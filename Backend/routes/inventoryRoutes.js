import { Router } from 'express';
import { getInventoryHandlerChain } from '../controllers/inventoryController.js';

const router = Router();
router.get('/', ...getInventoryHandlerChain('get', '/'));
router.get('/low', ...getInventoryHandlerChain('get', '/low'));
router.get('/movements', ...getInventoryHandlerChain('get', '/movements'));
router.get('/:id', ...getInventoryHandlerChain('get', '/:id'));
router.post('/', ...getInventoryHandlerChain('post', '/'));
router.put('/:id', ...getInventoryHandlerChain('put', '/:id'));
router.delete('/:id', ...getInventoryHandlerChain('delete', '/:id'));
router.post('/:id/stock-in', ...getInventoryHandlerChain('post', '/:id/stock-in'));
router.post('/:id/stock-out', ...getInventoryHandlerChain('post', '/:id/stock-out'));

export default router;
