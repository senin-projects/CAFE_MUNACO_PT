import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import { useFetch } from '../../hooks.js'
import { qs } from '../../services/api.js'
import { Empty, ErrorBox, Loading, PageHeader, StatusBadge } from '../../components/ui.jsx'
import { ORDER_TYPES, STATUS_LABEL, dateTime, peso, qty } from '../../utils.js'

// Used for "Order List" (cashier) and "Orders" (owner)
export default function OrderList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const { data, error, loading } = useFetch(`/orders${qs({ q, status, type })}`, { poll: 20000 })

  return (
    <>
      <PageHeader
        title={user.role === 'owner' ? 'Orders' : 'Order List'}
        subtitle={user.role === 'owner' ? 'Every order from every cashier. View only.' : 'Updates by itself, so you can see when an order is ready.'}
      >
        {user.role === 'cashier' && <Link className="btn btn-primary" to="/orders/new">New order</Link>}
      </PageHeader>

      <div className="filters">
        <input className="search" placeholder="Search order number or customer" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Order type">
          <option value="">All order types</option>
          {Object.entries(ORDER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data?.length === 0 ? (
        <Empty>No orders found. {user.role === 'cashier' && 'Create one with “New order”.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Type</th><th>Items</th><th className="num">Total</th><th>Status</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {data?.map((o) => (
                <tr
                  key={o.id}
                  className="order-row"
                  tabIndex={0}
                  aria-label={`Open order ${o.order_no}`}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      navigate(`/orders/${o.id}`)
                    }
                  }}
                >
                  <td><strong>{o.order_no}</strong></td>
                  <td>{o.customer_name}{o.table_no && <span className="muted"> · {o.table_no}</span>}</td>
                  <td>{ORDER_TYPES[o.order_type]}</td>
                  <td>{qty(o.item_count)}</td>
                  <td className="num">{peso(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="muted">{dateTime(o.created_at)}</td>
                  <td><Link className="link" to={`/orders/${o.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
