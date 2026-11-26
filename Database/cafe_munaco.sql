-- Cafe Munaco database for XAMPP (MySQL / MariaDB)
-- Import this file in phpMyAdmin: http://localhost/phpmyadmin  ->  Import  ->  choose this file  ->  Go
-- WARNING: running it again wipes and recreates all tables.

CREATE DATABASE IF NOT EXISTS cafe_munaco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_munaco;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_cancellations, notification_reads, activity_log, stock_movements, order_item_ingredients, menu_item_ingredients, inventory_items, order_items, orders, menu_items, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- users
-- [WBS 5.1.1] Login and session handling; [WBS 5.1.2] role values; [WBS 4.4.1-4.4.2] shared staff accounts.
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('cashier','kitchen','inventory','owner') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- [WBS 4.1.2] Persist read state for notifications shared by all staff roles.
CREATE TABLE notification_reads (
  user_id          INT          NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  read_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------- menu
-- [WBS 2.2.1] Menu items; [WBS 2.2.2] ingredient recipes.
CREATE TABLE menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  category     VARCHAR(50)   NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  is_available TINYINT(1)    NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------- orders
-- [WBS 1.1.1-1.2.2] Cashier orders and lifecycle; [WBS 2.1.2] kitchen status; [WBS 4.3.1] owner cancellation.
CREATE TABLE orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_no         VARCHAR(30)  NOT NULL UNIQUE,
  customer_name    VARCHAR(100) NOT NULL,
  order_type       ENUM('dine_in','takeout','reservation','buffet','birthday','special_event','advance_order') NOT NULL DEFAULT 'dine_in',
  table_no         VARCHAR(30)  NULL,
  guests           INT          NULL,
  scheduled_at     DATETIME     NULL,
  special_requests TEXT         NULL,
  -- pending = saved by cashier, not yet sent (still editable)
  status           ENUM('pending','sent','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
  total            DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status   ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  payment_method   ENUM('cash','card','e_wallet') NULL,
  paid_at          DATETIME NULL,
  created_by       INT NOT NULL,
  prepared_by      INT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at          DATETIME NULL,
  preparing_at     DATETIME NULL,
  ready_at         DATETIME NULL,
  served_at        DATETIME NULL,
  ingredients_deducted_at DATETIME NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

CREATE TABLE order_cancellations (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  order_id           INT NOT NULL UNIQUE,
  cancelled_by       INT NOT NULL,
  previous_status    ENUM('pending','sent','preparing','ready') NOT NULL,
  reason             VARCHAR(500) NOT NULL,
  payment_resolution ENUM('not_applicable','refunded','not_refunded') NOT NULL,
  inventory_resolution ENUM('not_applicable','consumed','restocked') NOT NULL DEFAULT 'not_applicable',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (cancelled_by) REFERENCES users(id)
);

CREATE TABLE order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  menu_item_id INT NULL,
  item_name    VARCHAR(100)  NOT NULL,   -- copied from menu so old orders never change
  quantity     INT           NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,   -- copied from menu at the time of the order
  notes        VARCHAR(255)  NULL,
  FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------- inventory
-- [WBS 3.1.1-3.3.1] Shared inventory records, stock history, recipe tracking, and low-stock data.
CREATE TABLE inventory_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  category      ENUM('Seafood','Meat','Vegetables','Dairy','Dry Goods','Beverages','Other') NOT NULL DEFAULT 'Other',
  unit          VARCHAR(20)  NOT NULL DEFAULT 'kg',
  quantity      DECIMAL(16,6) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(16,6) NOT NULL DEFAULT 0,
  is_fresh      TINYINT(1)   NOT NULL DEFAULT 0,   -- fresh / perishable (seafood, vegetables, ...)
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE stock_movements (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  item_id        INT NOT NULL,
  movement_type  ENUM('in','out') NOT NULL,
  quantity       DECIMAL(16,6) NOT NULL,
  balance_after  DECIMAL(16,6) NOT NULL,
  reason         VARCHAR(100) NULL,
  supplier       VARCHAR(100) NULL,
  note           VARCHAR(255) NULL,
  created_by     INT NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id)    REFERENCES inventory_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_item (item_id),
  INDEX idx_created (created_at)
);

-- [WBS 2.2.2] Store validated ingredient recipes.
CREATE TABLE menu_item_ingredients (
  menu_item_id       INT NOT NULL,
  ingredient_id      INT NOT NULL,
  quantity_required  DECIMAL(10,2) NOT NULL,
  unit_of_measurement VARCHAR(20) NOT NULL,
  PRIMARY KEY (menu_item_id, ingredient_id),
  INDEX idx_menu_item_ingredients_ingredient (ingredient_id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);

-- [WBS 1.1.2, 2.1.2, 3.2.3] Preserve the recipe quantities used for each sent order.
CREATE TABLE order_item_ingredients (
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

-- ---------------------------------------------------------------- activity log (owner monitors this)
-- [WBS 4.1.1] Owner activity monitoring; module actions write to this shared log.
CREATE TABLE activity_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  action     VARCHAR(60)  NOT NULL,
  details    VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_created (created_at)
);

-- ================================================================ SEED DATA
-- Passwords:  owner / owner123,  cashier1 + cashier2 / cashier123,
--             kitchen1 + kitchen2 / kitchen123,  inventory1 / inventory123
INSERT INTO users (id, full_name, username, password_hash, role) VALUES
(1, 'Raquel Magnaye',   'owner',      'scrypt$cbebf212eb1e3ab517176bf6174fdc38$a2197d9bf10cd9d70ee769e4cd8bda8e9822e71fd52aea2e4063decd89ee2b7edd72336c73167a9c8aca3ba8ae942e219c2e68f8595a09c106db9c07c39b0cbe', 'owner'),
(2, 'Maria Santos',     'cashier1',   'scrypt$c57ce1269ceadd49037fe9518e3c5cc8$c7e4b36390347e6097a40d60ca38256135d59346713fb0ae069b1cfe5d0ac2a0629dea85e2c8c2f25bd109d15e5cc13d63a570ecbc8d0d89a5487d2b322156ac', 'cashier'),
(3, 'Ana Reyes',        'cashier2',   'scrypt$c57ce1269ceadd49037fe9518e3c5cc8$c7e4b36390347e6097a40d60ca38256135d59346713fb0ae069b1cfe5d0ac2a0629dea85e2c8c2f25bd109d15e5cc13d63a570ecbc8d0d89a5487d2b322156ac', 'cashier'),
(4, 'Jose Dela Cruz',   'kitchen1',   'scrypt$dbf7e4ca56ca34081f6f9eae52673d9e$fd31359b4ad0b693c13b86ec07c41a25ad99541d4391ac3faaa6316aeafbf561b819928d399a177402980bbab72226e0a20d162c5e008ad13ea343f85ab6fb57', 'kitchen'),
(5, 'Pedro Villanueva', 'kitchen2',   'scrypt$dbf7e4ca56ca34081f6f9eae52673d9e$fd31359b4ad0b693c13b86ec07c41a25ad99541d4391ac3faaa6316aeafbf561b819928d399a177402980bbab72226e0a20d162c5e008ad13ea343f85ab6fb57', 'kitchen'),
(6, 'Lita Mendoza',     'inventory1', 'scrypt$a5e51f5e0d417eb1fbb0a9d1462b277d$a19b0143c02012dbc45566bc7e98e9b4761973df055f577813c916748ebd323ade6b85420ca8447775c0ca6189609c1372f08d3cb272ae2223bdce564dafb88b', 'inventory');

INSERT INTO menu_items (id, name, category, price) VALUES
(1,  'Grilled Tilapia',        'Seafood',  280.00),
(2,  'Butter Garlic Shrimp',   'Seafood',  420.00),
(3,  'Sinigang na Hipon',      'Seafood',  380.00),
(4,  'Inihaw na Pusit',        'Seafood',  350.00),
(5,  'Crispy Calamari',        'Seafood',  320.00),
(6,  'Chili Crab',             'Seafood',  650.00),
(7,  'Chicken Inasal',         'Mains',    230.00),
(8,  'Pork Sisig',             'Mains',    260.00),
(9,  'Beef Kare-Kare',         'Mains',    390.00),
(10, 'Pancit Canton',          'Mains',    240.00),
(11, 'Garlic Fried Rice',      'Sides',     70.00),
(12, 'Plain Rice',             'Sides',     40.00),
(13, 'Garden Salad',           'Sides',    150.00),
(14, 'Leche Flan',             'Desserts', 120.00),
(15, 'Halo-Halo',              'Desserts', 150.00),
(16, 'Kapeng Barako',          'Drinks',    90.00),
(17, 'Iced Latte',             'Drinks',   140.00),
(18, 'Calamansi Juice',        'Drinks',    80.00),
(19, 'Bottled Water',          'Drinks',    30.00),
(20, 'Buffet Package (per head)', 'Packages', 599.00),
(21, 'Birthday Set (per head)',   'Packages', 450.00);

INSERT INTO inventory_items (id, name, category, unit, quantity, reorder_level, is_fresh) VALUES
(1,  'Tilapia',            'Seafood',    'kg',   18.00, 10.00, 1),
(2,  'Shrimp (hipon)',     'Seafood',    'kg',    4.50,  8.00, 1),
(3,  'Squid (pusit)',      'Seafood',    'kg',    6.00,  5.00, 1),
(4,  'Crab (alimango)',    'Seafood',    'kg',    0.00,  5.00, 1),
(5,  'Chicken',            'Meat',       'kg',   25.00, 12.00, 1),
(6,  'Pork belly',         'Meat',       'kg',   14.00,  8.00, 1),
(7,  'Beef shank',         'Meat',       'kg',    9.00,  6.00, 1),
(8,  'Kangkong',           'Vegetables', 'kg',    3.00,  4.00, 1),
(9,  'Tomatoes',           'Vegetables', 'kg',    7.50,  3.00, 1),
(10, 'Calamansi',          'Vegetables', 'kg',    5.00,  3.00, 1),
(11, 'Eggs',               'Dairy',      'tray', 6.00,  4.00, 1),
(12, 'Fresh milk',         'Dairy',      'L',     8.00, 10.00, 1),
(13, 'Rice',               'Dry Goods',  'kg',   60.00, 25.00, 0),
(14, 'Cooking oil',        'Dry Goods',  'L',    12.00, 10.00, 0),
(15, 'Canton noodles',     'Dry Goods',  'pack', 20.00, 10.00, 0),
(16, 'Barako coffee beans','Beverages',  'kg',    4.00,  2.00, 0),
(17, 'Bottled water',      'Beverages',  'pcs', 48.00, 24.00, 0);

-- Illustrative demo recipes only. Replace these per-serving quantities with the cafe's actual recipes before production use.
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required, unit_of_measurement) VALUES
(1, 1, 0.30, 'kg'), (1, 14, 0.02, 'L'),
(2, 2, 0.15, 'kg'), (2, 14, 0.01, 'L'),
(3, 2, 0.12, 'kg'), (3, 8, 0.05, 'kg'), (3, 9, 0.05, 'kg'), (3, 10, 0.02, 'kg'),
(4, 3, 0.20, 'kg'), (4, 10, 0.02, 'kg'), (4, 14, 0.01, 'L'),
(5, 3, 0.15, 'kg'), (5, 14, 0.03, 'L'),
(6, 4, 0.40, 'kg'), (6, 9, 0.08, 'kg'), (6, 14, 0.02, 'L'),
(7, 5, 0.25, 'kg'), (7, 10, 0.02, 'kg'), (7, 14, 0.02, 'L'),
(8, 6, 0.20, 'kg'), (8, 10, 0.01, 'kg'), (8, 14, 0.02, 'L'),
(9, 7, 0.18, 'kg'), (9, 8, 0.03, 'kg'), (9, 9, 0.05, 'kg'),
(10, 5, 0.05, 'kg'), (10, 9, 0.03, 'kg'), (10, 14, 0.01, 'L'), (10, 15, 0.50, 'pack'),
(11, 13, 0.15, 'kg'), (11, 14, 0.01, 'L'),
(12, 13, 0.15, 'kg'),
(13, 8, 0.05, 'kg'), (13, 9, 0.10, 'kg'), (13, 10, 0.02, 'kg'),
(14, 11, 0.10, 'tray'), (14, 12, 0.05, 'L'),
(15, 12, 0.10, 'L'),
(16, 16, 0.02, 'kg'),
(17, 12, 0.20, 'L'), (17, 16, 0.02, 'kg'),
(18, 10, 0.15, 'kg'),
(19, 17, 1.00, 'pcs'),
(20, 5, 0.10, 'kg'), (20, 13, 0.15, 'kg'), (20, 17, 1.00, 'pcs'),
(21, 5, 0.10, 'kg'), (21, 13, 0.15, 'kg'), (21, 17, 1.00, 'pcs');

-- Opening balances reflect the later seeded stock in/out movements below.
INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, created_by, created_at)
SELECT id, 'in',
       CASE name
         WHEN 'Tilapia' THEN 8.00
         WHEN 'Shrimp (hipon)' THEN 8.15
         WHEN 'Crab (alimango)' THEN 2.00
         WHEN 'Squid (pusit)' THEN 6.20
         WHEN 'Chicken' THEN 25.80
         WHEN 'Tomatoes' THEN 7.03
         WHEN 'Calamansi' THEN 5.08
         WHEN 'Fresh milk' THEN 8.50
         WHEN 'Rice' THEN 60.30
         WHEN 'Cooking oil' THEN 12.11
         WHEN 'Canton noodles' THEN 20.50
         ELSE quantity
       END,
       CASE name
         WHEN 'Tilapia' THEN 8.00
         WHEN 'Shrimp (hipon)' THEN 8.15
         WHEN 'Crab (alimango)' THEN 2.00
         WHEN 'Squid (pusit)' THEN 6.20
         WHEN 'Chicken' THEN 25.80
         WHEN 'Tomatoes' THEN 7.03
         WHEN 'Calamansi' THEN 5.08
         WHEN 'Fresh milk' THEN 8.50
         WHEN 'Rice' THEN 60.30
         WHEN 'Cooking oil' THEN 12.11
         WHEN 'Canton noodles' THEN 20.50
         ELSE quantity
       END,
       'Opening stock', 6, NOW() - INTERVAL 10 DAY
FROM inventory_items
WHERE quantity > 0 OR name = 'Crab (alimango)';

INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, supplier, created_by, created_at) VALUES
(2, 'out', 3.50, 4.65, 'Used in kitchen', NULL, 6, NOW() - INTERVAL 1 DAY),
(4, 'out', 2.00, 0.00, 'Used in kitchen', NULL, 6, NOW() - INTERVAL 1 DAY),
(1, 'in', 10.00, 18.00, 'Delivery', 'Calaca Fish Port', 6, NOW() - INTERVAL 2 DAY);

-- Match stock deductions for the seeded preparing and ready kitchen orders.
INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, note, created_by, created_at) VALUES
(5, 'out', 0.80, 25.00, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(9, 'out', 0.03, 7.00, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(10, 'out', 0.06, 5.02, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(12, 'out', 0.50, 8.00, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(14, 'out', 0.07, 12.04, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(15, 'out', 0.50, 20.00, 'Order preparation', 'MUN-00007', 5, NOW() - INTERVAL 35 MINUTE),
(2, 'out', 0.15, 4.50, 'Order preparation', 'MUN-00006', 4, NOW() - INTERVAL 15 MINUTE),
(3, 'out', 0.20, 6.00, 'Order preparation', 'MUN-00006', 4, NOW() - INTERVAL 15 MINUTE),
(10, 'out', 0.02, 5.00, 'Order preparation', 'MUN-00006', 4, NOW() - INTERVAL 15 MINUTE),
(13, 'out', 0.30, 60.00, 'Order preparation', 'MUN-00006', 4, NOW() - INTERVAL 15 MINUTE),
(14, 'out', 0.04, 12.00, 'Order preparation', 'MUN-00006', 4, NOW() - INTERVAL 15 MINUTE);

-- Historical served samples predate recipe-based stock tracking; active kitchen samples below have snapshots and matching stock movements.
INSERT INTO orders (id, order_no, customer_name, order_type, table_no, guests, scheduled_at, special_requests, status, payment_status, payment_method, paid_at, created_by, prepared_by, created_at, sent_at, preparing_at, ready_at, served_at) VALUES
(1, 'MUN-00001', 'Dela Rosa Family', 'birthday',    'Garden 1', 12, NOW() - INTERVAL 6 DAY, 'Birthday cake arrives at 6 PM, please hold the lights.', 'served', 'paid', 'cash', NOW() - INTERVAL 6 DAY, 2, 4, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
(2, 'MUN-00002', 'Mr. Tolentino',    'dine_in',     'T4',        2, NULL, NULL, 'served', 'paid', 'cash', NOW() - INTERVAL 3 DAY, 2, 4, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(3, 'MUN-00003', 'Barangay Office',  'buffet',      'Hall',     40, NOW() - INTERVAL 2 DAY, NULL, 'served', 'paid', 'cash', NOW() - INTERVAL 2 DAY, 3, 5, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(4, 'MUN-00004', 'Ms. Aguilar',      'takeout',     NULL,        NULL, NULL, 'No chili please.', 'served', 'paid', 'cash', NOW() - INTERVAL 1 DAY, 3, 4, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
(5, 'MUN-00005', 'Garcia Table',     'dine_in',     'T2',        4, NULL, 'One guest allergic to peanuts (kare-kare without peanut sauce).', 'sent', 'paid', 'cash', NOW() - INTERVAL 19 MINUTE, 2, NULL, NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL 18 MINUTE, NULL, NULL, NULL),
(6, 'MUN-00006', 'Bautista Couple',  'dine_in',     'T6',        2, NULL, NULL, 'preparing', 'paid', 'cash', NOW() - INTERVAL 28 MINUTE, 2, 4, NOW() - INTERVAL 30 MINUTE, NOW() - INTERVAL 28 MINUTE, NOW() - INTERVAL 15 MINUTE, NULL, NULL),
(7, 'MUN-00007', 'Cruz Family',      'dine_in',     'T3',        5, NULL, NULL, 'ready', 'paid', 'cash', NOW() - INTERVAL 43 MINUTE, 3, 5, NOW() - INTERVAL 45 MINUTE, NOW() - INTERVAL 43 MINUTE, NOW() - INTERVAL 35 MINUTE, NOW() - INTERVAL 5 MINUTE, NULL),
(8, 'MUN-00008', 'Lopez Anniversary','reservation', 'T8',        6, NOW() + INTERVAL 2 DAY, 'Candlelit table by the window.', 'pending', 'unpaid', NULL, NULL, 2, NULL, NOW() - INTERVAL 1 HOUR, NULL, NULL, NULL, NULL);

INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, notes) VALUES
(1, 21, '', 12, 0, NULL), (1, 2, '', 3, 0, NULL), (1, 14, '', 12, 0, NULL),
(2, 1, '', 1, 0, NULL), (2, 12, '', 2, 0, NULL), (2, 16, '', 2, 0, NULL),
(3, 20, '', 40, 0, NULL),
(4, 8, '', 2, 0, 'No chili'), (4, 11, '', 2, 0, NULL),
(5, 9, '', 1, 0, 'No peanut sauce'), (5, 3, '', 1, 0, NULL), (5, 12, '', 4, 0, NULL), (5, 18, '', 4, 0, NULL),
(6, 2, '', 1, 0, NULL), (6, 4, '', 1, 0, NULL), (6, 11, '', 2, 0, NULL),
(7, 7, '', 3, 0, NULL), (7, 10, '', 1, 0, NULL), (7, 15, '', 5, 0, NULL),
(8, 6, '', 1, 0, NULL), (8, 5, '', 1, 0, NULL), (8, 17, '', 2, 0, NULL);

-- fill names and prices from the menu, then compute order totals
UPDATE order_items oi JOIN menu_items m ON m.id = oi.menu_item_id SET oi.item_name = m.name, oi.unit_price = m.price;
UPDATE orders o SET total = (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_items WHERE order_id = o.id);

-- Snapshot recipes for kitchen-visible demo orders; only preparing/ready orders have deducted stock.
INSERT INTO order_item_ingredients
  (order_item_id, ingredient_id, ingredient_name, quantity_required, unit_of_measurement, inventory_unit)
SELECT oi.id, mii.ingredient_id, i.name, mii.quantity_required, mii.unit_of_measurement, i.unit
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
JOIN inventory_items i ON i.id = mii.ingredient_id
WHERE o.status IN ('sent', 'preparing', 'ready');

UPDATE orders SET ingredients_deducted_at = preparing_at WHERE status IN ('preparing', 'ready');

INSERT INTO activity_log (user_id, action, details, created_at) VALUES
(2, 'Order sent', 'MUN-00005 sent to kitchen', NOW() - INTERVAL 18 MINUTE),
(4, 'Order status', 'MUN-00006 marked as preparing', NOW() - INTERVAL 15 MINUTE),
(5, 'Order status', 'MUN-00007 marked as ready', NOW() - INTERVAL 5 MINUTE),
(6, 'Stock out', 'Crab (alimango): 2 kg removed (Used in kitchen)', NOW() - INTERVAL 1 DAY),
(6, 'Stock in', 'Tilapia: 10 kg received from Calaca Fish Port', NOW() - INTERVAL 2 DAY),
(5, 'Stock out', 'Chicken: 0.8 kg used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(5, 'Stock out', 'Tomatoes: 0.03 kg used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(5, 'Stock out', 'Calamansi: 0.06 kg used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(5, 'Stock out', 'Fresh milk: 0.5 L used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(5, 'Stock out', 'Cooking oil: 0.07 L used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(5, 'Stock out', 'Canton noodles: 0.5 pack used to prepare MUN-00007', NOW() - INTERVAL 35 MINUTE),
(4, 'Stock out', 'Shrimp (hipon): 0.15 kg used to prepare MUN-00006', NOW() - INTERVAL 15 MINUTE),
(4, 'Stock out', 'Squid (pusit): 0.2 kg used to prepare MUN-00006', NOW() - INTERVAL 15 MINUTE),
(4, 'Stock out', 'Calamansi: 0.02 kg used to prepare MUN-00006', NOW() - INTERVAL 15 MINUTE),
(4, 'Stock out', 'Rice: 0.3 kg used to prepare MUN-00006', NOW() - INTERVAL 15 MINUTE),
(4, 'Stock out', 'Cooking oil: 0.04 L used to prepare MUN-00006', NOW() - INTERVAL 15 MINUTE);
