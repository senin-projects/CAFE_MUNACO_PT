import { Router } from 'express';
import {
  createOrderHandlers,
  editOrderHandlers,
  recordPaymentHandlers,
  sendOrderHandlers,
} from '../controllers/cashierController.js';

const router = Router();
router.post('/', ...createOrderHandlers);
router.put('/:id', ...editOrderHandlers);
router.post('/:id/payment', ...recordPaymentHandlers);
router.post('/:id/send', ...sendOrderHandlers);

export default router;
