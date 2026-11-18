import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError } from '../utils/http.js';
import { logActivity } from '../services/activityService.js';
import { getAllowedOrderTransition } from '../services/orderService.js';
import { getRouteHandlerChain } from './routeHandlers.js';

const router = Router();

// ---------------------------------------------------------------- status (kitchen: preparing/ready, cashier: served)
router.patch(
  '/:id/status',
  requireRole('cashier', 'kitchen'),
  wrap(async (req, res) => {
    const next = req.body?.status;
    const [rows] = await pool.query('SELECT id, order_no, status FROM orders WHERE id = ?', [req.params.id]);
    const order = rows[0];
    if (!order) throw httpError(404, 'Order not found.');

    const allowedNext = getAllowedOrderTransition(req.user.role, order.status);
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
export const updateOrderStatusHandlers = getRouteHandlerChain(router, 'patch', '/:id/status');
