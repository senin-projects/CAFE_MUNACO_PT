import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import { ORDER_TYPES, dateTime, timeAgo, qty } from '../../utils.js'

// One screen for Incoming / Preparing / Ready / History. Only `status` changes.
export default function KitchenQueue({ status, title, empty, history, toolbar }) {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useFetch(`/orders?status=${status}&items=1&sort=${history ? 'newest' : 'oldest'}`, { poll: 10000 })
  const [actionError, setActionError] = useState('')
  const [expandedOrders, setExpandedOrders] = useState({})
  const [visibleItemCounts, setVisibleItemCounts] = useState({})
  const ticketRefs = useRef(new Map())
  const ticketGridRef = useRef(null)

  useLayoutEffect(() => {
    if (history || !data?.length) return undefined

    const fitItemsToCards = () => {
      const fittedCounts = {}
      data.forEach((order) => {
        if (expandedOrders[order.id] || order.items.length < 5) return
        if (window.matchMedia('(max-width: 900px)').matches) {
          fittedCounts[order.id] = 4
          return
        }
        const card = ticketRefs.current.get(order.id)
        const list = card?.querySelector('.ticket-items:not(.ticket-items-measure)')
        const measureList = card?.querySelector('.ticket-items-measure')
        const more = card?.querySelector('.ticket-more')
        const anchor = card?.querySelector('.request, .ticket-action, .ticket-waiting')
        if (!card || !list || !measureList || !more || !anchor) return

        measureList.style.width = `${list.clientWidth}px`
        const listTop = list.getBoundingClientRect().top
        const availableHeight = anchor.getBoundingClientRect().top - listTop - more.getBoundingClientRect().height - 10
        let usedHeight = 0
        let count = 0
        for (const item of measureList.children) {
          const itemHeight = item.getBoundingClientRect().height
          if (usedHeight + itemHeight > availableHeight) break
          usedHeight += itemHeight
          count += 1
        }
        fittedCounts[order.id] = Math.max(1, Math.min(order.items.length, count))
      })

      setVisibleItemCounts((current) => {
        const changed = Object.entries(fittedCounts).some(([id, count]) => current[id] !== count)
        return changed ? { ...current, ...fittedCounts } : current
      })
    }

    fitItemsToCards()
    const observer = new ResizeObserver(fitItemsToCards)
    if (ticketGridRef.current) observer.observe(ticketGridRef.current)
    ticketRefs.current.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [data, expandedOrders, history])

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
      <PageHeader title={title}>{toolbar}</PageHeader>
      <ErrorBox message={error || actionError} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>{empty}</Empty> : history ? (
        <div className="table-wrap kitchen-history-wrap">
          <table className="kitchen-history-table">
            <colgroup>
              <col className="kitchen-history-col-order" />
              <col className="kitchen-history-col-customer" />
              <col className="kitchen-history-col-type" />
              <col className="kitchen-history-col-served" />
            </colgroup>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Order Type</th><th>Served</th></tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr
                  key={o.id}
                  className="order-row"
                  tabIndex={0}
                  aria-label={`Open order ${o.order_no}`}
                  onClick={() => navigate(`/orders/${o.id}`, { state: { from: '/kitchen/history' } })}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      navigate(`/orders/${o.id}`, { state: { from: '/kitchen/history' } })
                    }
                  }}
                >
                  <td><strong>{o.order_no}</strong></td>
                  <td>{o.customer_name}</td>
                  <td>{ORDER_TYPES[o.order_type] || o.order_type}</td>
                  <td className="muted">{dateTime(o[since])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tickets" ref={ticketGridRef}>
          {data?.map((o) => (
            <article
              className={`ticket ticket-clickable ${o.special_requests ? 'has-request' : ''} ${expandedOrders[o.id] ? 'ticket-expanded' : ''}`}
              key={o.id}
              ref={(element) => {
                if (element) ticketRefs.current.set(o.id, element)
                else ticketRefs.current.delete(o.id)
              }}
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
                {o.items.slice(0, expandedOrders[o.id] ? o.items.length : (visibleItemCounts[o.id] ?? 4)).map((i) => (
                  <li key={i.id}>
                    <span className="ticket-qty">{qty(i.quantity)}×</span>
                    <span>{i.item_name}{i.notes && <div className="note">{i.notes}</div>}</span>
                  </li>
                ))}
              </ul>
              {o.items.length >= 5 && (expandedOrders[o.id] || (visibleItemCounts[o.id] ?? 4) < o.items.length) && (
                <button
                  type="button"
                  className="link ticket-more"
                  aria-expanded={!!expandedOrders[o.id]}
                  onClick={() => setExpandedOrders((current) => ({ ...current, [o.id]: !current[o.id] }))}
                >
                  {expandedOrders[o.id] ? 'See less' : `See more (${o.items.length - (visibleItemCounts[o.id] ?? 4)})`}
                </button>
              )}

              <ul className="ticket-items ticket-items-measure" aria-hidden="true">
                {o.items.map((i) => (
                  <li key={i.id}>
                    <span className="ticket-qty">{qty(i.quantity)}</span>
                    <span>{i.item_name}{i.notes && <div className="note">{i.notes}</div>}</span>
                  </li>
                ))}
              </ul>

              {o.special_requests && <div className="request"><strong>Special request</strong><p>{o.special_requests}</p></div>}

              {status === 'sent' && <button className="btn btn-primary wide ticket-action" onClick={() => move(o, 'preparing')}>Start preparing</button>}
              {status === 'preparing' && <button className="btn btn-primary wide ticket-action" onClick={() => move(o, 'ready')}>Mark as ready</button>}
              {status === 'ready' && <p className="muted ticket-waiting">Waiting for service staff to pick it up.</p>}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
