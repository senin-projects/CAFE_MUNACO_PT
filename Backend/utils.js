import { pool } from './config/db.js';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function logActivity(userId, action, details, conn = pool) {
  await conn.query('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)', [
    userId,
    action,
    String(details).slice(0, 255),
  ]);
}

export const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
