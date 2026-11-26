import { findById } from '../models/userModel.js';
import { verifyToken } from '../services/authService.js';

// Every request must carry "Authorization: Bearer <token>". The user is re-checked
// in the database each time, so a deactivated account is locked out immediately.
// [WBS 5.1.2] Authenticate each protected request and reload the active user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const data = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!data) return res.status(401).json({ error: 'Please sign in again.' });
    const user = await findById(data.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'This account is not active.' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// [WBS 5.1.2] Restrict each API route to its permitted roles.
export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: 'Your role does not have permission to do that.' });
