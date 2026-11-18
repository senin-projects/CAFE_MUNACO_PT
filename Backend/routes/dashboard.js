import { Router } from 'express';
import { pool } from '../config/db.js';
import { wrap } from '../utils/http.js';

const router = Router();

const one = async (sql, params = []) => {
  const [[row]] = await pool.query(sql, params);
  return Object.values(row)[0];
};
const many = async (sql, params = []) => (await pool.query(sql, params))[0];

const LOW = 'quantity <= reorder_level';

// One endpoint, different numbers for each role
router.get(
  '/',
  wrap(async (req, res) => {
    const { role, id } = req.user;

    if (role === 'cashier') {
      return res.json({
        stats: {
          today_orders: await one("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE() AND status <> 'cancelled'"),
          drafts: await one("SELECT COUNT(*) FROM orders WHERE status = 'pending'"),
          in_kitchen: await one("SELECT COUNT(*) FROM orders WHERE status IN ('sent','preparing')"),
          ready: await one("SELECT COUNT(*) FROM orders WHERE status = 'ready'"),
        },
        ready_orders: await many(
          "SELECT id, order_no, customer_name, table_no, order_type, ready_at FROM orders WHERE status = 'ready' ORDER BY ready_at"
        ),
        recent_orders: await many(
          'SELECT id, order_no, customer_name, order_type, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 6'
        ),
      });
    }

    if (role === 'kitchen') {
      return res.json({
        stats: {
          incoming: await one("SELECT COUNT(*) FROM orders WHERE status = 'sent'"),
          preparing: await one("SELECT COUNT(*) FROM orders WHERE status = 'preparing'"),
          ready: await one("SELECT COUNT(*) FROM orders WHERE status = 'ready'"),
          served_today: await one("SELECT COUNT(*) FROM orders WHERE status = 'served' AND DATE(served_at) = CURDATE()"),
        },
        waiting: await many(
          "SELECT id, order_no, customer_name, order_type, table_no, sent_at, special_requests FROM orders WHERE status = 'sent' ORDER BY sent_at LIMIT 6"
        ),
      });
    }

    if (role === 'inventory') {
      return res.json({
        stats: {
          total_items: await one('SELECT COUNT(*) FROM inventory_items'),
          low_stock: await one(`SELECT COUNT(*) FROM inventory_items WHERE ${LOW} AND quantity > 0`),
          out_of_stock: await one('SELECT COUNT(*) FROM inventory_items WHERE quantity <= 0'),
          movements_today: await one('SELECT COUNT(*) FROM stock_movements WHERE DATE(created_at) = CURDATE()'),
        },
        low_items: await many(`SELECT id, name, unit, quantity, reorder_level, is_fresh FROM inventory_items WHERE ${LOW} ORDER BY quantity / NULLIF(reorder_level, 0) LIMIT 6`),
        recent_movements: await many(
          `SELECT m.id, m.movement_type, m.quantity, m.created_at, i.name AS item_name, i.unit
           FROM stock_movements m JOIN inventory_items i ON i.id = m.item_id ORDER BY m.created_at DESC, m.id DESC LIMIT 6`
        ),
      });
    }

    // owner
    return res.json({
      stats: {
        today_sales: await one("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'served' AND DATE(served_at) = CURDATE()"),
        today_orders: await one("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE() AND status <> 'cancelled'"),
        active_orders: await one("SELECT COUNT(*) FROM orders WHERE status IN ('sent','preparing','ready')"),
        low_stock: await one(`SELECT COUNT(*) FROM inventory_items WHERE ${LOW}`),
        active_staff: await one("SELECT COUNT(*) FROM users WHERE is_active = 1 AND role <> 'owner'"),
      },
      order_status: await many("SELECT status, COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE() GROUP BY status"),
      low_items: await many(`SELECT id, name, unit, quantity, reorder_level FROM inventory_items WHERE ${LOW} ORDER BY quantity / NULLIF(reorder_level, 0) LIMIT 5`),
      activity: await many(
        `SELECT a.id, a.action, a.details, a.created_at, u.full_name, u.role
         FROM activity_log a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC, a.id DESC LIMIT 10`
      ),
    });
  })
);

export default router;
