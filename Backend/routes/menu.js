import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError, logActivity } from '../utils.js';

const router = Router();

function validateMenuItem(body = {}) {
  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  const price = Number(body.price);
  const is_available = body.is_available === undefined ? true : body.is_available;
  if (name.length < 2 || name.length > 100) throw httpError(400, 'Item name must be 2 to 100 characters.');
  if (category.length < 2 || category.length > 50) throw httpError(400, 'Category must be 2 to 50 characters.');
  if (!Number.isFinite(price) || price < 0 || price > 99999999.99 || Math.round(price * 100) / 100 !== price) {
    throw httpError(400, 'Enter a valid price with up to two decimal places.');
  }
  if (typeof is_available !== 'boolean') throw httpError(400, 'Choose whether the item is available.');
  return { name, category, price, is_available };
}

router.get(
  '/',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, category, price, is_available FROM menu_items ORDER BY category, name'
    );
    res.json(rows);
  })
);

router.post(
  '/',
  requireRole('owner'),
  wrap(async (req, res) => {
    const { name, category, price, is_available } = validateMenuItem(req.body);
    const [result] = await pool.query(
      'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, ?)',
      [name, category, price, is_available ? 1 : 0]
    );
    await logActivity(req.user.id, 'Menu item added', `${name} added to ${category}`);
    res.status(201).json({ id: result.insertId });
  })
);

router.put(
  '/:id',
  requireRole('owner'),
  wrap(async (req, res) => {
    const { name, category, price, is_available } = validateMenuItem(req.body);
    const [[existing]] = await pool.query('SELECT id FROM menu_items WHERE id = ?', [req.params.id]);
    if (!existing) throw httpError(404, 'Menu item not found.');
    await pool.query(
      'UPDATE menu_items SET name = ?, category = ?, price = ?, is_available = ? WHERE id = ?',
      [name, category, price, is_available ? 1 : 0, req.params.id]
    );
    await logActivity(req.user.id, 'Menu item edited', `${name} updated`);
    res.json({ ok: true });
  })
);

router.patch(
  '/:id/availability',
  requireRole('owner'),
  wrap(async (req, res) => {
    if (typeof req.body?.is_available !== 'boolean') throw httpError(400, 'Choose whether the item is available.');
    await pool.query('UPDATE menu_items SET is_available = ? WHERE id = ?', [req.body.is_available ? 1 : 0, req.params.id]);
    const [[item]] = await pool.query('SELECT name FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) throw httpError(404, 'Menu item not found.');
    await logActivity(req.user.id, req.body.is_available ? 'Menu item available' : 'Menu item unavailable', item.name);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  requireRole('owner'),
  wrap(async (req, res) => {
    const [[item]] = await pool.query('SELECT name FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) throw httpError(404, 'Menu item not found.');
    await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Menu item deleted', item.name);
    res.json({ ok: true });
  })
);

export default router;
