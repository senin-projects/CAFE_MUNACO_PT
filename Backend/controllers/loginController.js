import { findForLogin } from '../models/userModel.js';
import { verifyPassword, signToken } from '../services/authService.js';
import { wrap, httpError, isBlank } from '../utils/http.js';
import { publicUser } from '../utils/publicUser.js';

export const login = wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (isBlank(username) || isBlank(password)) {
    throw httpError(400, 'Enter your username and password.');
  }

  const user = await findForLogin(String(username).trim());
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    throw httpError(401, 'Wrong username or password.');
  }
  if (!user.is_active) {
    throw httpError(403, 'This account has been deactivated. Ask the owner to reactivate it.');
  }

  res.json({ token: signToken({ id: user.id }), user: publicUser(user) });
});
