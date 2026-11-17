import { Router } from 'express';
import { pool } from '../config/db.js';
import { hashPassword, verifyPassword, signToken } from '../auth.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, httpError, isBlank } from '../utils.js';

const router = Router();
const publicUser = (u) => ({ id: u.id, full_name: u.full_name, username: u.username, role: u.role });

router.post(
  '/login',
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (isBlank(username) || isBlank(password)) throw httpError(400, 'Enter your username and password.');
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [String(username).trim()]);
    const user = rows[0];
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      throw httpError(401, 'Wrong username or password.');
    }
    if (!user.is_active) throw httpError(403, 'This account has been deactivated. Ask the owner to reactivate it.');
    res.json({ token: signToken({ id: user.id }), user: publicUser(user) });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put(
  '/profile',
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body?.full_name || '').trim();
    if (name.length < 2) throw httpError(400, 'Enter your full name.');
    await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [name, req.user.id]);
    res.json({ user: { ...publicUser(req.user), full_name: name } });
  })
);

router.put(
  '/password',
  requireAuth,
  wrap(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (isBlank(new_password) || String(new_password).length < 6) {
      throw httpError(400, 'The new password needs at least 6 characters.');
    }
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!verifyPassword(String(current_password || ''), rows[0].password_hash)) {
      throw httpError(400, 'Your current password is not correct.');
    }
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(String(new_password)), req.user.id]);
    res.json({ ok: true });
  })
);

export default router;
