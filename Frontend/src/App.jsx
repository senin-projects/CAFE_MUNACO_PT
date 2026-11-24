import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import OrderList from './modules/cashier/OrderList.jsx'
import OrderDetails from './modules/cashier/OrderDetails.jsx'
import NewOrder from './modules/cashier/NewOrder.jsx'
import KitchenQueue from './modules/kitchen/KitchenQueue.jsx'
import KitchenOrders from './modules/kitchen/KitchenOrders.jsx'
import InventoryList from './modules/inventory/InventoryList.jsx'
import ItemForm from './modules/inventory/ItemForm.jsx'
import StockForm from './modules/inventory/StockForm.jsx'
import LowStock from './modules/inventory/LowStock.jsx'
import StockHistory from './modules/inventory/StockHistory.jsx'
import Reports from './modules/owner/Reports.jsx'
import Users from './modules/owner/Users.jsx'
import MenuManagement from './modules/owner/MenuManagement.jsx'

// Only lets the listed roles open a page (the server checks again for every request)
function Only({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />

        {/* Orders: cashier and owner (kitchen can open a single order) */}
        <Route path="/orders" element={<Only roles={['cashier', 'owner']}><OrderList /></Only>} />
        <Route path="/orders/new" element={<Only roles={['cashier']}><NewOrder /></Only>} />
        <Route path="/orders/:id" element={<Only roles={['cashier', 'kitchen', 'owner']}><OrderDetails /></Only>} />
        <Route path="/orders/:id/edit" element={<Only roles={['cashier']}><NewOrder /></Only>} />

        {/* Kitchen */}
        <Route path="/kitchen/orders" element={<Only roles={['kitchen']}><KitchenOrders /></Only>} />
        <Route path="/kitchen/incoming" element={<Navigate to="/kitchen/orders?status=sent" replace />} />
        <Route path="/kitchen/preparing" element={<Navigate to="/kitchen/orders?status=preparing" replace />} />
        <Route path="/kitchen/ready" element={<Navigate to="/kitchen/orders?status=ready" replace />} />
        <Route path="/kitchen/history" element={<Only roles={['kitchen']}><KitchenQueue status="served" title="Order History" empty="No completed orders yet." history /></Only>} />

        {/* Inventory */}
        <Route path="/inventory" element={<Only roles={['inventory']}><InventoryList /></Only>} />
        <Route path="/inventory/new" element={<Only roles={['inventory']}><ItemForm /></Only>} />
        <Route path="/inventory/:id/edit" element={<Only roles={['inventory']}><ItemForm /></Only>} />
        <Route path="/inventory/stock-in" element={<Only roles={['inventory']}><StockForm type="in" /></Only>} />
        <Route path="/inventory/stock-out" element={<Only roles={['inventory']}><StockForm type="out" /></Only>} />
        <Route path="/inventory/low" element={<Only roles={['inventory']}><LowStock /></Only>} />
        <Route path="/stock-history" element={<Only roles={['inventory', 'owner']}><StockHistory /></Only>} />

        {/* Owner */}
        <Route path="/inventory-overview" element={<Only roles={['owner']}><InventoryList readOnly /></Only>} />
        <Route path="/reports" element={<Only roles={['owner']}><Reports /></Only>} />
        <Route path="/users" element={<Only roles={['owner']}><Users /></Only>} />
        <Route path="/menu-management" element={<Only roles={['owner', 'kitchen']}><MenuManagement /></Only>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
