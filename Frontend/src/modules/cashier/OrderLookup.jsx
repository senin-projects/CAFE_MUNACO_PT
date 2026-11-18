import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFetch } from '../../hooks.js'
import { qs } from '../../services/api.js'
import { Empty, ErrorBox, Loading, PageHeader, StatusBadge } from '../../components/ui.jsx'
import { ORDER_TYPES, dateTime } from '../../utils.js'

// "Order Details" in the cashier menu: find an order, then open its full details.
export default function OrderLookup() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data, error, loading } = useFetch(`/orders${qs({ q })}`)

  return (
    <>
      <PageHeader title="Order Details" subtitle="Search by order number or customer name, then open the order." />
      <input className="search" placeholder="Order number (for example MUN-00005) or customer name" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : (
        <section className="panel">
          {data?.length === 0 ? <Empty>No orders match “{q}”.</Empty> : (
            <ul className="rows">
              {data?.slice(0, 30).map((o) => (
                <li
                  key={o.id}
                  className="order-row"
                  role="link"
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
                  <Link to={`/orders/${o.id}`}><strong>{o.order_no}</strong> {o.customer_name}</Link>
                  <span><StatusBadge status={o.status} /> <span className="muted">{ORDER_TYPES[o.order_type]} · {dateTime(o.created_at)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
