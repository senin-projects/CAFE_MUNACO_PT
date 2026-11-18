import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import { errorHandler, notFound } from './controllers/systemController.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes); // Login is public; protected auth routes check their own token.
app.use('/api/menu', requireAuth, menuRoutes);
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
