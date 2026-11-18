import { Router } from 'express';
import { getOrderHandlerChain } from '../controllers/orderController.js';

const router = Router();
router.get('/', ...getOrderHandlerChain('get', '/'));
router.get('/:id', ...getOrderHandlerChain('get', '/:id'));
router.post('/:id/cancel', ...getOrderHandlerChain('post', '/:id/cancel'));

export default router;
