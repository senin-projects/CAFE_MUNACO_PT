import { Router } from 'express';
import { getRouteHandlerChain } from './routeHandlers.js';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/http.js';

const router = Router();
router.use(requireRole('owner'));

const rows = async (sql, params = []) => (await pool.query(sql, params))[0];

// Sales count only orders that were served.
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
      overview: (await rows(
        `SELECT COALESCE(SUM(CASE WHEN DATE(served_at) = CURDATE() THEN total ELSE 0 END), 0) AS sales_today,
                COALESCE(SUM(total), 0) AS total_revenue
         FROM orders WHERE status = 'served'`
      ))[0],
      daily: await rows(
        `SELECT DATE_FORMAT(served_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total) AS sales
         FROM orders WHERE status = 'served' AND served_at >= NOW() - INTERVAL ? DAY
         GROUP BY day ORDER BY day`,
        [days]
      ),
      top_items: await rows(
        `SELECT oi.item_name, SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.unit_price) AS sales
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'served' AND o.served_at >= NOW() - INTERVAL ? DAY
         GROUP BY oi.item_name ORDER BY quantity DESC LIMIT 8`,
        [days]
      ),
      by_category: await rows(
        `SELECT COALESCE(mi.category, 'Uncategorized') AS category,
                SUM(oi.quantity) AS quantity,
                SUM(oi.quantity * oi.unit_price) AS sales
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE o.status = 'served' AND o.served_at >= NOW() - INTERVAL ? DAY
         GROUP BY category ORDER BY sales DESC`,
        [days]
      ),
      monthly: await rows(
        `SELECT DATE_FORMAT(served_at, '%Y-%m') AS period, COUNT(*) AS orders, SUM(total) AS sales
         FROM orders WHERE status = 'served' AND served_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
         GROUP BY period ORDER BY period`
      ),
      yearly: await rows(
        `SELECT DATE_FORMAT(served_at, '%Y') AS period, COUNT(*) AS orders, SUM(total) AS sales
         FROM orders WHERE status = 'served' AND served_at >= DATE_SUB(CURDATE(), INTERVAL 4 YEAR)
         GROUP BY period ORDER BY period`
      ),
    });
  })
);

export default router;

export function getReportsHandlerChain(method, path) { return getRouteHandlerChain(router, method, path); }
