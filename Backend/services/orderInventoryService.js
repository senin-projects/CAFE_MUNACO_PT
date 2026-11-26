// Shared by cashier validation/sending, kitchen preparation, inventory, and owner cancellation.
// [WBS 1.1.2] Recheck stock and snapshot recipes before sending paid orders.
// [WBS 2.1.2] Deduct snapshotted ingredients when preparation starts.
// [WBS 3.2.3] Convert, deduct, restock, and record ordered-item ingredients.
import { convertUnitQuantity, roundStockQuantity } from '../../Shared/units.js';
import { logActivity } from './activityService.js';
import { httpError } from '../utils/http.js';

const MAX_STOCK_QUANTITY = 9_999_999_999.999999;

async function loadMenuRecipeStock(menuItemIds, db, lock = false) {
  const ids = [...new Set(menuItemIds.map(Number))];
  if (!ids.length) return [];
  const [rows] = await db.query(
    `SELECT mii.menu_item_id, mii.ingredient_id, i.name AS ingredient_name,
            mii.quantity_required, mii.unit_of_measurement,
            i.unit AS inventory_unit, i.quantity AS current_stock
     FROM menu_item_ingredients mii
     JOIN inventory_items i ON i.id = mii.ingredient_id
     WHERE mii.menu_item_id IN (?)
     ORDER BY i.id, mii.menu_item_id
     ${lock ? 'FOR UPDATE' : ''}`,
    [ids],
  );
  return rows;
}

export async function getMenuInventoryAvailability(menuItems, db) {
  const availability = new Map(menuItems.map((item) => [
    Number(item.id),
    {
      inventory_available: Boolean(item.has_recipe),
      unavailable_ingredients: [],
      has_out_of_stock_ingredient: false,
    },
  ]));
  const recipeRows = await loadMenuRecipeStock(menuItems.map((item) => item.id), db);

  for (const row of recipeRows) {
    const convertedRequired = convertUnitQuantity(
      Number(row.quantity_required),
      row.unit_of_measurement,
      row.inventory_unit,
    );
    const required = roundStockQuantity(convertedRequired);
    if (convertedRequired === null || !Number.isFinite(required) || required <= 0) {
      throw httpError(409, `The recipe unit for ${row.ingredient_name} is incompatible with its inventory unit.`);
    }

    const itemAvailability = availability.get(Number(row.menu_item_id));
    if (Number(row.current_stock) < required) {
      itemAvailability.inventory_available = false;
      itemAvailability.unavailable_ingredients.push(row.ingredient_name);
      if (Number(row.current_stock) <= 0) itemAvailability.has_out_of_stock_ingredient = true;
    }
  }

  return availability;
}

export async function makeStockedMenuItemsAvailable(ingredientIds, db) {
  const ids = [...new Set(ingredientIds.map(Number))];
  if (!ids.length) return;

  const [menuItems] = await db.query(
    `SELECT DISTINCT m.id, 1 AS has_recipe
     FROM menu_items m
     JOIN menu_item_ingredients mii ON mii.menu_item_id = m.id
     WHERE mii.ingredient_id IN (?)
     ORDER BY m.id`,
    [ids],
  );
  const availability = await getMenuInventoryAvailability(menuItems, db);
  const availableIds = menuItems
    .filter((item) => availability.get(Number(item.id))?.inventory_available)
    .map((item) => item.id);

  if (availableIds.length) {
    await db.query('UPDATE menu_items SET is_available = 1 WHERE id IN (?)', [availableIds]);
  }
}

export async function assertMenuOrderStock(orderItems, db) {
  const items = orderItems.filter((item) => item.menu_item_id !== null && item.menu_item_id !== undefined);
  if (!items.length) return;

  const recipeRows = await loadMenuRecipeStock(items.map((item) => item.menu_item_id), db, true);
  const validationItems = items.map((item, index) => ({
    id: index,
    item_name: item.item_name,
  }));
  const validationRows = recipeRows.flatMap((row) =>
    items.flatMap((item, index) => Number(item.menu_item_id) === Number(row.menu_item_id)
      ? [{
          ...row,
          order_item_id: index,
          order_quantity: item.quantity,
        }]
      : [])
  );
  const requirements = buildIngredientRequirements(validationItems, validationRows);
  const stockById = new Map(recipeRows.map((row) => [Number(row.ingredient_id), row]));

  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    if (!stock || Number(stock.current_stock) < requirement.quantity_required) {
      throw httpError(
        409,
        `Not enough ${requirement.ingredient_name} to complete this order. Required: ${requirement.quantity_required} ${requirement.inventory_unit}; available: ${stock?.current_stock ?? 0} ${requirement.inventory_unit}.`,
      );
    }
  }
}

export function buildIngredientRequirements(orderItems, recipeRows) {
  const rowsByOrderItem = new Map();
  for (const row of recipeRows) {
    const orderItemId = Number(row.order_item_id);
    if (!rowsByOrderItem.has(orderItemId)) rowsByOrderItem.set(orderItemId, []);
    rowsByOrderItem.get(orderItemId).push(row);
  }

  const requiredByIngredient = new Map();
  for (const orderItem of orderItems) {
    const rows = rowsByOrderItem.get(Number(orderItem.id)) || [];
    if (!rows.length) {
      throw httpError(409, `The saved ingredient recipe for ${orderItem.item_name} is missing. Contact an owner before continuing this order.`);
    }

    for (const row of rows) {
      const recipeQuantity = Number(row.quantity_required);
      const orderQuantity = Number(row.order_quantity);
      if (!Number.isFinite(recipeQuantity) || recipeQuantity <= 0 ||
          !Number.isInteger(orderQuantity) || orderQuantity <= 0) {
        throw httpError(409, `The saved ingredient recipe for ${orderItem.item_name} is invalid.`);
      }

      const used = convertUnitQuantity(
        recipeQuantity * orderQuantity,
        row.unit_of_measurement,
        row.inventory_unit,
      );
      if (used === null || !Number.isFinite(used) || used <= 0) {
        throw httpError(409, `The recipe unit for ${row.ingredient_name} is incompatible with its saved inventory unit.`);
      }

      const roundedUsed = roundStockQuantity(used);
      if (roundedUsed <= 0) {
        throw httpError(409, `The recipe quantity for ${row.ingredient_name} is too small to track in inventory.`);
      }

      const ingredientId = Number(row.ingredient_id);
      const existing = requiredByIngredient.get(ingredientId);
      if (existing && existing.inventory_unit !== row.inventory_unit) {
        throw httpError(409, `The saved inventory unit for ${row.ingredient_name} is inconsistent across this order.`);
      }

      const total = roundStockQuantity((existing?.quantity_required || 0) + roundedUsed);
      if (!Number.isFinite(total) || total > MAX_STOCK_QUANTITY) {
        throw httpError(409, `The required quantity for ${row.ingredient_name} exceeds the supported inventory range.`);
      }
      requiredByIngredient.set(ingredientId, {
        ingredient_id: ingredientId,
        ingredient_name: row.ingredient_name,
        inventory_unit: row.inventory_unit,
        quantity_required: total,
      });
    }
  }

  return [...requiredByIngredient.values()].sort((first, second) => first.ingredient_id - second.ingredient_id);
}

export async function snapshotOrderRecipe(conn, orderId) {
  const [orderItems] = await conn.query(
    'SELECT id, menu_item_id, item_name, quantity FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE',
    [orderId],
  );
  if (!orderItems.length) throw httpError(409, 'This order has no items to send to the kitchen.');

  if (orderItems.some((item) => item.menu_item_id == null)) {
    throw httpError(409, 'One or more order items no longer have a menu recipe. Update the order before sending it.');
  }
  const menuItemIds = [...new Set(orderItems.map((item) => Number(item.menu_item_id)))];

  const [menuItems] = await conn.query(
    'SELECT id FROM menu_items WHERE id IN (?) ORDER BY id FOR UPDATE',
    [menuItemIds],
  );
  if (menuItems.length !== menuItemIds.length) {
    throw httpError(409, 'One or more menu items no longer exist. Update the order before sending it.');
  }

  const [recipeRows] = await conn.query(
    `SELECT mii.menu_item_id, mii.ingredient_id, i.name AS ingredient_name,
            mii.quantity_required, mii.unit_of_measurement, i.unit AS inventory_unit
     FROM menu_item_ingredients mii
     JOIN inventory_items i ON i.id = mii.ingredient_id
     WHERE mii.menu_item_id IN (?)
     ORDER BY mii.menu_item_id, mii.ingredient_id
     FOR UPDATE`,
    [menuItemIds],
  );

  const recipeByMenuItem = new Map();
  for (const row of recipeRows) {
    if (!recipeByMenuItem.has(row.menu_item_id)) recipeByMenuItem.set(row.menu_item_id, []);
    recipeByMenuItem.get(row.menu_item_id).push(row);
  }

  const snapshotRows = [];
  const validationRows = [];
  for (const orderItem of orderItems) {
    const recipe = recipeByMenuItem.get(orderItem.menu_item_id) || [];
    if (!recipe.length) {
      throw httpError(409, `${orderItem.item_name} has no saved ingredients. Add a recipe before sending this order.`);
    }
    for (const row of recipe) {
      snapshotRows.push([
        orderItem.id,
        row.ingredient_id,
        row.ingredient_name,
        row.quantity_required,
        row.unit_of_measurement,
        row.inventory_unit,
      ]);
      validationRows.push({
        ...row,
        order_item_id: orderItem.id,
        order_quantity: orderItem.quantity,
      });
    }
  }

  const requirements = buildIngredientRequirements(
    orderItems.map((item) => ({ ...item, id: Number(item.id) })),
    validationRows,
  );
  const stockById = await lockInventory(conn, orderId, requirements);
  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    if (Number(stock.quantity) < requirement.quantity_required) {
      throw httpError(
        409,
        `Not enough ${stock.name} to send this order. Required: ${requirement.quantity_required} ${stock.unit}; available: ${stock.quantity} ${stock.unit}.`,
      );
    }
  }
  await conn.query(
    `INSERT INTO order_item_ingredients
       (order_item_id, ingredient_id, ingredient_name, quantity_required, unit_of_measurement, inventory_unit)
     VALUES ?`,
    [snapshotRows],
  );
}

async function getOrderIngredientRequirements(conn, orderId) {
  const [orderItems] = await conn.query(
    'SELECT id, item_name FROM order_items WHERE order_id = ? ORDER BY id',
    [orderId],
  );
  const [recipeRows] = await conn.query(
    `SELECT snapshot.order_item_id, snapshot.ingredient_id, snapshot.ingredient_name,
            snapshot.quantity_required, snapshot.unit_of_measurement, snapshot.inventory_unit,
            oi.quantity AS order_quantity
     FROM order_item_ingredients snapshot
     JOIN order_items oi ON oi.id = snapshot.order_item_id
     WHERE oi.order_id = ?
     ORDER BY snapshot.ingredient_id, snapshot.order_item_id`,
    [orderId],
  );
  return buildIngredientRequirements(orderItems, recipeRows);
}

async function lockInventory(conn, orderId, requirements) {
  const ingredientIds = requirements.map((item) => item.ingredient_id);
  const [stockRows] = await conn.query(
    'SELECT id, name, unit, quantity FROM inventory_items WHERE id IN (?) ORDER BY id FOR UPDATE',
    [ingredientIds],
  );
  const stockById = new Map(stockRows.map((item) => [Number(item.id), item]));

  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    if (!stock || stock.unit !== requirement.inventory_unit) {
      throw httpError(409, `The inventory unit for ${requirement.ingredient_name} changed after order ${orderId} was sent. Contact an owner.`);
    }
  }
  return stockById;
}

export async function deductOrderIngredients(conn, order, userId) {
  if (order.ingredients_deducted_at) return false;
  const requirements = await getOrderIngredientRequirements(conn, order.id);
  const stockById = await lockInventory(conn, order.id, requirements);

  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    if (Number(stock.quantity) < requirement.quantity_required) {
      throw httpError(
        409,
        `Not enough ${stock.name} to prepare this order. Required: ${requirement.quantity_required} ${stock.unit}; available: ${stock.quantity} ${stock.unit}.`,
      );
    }
  }

  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    const balance = roundStockQuantity(Number(stock.quantity) - requirement.quantity_required);
    await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [balance, stock.id]);
    await conn.query(
      `INSERT INTO stock_movements
         (item_id, movement_type, quantity, balance_after, reason, note, created_by)
       VALUES (?, 'out', ?, ?, 'Order preparation', ?, ?)`,
      [stock.id, requirement.quantity_required, balance, order.order_no, userId],
    );
    await logActivity(
      userId,
      'Stock out',
      `${stock.name}: ${requirement.quantity_required} ${stock.unit} used to prepare ${order.order_no}`,
      conn,
    );
  }

  await conn.query('UPDATE orders SET ingredients_deducted_at = NOW() WHERE id = ? AND ingredients_deducted_at IS NULL', [order.id]);
  return true;
}

export async function restockOrderIngredients(conn, order, userId) {
  if (!order.ingredients_deducted_at) return false;
  const requirements = await getOrderIngredientRequirements(conn, order.id);
  const stockById = await lockInventory(conn, order.id, requirements);

  for (const requirement of requirements) {
    const stock = stockById.get(requirement.ingredient_id);
    const balance = roundStockQuantity(Number(stock.quantity) + requirement.quantity_required);
    await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [balance, stock.id]);
    await conn.query(
      `INSERT INTO stock_movements
         (item_id, movement_type, quantity, balance_after, reason, note, created_by)
       VALUES (?, 'in', ?, ?, 'Cancelled order restock', ?, ?)`,
      [stock.id, requirement.quantity_required, balance, order.order_no, userId],
    );
    await logActivity(
      userId,
      'Stock in',
      `${stock.name}: ${requirement.quantity_required} ${stock.unit} restocked from cancelled ${order.order_no}`,
      conn,
    );
  }

  await makeStockedMenuItemsAvailable(requirements.map((item) => item.ingredient_id), conn);
  await conn.query('UPDATE orders SET ingredients_deducted_at = NULL WHERE id = ?', [order.id]);
  return true;
}
