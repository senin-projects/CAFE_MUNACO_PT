import { Router } from 'express';
import { login } from '../controllers/loginController.js';

const router = Router();
// [WBS 5.1.1] Expose the public login endpoint.
router.post('/', login);

export default router;
