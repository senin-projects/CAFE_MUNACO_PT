import { Router } from 'express';
import { updateOrderStatusHandlers } from '../controllers/kitchenController.js';

const router = Router();
router.patch('/:id/status', ...updateOrderStatusHandlers);

export default router;
