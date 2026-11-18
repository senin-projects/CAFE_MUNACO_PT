import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import { ORDER_TYPES, dateTime, timeAgo, qty } from '../../utils.js'

// One screen for Incoming / Preparing / Ready / History. Only `status` changes.
export default function KitchenQueue({ status, title, empty, history }) {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useFetch(`/orders?status=${status}&items=1&sort=${history ? 'newest' : 'oldest'}`, { poll: 10000 })
  const [actionError, setActionError] = useState('')

  async function move(order, next) {
    setActionError('')
    try {
      await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: next } })
      reload()
    } catch (e) {
      setActionError(e.message)
      reload()
    }
  }

  const since = { sent: 'sent_at', preparing: 'preparing_at', ready: 'ready_at', served: 'served_at' }[status]

  return (
    <>
      <PageHeader title={title} subtitle={history ? 'Completed orders, newest first.' : 'This page refreshes every 10 seconds.'} />
      <ErrorBox message={error || actionError} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>{empty}</Empty> : (
        <div className="tickets">
          {data?.map((o) => (
            <article
              className={`ticket ticket-clickable ${o.special_requests ? 'has-request' : ''}`}
              key={o.id}
              role="link"
              tabIndex={0}
              aria-label={`Open order ${o.order_no}`}
              onClick={(e) => {
                if (!e.target.closest('button, a')) navigate(`/orders/${o.id}`)
              }}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  navigate(`/orders/${o.id}`)
                }
              }}
            >
              <header>
                <div>
                  <Link to={`/orders/${o.id}`}><strong>{o.order_no}</strong></Link>
                  <div className="muted">{o.customer_name}</div>
                </div>
                <div className="ticket-meta">
                  <span>{o.table_no || ORDER_TYPES[o.order_type]}</span>
                  <span className="muted">{history ? dateTime(o[since]) : timeAgo(o[since])}</span>
                </div>
              </header>

              {o.scheduled_at && <p className="muted">{ORDER_TYPES[o.order_type]} for {dateTime(o.scheduled_at)}{o.guests ? ` · ${qty(o.guests)} guests` : ''}</p>}

              <ul className="ticket-items">
                {o.items.map((i) => (
                  <li key={i.id}>
                    <span className="ticket-qty">{qty(i.quantity)}×</span>
                    <span>{i.item_name}{i.notes && <div className="note">{i.notes}</div>}</span>
                  </li>
                ))}
              </ul>

              {o.special_requests && <div className="request"><strong>Special request</strong><p>{o.special_requests}</p></div>}

              {status === 'sent' && <button className="btn btn-primary wide" onClick={() => move(o, 'preparing')}>Start preparing</button>}
              {status === 'preparing' && <button className="btn btn-primary wide" onClick={() => move(o, 'ready')}>Mark as ready</button>}
              {status === 'ready' && <p className="muted">Waiting for service staff to pick it up.</p>}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
