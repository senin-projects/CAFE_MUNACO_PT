import { Router } from 'express';
import { pool } from '../config/db.js';
import { wrap } from '../utils.js';

const router = Router();

router.post(
  '/read',
  wrap(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))].filter((id) => id.length > 0 && id.length <= 100).slice(0, 150) : [];
    if (!ids.length) return res.json({ ok: true });
    await pool.query(
      'INSERT INTO notification_reads (user_id, notification_key) VALUES ? ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
      [ids.map((id) => [req.user.id, id])]
    );
    res.json({ ok: true });
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const notes = [];
    const role = req.user.role;

    if (role === 'cashier') {
      const [orders] = await pool.query(
        "SELECT id, order_no, customer_name, ready_at FROM orders WHERE status = 'ready' ORDER BY ready_at DESC LIMIT 50"
      );
      orders.forEach((o) => notes.push({
        id: `ready-${o.id}`,
        title: `${o.order_no} is ready`,
        message: `${o.customer_name}'s order is ready to serve.`,
        to: `/orders/${o.id}`,
        created_at: o.ready_at,
      }));
    }

    if (role === 'kitchen') {
      const [orders] = await pool.query(
        "SELECT id, order_no, customer_name, sent_at FROM orders WHERE status = 'sent' ORDER BY sent_at ASC LIMIT 50"
      );
      orders.forEach((o) => notes.push({
        id: `sent-${o.id}`,
        title: `New ticket ${o.order_no}`,
        message: `${o.customer_name}'s order is waiting to be prepared.`,
        to: `/orders/${o.id}`,
        created_at: o.sent_at,
      }));
    }

    if (role === 'inventory' || role === 'owner') {
      const [items] = await pool.query(
        'SELECT id, name, quantity, reorder_level FROM inventory_items WHERE quantity <= reorder_level ORDER BY quantity ASC, name LIMIT 50'
      );
      items.forEach((item) => notes.push({
        id: `stock-${item.id}`,
        title: item.quantity <= 0 ? `${item.name} is out of stock` : `${item.name} is low`,
        message: `Stock is ${item.quantity}; reorder level is ${item.reorder_level}.`,
        to: '/inventory/low',
        created_at: null,
      }));
    }

    if (role === 'owner') {
      const [activity] = await pool.query(
        `SELECT a.id, a.action, a.details, a.created_at, u.full_name
         FROM activity_log a JOIN users u ON u.id = a.user_id
         WHERE a.created_at >= NOW() - INTERVAL 7 DAY
           AND a.action IN ('Account created','Account edited','Account activated','Account deactivated','Password reset',
             'Menu item added','Menu item edited','Menu item deleted','Menu item available','Menu item unavailable')
         ORDER BY a.created_at DESC LIMIT 50`
      );
      activity.forEach((entry) => {
        const menuAction = entry.action.startsWith('Menu item');
        notes.push({
          id: `activity-${entry.id}`,
          title: entry.action,
          message: `${entry.full_name}: ${entry.details || ''}`,
          to: menuAction ? '/menu-management' : '/users',
          created_at: entry.created_at,
        });
      });
    }

    notes.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (notes.length) {
      const [reads] = await pool.query(
        'SELECT notification_key FROM notification_reads WHERE user_id = ? AND notification_key IN (?)',
        [req.user.id, notes.map((note) => note.id)]
      );
      const readKeys = new Set(reads.map((row) => row.notification_key));
      notes.forEach((note) => { note.is_read = readKeys.has(note.id); });
    }
    res.json(notes);
  })
);

export default router;
