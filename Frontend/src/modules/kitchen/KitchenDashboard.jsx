import { Link, useNavigate } from 'react-router-dom'
import { Empty, StatCard } from '../../components/ui.jsx'
import { ORDER_TYPES, timeAgo } from '../../utils.js'

// Kitchen-specific dashboard content. The shared dashboard loads its data.
// [WBS 2.3.1] Display kitchen dashboard summary.
export default function KitchenDashboard({ data }) {
  const navigate = useNavigate()
  const stats = data.stats

  function openOrder(id, event) {
    if (!event.target.closest('a, button')) navigate(`/orders/${id}`)
  }

  function handleOrderKeyDown(id, event) {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      navigate(`/orders/${id}`)
    }
  }

  return (
    <>
      <div className="stats">
        <StatCard label="Waiting to start" value={stats.incoming} tone={stats.incoming ? 'warn' : ''} />
        <StatCard label="Being prepared" value={stats.preparing} />
        <StatCard label="Ready for service" value={stats.ready} />
        <StatCard label="Served today" value={stats.served_today} />
      </div>
      <section className="panel">
        <h2>Oldest orders waiting</h2>
        {data.waiting.length === 0 ? <Empty>No orders are waiting.</Empty> : (
          <ul className="rows">
            {data.waiting.map((order) => (
              <li
                key={order.id}
                className="order-row"
                role="link"
                tabIndex={0}
                aria-label={`Open order ${order.order_no}`}
                onClick={(event) => openOrder(order.id, event)}
                onKeyDown={(event) => handleOrderKeyDown(order.id, event)}
              >
                <Link to={`/orders/${order.id}`}><strong>{order.order_no}</strong> {order.customer_name}</Link>
                <span className="muted">
                  {order.table_no || ORDER_TYPES[order.order_type]} · sent {timeAgo(order.sent_at)}
                  {order.special_requests ? ' · has special request' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
