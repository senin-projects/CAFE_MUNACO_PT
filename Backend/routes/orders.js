import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError, isBlank, logActivity } from '../utils.js';

const router = Router();

const STATUSES = ['pending', 'sent', 'preparing', 'ready', 'served', 'cancelled'];
const TYPES = ['dine_in', 'takeout', 'reservation', 'buffet', 'birthday', 'special_event', 'advance_order'];
const NEEDS_SCHEDULE = ['reservation', 'buffet', 'birthday', 'special_event', 'advance_order'];
const KITCHEN_CAN_SEE = ['sent', 'preparing', 'ready', 'served'];

// Who may move an order from one status to the next
const TRANSITIONS = {
  kitchen: { sent: 'preparing', preparing: 'ready' },
  cashier: { ready: 'served' },
};

// Kitchen staff must never see prices or totals
function stripPrices(order, role) {
  if (role !== 'kitchen') return order;
  const { total, ...rest } = order;
  if (rest.items) rest.items = rest.items.map(({ unit_price, ...item }) => item);
  return rest;
}

async function loadItems(orderIds) {
  if (!orderIds.length) return new Map();
  const [rows] = await pool.query(
    'SELECT id, order_id, menu_item_id, item_name, quantity, unit_price, notes FROM order_items WHERE order_id IN (?) ORDER BY id',
    [orderIds]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.order_id)) map.set(row.order_id, []);
    map.get(row.order_id).push(row);
  }
  return map;
}

const ORDER_SELECT = `
  SELECT o.*, cu.full_name AS created_by_name, ku.full_name AS prepared_by_name,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM orders o
  JOIN users cu ON cu.id = o.created_by
  LEFT JOIN users ku ON ku.id = o.prepared_by`;

// Reads the form, checks it, and rebuilds the item lines using the real menu prices
async function validateOrder(body) {
  const customer_name = String(body.customer_name || '').trim();
  if (!customer_name) throw httpError(400, 'Enter the customer name.');

  const order_type = body.order_type;
  if (!TYPES.includes(order_type)) throw httpError(400, 'Choose an order type.');

  let scheduled_at = null;
  if (NEEDS_SCHEDULE.includes(order_type)) {
    if (isBlank(body.scheduled_at)) throw httpError(400, 'Set the date and time for this reservation, event or advance order.');
    scheduled_at = String(body.scheduled_at).replace('T', ' ');
  }

  const guests = isBlank(body.guests) ? null : Number(body.guests);
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 500)) {
    throw httpError(400, 'Number of guests must be a whole number from 1 to 500.');
  }

  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length) throw httpError(400, 'Add at least one item to the order.');

  const ids = lines.map((l) => Number(l.menu_item_id));
  const [menu] = await pool.query('SELECT id, name, price, is_available FROM menu_items WHERE id IN (?)', [ids]);
  const menuById = new Map(menu.map((m) => [m.id, m]));

  const items = lines.map((l) => {
    const m = menuById.get(Number(l.menu_item_id));
    const quantity = Number(l.quantity);
    if (!m) throw httpError(400, 'One of the items is not on the menu.');
    if (!m.is_available) throw httpError(400, `${m.name} is not available right now.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw httpError(400, `Quantity for ${m.name} must be a whole number from 1 to 999.`);
    }
    return {
      menu_item_id: m.id,
      item_name: m.name,
      quantity,
      unit_price: m.price,
      notes: isBlank(l.notes) ? null : String(l.notes).trim().slice(0, 255),
    };
  });

  return {
    header: {
      customer_name,
      order_type,
      table_no: isBlank(body.table_no) ? null : String(body.table_no).trim().slice(0, 30),
      guests,
      scheduled_at,
      special_requests: isBlank(body.special_requests) ? null : String(body.special_requests).trim(),
    },
    items,
    total: items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
  };
}

async function writeItems(conn, orderId, items) {
  await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await conn.query('INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, notes) VALUES ?', [
    items.map((i) => [orderId, i.menu_item_id, i.item_name, i.quantity, i.unit_price, i.notes]),
  ]);
}

// ---------------------------------------------------------------- list
// ?status=sent,preparing  ?q=search  ?type=dine_in  ?items=1 (include item lines)  ?sort=oldest
router.get(
  '/',
  requireRole('cashier', 'kitchen', 'owner'),
  wrap(async (req, res) => {
    const where = [];
    const params = [];

    if (req.query.status) {
      const list = String(req.query.status).split(',').filter((s) => STATUSES.includes(s));
      if (list.length) {
        where.push('o.status IN (?)');
        params.push(list);
      }
    }
    if (req.user.role === 'kitchen') {
      where.push('o.status IN (?)');
      params.push(KITCHEN_CAN_SEE);
    }
    if (req.query.type && TYPES.includes(req.query.type)) {
      where.push('o.order_type = ?');
      params.push(req.query.type);
    }
    if (req.query.q) {
      where.push('(o.order_no LIKE ? OR o.customer_name LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }

    const direction = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
    const [orders] = await pool.query(
      `${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY COALESCE(o.sent_at, o.created_at) ${direction}, o.id ${direction} LIMIT 300`,
      params
    );

    if (req.query.items === '1') {
      const itemMap = await loadItems(orders.map((o) => o.id));
      orders.forEach((o) => (o.items = itemMap.get(o.id) || []));
    }
    res.json(orders.map((o) => stripPrices(o, req.user.role)));
  })
);

// ---------------------------------------------------------------- one order
router.get(
  '/:id',
  requireRole('cashier', 'kitchen', 'owner'),
  wrap(async (req, res) => {
    const [rows] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [req.params.id]);
    const order = rows[0];
    if (!order || (req.user.role === 'kitchen' && !KITCHEN_CAN_SEE.includes(order.status))) {
      throw httpError(404, 'Order not found.');
    }
    order.items = (await loadItems([order.id])).get(order.id) || [];
    res.json(stripPrices(order, req.user.role));
  })
);

// ---------------------------------------------------------------- create (cashier)
router.post(
  '/',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const { header, items, total } = await validateOrder(req.body || {});
    const sendNow = req.body.send === true;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query('INSERT INTO orders SET ?', [
        {
          ...header,
          order_no: `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          total,
          status: sendNow ? 'sent' : 'pending',
          sent_at: sendNow ? new Date() : null,
          created_by: req.user.id,
        },
      ]);
      const id = result.insertId;
      const orderNo = `MUN-${String(id).padStart(5, '0')}`;
      await conn.query('UPDATE orders SET order_no = ? WHERE id = ?', [orderNo, id]);
      await writeItems(conn, id, items);
      await logActivity(req.user.id, sendNow ? 'Order sent' : 'Order created', `${orderNo} for ${header.customer_name}${sendNow ? ' sent to kitchen' : ' saved as draft'}`, conn);
      await conn.commit();
      res.status(201).json({ id, order_no: orderNo });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ---------------------------------------------------------------- edit (cashier, only before it is sent)
router.put(
  '/:id',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const { header, items, total } = await validateOrder(req.body || {});
    const sendNow = req.body.send === true;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT id, order_no, status FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!rows.length) throw httpError(404, 'Order not found.');
      if (rows[0].status !== 'pending') {
        throw httpError(409, 'This order was already sent to the kitchen, so it can no longer be edited.');
      }
      await conn.query('UPDATE orders SET ?, total = ?, status = ?, sent_at = ? WHERE id = ?', [
        header,
        total,
        sendNow ? 'sent' : 'pending',
        sendNow ? new Date() : null,
        rows[0].id,
      ]);
      await writeItems(conn, rows[0].id, items);
      await logActivity(req.user.id, sendNow ? 'Order sent' : 'Order edited', `${rows[0].order_no} ${sendNow ? 'sent to kitchen' : 'edited'}`, conn);
      await conn.commit();
      res.json({ id: rows[0].id, order_no: rows[0].order_no });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ---------------------------------------------------------------- send to kitchen (cashier)
router.post(
  '/:id/send',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const [result] = await pool.query("UPDATE orders SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'pending'", [req.params.id]);
    if (!result.affectedRows) throw httpError(409, 'This order was already sent or no longer exists.');
    const [[order]] = await pool.query('SELECT order_no FROM orders WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Order sent', `${order.order_no} sent to kitchen`);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- cancel (cashier, only before it is sent)
router.post(
  '/:id/cancel',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const [result] = await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [req.params.id]);
    if (!result.affectedRows) throw httpError(409, 'Only orders that are not yet sent can be cancelled.');
    const [[order]] = await pool.query('SELECT order_no FROM orders WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Order cancelled', `${order.order_no} cancelled`);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- status (kitchen: preparing/ready, cashier: served)
router.patch(
  '/:id/status',
  requireRole('cashier', 'kitchen'),
  wrap(async (req, res) => {
    const next = req.body?.status;
    const [rows] = await pool.query('SELECT id, order_no, status FROM orders WHERE id = ?', [req.params.id]);
    const order = rows[0];
    if (!order) throw httpError(404, 'Order not found.');

    const allowedNext = TRANSITIONS[req.user.role]?.[order.status];
    if (!allowedNext || allowedNext !== next) {
      throw httpError(409, `Your role cannot change an order from "${order.status}" to "${next}".`);
    }

    const stamp = { preparing: 'preparing_at', ready: 'ready_at', served: 'served_at' }[next];
    const extra = next === 'preparing' ? ', prepared_by = ?' : '';
    const params = next === 'preparing' ? [next, req.user.id, order.id, order.status] : [next, order.id, order.status];
    // "AND status = ?" makes sure two people cannot move the same order at once
    const [result] = await pool.query(`UPDATE orders SET status = ?, ${stamp} = NOW()${extra} WHERE id = ? AND status = ?`, params);
    if (!result.affectedRows) throw httpError(409, 'Someone else just updated this order. Refresh and try again.');

    await logActivity(req.user.id, 'Order status', `${order.order_no} marked as ${next}`);
    res.json({ ok: true, status: next });
  })
);

export default router;
