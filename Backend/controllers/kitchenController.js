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
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT id, order_no, status FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
      const order = rows[0];
      if (!order) throw httpError(404, 'Order not found.');

      const allowedNext = getAllowedOrderTransition(req.user.role, order.status);
      if (!allowedNext || allowedNext !== next) {
        throw httpError(409, `Your role cannot change an order from "${order.status}" to "${next}".`);
      }

      if (next === 'served') {
        const [required] = await conn.query(
          `SELECT mii.ingredient_id, i.name, i.unit,
                  SUM(mii.quantity_required * oi.quantity) AS quantity_required
           FROM order_items oi
           JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
           JOIN inventory_items i ON i.id = mii.ingredient_id
           WHERE oi.order_id = ?
           GROUP BY mii.ingredient_id, i.name, i.unit
           ORDER BY mii.ingredient_id`,
          [order.id]
        );
        if (required.length) {
          const ids = required.map((item) => item.ingredient_id);
          const [stockRows] = await conn.query(
            'SELECT id, name, unit, quantity FROM inventory_items WHERE id IN (?) ORDER BY id FOR UPDATE',
            [ids]
          );
          const stockById = new Map(stockRows.map((item) => [item.id, item]));
          for (const ingredient of required) {
            const stock = stockById.get(ingredient.ingredient_id);
            if (!stock || stock.unit !== ingredient.unit) {
              throw httpError(409, `The inventory unit for ${ingredient.name} no longer matches its recipe. Update the recipe before serving this order.`);
            }
            if (Number(stock.quantity) < Number(ingredient.quantity_required)) {
              throw httpError(
                409,
                `Not enough ${stock.name} to fulfill this order. Required: ${ingredient.quantity_required} ${stock.unit}; available: ${stock.quantity} ${stock.unit}.`
              );
            }
          }

          for (const ingredient of required) {
            const stock = stockById.get(ingredient.ingredient_id);
            const used = Number(Number(ingredient.quantity_required).toFixed(2));
            const balance = Number((Number(stock.quantity) - used).toFixed(2));
            await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [balance, stock.id]);
            await conn.query(
              "INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, note, created_by) VALUES (?, 'out', ?, ?, 'Order served', ?, ?)",
              [stock.id, used, balance, order.order_no, req.user.id]
            );
            await logActivity(req.user.id, 'Stock out', `${stock.name}: ${used} ${stock.unit} used for ${order.order_no}`, conn);
          }
        }
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
