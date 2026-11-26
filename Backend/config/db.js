import 'dotenv/config';
import mysql from 'mysql2/promise';

// One MySQL pool serves [WBS 1 Cashier], [WBS 2 Kitchen], [WBS 3 Inventory], [WBS 4 Owner], and [WBS 5 Authentication].
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cafe_munaco',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as numbers, not strings
});
