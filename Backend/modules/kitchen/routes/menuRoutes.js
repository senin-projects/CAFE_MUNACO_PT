import { Router } from 'express';
import { getMenuHandlerChain } from '../controllers/menuController.js';

const router = Router();
// [WBS 2.2.1] Register menu-item management endpoints.
// [WBS 2.2.2] Recipe updates use the same menu-item endpoints.
router.get('/', ...getMenuHandlerChain('get', '/'));
router.get('/:id', ...getMenuHandlerChain('get', '/:id'));
router.post('/', ...getMenuHandlerChain('post', '/'));
router.put('/:id', ...getMenuHandlerChain('put', '/:id'));
router.patch('/:id/availability', ...getMenuHandlerChain('patch', '/:id/availability'));
router.delete('/:id', ...getMenuHandlerChain('delete', '/:id'));

export default router;
