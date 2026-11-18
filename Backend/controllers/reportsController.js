import { Router } from 'express';
import { getRouteHandlerChain } from './routeHandlers.js';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/http.js';

const router = Router();
router.use(requireRole('owner'));

const rows = async (sql, params = []) => (await pool.query(sql, params))[0];

// ?days=7|30|90  - sales count only orders that were served
router.get(
  '/summary',
  wrap(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

    const [totals] = await rows(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales, COALESCE(AVG(total), 0) AS average
       FROM orders WHERE status = 'served' AND served_at >= NOW() - INTERVAL ? DAY`,
      [days]
    );

    res.json({
      days,
      totals,
      daily: await rows(
        `SELECT DATE_FORMAT(served_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total) AS sales
         FROM orders WHERE status = 'served' AND served_at >= NOW() - INTERVAL ? DAY
         GROUP BY day ORDER BY day`,
        [days]
      ),
      by_type: await rows(
        `SELECT order_type, COUNT(*) AS orders, SUM(total) AS sales
         FROM orders WHERE status = 'served' AND served_at >= NOW() - INTERVAL ? DAY
         GROUP BY order_type ORDER BY sales DESC`,
        [days]
      ),
      top_items: await rows(
        `SELECT oi.item_name, SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.unit_price) AS sales
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'served' AND o.served_at >= NOW() - INTERVAL ? DAY
         GROUP BY oi.item_name ORDER BY quantity DESC LIMIT 8`,
        [days]
      ),
      order_status: await rows(
        'SELECT status, COUNT(*) AS count FROM orders WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY status',
        [days]
      ),
      stock_in: (
        await rows(
          "SELECT COUNT(*) AS count FROM stock_movements WHERE movement_type = 'in' AND created_at >= NOW() - INTERVAL ? DAY",
          [days]
        )
      )[0].count,
      stock_out_reasons: await rows(
        `SELECT reason, COUNT(*) AS count FROM stock_movements
         WHERE movement_type = 'out' AND created_at >= NOW() - INTERVAL ? DAY GROUP BY reason ORDER BY count DESC`,
        [days]
      ),
      low_stock: await rows(
        'SELECT id, name, unit, quantity, reorder_level FROM inventory_items WHERE quantity <= reorder_level ORDER BY name'
      ),
    });
  })
);

export default router;

export function getReportsHandlerChain(method, path) { return getRouteHandlerChain(router, method, path); }
