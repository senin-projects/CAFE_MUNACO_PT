CREATE TABLE IF NOT EXISTS notification_reads (
  user_id          INT          NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  read_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
