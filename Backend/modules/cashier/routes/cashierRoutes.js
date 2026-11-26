import { Router } from 'express';
import {
  createOrderHandlers,
  editOrderHandlers,
  recordPaymentHandlers,
  sendOrderHandlers,
} from '../controllers/cashierController.js';

const router = Router();
// [WBS 1.1.1] Create and edit cashier orders.
router.post('/', ...createOrderHandlers);
router.put('/:id', ...editOrderHandlers);
// [WBS 1.1.2] Record payment and send paid orders to the kitchen.
router.post('/:id/payment', ...recordPaymentHandlers);
router.post('/:id/send', ...sendOrderHandlers);

export default router;
