import { Router } from 'express';
import { pool } from '../config/db.js';
import { wrap } from '../utils.js';

const router = Router();

router.get(
  '/',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, category, price, is_available FROM menu_items ORDER BY category, name'
    );
    res.json(rows);
  })
);

export default router;
