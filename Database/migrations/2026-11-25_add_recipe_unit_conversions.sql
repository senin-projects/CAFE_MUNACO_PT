-- [WBS 2.2.2] Support compatible recipe measurements.
-- [WBS 3.2.3] Preserve converted fractional inventory movements.
ALTER TABLE inventory_items
  MODIFY quantity DECIMAL(16,6) NOT NULL DEFAULT 0,
  MODIFY reorder_level DECIMAL(16,6) NOT NULL DEFAULT 0;

ALTER TABLE stock_movements
  MODIFY quantity DECIMAL(16,6) NOT NULL,
  MODIFY balance_after DECIMAL(16,6) NOT NULL;
