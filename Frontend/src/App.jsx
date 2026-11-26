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
import StockHistory from './modules/inventory/StockHistory.jsx'
import InventoryModule from './modules/inventory/InventoryModule.jsx'
import StockManagement from './modules/inventory/StockManagement.jsx'
import Reports from './modules/owner/Reports.jsx'
import Users from './modules/owner/Users.jsx'
import MenuManagement from './modules/owner/MenuManagement.jsx'

function Home() {
  const { user } = useAuth()
  return user.role === 'owner' ? <Reports /> : <Dashboard />
}

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
        <Route path="/dashboard" element={<Home />} />
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
        <Route path="/inventory" element={
          <Only roles={['inventory', 'owner']}>
            {user.role === 'owner' ? <InventoryModule /> : <InventoryList />}
          </Only>
        } />
        <Route path="/inventory/new" element={<Only roles={['inventory']}><ItemForm /></Only>} />
        <Route path="/inventory/:id/edit" element={<Only roles={['inventory']}><ItemForm /></Only>} />
        <Route path="/inventory/stock-in" element={<Only roles={['inventory']}><StockForm type="in" /></Only>} />
        <Route path="/inventory/stock-out" element={<Only roles={['inventory']}><StockForm type="out" /></Only>} />
        <Route path="/stock-management" element={<Only roles={['inventory']}><StockManagement /></Only>} />
        <Route path="/inventory/low" element={
          <Only roles={['inventory', 'owner']}>
            <Navigate to="/inventory?tab=overview&low=1" replace />
          </Only>
        } />
        <Route path="/stock-history" element={
          <Only roles={['inventory', 'owner']}>
            {user.role === 'owner' ? <Navigate to="/inventory?tab=history" replace /> : <StockHistory />}
          </Only>
        } />

        {/* Owner */}
        <Route path="/inventory-overview" element={<Only roles={['owner']}><Navigate to="/inventory?tab=overview" replace /></Only>} />
        <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
        <Route path="/users" element={<Only roles={['owner']}><Users /></Only>} />
        <Route path="/menu-management" element={<Only roles={['owner', 'kitchen']}><MenuManagement /></Only>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
