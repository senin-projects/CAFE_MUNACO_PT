import { Router } from 'express';
import { pool } from '../../../config/db.js';
import { requireRole } from '../../../middleware/auth.js';
import { wrap, httpError } from '../../../utils/http.js';
import { logActivity } from '../../../services/activityService.js';
import { getAllowedOrderTransition } from '../../../services/orderService.js';
import { getRouteHandlerChain } from '../../../controllers/routeHandlers.js';
import { deductOrderIngredients } from '../../../services/orderInventoryService.js';

const router = Router();

// [WBS 2.1.2] Implement order preparation status updates.
// [WBS 1.2.2] Implement serving and cancelling of orders.
// ---------------------------------------------------------------- status (kitchen: preparing/ready, cashier: served)
router.patch(
  '/:id/status',
  requireRole('cashier', 'kitchen'),
  wrap(async (req, res) => {
    const next = req.body?.status;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT id, order_no, status, ingredients_deducted_at FROM orders WHERE id = ? FOR UPDATE',
        [req.params.id],
      );
      const order = rows[0];
      if (!order) throw httpError(404, 'Order not found.');

      const allowedNext = getAllowedOrderTransition(req.user.role, order.status);
      if (!allowedNext || allowedNext !== next) {
        throw httpError(409, `Your role cannot change an order from "${order.status}" to "${next}".`);
      }

      if (['preparing', 'ready', 'served'].includes(next)) {
        await deductOrderIngredients(conn, order, req.user.id);
      }

      const stamp = { preparing: 'preparing_at', ready: 'ready_at', served: 'served_at' }[next];
      const extra = next === 'preparing' ? ', prepared_by = ?' : '';
      const params = next === 'preparing' ? [next, req.user.id, order.id, order.status] : [next, order.id, order.status];
      const [result] = await conn.query(
        `UPDATE orders SET status = ?, ${stamp} = NOW()${extra} WHERE id = ? AND status = ?`,
        params
      );
      if (!result.affectedRows) throw httpError(409, 'Someone else just updated this order. Refresh and try again.');

      await logActivity(req.user.id, 'Order status', `${order.order_no} marked as ${next}`, conn);
      await conn.commit();
      res.json({ ok: true, status: next });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

export default router;
export const updateOrderStatusHandlers = getRouteHandlerChain(router, 'patch', '/:id/status');
