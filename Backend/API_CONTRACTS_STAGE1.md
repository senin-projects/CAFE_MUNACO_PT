# Stage 1: Existing API contract baseline

This document records the currently mounted backend API, authentication and role checks, and frontend call sites before any modular route migration. It is a read-only baseline for later stages. It does not authorize source changes.

## Mounts and shared middleware

`Backend/app.js` enables CORS and JSON request parsing, then registers these routers:

| Mount | Router | Middleware at mount | Additional route middleware |
|---|---|---|---|
| `/api/auth` | `routes/auth.js` | None at mount | `/login` is public; `/me`, `/profile`, and `/password` use `requireAuth` in the router |
| `/api/menu` | `routes/menu.js` | `requireAuth` | Writes use `requireRole('owner')`; menu reads do not add a role restriction |
| `/api/orders` | `routes/orders.js` | `requireAuth` | Individual read/write routes enforce role sets as detailed below |
| `/api/inventory` | `routes/inventory.js` | `requireAuth` | Read routes allow `inventory` and `owner`; mutations allow `inventory` |
| `/api/users` | `routes/users.js` | `requireAuth` | The whole router applies `requireRole('owner')` |
| `/api/dashboard` | `routes/dashboard.js` | `requireAuth` | No additional role middleware; response data branches by `req.user.role` |
| `/api/reports` | `routes/reports.js` | `requireAuth` | The whole router applies `requireRole('owner')` |
| `/api/notifications` | `routes/notifications.js` | `requireAuth` | No additional role middleware; results branch by role |

After these mounts, `/api` uses the not-found handler, followed by the shared error handler. `requireAuth` reads a Bearer token, verifies it, reloads the user, rejects missing/deactivated accounts, and sets `req.user`. `requireRole(...roles)` returns 403 for roles outside the supplied set.

## Existing endpoint contracts

Methods and paths below are relative to their mount. Request/response notes reflect current handlers; absent request bodies are omitted. Existing handlers use the shared async wrapper for forwarded errors except where noted.

### Authentication: `/api/auth`

| Method and path | Access | Request | Response/behavior |
|---|---|---|---|
| `POST /login` | Public | `{ username, password }` | `{ token, user: { id, full_name, username, role } }`; invalid credentials return 401, deactivated account returns 403 |
| `GET /me` | Authenticated | None | `{ user: { id, full_name, username, role } }` |
| `PUT /profile` | Authenticated | `{ full_name }` | `{ user }` with updated full name |
| `PUT /password` | Authenticated | `{ current_password, new_password }` | `{ ok: true }`; validates current password and minimum new-password length |

### Menu: `/api/menu`

| Method and path | Access | Request | Response/behavior |
|---|---|---|---|
| `GET /` | Any authenticated role | None | Array of `{ id, name, category, price, is_available }` |
| `POST /` | Owner | `{ name, category, price, is_available? }` | 201 `{ id }`; `is_available` defaults to true |
| `PUT /:id` | Owner | `{ name, category, price, is_available }` | `{ ok: true }` |
| `PATCH /:id/availability` | Owner | `{ is_available: boolean }` | `{ ok: true }` |
| `DELETE /:id` | Owner | None | `{ ok: true }` |

### Orders: `/api/orders`

The following paths are all currently implemented in the single `routes/orders.js` router. This is the shared order contract; cashier, kitchen, and owner behavior must not be duplicated during later extraction.

| Method and path | Access | Request | Response/behavior |
|---|---|---|---|
| `GET /` | Cashier, kitchen, owner | Optional query: `status` (comma-separated accepted statuses), `q`, `type`, `items=1`, `sort=oldest` | Array of orders; optional item rows when `items=1`. Kitchen results are constrained to kitchen-visible statuses and prices/payment fields are stripped for kitchen users. Limit 300. |
| `GET /:id` | Cashier, kitchen, owner | None | Order with items and cancellation details; kitchen can only read kitchen-visible statuses and receives prices/payment fields stripped. |
| `POST /` | Cashier | Order header and `items`; optional `send`, `payment_method` | 201 `{ id, order_no }`; validates menu items and prices, records order/items, and can atomically send a paid order when requested |
| `PUT /:id` | Cashier | Updated order header and `items`; `send: true` is rejected | `{ id, order_no }`; only editable unpaid pending orders are accepted |
| `POST /:id/payment` | Cashier | `{ method: 'cash' | 'card' | 'e_wallet' }` | `{ ok: true, payment_status: 'paid', payment_method }` |
| `POST /:id/send` | Cashier | No body required | `{ ok: true }`; requires an unpaid-to-paid recording and pending status |
| `POST /:id/cancel` | Cashier or owner | Owner cancellation requires `{ reason, payment_resolution? }`; cashier cancellation does not require a body | `{ ok: true, status: 'cancelled', payment_resolution }`; cashier may cancel only an unpaid pending draft; owner can cancel eligible orders subject to reason/refund validation |
| `PATCH /:id/status` | Cashier or kitchen | `{ status }` | `{ ok: true, status }`; one handler checks allowed transition by role: kitchen `sent → preparing → ready`; cashier `ready → served` |

Shared order implementation currently includes validation, menu-price lookup, item loading/writing, role-based price stripping, transactions, status transitions, and activity logging in `routes/orders.js`.

### Inventory: `/api/inventory`

| Method and path | Access | Request | Response/behavior |
|---|---|---|---|
| `GET /` | Inventory, owner | Optional query: `q`, `category`, `fresh=1`, `low=1` | Array of inventory items with computed `stock_status` |
| `GET /low` | Inventory, owner | None | Low-stock items with `stock_status` and computed `shortage` |
| `GET /movements` | Inventory, owner | Optional `type=in|out`, `item_id`, `q`, `days` | Movement rows joined with item and user names; maximum 500 |
| `GET /:id` | Inventory, owner | None | Item with computed `stock_status`; 404 if missing |
| `POST /` | Inventory | Item fields: `name`, `category`, `unit`; optional `quantity`, `reorder_level`, `is_fresh` | 201 `{ id }`; starting stock may also create a movement record in a transaction |
| `PUT /:id` | Inventory | `name`, `category`, `unit`, `reorder_level`, `is_fresh` | `{ ok: true }`; item quantity is changed through stock operations, not this edit route |
| `POST /:id/stock-in` | Inventory | `quantity`; optional `reason`, `supplier`, `note` | `{ ok: true, item }`; transactionally updates stock and records a movement |
| `POST /:id/stock-out` | Inventory | `quantity`, `reason`; optional `note` | `{ ok: true, item }`; rejects quantity above available stock and records the movement |

### Users: `/api/users`

All endpoints are owner-only because `routes/users.js` applies `requireRole('owner')` to the router.

| Method and path | Request | Response/behavior |
|---|---|---|
| `GET /` | None | Array of staff records (`id`, `full_name`, `username`, `role`, `is_active`, `created_at`) |
| `POST /` | `{ full_name, role, username, password }` | 201 `{ id }` |
| `PUT /:id` | `{ full_name, role }` | `{ ok: true }`; owner cannot change own role away from owner |
| `PATCH /:id/active` | `{ is_active }` | `{ ok: true }`; owner cannot deactivate own account |
| `POST /:id/reset-password` | `{ password }` | `{ ok: true }` |

### Dashboard: `/api/dashboard`

`GET /` is available to every authenticated role, with response data selected from `req.user.role`. It returns role-specific `stats` plus associated records: cashier order summaries; kitchen queue summary; inventory item/movement summary; or owner sales/order/staff/activity summary. The role branches and current response keys are implemented in `routes/dashboard.js`. This endpoint is **not owner-only**.

### Reports: `/api/reports`

| Method and path | Access | Request | Response/behavior |
|---|---|---|---|
| `GET /summary` | Owner | Optional query `days` (clamped to 1–365, defaults to 30) | Summary object containing totals, daily sales, order types, top items, status counts, stock-in count, stock-out reasons, and low-stock rows |

### Notifications: `/api/notifications`

Both endpoints are available to every authenticated role. The route returns different notification records based on role; this does not make the endpoint owner-only.

| Method and path | Request | Response/behavior |
|---|---|---|
| `GET /` | None | Array of role-specific notification objects with `id`, `title`, `message`, destination `to`, optional stock fields/date, and `is_read` where read-state data is present |
| `POST /read` | `{ ids: string[] }` | `{ ok: true }`; IDs are de-duplicated, length-limited, capped at 150, and recorded for the authenticated user |

## Frontend API call sites

`Frontend/src/services/api.js` prefixes calls with `/api`, sends JSON, attaches `Authorization: Bearer <token>` when present, clears the token and dispatches `munaco:signed-out` on an authenticated 401, and throws an error from the API response on failure. `Frontend/vite.config.js` proxies `/api` to `http://localhost:5000`.

| Frontend file | Calls made |
|---|---|
| `Frontend/src/auth.jsx` | `GET /auth/me`; `POST /auth/login` with `{ username, password }` |
| `Frontend/src/pages/Profile.jsx` | `PUT /auth/profile` with `{ full_name }`; `PUT /auth/password` with `{ current_password, new_password }` |
| `Frontend/src/modules/cashier/NewOrder.jsx` | `GET /orders/:id`; `POST /orders`; `PUT /orders/:id`; `POST /orders/:id/payment` with `{ method }`; `POST /orders/:id/send` |
| `Frontend/src/modules/cashier/OrderDetails.jsx` | `GET /orders/:id` through `useFetch`; `PATCH /orders/:id/status` with `{ status }`; `POST /orders/:id/cancel` with `{ reason, payment_resolution }` for owner cancel; `POST /orders/:id/payment` with `{ method }`; `POST /orders/:id/send` |
| `Frontend/src/modules/cashier/OrderList.jsx` | `GET /orders` through `useFetch`, with optional `q`, `status`, and `type` query parameters |
| `Frontend/src/modules/cashier/OrderLookup.jsx` | `GET /orders` through `useFetch`, with optional `q` query parameter |
| `Frontend/src/modules/kitchen/KitchenQueue.jsx` | `GET /orders` through `useFetch`, with `status`, `items=1`, and `sort` query parameters; `PATCH /orders/:id/status` with `{ status }` |
| `Frontend/src/modules/inventory/InventoryList.jsx` | `GET /inventory` through `useFetch`, with optional `q`, `category`, `fresh`, and `low` query parameters |
| `Frontend/src/modules/inventory/ItemForm.jsx` | `GET /inventory/:id`; `POST /inventory`; `PUT /inventory/:id` |
| `Frontend/src/modules/inventory/StockForm.jsx` | `POST /inventory/:id/stock-in` or `/stock-out` with the form body |
| `Frontend/src/modules/inventory/LowStock.jsx` | Low-stock query through `useFetch` |
| `Frontend/src/modules/inventory/StockHistory.jsx` | `GET /inventory/movements` through `useFetch`, with optional `q`, `type`, and `days` query parameters |
| `Frontend/src/modules/owner/MenuManagement.jsx` | Menu list query through `useFetch`; `POST /menu`; `PUT /menu/:id`; `PATCH /menu/:id/availability`; `DELETE /menu/:id` |
| `Frontend/src/modules/owner/Users.jsx` | User list query through `useFetch`; `POST /users`; `PUT /users/:id`; `POST /users/:id/reset-password`; `PATCH /users/:id/active` |
| `Frontend/src/modules/owner/Reports.jsx` | `GET /reports/summary?days=...` through `useFetch` |
| `Frontend/src/components/NotificationBell.jsx` | `GET /notifications` through `useFetch`; `POST /notifications/read` with `{ ids }` |
| `Frontend/src/pages/Dashboard.jsx` | `GET /dashboard` through `useFetch` with polling |
| `Frontend/src/hooks.js` | Shared `useFetch(path)` calls `api(path)`; the concrete endpoint is passed by each page above |

The low-stock list uses `GET /inventory/low`; the owner menu and users pages use `GET /menu` and `GET /users`; `Frontend/src/modules/inventory/StockForm.jsx` loads `GET /inventory`; and `Frontend/src/modules/inventory/ItemForm.jsx` loads `GET /inventory/:id`. The cashier list, lookup, kitchen queue, inventory list/low-stock/history, owner menu/users/reports, and dashboard use `useFetch`; the helper adds no endpoint of its own. The exact query strings are assembled in their respective page files and should be retained during migration.

## Migration safeguards recorded for later stages

- Register each endpoint/method combination exactly once at a time. Do not mount old and replacement handlers so both can execute the same operation.
- Keep the shared `PATCH /api/orders/:id/status` handler singular. It must dispatch using `req.user.role` to the cashier or kitchen operation after authentication, while shared transition rules/data logic remain reusable.
- Keep original route implementations until the replacement for each route is checked successfully. Remove an old handler only after the replacement is active and verified, preventing both double execution and gaps.
- Keep the dashboard and notification mounts available to every authenticated role; preserve their current role-dependent result branches.
- Do not change frontend call paths, database schema, or existing records as part of the backend restructuring.

## Stage 1 scope

This file documents the existing API baseline only. It does not create modular routers/controllers/models, edit runtime source, change route registration, or run migration tests. Those actions belong to later stages and require separate approval.
