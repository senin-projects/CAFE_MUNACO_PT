import { Router } from 'express';
import { getRouteHandlerChain } from './routeHandlers.js';
import { pool } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError } from '../utils/http.js';
import { logActivity } from '../services/activityService.js';

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

function validateRecipe(ingredients) {
  if (!Array.isArray(ingredients)) throw httpError(400, 'Ingredients must be a list.');
  if (ingredients.length > 200) throw httpError(400, 'A menu item can have at most 200 ingredients.');
  const seen = new Set();
  return ingredients.map((ingredient) => {
    const ingredient_id = Number(ingredient?.ingredient_id);
    const quantity_required = Number(ingredient?.quantity_required);
    const unit_of_measurement = String(ingredient?.unit_of_measurement || '').trim();
    if (!Number.isInteger(ingredient_id) || ingredient_id < 1) throw httpError(400, 'Choose a valid inventory ingredient.');
    if (seen.has(ingredient_id)) throw httpError(400, 'An ingredient can only be assigned once per menu item.');
    seen.add(ingredient_id);
    if (!Number.isFinite(quantity_required) || quantity_required <= 0 || quantity_required > 99999999.99 ||
      Math.round(quantity_required * 100) / 100 !== quantity_required) {
      throw httpError(400, 'Ingredient quantities must be positive and have at most two decimal places.');
    }
    if (!unit_of_measurement || unit_of_measurement.length > 20) {
      throw httpError(400, 'Choose a valid unit of measurement for each ingredient.');
    }
    return { ingredient_id, quantity_required, unit_of_measurement };
  });
}

async function saveRecipe(conn, menuItemId, ingredients) {
  const ids = ingredients.map((ingredient) => ingredient.ingredient_id);
  const inventory = ids.length
    ? (await conn.query('SELECT id, unit FROM inventory_items WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]))[0]
    : [];
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  if (inventory.length !== ids.length) throw httpError(400, 'One or more selected ingredients no longer exist in inventory.');
  for (const ingredient of ingredients) {
    const item = inventoryById.get(ingredient.ingredient_id);
    if (ingredient.unit_of_measurement !== item.unit) {
      throw httpError(409, `The unit for inventory ingredient ${ingredient.ingredient_id} changed. Refresh and try again.`);
    }
  }

  await conn.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [menuItemId]);
  if (ingredients.length) {
    await conn.query(
      'INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required, unit_of_measurement) VALUES ?',
      [ingredients.map((ingredient) => [
        menuItemId,
        ingredient.ingredient_id,
        ingredient.quantity_required,
        ingredient.unit_of_measurement,
      ])]
    );
  }
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

router.get(
  '/:id',
  requireRole('owner', 'kitchen'),
  wrap(async (req, res) => {
    const [[item]] = await pool.query(
      'SELECT id, name, category, price, is_available FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    if (!item) throw httpError(404, 'Menu item not found.');
    const [ingredients] = await pool.query(
      `SELECT mii.ingredient_id, i.name, i.category, i.quantity AS current_stock,
              i.unit AS inventory_unit, mii.quantity_required, mii.unit_of_measurement
       FROM menu_item_ingredients mii
       JOIN inventory_items i ON i.id = mii.ingredient_id
       WHERE mii.menu_item_id = ? ORDER BY i.name`,
      [req.params.id]
    );
    res.json({ ...item, ingredients });
  })
);

router.post(
  '/',
  requireRole('owner', 'kitchen'),
  wrap(async (req, res) => {
    const { name, category, price, is_available } = validateMenuItem(req.body);
    const ingredients = validateRecipe(req.body?.ingredients ?? []);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'INSERT INTO menu_items (name, category, price, is_available) VALUES (?, ?, ?, ?)',
        [name, category, price, is_available ? 1 : 0]
      );
      await saveRecipe(conn, result.insertId, ingredients);
      await logActivity(req.user.id, 'Menu item added', `${name} added to ${category}`, conn);
      await conn.commit();
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.put(
  '/:id',
  requireRole('owner', 'kitchen'),
  wrap(async (req, res) => {
    const { name, category, price, is_available } = validateMenuItem(req.body);
    const ingredients = req.body?.ingredients === undefined ? null : validateRecipe(req.body.ingredients);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[existing]] = await conn.query('SELECT id FROM menu_items WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!existing) throw httpError(404, 'Menu item not found.');
      await conn.query(
        'UPDATE menu_items SET name = ?, category = ?, price = ?, is_available = ? WHERE id = ?',
        [name, category, price, is_available ? 1 : 0, req.params.id]
      );
      if (ingredients) await saveRecipe(conn, req.params.id, ingredients);
      await logActivity(req.user.id, 'Menu item edited', `${name} updated`, conn);
      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.patch(
  '/:id/availability',
  requireRole('owner', 'kitchen'),
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
  requireRole('owner', 'kitchen'),
  wrap(async (req, res) => {
    const [[item]] = await pool.query('SELECT name FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) throw httpError(404, 'Menu item not found.');
    await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Menu item deleted', item.name);
    res.json({ ok: true });
  })
);

export default router;

export function getMenuHandlerChain(method, path) { return getRouteHandlerChain(router, method, path); }
