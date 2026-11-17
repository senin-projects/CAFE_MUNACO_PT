import { pool } from '../config/db.js';
import { verifyToken } from '../auth.js';

// Every request must carry "Authorization: Bearer <token>". The user is re-checked
// in the database each time, so a deactivated account is locked out immediately.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const data = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!data) return res.status(401).json({ error: 'Please sign in again.' });
    const [rows] = await pool.query(
      'SELECT id, full_name, username, role, is_active FROM users WHERE id = ?',
      [data.id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'This account is not active.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: 'Your role does not have permission to do that.' });
