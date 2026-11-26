import { Router } from 'express';
import { getInventoryHandlerChain } from '../controllers/inventoryController.js';

const router = Router();
// [WBS 3.1.1] Inventory item CRUD and retrieval.
router.get('/', ...getInventoryHandlerChain('get', '/'));
router.get('/low', ...getInventoryHandlerChain('get', '/low'));
// [WBS 3.2.2] Retrieve filtered stock movement history.
router.get('/movements', ...getInventoryHandlerChain('get', '/movements'));
router.get('/:id', ...getInventoryHandlerChain('get', '/:id'));
router.post('/', ...getInventoryHandlerChain('post', '/'));
router.put('/:id', ...getInventoryHandlerChain('put', '/:id'));
router.delete('/:id', ...getInventoryHandlerChain('delete', '/:id'));
// [WBS 3.2.1] Record stock-in and stock-out.
router.post('/:id/stock-in', ...getInventoryHandlerChain('post', '/:id/stock-in'));
router.post('/:id/stock-out', ...getInventoryHandlerChain('post', '/:id/stock-out'));

export default router;
