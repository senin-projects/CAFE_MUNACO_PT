import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth.js';
import { ownerHandlers } from '../controllers/ownerController.js';

const router = Router();
// [WBS 4.4.1] Owner-only staff account management.
const users = Router();
users.use(requireRole('owner'));
users.get('/', ...ownerHandlers.getUsersHandlerChain('get', '/'));
users.post('/', ...ownerHandlers.getUsersHandlerChain('post', '/'));
users.put('/:id', ...ownerHandlers.getUsersHandlerChain('put', '/:id'));
users.patch('/:id/active', ...ownerHandlers.getUsersHandlerChain('patch', '/:id/active'));
users.post('/:id/reset-password', ...ownerHandlers.getUsersHandlerChain('post', '/:id/reset-password'));

const reports = Router();
// [WBS 4.2.1] Owner-only sales analytics.
reports.use(requireRole('owner'));
reports.get('/summary', ...ownerHandlers.getReportsHandlerChain('get', '/summary'));

router.use('/users', requireAuth, users);
router.use('/reports', requireAuth, reports);

export default router;
