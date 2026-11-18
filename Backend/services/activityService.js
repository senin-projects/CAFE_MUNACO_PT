import { pool } from '../config/db.js';

export async function logActivity(userId, action, details, conn = pool) {
  await conn.query('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)', [
    userId,
    action,
    String(details).slice(0, 255),
  ]);
}
