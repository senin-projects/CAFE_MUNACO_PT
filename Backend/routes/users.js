import { Router } from 'express';
import { pool } from '../config/db.js';
import { hashPassword } from '../auth.js';
import { requireRole } from '../middleware/auth.js';
import { wrap, httpError, isBlank, logActivity } from '../utils.js';

const router = Router();
router.use(requireRole('owner')); // the whole file is owner-only

const ROLES = ['cashier', 'kitchen', 'inventory', 'owner'];
const COLUMNS = 'id, full_name, username, role, is_active, created_at';

function checkName(v) {
  const name = String(v || '').trim();
  if (name.length < 2) throw httpError(400, 'Enter the employee’s full name.');
  return name;
}
function checkRole(v) {
  if (!ROLES.includes(v)) throw httpError(400, 'Choose a role.');
  return v;
}
function checkPassword(v) {
  if (isBlank(v) || String(v).length < 6) throw httpError(400, 'The password needs at least 6 characters.');
  return String(v);
}

router.get(
  '/',
  wrap(async (req, res) => {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY is_active DESC, role, full_name`);
    res.json(rows);
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const b = req.body || {};
    const full_name = checkName(b.full_name);
    const role = checkRole(b.role);
    const username = String(b.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(username)) {
      throw httpError(400, 'Username must be 3–30 characters: letters, numbers, dot or underscore.');
    }
    const password = checkPassword(b.password);

    const [dup] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (dup.length) throw httpError(409, `The username "${username}" is already taken.`);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, username, hashPassword(password), role]
    );
    await logActivity(req.user.id, 'Account created', `${full_name} (${role}) added`);
    res.status(201).json({ id: result.insertId });
  })
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    const full_name = checkName(req.body?.full_name);
    const role = checkRole(req.body?.role);
    if (Number(req.params.id) === req.user.id && role !== 'owner') {
      throw httpError(400, 'You cannot change your own role.');
    }
    const [result] = await pool.query('UPDATE users SET full_name = ?, role = ? WHERE id = ?', [full_name, role, req.params.id]);
    if (!result.affectedRows) throw httpError(404, 'Account not found.');
    await logActivity(req.user.id, 'Account edited', `${full_name} is now ${role}`);
    res.json({ ok: true });
  })
);

router.patch(
  '/:id/active',
  wrap(async (req, res) => {
    const active = req.body?.is_active ? 1 : 0;
    if (Number(req.params.id) === req.user.id && !active) {
      throw httpError(400, 'You cannot deactivate your own account.');
    }
    const [result] = await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [active, req.params.id]);
    if (!result.affectedRows) throw httpError(404, 'Account not found.');
    const [[user]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, active ? 'Account activated' : 'Account deactivated', user.full_name);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/reset-password',
  wrap(async (req, res) => {
    const password = checkPassword(req.body?.password);
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), req.params.id]);
    if (!result.affectedRows) throw httpError(404, 'Account not found.');
    const [[user]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'Password reset', `Password reset for ${user.full_name}`);
    res.json({ ok: true });
  })
);

export default router;
