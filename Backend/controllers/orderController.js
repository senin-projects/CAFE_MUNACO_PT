import { Router } from 'express';
import { getRouteHandlerChain } from './routeHandlers.js';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError } from '../utils/http.js';
import { logActivity } from '../services/activityService.js';
import { ORDER_SELECT, loadOrderItems } from '../models/orderModel.js';
import {
  isKitchenVisibleStatus,
  KITCHEN_VISIBLE_STATUSES,
  ORDER_STATUSES,
  ORDER_TYPES,
  stripOrderPrices,
} from '../services/orderService.js';

const router = Router();

// ---------------------------------------------------------------- list
// ?status=sent,preparing  ?q=search  ?type=dine_in  ?items=1 (include item lines)  ?sort=oldest
router.get(
  '/',
  requireRole('cashier', 'kitchen', 'owner'),
  wrap(async (req, res) => {
    const where = [];
    const params = [];

    if (req.query.status) {
      const list = String(req.query.status).split(',').filter((s) => ORDER_STATUSES.includes(s));
      if (list.length) {
        where.push('o.status IN (?)');
        params.push(list);
      }
    }
    if (req.user.role === 'kitchen') {
      where.push('o.status IN (?)');
      params.push(KITCHEN_VISIBLE_STATUSES);
    }
    if (req.query.type && ORDER_TYPES.includes(req.query.type)) {
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
      const itemMap = await loadOrderItems(orders.map((o) => o.id));
      orders.forEach((o) => (o.items = itemMap.get(o.id) || []));
    }
    res.json(orders.map((o) => stripOrderPrices(o, req.user.role)));
  })
);

// ---------------------------------------------------------------- one order
router.get(
  '/:id',
  requireRole('cashier', 'kitchen', 'owner'),
  wrap(async (req, res) => {
    const [rows] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [req.params.id]);
    const order = rows[0];
    if (!order || (req.user.role === 'kitchen' && !isKitchenVisibleStatus(order.status))) {
      throw httpError(404, 'Order not found.');
    }
    order.items = (await loadOrderItems([order.id])).get(order.id) || [];
    const [[cancellation]] = await pool.query(
      `SELECT c.reason, c.payment_resolution, c.previous_status, c.created_at, u.full_name AS cancelled_by_name
       FROM order_cancellations c JOIN users u ON u.id = c.cancelled_by WHERE c.order_id = ?`,
      [order.id]
    );
    order.cancellation = cancellation || null;
    res.json(stripOrderPrices(order, req.user.role));
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

export default router;

// During modular routing, expose the existing handler chains so they are
// registered once under their module route files without copying logic.
export function getOrderHandlerChain(method, path) {
  return getRouteHandlerChain(router, method, path);
}
