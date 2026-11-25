import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIngredientRequirements } from '../services/orderInventoryService.js';

test('aggregates an order recipe in each ingredient inventory unit', () => {
  const requirements = buildIngredientRequirements(
    [
      { id: 1, item_name: 'Coffee' },
      { id: 2, item_name: 'Latte' },
    ],
    [
      {
        order_item_id: 1,
        order_quantity: 2,
        ingredient_id: 10,
        ingredient_name: 'Coffee beans',
        quantity_required: 18,
        unit_of_measurement: 'g',
        inventory_unit: 'kg',
      },
      {
        order_item_id: 2,
        order_quantity: 1,
        ingredient_id: 10,
        ingredient_name: 'Coffee beans',
        quantity_required: 0.01,
        unit_of_measurement: 'kg',
        inventory_unit: 'kg',
      },
    ],
  );

  assert.deepEqual(requirements, [{
    ingredient_id: 10,
    ingredient_name: 'Coffee beans',
    inventory_unit: 'kg',
    quantity_required: 0.046,
  }]);
});

test('rejects incompatible recipe units', () => {
  assert.throws(
    () => buildIngredientRequirements(
      [{ id: 1, item_name: 'Soup' }],
      [{
        order_item_id: 1,
        order_quantity: 1,
        ingredient_id: 10,
        ingredient_name: 'Flour',
        quantity_required: 1,
        unit_of_measurement: 'kg',
        inventory_unit: 'L',
      }],
    ),
    (error) => error.status === 409,
  );
});

test('rejects an order item with no snapshotted recipe', () => {
  assert.throws(
    () => buildIngredientRequirements([{ id: 1, item_name: 'Tea' }], []),
    (error) => error.status === 409 && /recipe.*missing/i.test(error.message),
  );
});
