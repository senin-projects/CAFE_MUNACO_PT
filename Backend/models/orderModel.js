import { pool } from '../config/db.js';

// Shared order projection used by cashier, kitchen, and owner order reads.
export const ORDER_SELECT = `
  SELECT o.*, cu.full_name AS created_by_name, ku.full_name AS prepared_by_name,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM orders o
  JOIN users cu ON cu.id = o.created_by
  LEFT JOIN users ku ON ku.id = o.prepared_by`;

export async function findMenuItemsByIds(ids, db = pool) {
  return (await db.query('SELECT id, name, price, is_available FROM menu_items WHERE id IN (?)', [ids]))[0];
}

export async function loadOrderItems(orderIds, db = pool) {
  if (!orderIds.length) return new Map();
  const [rows] = await db.query(
    'SELECT id, order_id, menu_item_id, item_name, quantity, unit_price, notes FROM order_items WHERE order_id IN (?) ORDER BY id',
    [orderIds]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.order_id)) map.set(row.order_id, []);
    map.get(row.order_id).push(row);
  }
  return map;
}

export async function replaceOrderItems(conn, orderId, items) {
  await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await conn.query('INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, notes) VALUES ?', [
    items.map((i) => [orderId, i.menu_item_id, i.item_name, i.quantity, i.unit_price, i.notes]),
  ]);
}
