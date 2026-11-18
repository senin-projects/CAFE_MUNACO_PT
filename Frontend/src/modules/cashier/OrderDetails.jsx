import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useAuth } from '../../auth.jsx'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, PageHeader, StatusBadge } from '../../components/ui.jsx'
import { ORDER_TYPES, dateTime, peso } from '../../utils.js'

const STEPS = [
  ['created_at', 'Created'],
  ['sent_at', 'Sent to kitchen'],
  ['preparing_at', 'Preparing'],
  ['ready_at', 'Ready'],
  ['served_at', 'Served'],
]

export default function OrderDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: o, error, loading, reload } = useFetch(`/orders/${id}`, { poll: 15000 })
  const [actionError, setActionError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const showPrices = user.role !== 'kitchen'

  async function run(path, options, after) {
    setActionError('')
    try {
      await api(path, options)
      after ? after() : reload()
    } catch (e) {
      setActionError(e.message)
    }
  }
  const setStatus = (status) => run(`/orders/${id}/status`, { method: 'PATCH', body: { status } })
  async function payAndSend() {
    setActionError('')
    try {
      await api(`/orders/${id}/payment`, { method: 'POST', body: { method: paymentMethod } })
      await api(`/orders/${id}/send`, { method: 'POST' })
      reload()
    } catch (e) {
      setActionError(e.message)
      reload()
    }
  }

  if (loading && !o) return <Loading />
  if (!o) return <ErrorBox message={error || 'Order not found.'} />

  return (
    <>
      <PageHeader title={<span className="order-number">{o.order_no}</span>} subtitle={`${o.customer_name} · ${ORDER_TYPES[o.order_type]}`}>
        <StatusBadge status={o.status} />
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && (
          <>
            <Link className="btn" to={`/orders/${o.id}/edit`}>Edit order</Link>
            <button className="btn btn-danger" onClick={() => window.confirm('Cancel this order?') && run(`/orders/${id}/cancel`, { method: 'POST' }, () => navigate('/orders'))}>Cancel order</button>
          </>
        )}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && <>
          <select aria-label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="card">Card</option><option value="e_wallet">E-wallet</option></select>
          <button className="btn btn-primary" onClick={payAndSend}>Pay &amp; send to kitchen</button>
        </>}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <button className="btn btn-primary" onClick={() => run(`/orders/${id}/send`, { method: 'POST' })}>Send to kitchen</button>}
        {user.role === 'cashier' && o.status === 'ready' && <button className="btn btn-primary" onClick={() => setStatus('served')}>Mark as served</button>}
        {user.role !== 'kitchen' && <button className="btn" onClick={() => window.print()}>Print receipt</button>}
        {user.role === 'kitchen' && o.status === 'sent' && <button className="btn btn-primary" onClick={() => setStatus('preparing')}>Start preparing</button>}
        {user.role === 'kitchen' && o.status === 'preparing' && <button className="btn btn-primary" onClick={() => setStatus('ready')}>Mark as ready</button>}
      </PageHeader>

      <ErrorBox message={actionError} />
      {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <p className="muted">This draft is paid and locked. Send it to the kitchen to continue.</p>}
      {user.role === 'cashier' && o.status !== 'pending' && o.status !== 'cancelled' && (
        <p className="muted">This order is already with the kitchen, so it can no longer be edited.</p>
      )}

      {o.special_requests && (
        <div className="request"><strong>Special requests</strong><p>{o.special_requests}</p></div>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2>Order information</h2>
          <dl className="facts">
            <dt>Customer</dt><dd>{o.customer_name}</dd>
            <dt>Type</dt><dd>{ORDER_TYPES[o.order_type]}</dd>
            {o.table_no && <><dt>Table / area</dt><dd>{o.table_no}</dd></>}
            {o.guests && <><dt>Guests</dt><dd>{o.guests}</dd></>}
            {o.scheduled_at && <><dt>Scheduled for</dt><dd>{dateTime(o.scheduled_at)}</dd></>}
            <dt>Taken by</dt><dd>{o.created_by_name}</dd>
            {o.prepared_by_name && <><dt>Prepared by</dt><dd>{o.prepared_by_name}</dd></>}
            {user.role !== 'kitchen' && <><dt>Payment</dt><dd>{o.payment_status === 'paid' ? `Paid · ${o.payment_method?.replace('_', '-')}` : 'Unpaid'}</dd></>}
          </dl>
        </section>

        <section className="panel">
          <h2>Progress</h2>
          <ol className="timeline">
            {STEPS.map(([key, label]) => (
              <li key={key} className={o[key] ? 'done' : ''}>
                <span>{label}</span>
                <span className="muted">{o[key] ? dateTime(o[key]) : 'Waiting'}</span>
              </li>
            ))}
          </ol>
          {o.status === 'cancelled' && <p className="muted">This order was cancelled.</p>}
        </section>
      </div>

      <section className="panel">
        <h2>Items</h2>
        <div className="table-wrap flat">
          <table>
            <thead>
              <tr><th>Item</th><th className="num">Qty</th>{showPrices && <><th className="num">Price</th><th className="num">Amount</th></>}</tr>
            </thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.item_name}{i.notes && <div className="note">{i.notes}</div>}</td>
                  <td className="num">{i.quantity}</td>
                  {showPrices && <><td className="num">{peso(i.unit_price)}</td><td className="num">{peso(i.quantity * i.unit_price)}</td></>}
                </tr>
              ))}
            </tbody>
            {showPrices && <tfoot><tr><td colSpan="3">Total</td><td className="num"><strong>{peso(o.total)}</strong></td></tr></tfoot>}
          </table>
        </div>
      </section>
      {user.role !== 'kitchen' && <section className="receipt">
        <h1>Cafe Munaco</h1><p>Receipt · {o.order_no}</p><p>{o.customer_name} · {ORDER_TYPES[o.order_type]}</p>
        <ul>{o.items.map((i) => <li key={i.id}>{i.quantity} × {i.item_name}<span>{peso(i.quantity * i.unit_price)}</span></li>)}</ul>
        <strong>Total: {peso(o.total)}</strong><p>{o.payment_status === 'paid' ? `Paid by ${o.payment_method?.replace('_', '-')}` : 'Unpaid'}</p>
        {o.paid_at && <p>{dateTime(o.paid_at)}</p>}
      </section>}
    </>
  )
}
