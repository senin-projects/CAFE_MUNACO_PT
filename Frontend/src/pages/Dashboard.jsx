import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { useFetch } from '../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard, StatusBadge } from '../components/ui.jsx'
import { ORDER_TYPES, STATUS_LABEL, dateTime, peso, qty, timeAgo } from '../utils.js'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useFetch('/dashboard', { poll: 15000 })

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.full_name.split(' ')[0]}`} subtitle={new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data && <Body role={user.role} d={data} />}
    </>
  )
}

function Body({ role, d }) {
  const navigate = useNavigate()
  const s = d.stats
  const orderRowProps = (id, orderNo) => ({
    className: 'order-row',
    role: 'link',
    tabIndex: 0,
    'aria-label': `Open order ${orderNo}`,
    onClick: (e) => {
      if (!e.target.closest('a, button')) navigate(`/orders/${id}`)
    },
    onKeyDown: (e) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        navigate(`/orders/${id}`)
      }
    },
  })

  if (role === 'cashier')
    return (
      <>
        <div className="stats">
          <StatCard label="Orders today" value={s.today_orders} />
          <StatCard label="Not sent yet" value={s.drafts} />
          <StatCard label="In the kitchen" value={s.in_kitchen} />
          <StatCard label="Ready to serve" value={s.ready} tone={s.ready ? 'good' : ''} />
        </div>
        <div className="grid-2">
          <section className="panel">
            <h2>Ready to serve</h2>
            {d.ready_orders.length === 0 ? <Empty>Nothing is ready yet.</Empty> : (
              <ul className="rows">
                {d.ready_orders.map((o) => (
                  <li key={o.id} {...orderRowProps(o.id, o.order_no)}>
                    <Link to={`/orders/${o.id}`}><strong>{o.order_no}</strong> {o.customer_name}</Link>
                    <span className="muted">{o.table_no || ORDER_TYPES[o.order_type]} · ready {timeAgo(o.ready_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>Latest orders</h2>
            <ul className="rows">
              {d.recent_orders.map((o) => (
                <li key={o.id} {...orderRowProps(o.id, o.order_no)}>
                  <Link to={`/orders/${o.id}`}><strong>{o.order_no}</strong> {o.customer_name}</Link>
                  <span><StatusBadge status={o.status} /> <span className="muted">{peso(o.total)}</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    )

  if (role === 'kitchen')
    return (
      <>
        <div className="stats">
          <StatCard label="Waiting to start" value={s.incoming} tone={s.incoming ? 'warn' : ''} />
          <StatCard label="Being prepared" value={s.preparing} />
          <StatCard label="Ready for service" value={s.ready} />
          <StatCard label="Served today" value={s.served_today} />
        </div>
        <section className="panel">
          <h2>Oldest orders waiting</h2>
          {d.waiting.length === 0 ? <Empty>No orders are waiting.</Empty> : (
            <ul className="rows">
              {d.waiting.map((o) => (
                <li key={o.id} {...orderRowProps(o.id, o.order_no)}>
                  <Link to={`/orders/${o.id}`}><strong>{o.order_no}</strong> {o.customer_name}</Link>
                  <span className="muted">{o.table_no || ORDER_TYPES[o.order_type]} · sent {timeAgo(o.sent_at)}{o.special_requests ? ' · has special request' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    )

  if (role === 'inventory')
    return (
      <>
        <div className="stats">
          <StatCard label="Items tracked" value={s.total_items} />
          <StatCard label="Running low" value={s.low_stock} tone={s.low_stock ? 'warn' : ''} />
          <StatCard label="Out of stock" value={s.out_of_stock} tone={s.out_of_stock ? 'bad' : ''} />
          <StatCard label="Stock updates today" value={s.movements_today} />
        </div>
        <div className="grid-2">
          <section className="panel">
            <h2>Needs restocking</h2>
            {d.low_items.length === 0 ? <Empty>Everything is above its reorder level.</Empty> : (
              <ul className="rows">
                {d.low_items.map((i) => (
                  <li key={i.id}>
                    <strong>{i.name}</strong>
                    <span className="muted">{qty(i.quantity)} / {qty(i.reorder_level)} {i.unit}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link className="link" to="/inventory/low">See all low stock</Link>
          </section>
          <section className="panel">
            <h2>Recent stock changes</h2>
            <ul className="rows">
              {d.recent_movements.map((m) => (
                <li key={m.id}>
                  <span><span className={`badge move-${m.movement_type}`}>{m.movement_type === 'in' ? 'In' : 'Out'}</span> {m.item_name}</span>
                  <span className="muted">{qty(m.quantity)} {m.unit} · {dateTime(m.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    )

  // owner
  return (
    <>
      <div className="stats">
        <StatCard label="Sales today (served)" value={peso(s.today_sales)} />
        <StatCard label="Orders today" value={s.today_orders} />
        <StatCard label="Orders in progress" value={s.active_orders} />
        <StatCard label="Items low or out" value={s.low_stock} tone={s.low_stock ? 'warn' : ''} />
        <StatCard label="Active staff accounts" value={s.active_staff} />
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>What staff just did</h2>
          {d.activity.length === 0 ? <Empty>No activity yet.</Empty> : (
            <ul className="rows">
              {d.activity.map((a) => (
                <li key={a.id}>
                  <span><strong>{a.full_name}</strong> <span className="muted">{a.details}</span></span>
                  <span className="muted">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="stack">
          <section className="panel">
            <h2>Today’s orders by status</h2>
            {d.order_status.length === 0 ? <Empty>No orders yet today.</Empty> : (
              <ul className="rows">
                {d.order_status.map((r) => (
                  <li key={r.status}><span>{STATUS_LABEL[r.status]}</span><strong>{qty(r.count)}</strong></li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>Low stock</h2>
            {d.low_items.length === 0 ? <Empty>All items are above their reorder level.</Empty> : (
              <ul className="rows">
                {d.low_items.map((i) => (
                  <li key={i.id}><strong>{i.name}</strong><span className="muted">{qty(i.quantity)} / {qty(i.reorder_level)} {i.unit}</span></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
