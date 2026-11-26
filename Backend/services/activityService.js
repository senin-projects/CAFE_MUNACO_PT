import { pool } from '../config/db.js';

// Shared activity writer used by cashier order changes, inventory changes, and owner monitoring.
// [WBS 1.2.2] Record order status activity.
// [WBS 3.2.1] Record stock movement activity.
// [WBS 4.1.1] Provide recent activity for the owner overview.
// [WBS 4.4.1] Record staff-account changes.
export async function logActivity(userId, action, details, conn = pool) {
  await conn.query('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)', [
    userId,
    action,
    String(details).slice(0, 255),
  ]);
}
