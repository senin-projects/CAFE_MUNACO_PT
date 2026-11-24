# Cafe Munaco – setup (Frontend / Backend / Database)

## 1. Database (XAMPP)
Start MySQL in XAMPP, open http://localhost/phpmyadmin -> Import -> `Database/cafe_munaco.sql`.
WARNING: importing again wipes all tables. Do it once per computer.
For an existing database, also apply the unapplied migrations in `Database/migrations/` in date order in phpMyAdmin, including `2026-11-24_create_menu_item_ingredients.sql`.

## 2. Backend
```
cd Backend
copy .env.example .env     (Mac/Linux: cp .env.example .env)
npm install
node app.js
```
Expected: `Cafe Munaco API running on http://localhost:5000`

## 3. Frontend (second terminal)
```
cd Frontend
npm install
npm run dev
```
Open http://localhost:5173

## Demo accounts
owner / owner123 · cashier1 / cashier123 · kitchen1 / kitchen123 · inventory1 / inventory123

## Who edits what
| Member | Folder |
|---|---|
| Domingo Yhuan (owner) | Frontend/src/modules/cashier |
| Zenin Mae Jalique (kitchen) | Frontend/src/modules/kitchen |
| Gwyneth Marquinez (inventory) | Frontend/src/modules/inventory |
| John Lloyd Bueno (cashier) | Frontend/src/modules/owner |

Shared (ask the group first): App.jsx, nav.js, auth.jsx, hooks.js, utils.js, components/, pages/, services/api.js,
and in Backend: index.js, auth.js, utils.js, config/, middleware/, routes/, Database/.
OrderList/OrderDetails (cashier folder) are also used by kitchen and owner; InventoryList/StockHistory (inventory folder) are also used by owner.
