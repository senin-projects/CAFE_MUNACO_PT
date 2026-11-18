import { pool } from '../config/db.js';

export async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, full_name, username, role, is_active FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function findForLogin(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}

export async function findPasswordHash(id) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [id]);
  return rows[0]?.password_hash || null;
}

export async function updateName(id, name) {
  await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [name, id]);
}

export async function updatePassword(id, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}
