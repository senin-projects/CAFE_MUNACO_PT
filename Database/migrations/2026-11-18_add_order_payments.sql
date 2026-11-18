-- Apply once to an existing cafe_munaco database to enable cashier payment recording.
ALTER TABLE orders
  ADD COLUMN payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid' AFTER total,
  ADD COLUMN payment_method ENUM('cash','card','e_wallet') NULL AFTER payment_status,
  ADD COLUMN paid_at DATETIME NULL AFTER payment_method;
