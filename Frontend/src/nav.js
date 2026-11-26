// The sidebar menu for each role. `to` is the page address, `icon` a name from Icon.jsx.
export const NAV = {
  cashier: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'New Order', to: '/orders/new', icon: 'plus' },
    { label: 'Order List', to: '/orders', icon: 'list', end: true },
  ],
  kitchen: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'Orders', to: '/kitchen/orders', icon: 'inbox' },
    { label: 'Order History', to: '/kitchen/history', icon: 'archive' },
    { label: 'Menu Management', to: '/menu-management', icon: 'list' },
  ],
  inventory: [
    { label: 'Dashboard', to: '/dashboard', icon: 'grid' },
    { label: 'Inventory Management', to: '/inventory', icon: 'box' },
    { label: 'Stock Management', to: '/stock-management', icon: 'archive' },
  ],
  owner: [
    { label: 'Overview', to: '/dashboard', icon: 'chart' },
    { label: 'Orders', to: '/orders', icon: 'receipt' },
    { label: 'Inventory', to: '/inventory', icon: 'box' },
    { label: 'User Management', to: '/users', icon: 'users' },
  ],
}
