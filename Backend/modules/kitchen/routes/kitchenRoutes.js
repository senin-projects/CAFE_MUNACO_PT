import { Router } from 'express';
import { updateOrderStatusHandlers } from '../controllers/kitchenController.js';

const router = Router();
// [WBS 2.1.2] Update kitchen preparation status.
// [WBS 1.2.2] Allow cashier to mark ready orders served.
router.patch('/:id/status', ...updateOrderStatusHandlers);

export default router;
