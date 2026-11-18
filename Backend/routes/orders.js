import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError, isBlank } from '../utils/http.js';
import { logActivity } from '../services/activityService.js';

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
  const { total, payment_status, payment_method, paid_at, ...rest } = order;
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
async function validateOrder(body, preservedUnavailable = new Map()) {
  const customer_name = String(body.customer_name || '').trim();
  if (!customer_name) throw httpError(400, 'Enter the customer name.');

  const order_type = body.order_type;
  if (!TYPES.includes(order_type)) throw httpError(400, 'Choose an order type.');

  let scheduled_at = null;
  if (NEEDS_SCHEDULE.includes(order_type)) {
    if (isBlank(body.scheduled_at)) throw httpError(400, 'Set the date and time for this reservation, event or advance order.');
    const raw = String(body.scheduled_at);
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
    if (!match) throw httpError(400, 'Enter a valid scheduled date and time.');
    const [y, mo, d, h, mi] = match.slice(1).map(Number);
    const scheduledDate = new Date(y, mo - 1, d, h, mi);
    if (scheduledDate.getFullYear() !== y || scheduledDate.getMonth() !== mo - 1 || scheduledDate.getDate() !== d || scheduledDate.getHours() !== h || scheduledDate.getMinutes() !== mi) {
      throw httpError(400, 'Enter a valid scheduled date and time.');
    }
    if (scheduledDate <= new Date()) throw httpError(400, 'Scheduled date and time must be in the future.');
    scheduled_at = raw.replace('T', ' ');
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
    const notes = isBlank(l.notes) ? null : String(l.notes).trim().slice(0, 255);
    if (!m) {
      const preserved = preservedUnavailable.get(`row:${Number(l.existing_item_id)}`);
      if (!preserved || preserved.menu_item_id !== null || preserved.quantity !== quantity || (preserved.notes || null) !== notes) {
        throw httpError(400, 'One of the items is not on the menu. Remove it or replace it before saving.');
      }
      return preserved;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw httpError(400, `Quantity for ${m.name} must be a whole number from 1 to 999.`);
    }
    if (!m.is_available) {
      const preserved = preservedUnavailable.get(m.id);
      if (!preserved || preserved.quantity !== quantity || (preserved.notes || null) !== notes) {
        throw httpError(400, `${m.name} is no longer available. Remove it or replace it before saving.`);
      }
      return { ...preserved, menu_item_id: m.id };
    }
    return {
      menu_item_id: m.id,
      item_name: m.name,
      quantity,
      unit_price: m.price,
      notes,
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
    const [[cancellation]] = await pool.query(
      `SELECT c.reason, c.payment_resolution, c.previous_status, c.created_at, u.full_name AS cancelled_by_name
       FROM order_cancellations c JOIN users u ON u.id = c.cancelled_by WHERE c.order_id = ?`,
      [order.id]
    );
    order.cancellation = cancellation || null;
    res.json(stripPrices(order, req.user.role));
  })
);

// ---------------------------------------------------------------- create (cashier)
router.post(
  '/',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const { header, items, total } = await validateOrder(req.body || {});
    const sendNow = req.body?.send === true;
    const paymentMethod = String(req.body?.payment_method || '');
    if (sendNow && !['cash', 'card', 'e_wallet'].includes(paymentMethod)) {
      throw httpError(400, 'Choose a payment method before sending the order to the kitchen.');
    }
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
          payment_status: sendNow ? 'paid' : 'unpaid',
          payment_method: sendNow ? paymentMethod : null,
          paid_at: sendNow ? new Date() : null,
          created_by: req.user.id,
        },
      ]);
      const id = result.insertId;
      const orderNo = `MUN-${String(id).padStart(5, '0')}`;
      await conn.query('UPDATE orders SET order_no = ? WHERE id = ?', [orderNo, id]);
      await writeItems(conn, id, items);
      await logActivity(req.user.id, sendNow ? 'Payment recorded' : 'Order created', sendNow ? `${orderNo} paid by ${paymentMethod.replace('_', '-')}` : `${orderNo} for ${header.customer_name} saved as draft`, conn);
      if (sendNow) await logActivity(req.user.id, 'Order sent', `${orderNo} sent to kitchen`, conn);
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
    if (req.body?.send === true) throw httpError(409, 'Record payment from the order details before sending it to the kitchen.');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT id, order_no, status, payment_status FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!rows.length) throw httpError(404, 'Order not found.');
      if (rows[0].status !== 'pending') {
        throw httpError(409, 'This order was already sent to the kitchen, so it can no longer be edited.');
      }
      if (rows[0].payment_status === 'paid') throw httpError(409, 'This order is paid and locked. Contact the owner if a correction is needed.');
      const [oldItems] = await conn.query('SELECT id, menu_item_id, item_name, quantity, unit_price, notes FROM order_items WHERE order_id = ?', [rows[0].id]);
      const preservedUnavailable = new Map();
      oldItems.forEach((i) => {
        if (i.menu_item_id !== null) preservedUnavailable.set(i.menu_item_id, i);
        else preservedUnavailable.set(`row:${i.id}`, i);
      });
      const { header, items, total } = await validateOrder(req.body || {}, preservedUnavailable);
      await conn.query('UPDATE orders SET ?, total = ?, status = ?, sent_at = ? WHERE id = ?', [
        header,
        total,
        'pending',
        null,
        rows[0].id,
      ]);
      await writeItems(conn, rows[0].id, items);
      await logActivity(req.user.id, 'Order edited', `${rows[0].order_no} edited`, conn);
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

// ---------------------------------------------------------------- payment (cashier)
router.post(
  '/:id/payment',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const method = String(req.body?.method || '');
    if (!['cash', 'card', 'e_wallet'].includes(method)) throw httpError(400, 'Choose cash, card, or e-wallet.');
    const [result] = await pool.query(
      "UPDATE orders SET payment_status = 'paid', payment_method = ?, paid_at = NOW() WHERE id = ? AND status = 'pending' AND payment_status = 'unpaid'",
      [method, req.params.id]
    );
    if (!result.affectedRows) throw httpError(409, 'Payment must be recorded once while the order is still a draft.');
    const [[order]] = await pool.query('SELECT order_no FROM orders WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Payment recorded', `${order.order_no} paid by ${method.replace('_', '-')}`);
    res.json({ ok: true, payment_status: 'paid', payment_method: method });
  })
);

// ---------------------------------------------------------------- send to kitchen (cashier)
router.post(
  '/:id/send',
  requireRole('cashier'),
  wrap(async (req, res) => {
    const [result] = await pool.query("UPDATE orders SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'pending' AND payment_status = 'paid'", [req.params.id]);
    if (!result.affectedRows) throw httpError(409, 'Record payment before sending this order to the kitchen.');
    const [[order]] = await pool.query('SELECT order_no FROM orders WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Order sent', `${order.order_no} sent to kitchen`);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- cancel / void
router.post(
  '/:id/cancel',
  requireRole('cashier', 'owner'),
  wrap(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT id, order_no, status, payment_status FROM orders WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      const order = rows[0];
      if (!order) throw httpError(404, 'Order not found.');
      if (!['pending', 'sent', 'preparing', 'ready'].includes(order.status)) {
        throw httpError(409, 'Served or already cancelled orders cannot be cancelled.');
      }

      const ownerApproved = req.user.role === 'owner';
      const cashierDraft = req.user.role === 'cashier' && order.status === 'pending' && order.payment_status === 'unpaid';
      if (!ownerApproved && !cashierDraft) {
        throw httpError(403, 'Only an owner can cancel a paid or kitchen-sent order.');
      }

      const reason = ownerApproved ? String(req.body?.reason || '').trim() : 'Cancelled by cashier before payment.';
      if (ownerApproved && !reason) throw httpError(400, 'Enter a reason for cancelling this order.');
      if (reason.length > 500) throw httpError(400, 'The cancellation reason must be 500 characters or fewer.');

      const paymentResolution = order.payment_status === 'paid'
        ? String(req.body?.payment_resolution || '')
        : 'not_applicable';
      if (order.payment_status === 'paid' && !['refunded', 'not_refunded'].includes(paymentResolution)) {
        throw httpError(400, 'Choose whether the customer was refunded.');
      }

      await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
      await conn.query(
        'INSERT INTO order_cancellations (order_id, cancelled_by, previous_status, reason, payment_resolution) VALUES (?, ?, ?, ?, ?)',
        [order.id, req.user.id, order.status, reason, paymentResolution]
      );
      await logActivity(
        req.user.id,
        ownerApproved ? 'Order voided' : 'Order cancelled',
        `${order.order_no}: ${reason}${paymentResolution === 'refunded' ? ' (refunded)' : paymentResolution === 'not_refunded' ? ' (not refunded)' : ''}`,
        conn
      );
      await conn.commit();
      res.json({ ok: true, status: 'cancelled', payment_resolution: paymentResolution });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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
