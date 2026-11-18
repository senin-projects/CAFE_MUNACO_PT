// The sidebar menu for each role. `to` is the page address, `icon` a name from Icon.jsx.
export const NAV = {
  cashier: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'New Order', to: '/orders/new', icon: 'plus' },
    { label: 'Order List', to: '/orders', icon: 'list', end: true },
    { label: 'Order Details', to: '/orders/details', icon: 'file' },
  ],
  kitchen: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'Incoming Orders', to: '/kitchen/incoming', icon: 'inbox' },
    { label: 'Preparing Orders', to: '/kitchen/preparing', icon: 'clock' },
    { label: 'Ready Orders', to: '/kitchen/ready', icon: 'check' },
    { label: 'Order History', to: '/kitchen/history', icon: 'archive' },
  ],
  inventory: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'Inventory List', to: '/inventory', icon: 'box', end: true },
    { label: 'Add New Item', to: '/inventory/new', icon: 'plus' },
    { label: 'Stock In', to: '/inventory/stock-in', icon: 'down' },
    { label: 'Stock Out', to: '/inventory/stock-out', icon: 'up' },
    { label: 'Low Stock', to: '/inventory/low', icon: 'alert' },
    { label: 'Stock History', to: '/stock-history', icon: 'archive' },
  ],
  owner: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'Orders', to: '/orders', icon: 'list' },
    { label: 'Menu Management', to: '/menu-management', icon: 'list' },
    { label: 'Inventory Overview', to: '/inventory-overview', icon: 'box' },
    { label: 'Stock History', to: '/stock-history', icon: 'archive' },
    { label: 'Business Reports', to: '/reports', icon: 'chart' },
    { label: 'User Management', to: '/users', icon: 'users' },
  ],
}
