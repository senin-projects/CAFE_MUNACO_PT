import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ownerHandlers } from '../controllers/ownerController.js';

const router = Router();
const menu = Router();
menu.get('/', ...ownerHandlers.getMenuHandlerChain('get', '/'));
menu.post('/', ...ownerHandlers.getMenuHandlerChain('post', '/'));
menu.put('/:id', ...ownerHandlers.getMenuHandlerChain('put', '/:id'));
menu.patch('/:id/availability', ...ownerHandlers.getMenuHandlerChain('patch', '/:id/availability'));
menu.delete('/:id', ...ownerHandlers.getMenuHandlerChain('delete', '/:id'));

const users = Router();
users.use(requireRole('owner'));
users.get('/', ...ownerHandlers.getUsersHandlerChain('get', '/'));
users.post('/', ...ownerHandlers.getUsersHandlerChain('post', '/'));
users.put('/:id', ...ownerHandlers.getUsersHandlerChain('put', '/:id'));
users.patch('/:id/active', ...ownerHandlers.getUsersHandlerChain('patch', '/:id/active'));
users.post('/:id/reset-password', ...ownerHandlers.getUsersHandlerChain('post', '/:id/reset-password'));

const reports = Router();
reports.use(requireRole('owner'));
reports.get('/summary', ...ownerHandlers.getReportsHandlerChain('get', '/summary'));

router.use('/menu', requireAuth, menu);
router.use('/users', requireAuth, users);
router.use('/reports', requireAuth, reports);

export default router;
