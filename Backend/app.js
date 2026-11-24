import 'dotenv/config';
import { pool } from './config/db.js';
import app from './server.js';

const port = Number(process.env.PORT || 5000);

try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error('\nCould not connect to MySQL: ' + err.message);
  console.error('Check that MySQL is running in the XAMPP Control Panel, the database "cafe_munaco" was imported,');
  console.error('and the values in Backend/.env are right.\n');
  process.exit(1);
}

app.listen(port, () => console.log(`Cafe Munaco API running on http://localhost:${port}`));
