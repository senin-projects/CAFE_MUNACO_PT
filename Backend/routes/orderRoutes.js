import { Router } from 'express';
import { getOrderHandlerChain } from '../controllers/orderController.js';

const router = Router();
// Shared reads/cancellations for WBS 1.2.1, 1.2.2, 2.1.1, and 4.3.1.
router.get('/', ...getOrderHandlerChain('get', '/'));
router.get('/:id', ...getOrderHandlerChain('get', '/:id'));
router.post('/:id/cancel', ...getOrderHandlerChain('post', '/:id/cancel'));

export default router;
