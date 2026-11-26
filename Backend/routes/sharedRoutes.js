import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sharedHandlers } from '../controllers/sharedController.js';

const router = Router();
// Cross-role endpoint aggregation for the dashboard and notification WBS tasks.
const dashboard = Router();
dashboard.get('/', ...sharedHandlers.getDashboardHandlerChain('get', '/'));
const notifications = Router();
notifications.post('/read', ...sharedHandlers.getNotificationsHandlerChain('post', '/read'));
notifications.get('/', ...sharedHandlers.getNotificationsHandlerChain('get', '/'));

// These endpoints intentionally remain available to all authenticated roles.
router.use('/dashboard', requireAuth, dashboard);
router.use('/notifications', requireAuth, notifications);

export default router;
