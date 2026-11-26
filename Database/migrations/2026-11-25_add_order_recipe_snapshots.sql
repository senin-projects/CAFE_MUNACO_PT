-- [WBS 1.1.2] Snapshot recipes when paid orders are sent.
-- [WBS 2.1.2] Track preparation deductions; [WBS 3.2.3] preserve inventory resolution history.
ALTER TABLE orders
  ADD COLUMN ingredients_deducted_at DATETIME NULL;

ALTER TABLE order_cancellations
  ADD COLUMN inventory_resolution ENUM('not_applicable','consumed','restocked')
    NOT NULL DEFAULT 'not_applicable';

CREATE TABLE IF NOT EXISTS order_item_ingredients (
  order_item_id       INT NOT NULL,
  ingredient_id       INT NOT NULL,
  ingredient_name     VARCHAR(100) NOT NULL,
  quantity_required   DECIMAL(10,2) NOT NULL,
  unit_of_measurement VARCHAR(20) NOT NULL,
  inventory_unit      VARCHAR(20) NOT NULL,
  PRIMARY KEY (order_item_id, ingredient_id),
  INDEX idx_order_item_ingredients_ingredient (ingredient_id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);

INSERT INTO order_item_ingredients
  (order_item_id, ingredient_id, ingredient_name, quantity_required, unit_of_measurement, inventory_unit)
SELECT oi.id, mii.ingredient_id, i.name, mii.quantity_required, mii.unit_of_measurement, i.unit
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
JOIN inventory_items i ON i.id = mii.ingredient_id
WHERE o.status IN ('sent', 'preparing', 'ready');
