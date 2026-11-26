# Cafe Munaco – setup (Frontend / Backend / Database)

## 1. Database (XAMPP)
Start MySQL in XAMPP, open http://localhost/phpmyadmin -> Import -> `Database/cafe_munaco.sql`.
WARNING: importing again wipes all tables. Do it once per computer.
For an existing database, also apply the unapplied migrations in `Database/migrations/` in date order in phpMyAdmin, including `2026-11-24_create_menu_item_ingredients.sql`, `2026-11-25_add_recipe_unit_conversions.sql`, and `2026-11-25_add_order_recipe_snapshots.sql`.

Orders snapshot their ingredient recipes when sent to the kitchen. Inventory is deducted when preparation starts. If an owner cancels an order after preparation starts, they must record whether ingredients were consumed/wasted or fully restocked.
Cashier menu availability is calculated from each product's recipe and current ingredient stock. Products remain visible but cannot be added when stock is insufficient; availability refreshes automatically, and stock is checked again when orders are saved, sent to the kitchen, and prepared.
The fresh-import seed includes illustrative demo recipes so sample kitchen orders can run. Replace their quantities with the cafe's actual recipes in Menu Management before production use. Menu items without recipes are marked as requiring a recipe and cannot be ordered. Seed changes affect fresh imports only; existing databases retain their current data.

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

## WBS ownership and project layout

The repository remains one application with one database. Module folders group module-owned code; shared files and cross-role workflows stay shared and are mapped below.

```text
Backend/
  modules/
    cashier/
      controllers/cashierController.js
      routes/cashierRoutes.js
    kitchen/
      controllers/kitchenController.js
      controllers/menuController.js
      routes/kitchenRoutes.js
      routes/menuRoutes.js
    inventory/
      controllers/inventoryController.js
      routes/inventoryRoutes.js
    owner/
      controllers/ownerController.js
      controllers/reportsController.js
      controllers/usersController.js
      routes/ownerRoutes.js
  controllers/                         # shared order, dashboard, auth, notification, and system handlers
  routes/                              # shared auth, login, order, and dashboard/notification routes
  config/ middleware/ models/ services/ utils/ # shared backend infrastructure and logic
Database/                              # one schema and shared migrations
Frontend/src/
  modules/
    cashier/                           # order taking and cashier order screens
    kitchen/                           # kitchen queue, dashboard, menu, and recipes
    inventory/                         # inventory and stock management
    owner/                             # owner analytics and staff screens
  components/ pages/ services/         # shared UI, route shell, auth, and API helpers
Shared/units.js                        # shared recipe/inventory unit conversion
```

### Assigned members

| WBS area | Member | Main module paths |
|---|---|---|
| 1 Cashier | John Lloyd Bueno | `Frontend/src/modules/cashier/`, `Backend/modules/cashier/` |
| 2 Kitchen | Zenin Mae Jalique | `Frontend/src/modules/kitchen/`, `Backend/modules/kitchen/` |
| 3 Inventory | Gwyneth Marquinez | `Frontend/src/modules/inventory/`, `Backend/modules/inventory/` |
| 4 Owner | Domingo Yhuan (frontend); Zenin Mae Jalique (backend) | Owner frontend screens plus shared owner views; `Backend/modules/owner/` |
| 5 Authentication | Zenin Mae Jalique | Shared frontend auth and `Backend/controllers/`, `Backend/routes/`, `Backend/middleware/` |

### WBS-to-file and commit mapping

Stage the files in the row for the WBS task being committed. A shared file can appear in multiple rows: stage only that task's hunk with `git add -p` if the same file contains changes for another task.

| WBS | Task | Frontend files | Backend / shared files |
|---|---|---|---|
| 1.1.1 | Implement order creation and editing | `Frontend/src/modules/cashier/NewOrder.jsx` | `Backend/modules/cashier/controllers/cashierController.js`, `Backend/modules/cashier/routes/cashierRoutes.js`, `Backend/services/orderService.js`, `Backend/models/orderModel.js` |
| 1.1.2 | Implement payment and sending to kitchen | `Frontend/src/modules/cashier/NewOrder.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` | `Backend/modules/cashier/controllers/cashierController.js`, `Backend/modules/cashier/routes/cashierRoutes.js`, `Backend/services/orderInventoryService.js`, `Backend/models/orderModel.js`, `Database/migrations/2026-11-18_add_order_payments.sql`, `Database/migrations/2026-11-25_add_order_recipe_snapshots.sql` |
| 1.2.1 | Display order list and order details | `Frontend/src/modules/cashier/OrderList.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` | `Backend/controllers/orderController.js`, `Backend/routes/orderRoutes.js`, `Backend/models/orderModel.js` |
| 1.2.2 | Implement serving and cancelling of orders | `Frontend/src/modules/cashier/OrderDetails.jsx` | `Backend/controllers/orderController.js`, `Backend/modules/kitchen/controllers/kitchenController.js`, `Backend/modules/kitchen/routes/kitchenRoutes.js`, `Backend/services/orderService.js`, `Backend/services/activityService.js`, `Database/migrations/2026-11-18_add_order_cancellations.sql` |
| 1.3.1 | Display cashier dashboard summary | `Frontend/src/pages/Dashboard.jsx` | `Backend/controllers/dashboardController.js`, `Backend/routes/sharedRoutes.js` |
| 2.1.1 | Display incoming, preparing, and ready orders | `Frontend/src/modules/kitchen/KitchenOrders.jsx`, `Frontend/src/modules/kitchen/KitchenQueue.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` (shared order detail view) | `Backend/controllers/orderController.js`, `Backend/routes/orderRoutes.js`, `Backend/services/orderService.js` |
| 2.1.2 | Implement order preparation status updates | `Frontend/src/modules/kitchen/KitchenQueue.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` | `Backend/modules/kitchen/controllers/kitchenController.js`, `Backend/modules/kitchen/routes/kitchenRoutes.js`, `Backend/services/orderService.js`, `Backend/services/orderInventoryService.js`, `Database/migrations/2026-11-25_add_order_recipe_snapshots.sql` |
| 2.1.3 | Display kitchen order history | `Frontend/src/modules/kitchen/KitchenQueue.jsx`, `Frontend/src/modules/kitchen/KitchenOrders.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` (shared) | `Backend/controllers/orderController.js`, `Backend/routes/orderRoutes.js` |
| 2.2.1 | Implement menu item create, update, delete, and availability | `Frontend/src/modules/kitchen/MenuManagement.jsx` | `Backend/modules/kitchen/controllers/menuController.js`, `Backend/modules/kitchen/routes/menuRoutes.js` |
| 2.2.2 | Implement ingredient recipes per menu item | `Frontend/src/modules/kitchen/MenuManagement.jsx` | `Backend/modules/kitchen/controllers/menuController.js`, `Backend/modules/kitchen/routes/menuRoutes.js`, `Backend/services/orderInventoryService.js`, `Shared/units.js`, `Database/migrations/2026-11-24_create_menu_item_ingredients.sql`, `Database/migrations/2026-11-25_add_recipe_unit_conversions.sql` |
| 2.3.1 | Display kitchen dashboard summary | `Frontend/src/pages/Dashboard.jsx`, `Frontend/src/modules/kitchen/KitchenDashboard.jsx` | `Backend/controllers/dashboardController.js`, `Backend/routes/sharedRoutes.js` |
| 3.1.1 | Implement inventory item create, update, and delete | `Frontend/src/modules/inventory/InventoryList.jsx`, `Frontend/src/modules/inventory/ItemForm.jsx` | `Backend/modules/inventory/controllers/inventoryController.js`, `Backend/modules/inventory/routes/inventoryRoutes.js`, `Database/cafe_munaco.sql` |
| 3.2.1 | Record stock-in and stock-out | `Frontend/src/modules/inventory/StockManagement.jsx`, `Frontend/src/modules/inventory/StockForm.jsx` | `Backend/modules/inventory/controllers/inventoryController.js`, `Backend/modules/inventory/routes/inventoryRoutes.js`, `Backend/services/activityService.js` |
| 3.2.2 | Display stock movement history | `Frontend/src/modules/inventory/StockHistory.jsx`, `Frontend/src/modules/inventory/StockManagement.jsx` | `Backend/modules/inventory/controllers/inventoryController.js`, `Backend/modules/inventory/routes/inventoryRoutes.js` |
| 3.2.3 | Update stock for ordered items | `Frontend/src/modules/inventory/InventoryList.jsx`, `Frontend/src/modules/inventory/StockHistory.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` (shared outcomes) | `Backend/services/orderInventoryService.js`, `Backend/services/orderService.js`, `Backend/modules/cashier/controllers/cashierController.js`, `Backend/modules/kitchen/controllers/kitchenController.js`, `Backend/controllers/orderController.js`, `Backend/modules/inventory/controllers/inventoryController.js`, `Shared/units.js`, `Database/migrations/2026-11-25_add_order_recipe_snapshots.sql`, `Database/migrations/2026-11-25_add_recipe_unit_conversions.sql` |
| 3.3.1 | Display low-stock items and inventory dashboard | `Frontend/src/pages/Dashboard.jsx`, `Frontend/src/modules/inventory/InventoryList.jsx`; **Review:** low-stock notification UI is not present in the current frontend. | `Backend/modules/inventory/controllers/inventoryController.js`, `Backend/controllers/dashboardController.js`, `Backend/controllers/notificationsController.js`, `Backend/routes/sharedRoutes.js` |
| 4.1.1 | Display owner overview dashboard | `Frontend/src/pages/Dashboard.jsx` | `Backend/controllers/dashboardController.js`, `Backend/routes/sharedRoutes.js`, `Backend/services/activityService.js` |
| 4.1.2 | Display notifications | **Review:** no frontend notification component or `/notifications` API call exists in the current tracked source. | `Backend/controllers/notificationsController.js`, `Backend/routes/sharedRoutes.js`, `Database/migrations/2026-11-18_create_notification_reads.sql` |
| 4.2.1 | Calculate and display sales summaries and trend charts | `Frontend/src/modules/owner/Reports.jsx`, `Frontend/src/pages/Dashboard.jsx` | `Backend/modules/owner/controllers/reportsController.js`, `Backend/modules/owner/controllers/ownerController.js`, `Backend/modules/owner/routes/ownerRoutes.js` |
| 4.2.2 | Identify best-selling items and sales by category | `Frontend/src/modules/owner/Reports.jsx` | `Backend/modules/owner/controllers/reportsController.js`, `Backend/modules/owner/controllers/ownerController.js`, `Backend/modules/owner/routes/ownerRoutes.js` |
| 4.3.1 | Monitor and cancel orders | `Frontend/src/modules/cashier/OrderList.jsx`, `Frontend/src/modules/cashier/OrderDetails.jsx` (shared role-aware screens) | `Backend/controllers/orderController.js`, `Backend/routes/orderRoutes.js`, `Backend/services/orderInventoryService.js` |
| 4.3.2 | View inventory overview and stock history | `Frontend/src/modules/inventory/InventoryModule.jsx`, `Frontend/src/modules/inventory/InventoryList.jsx`, `Frontend/src/modules/inventory/StockHistory.jsx` (shared read-only views) | `Backend/modules/inventory/controllers/inventoryController.js`, `Backend/modules/inventory/routes/inventoryRoutes.js` |
| 4.4.1 | Implement staff account create, update, and activate or deactivate | `Frontend/src/modules/owner/Users.jsx` | `Backend/modules/owner/controllers/usersController.js`, `Backend/modules/owner/controllers/ownerController.js`, `Backend/modules/owner/routes/ownerRoutes.js`, `Backend/services/authService.js`, `Backend/services/activityService.js` |
| 4.4.2 | Implement staff password reset | `Frontend/src/modules/owner/Users.jsx` | `Backend/modules/owner/controllers/usersController.js`, `Backend/modules/owner/controllers/ownerController.js`, `Backend/modules/owner/routes/ownerRoutes.js`, `Backend/services/authService.js` |
| 5.1.1 | Implement login and session handling | `Frontend/src/pages/Login.jsx`, `Frontend/src/auth.jsx`, `Frontend/src/services/login.js`, `Frontend/src/services/api.js` | `Backend/controllers/loginController.js`, `Backend/routes/login.js`, `Backend/routes/auth.js`, `Backend/services/authService.js`, `Backend/models/userModel.js` |
| 5.1.2 | Implement role-based access | `Frontend/src/App.jsx`, `Frontend/src/nav.js`, `Frontend/src/components/Layout.jsx`, `Frontend/src/auth.jsx` | `Backend/server.js`, `Backend/middleware/auth.js`, `Backend/services/authService.js` |
| 5.1.3 | Implement My Profile | `Frontend/src/pages/Profile.jsx`, `Frontend/src/auth.jsx` | `Backend/routes/auth.js`, `Backend/models/userModel.js` |

### Shared files and staging notes

These are shared by multiple WBS tasks and should not be copied into module folders or duplicated:

- Backend startup/configuration: `Backend/app.js`, `Backend/server.js`, `Backend/config/db.js`.
- Backend cross-module handlers/routes: `Backend/controllers/orderController.js`, `Backend/controllers/dashboardController.js`, `Backend/controllers/notificationsController.js`, `Backend/controllers/loginController.js`, `Backend/controllers/routeHandlers.js`, `Backend/controllers/sharedController.js`, `Backend/controllers/systemController.js`, `Backend/routes/auth.js`, `Backend/routes/login.js`, `Backend/routes/orderRoutes.js`, `Backend/routes/sharedRoutes.js`.
- Backend shared logic: `Backend/middleware/auth.js`, `Backend/models/orderModel.js`, `Backend/models/userModel.js`, `Backend/services/activityService.js`, `Backend/services/authService.js`, `Backend/services/orderInventoryService.js`, `Backend/services/orderService.js`, `Backend/utils/`, `Backend/config/`.
- Frontend shared shell/services: `Frontend/src/App.jsx`, `Frontend/src/auth.jsx`, `Frontend/src/nav.js`, `Frontend/src/hooks.js`, `Frontend/src/utils.js`, `Frontend/src/components/`, `Frontend/src/pages/`, `Frontend/src/services/`, `Frontend/src/App.css`, `Frontend/src/index.css`.
- One shared database and schema: `Database/` and `Shared/units.js`.

The file moves, route registration updates, and comments in this reorganization span all modules and should be committed once as a shared structural baseline. For future WBS work, use the task row above; do not stage entire shared files when they contain unrelated task changes. Example: `git add -p Backend/controllers/orderController.js`.

For each task, stage the listed paths (or matching hunks in shared files), then use a task-specific commit message such as `WBS 1.1.1: Implement order creation and editing` and push that member's branch.
