import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import loginRoutes from './routes/login.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orderRoutes.js';
import cashierRoutes from './modules/cashier/routes/cashierRoutes.js';
import kitchenRoutes from './modules/kitchen/routes/kitchenRoutes.js';
import menuRoutes from './modules/kitchen/routes/menuRoutes.js';
import inventoryRoutes from './modules/inventory/routes/inventoryRoutes.js';
import ownerRoutes from './modules/owner/routes/ownerRoutes.js';
import sharedRoutes from './routes/sharedRoutes.js';
import { errorHandler, notFound } from './controllers/systemController.js';

const app = express();
app.use(cors());
app.use(express.json());

// Shared authentication and order routes; module-owned routers live under Backend/modules/.
app.use('/api/auth/login', loginRoutes);
app.use('/api/auth', authRoutes); // Protected auth routes check their own token.
app.use('/api/orders', requireAuth);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', cashierRoutes);
app.use('/api/orders', kitchenRoutes);
app.use('/api/menu', requireAuth, menuRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api', ownerRoutes);
app.use('/api', sharedRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
