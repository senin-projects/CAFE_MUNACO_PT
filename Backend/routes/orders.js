// Backward-compatible combined order router. app.js mounts the individual
// modular routers so each method/path is registered exactly once.
import { Router } from 'express';
import sharedOrderRoutes from './orderRoutes.js';
import cashierRoutes from './cashierRoutes.js';
import kitchenRoutes from './kitchenRoutes.js';

const router = Router();
router.use(sharedOrderRoutes, cashierRoutes, kitchenRoutes);

export default router;
