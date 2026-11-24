import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import loginRoutes from './routes/login.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orderRoutes.js';
import cashierRoutes from './routes/cashierRoutes.js';
import kitchenRoutes from './routes/kitchenRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import sharedRoutes from './routes/sharedRoutes.js';
import { errorHandler, notFound } from './controllers/systemController.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth/login', loginRoutes);
app.use('/api/auth', authRoutes); // Protected auth routes check their own token.
app.use('/api/orders', requireAuth);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', cashierRoutes);
app.use('/api/orders', kitchenRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api', ownerRoutes);
app.use('/api', sharedRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
