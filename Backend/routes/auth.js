import { Router } from 'express';
import { findPasswordHash, updateName, updatePassword } from '../models/userModel.js';
import { hashPassword, verifyPassword } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, httpError, isBlank } from '../utils/http.js';
import { publicUser } from '../utils/publicUser.js';

const router = Router();

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put(
  '/profile',
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body?.full_name || '').trim();
    if (name.length < 2) throw httpError(400, 'Enter your full name.');
    await updateName(req.user.id, name);
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
    const passwordHash = await findPasswordHash(req.user.id);
    if (!passwordHash || !verifyPassword(String(current_password || ''), passwordHash)) {
      throw httpError(400, 'Your current password is not correct.');
    }
    await updatePassword(req.user.id, hashPassword(String(new_password)));
    res.json({ ok: true });
  })
);

export default router;
