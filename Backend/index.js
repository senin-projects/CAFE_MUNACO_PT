import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes); // login is public; the other auth routes check the token themselves
app.use('/api/menu', requireAuth, menuRoutes);
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Any error thrown in a route ends up here
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the server terminal for details.' });
});

const port = Number(process.env.PORT || 5000);

try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error('\nCould not connect to MySQL: ' + err.message);
  console.error('Check that MySQL is running in the XAMPP Control Panel, the database "cafe_munaco" was imported,');
  console.error('and the values in server/.env are right.\n');
  process.exit(1);
}

app.listen(port, () => console.log(`Cafe Munaco API running on http://localhost:${port}`));
