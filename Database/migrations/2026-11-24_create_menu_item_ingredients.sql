-- [WBS 2.2.2] Store compatible ingredient recipes per menu item.
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  menu_item_id       INT NOT NULL,
  ingredient_id      INT NOT NULL,
  quantity_required  DECIMAL(10,2) NOT NULL,
  unit_of_measurement VARCHAR(20) NOT NULL,
  PRIMARY KEY (menu_item_id, ingredient_id),
  INDEX idx_menu_item_ingredients_ingredient (ingredient_id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);
