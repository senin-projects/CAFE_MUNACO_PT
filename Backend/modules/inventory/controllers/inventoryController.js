import { Router } from 'express';
import { getRouteHandlerChain } from '../../../controllers/routeHandlers.js';
import { pool } from '../../../config/db.js';
import { requireRole } from '../../../middleware/auth.js';
import { wrap, httpError, isBlank } from '../../../utils/http.js';
import { logActivity } from '../../../services/activityService.js';
import { makeStockedMenuItemsAvailable } from '../../../services/orderInventoryService.js';

const router = Router();

const CATEGORIES = ['Seafood', 'Meat', 'Vegetables', 'Dairy', 'Dry Goods', 'Beverages', 'Other'];
// Owner read access serves the shared overview/history workflow in WBS 4.3.2.
const READERS = ['inventory', 'owner', 'kitchen'];

const num = (v, label) => {
  const n = Number(v);
  if (isBlank(v) || !Number.isFinite(n) || n < 0) throw httpError(400, `${label} must be a number, zero or higher.`);
  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
};

const status = (item) => (item.quantity <= 0 ? 'out' : item.quantity <= item.reorder_level ? 'low' : 'ok');

// [WBS 3.1.1] Implement inventory item create, update, and delete.
// ---------------------------------------------------------------- list  (?q= ?category= ?fresh=1 ?low=1)
router.get(
  '/',
  requireRole(...READERS),
  wrap(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q) {
      where.push('name LIKE ?');
      params.push(`%${req.query.q}%`);
    }
    if (CATEGORIES.includes(req.query.category)) {
      where.push('category = ?');
      params.push(req.query.category);
    }
    if (req.query.fresh === '1') where.push('is_fresh = 1');
    if (req.query.low === '1') where.push('quantity <= reorder_level');

    const [rows] = await pool.query(
      `SELECT * FROM inventory_items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name`,
      params
    );
    res.json(rows.map((r) => ({ ...r, stock_status: status(r) })));
  })
);

// [WBS 3.3.1] Return items at or below their reorder level.
router.get(
  '/low',
  requireRole(...READERS),
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT * FROM inventory_items WHERE quantity <= reorder_level ORDER BY (quantity / NULLIF(reorder_level, 0)) ASC, name'
    );
    res.json(rows.map((r) => ({ ...r, stock_status: status(r), shortage: Math.max(r.reorder_level - r.quantity, 0) })));
  })
);

// [WBS 3.2.2] Display stock movement history.
// ---------------------------------------------------------------- movement history (must be before /:id)
// ?type=in|out  ?item_id=  ?q=item name  ?days=30
router.get(
  '/movements',
  requireRole(...READERS),
  wrap(async (req, res) => {
    const where = [];
    const params = [];
    if (['in', 'out'].includes(req.query.type)) {
      where.push('m.movement_type = ?');
      params.push(req.query.type);
    }
    if (req.query.item_id) {
      where.push('m.item_id = ?');
      params.push(Number(req.query.item_id));
    }
    if (req.query.q) {
      where.push('i.name LIKE ?');
      params.push(`%${req.query.q}%`);
    }
    const days = Number(req.query.days);
    if (days > 0) {
      where.push('m.created_at >= NOW() - INTERVAL ? DAY');
      params.push(Math.min(days, 365));
    }
    const [rows] = await pool.query(
      `SELECT m.*, i.name AS item_name, i.unit, u.full_name AS user_name
       FROM stock_movements m
       JOIN inventory_items i ON i.id = m.item_id
       JOIN users u ON u.id = m.created_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.created_at DESC, m.id DESC LIMIT 500`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  requireRole(...READERS),
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    if (!rows.length) throw httpError(404, 'Item not found.');
    res.json({ ...rows[0], stock_status: status(rows[0]) });
  })
);

// [WBS 3.1.1] Implement inventory item create, update, and delete.
// ---------------------------------------------------------------- add item (inventory)
router.post(
  '/',
  requireRole('inventory'),
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) throw httpError(400, 'Enter the item name.');
    if (!CATEGORIES.includes(b.category)) throw httpError(400, 'Choose a category.');
    if (isBlank(b.unit)) throw httpError(400, 'Choose a unit.');
    const quantity = isBlank(b.quantity) ? 0 : num(b.quantity, 'Starting quantity');
    const reorder_level = isBlank(b.reorder_level) ? 0 : num(b.reorder_level, 'Reorder level');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [dup] = await conn.query('SELECT id FROM inventory_items WHERE name = ?', [name]);
      if (dup.length) throw httpError(409, `"${name}" is already in the inventory list.`);
      const [result] = await conn.query(
        'INSERT INTO inventory_items (name, category, unit, quantity, reorder_level, is_fresh) VALUES (?, ?, ?, ?, ?, ?)',
        [name, b.category, String(b.unit).trim(), quantity, reorder_level, b.is_fresh ? 1 : 0]
      );
      if (quantity > 0) {
        await conn.query(
          "INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, created_by) VALUES (?, 'in', ?, ?, 'Opening stock', ?)",
          [result.insertId, quantity, quantity, req.user.id]
        );
      }
      await logActivity(req.user.id, 'Item added', `${name} added to inventory`, conn);
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

// [WBS 3.1.1] Implement inventory item create, update, and delete.
// ---------------------------------------------------------------- edit details (inventory). Quantity changes go through stock in/out.
router.put(
  '/:id',
  requireRole('inventory'),
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) throw httpError(400, 'Enter the item name.');
    if (!CATEGORIES.includes(b.category)) throw httpError(400, 'Choose a category.');
    if (isBlank(b.unit)) throw httpError(400, 'Choose a unit.');
    const reorder_level = num(b.reorder_level, 'Reorder level');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[existing]] = await conn.query('SELECT id, unit FROM inventory_items WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!existing) throw httpError(404, 'Item not found.');
      if (String(b.unit).trim() !== existing.unit) {
        const [[assigned]] = await conn.query(
          'SELECT menu_item_id FROM menu_item_ingredients WHERE ingredient_id = ? LIMIT 1 FOR UPDATE',
          [req.params.id]
        );
        if (assigned) throw httpError(409, 'This ingredient is used in menu recipes. Remove it from those recipes before changing its unit.');
        const [[snapshotted]] = await conn.query(
          'SELECT order_item_id FROM order_item_ingredients WHERE ingredient_id = ? LIMIT 1 FOR UPDATE',
          [req.params.id],
        );
        if (snapshotted) throw httpError(409, 'This ingredient unit is part of order recipe history and cannot be changed.');
      }
      const [dup] = await conn.query('SELECT id FROM inventory_items WHERE name = ? AND id <> ?', [name, req.params.id]);
      if (dup.length) throw httpError(409, `"${name}" is already in the inventory list.`);
      await conn.query(
        'UPDATE inventory_items SET name = ?, category = ?, unit = ?, reorder_level = ?, is_fresh = ? WHERE id = ?',
        [name, b.category, String(b.unit).trim(), reorder_level, b.is_fresh ? 1 : 0, req.params.id]
      );
      await logActivity(req.user.id, 'Item edited', `${name} details updated`, conn);
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

// [WBS 3.1.1] Implement inventory item create, update, and delete.
// ---------------------------------------------------------------- delete item (inventory)
router.delete(
  '/:id',
  requireRole('inventory'),
  wrap(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[existing]] = await conn.query(
        'SELECT id, name FROM inventory_items WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!existing) throw httpError(404, 'Item not found.');

      const [[recipeUse]] = await conn.query(
        `SELECT COUNT(*) AS count
         FROM menu_item_ingredients
         WHERE ingredient_id = ?`,
        [req.params.id]
      );
      if (recipeUse.count > 0) {
        throw httpError(409, `"${existing.name}" is used in menu recipes. Remove it from those recipes before deleting it.`);
      }

      const [[orderRecipeUse]] = await conn.query(
        'SELECT COUNT(*) AS count FROM order_item_ingredients WHERE ingredient_id = ?',
        [req.params.id],
      );
      if (orderRecipeUse.count > 0) {
        throw httpError(409, `"${existing.name}" is part of order recipe history and cannot be deleted.`);
      }

      const [[stockUse]] = await conn.query(
        'SELECT COUNT(*) AS count FROM stock_movements WHERE item_id = ?',
        [req.params.id]
      );
      if (stockUse.count > 0) {
        throw httpError(409, `"${existing.name}" has stock history. It cannot be deleted so that history is preserved.`);
      }

      await conn.query('DELETE FROM inventory_items WHERE id = ?', [req.params.id]);
      await logActivity(req.user.id, 'Item deleted', `${existing.name} deleted from inventory`, conn);
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

// [WBS 3.2.1] Record stock-in and stock-out.
// ---------------------------------------------------------------- stock in / stock out (inventory)
async function moveStock(req, res, type) {
  const b = req.body || {};
  const quantity = num(b.quantity, 'Quantity');
  if (quantity <= 0) throw httpError(400, 'Quantity must be more than zero.');
  if (type === 'out' && isBlank(b.reason)) throw httpError(400, 'Choose a reason for removing this stock.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // FOR UPDATE locks the row so two people cannot change the same item at once
    const [rows] = await conn.query('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [req.params.id]);
    const item = rows[0];
    if (!item) throw httpError(404, 'Item not found.');
    if (type === 'out' && quantity > item.quantity) {
      throw httpError(400, `Only ${item.quantity} ${item.unit} of ${item.name} left. You cannot remove ${quantity}.`);
    }
    const balance = num(Number(item.quantity) + (type === 'in' ? quantity : -quantity), 'Quantity');
    await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [balance, item.id]);
    if (type === 'in') await makeStockedMenuItemsAvailable([item.id], conn);
    await conn.query(
      'INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, supplier, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        item.id,
        type,
        quantity,
        balance,
        type === 'in' ? (isBlank(b.reason) ? 'Delivery' : String(b.reason).trim()) : String(b.reason).trim(),
        type === 'in' && !isBlank(b.supplier) ? String(b.supplier).trim().slice(0, 100) : null,
        isBlank(b.note) ? null : String(b.note).trim().slice(0, 255),
        req.user.id,
      ]
    );
    await logActivity(
      req.user.id,
      type === 'in' ? 'Stock in' : 'Stock out',
      type === 'in'
        ? `${item.name}: ${quantity} ${item.unit} received${b.supplier ? ' from ' + String(b.supplier).trim() : ''}`
        : `${item.name}: ${quantity} ${item.unit} removed (${String(b.reason).trim()})`,
      conn
    );
    await conn.commit();
    res.json({ ok: true, item: { ...item, quantity: balance, stock_status: status({ ...item, quantity: balance }) } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

router.post('/:id/stock-in', requireRole('inventory'), wrap((req, res) => moveStock(req, res, 'in')));
router.post('/:id/stock-out', requireRole('inventory'), wrap((req, res) => moveStock(req, res, 'out')));

export default router;

export function getInventoryHandlerChain(method, path) {
  return getRouteHandlerChain(router, method, path);
}
