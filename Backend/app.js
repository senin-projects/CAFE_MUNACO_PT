import 'dotenv/config';
import { pool } from './config/db.js';
import app from './server.js';

const port = Number(process.env.PORT || 5000);

try {
  await pool.query('SELECT 1');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      menu_item_id       INT NOT NULL,
      ingredient_id      INT NOT NULL,
      quantity_required  DECIMAL(10,2) NOT NULL,
      unit_of_measurement VARCHAR(20) NOT NULL,
      PRIMARY KEY (menu_item_id, ingredient_id),
      INDEX idx_menu_item_ingredients_ingredient (ingredient_id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
    )
  `);
} catch (err) {
  console.error('\nCould not connect to MySQL: ' + err.message);
  console.error('Check that MySQL is running in the XAMPP Control Panel, the database "cafe_munaco" was imported,');
  console.error('and the values in Backend/.env are right.\n');
  process.exit(1);
}

app.listen(port, () => console.log(`Cafe Munaco API running on http://localhost:${port}`));
