-- Adds an audit record for cashier cancellations and owner-approved voids.
CREATE TABLE IF NOT EXISTS order_cancellations (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  order_id           INT NOT NULL UNIQUE,
  cancelled_by       INT NOT NULL,
  previous_status    ENUM('pending','sent','preparing','ready') NOT NULL,
  reason             VARCHAR(500) NOT NULL,
  payment_resolution ENUM('not_applicable','refunded','not_refunded') NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (cancelled_by) REFERENCES users(id)
);
