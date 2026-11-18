-- Cafe Munaco database for XAMPP (MySQL / MariaDB)
-- Import this file in phpMyAdmin: http://localhost/phpmyadmin  ->  Import  ->  choose this file  ->  Go
-- WARNING: running it again wipes and recreates all tables.

CREATE DATABASE IF NOT EXISTS cafe_munaco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_munaco;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notification_reads, activity_log, stock_movements, inventory_items, order_items, orders, menu_items, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('cashier','kitchen','inventory','owner') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_reads (
  user_id          INT          NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  read_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------- menu
CREATE TABLE menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  category     VARCHAR(50)   NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  is_available TINYINT(1)    NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------- orders
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
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (prepared_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
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
CREATE TABLE inventory_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  category      ENUM('Seafood','Meat','Vegetables','Dairy','Dry Goods','Beverages','Other') NOT NULL DEFAULT 'Other',
  unit          VARCHAR(20)  NOT NULL DEFAULT 'kg',
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_fresh      TINYINT(1)   NOT NULL DEFAULT 0,   -- fresh / perishable (seafood, vegetables, ...)
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE stock_movements (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  item_id        INT NOT NULL,
  movement_type  ENUM('in','out') NOT NULL,
  quantity       DECIMAL(10,2) NOT NULL,
  balance_after  DECIMAL(10,2) NOT NULL,
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

-- ---------------------------------------------------------------- activity log (owner monitors this)
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

INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, created_by, created_at)
SELECT id, 'in', quantity, quantity, 'Opening stock', 6, NOW() - INTERVAL 10 DAY FROM inventory_items WHERE quantity > 0;

INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, reason, supplier, created_by, created_at) VALUES
(2, 'out', 3.50, 4.50, 'Used in kitchen', NULL, 6, NOW() - INTERVAL 1 DAY),
(4, 'out', 2.00, 0.00, 'Used in kitchen', NULL, 6, NOW() - INTERVAL 1 DAY),
(1, 'in', 10.00, 18.00, 'Delivery', 'Calaca Fish Port', 6, NOW() - INTERVAL 2 DAY);

-- Sample orders so the dashboards, reports and kitchen screens are not empty
INSERT INTO orders (id, order_no, customer_name, order_type, table_no, guests, scheduled_at, special_requests, status, created_by, prepared_by, created_at, sent_at, preparing_at, ready_at, served_at) VALUES
(1, 'MUN-00001', 'Dela Rosa Family', 'birthday',    'Garden 1', 12, NOW() - INTERVAL 6 DAY, 'Birthday cake arrives at 6 PM, please hold the lights.', 'served', 2, 4, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
(2, 'MUN-00002', 'Mr. Tolentino',    'dine_in',     'T4',        2, NULL, NULL, 'served', 2, 4, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(3, 'MUN-00003', 'Barangay Office',  'buffet',      'Hall',     40, NOW() - INTERVAL 2 DAY, NULL, 'served', 3, 5, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(4, 'MUN-00004', 'Ms. Aguilar',      'takeout',     NULL,        NULL, NULL, 'No chili please.', 'served', 3, 4, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
(5, 'MUN-00005', 'Garcia Table',     'dine_in',     'T2',        4, NULL, 'One guest allergic to peanuts (kare-kare without peanut sauce).', 'sent', 2, NULL, NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL 18 MINUTE, NULL, NULL, NULL),
(6, 'MUN-00006', 'Bautista Couple',  'dine_in',     'T6',        2, NULL, NULL, 'preparing', 2, 4, NOW() - INTERVAL 30 MINUTE, NOW() - INTERVAL 28 MINUTE, NOW() - INTERVAL 15 MINUTE, NULL, NULL),
(7, 'MUN-00007', 'Cruz Family',      'dine_in',     'T3',        5, NULL, NULL, 'ready', 3, 5, NOW() - INTERVAL 45 MINUTE, NOW() - INTERVAL 43 MINUTE, NOW() - INTERVAL 35 MINUTE, NOW() - INTERVAL 5 MINUTE, NULL),
(8, 'MUN-00008', 'Lopez Anniversary','reservation', 'T8',        6, NOW() + INTERVAL 2 DAY, 'Candlelit table by the window.', 'pending', 2, NULL, NOW() - INTERVAL 1 HOUR, NULL, NULL, NULL, NULL);

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

INSERT INTO activity_log (user_id, action, details, created_at) VALUES
(2, 'Order sent', 'MUN-00005 sent to kitchen', NOW() - INTERVAL 18 MINUTE),
(4, 'Order status', 'MUN-00006 marked as preparing', NOW() - INTERVAL 15 MINUTE),
(5, 'Order status', 'MUN-00007 marked as ready', NOW() - INTERVAL 5 MINUTE),
(6, 'Stock out', 'Crab (alimango): 2 kg removed (Used in kitchen)', NOW() - INTERVAL 1 DAY),
(6, 'Stock in', 'Tilapia: 10 kg received from Calaca Fish Port', NOW() - INTERVAL 2 DAY);
