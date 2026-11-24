import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useAuth } from '../../auth.jsx'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, Modal, PageHeader, StatusBadge } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { ORDER_TYPES, dateTime, peso, qty } from '../../utils.js'

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
  const location = useLocation()
  const navigate = useNavigate()
  const { data: o, error, loading, reload } = useFetch(`/orders/${id}`, { poll: 15000 })
  const [actionError, setActionError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [paymentResolution, setPaymentResolution] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const showPrices = user.role !== 'kitchen'

  async function run(path, options, after) {
    if (actionBusy) return
    setActionError('')
    setActionBusy(true)
    try {
      await api(path, options)
      after ? after() : reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActionBusy(false)
    }
  }
  const setStatus = (status) => run(`/orders/${id}/status`, { method: 'PATCH', body: { status } })
  const canOwnerCancel = user.role === 'owner' && ['pending', 'sent', 'preparing', 'ready'].includes(o?.status)

  function openCancelModal() {
    setCancelReason('')
    setPaymentResolution(o.payment_status === 'paid' ? '' : 'not_applicable')
    setCancelModal(true)
  }

  async function cancelAsOwner(e) {
    e.preventDefault()
    setActionError('')
    setCancelBusy(true)
    try {
      await api(`/orders/${id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason, payment_resolution: paymentResolution },
      })
      setCancelModal(false)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setCancelBusy(false)
    }
  }
  async function payAndSend() {
    if (actionBusy) return
    setActionError('')
    setActionBusy(true)
    try {
      await api(`/orders/${id}/payment`, { method: 'POST', body: { method: paymentMethod } })
      await api(`/orders/${id}/send`, { method: 'POST' })
      reload()
    } catch (e) {
      setActionError(e.message)
      reload()
    } finally {
      setActionBusy(false)
    }
  }

  if (loading && !o) return <Loading />
  if (!o) return <ErrorBox message={error || 'Order not found.'} />

  return (
    <>
      <PageHeader title={<span className="order-number">{o.order_no}</span>} subtitle={`${o.customer_name} · ${ORDER_TYPES[o.order_type]}`}>
        {user.role === 'kitchen' && (
          <Link className="btn" to={location.state?.from === '/kitchen/history' ? '/kitchen/history' : '/kitchen/orders'}>
            {location.state?.from === '/kitchen/history' ? 'Back to Order History' : 'Back to Orders'}
          </Link>
        )}
        <StatusBadge status={o.status} />
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && (
          <>
            <Link className="btn" to={`/orders/${o.id}/edit`}>Edit order</Link>
            <button className="btn btn-danger" onClick={() => window.confirm('Cancel this order?') && run(`/orders/${id}/cancel`, { method: 'POST' }, () => navigate('/orders'))}>Cancel order</button>
          </>
        )}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && <>
          <select aria-label="Payment method" disabled={actionBusy} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="e_wallet">GCash</option><option value="card">Card</option></select>
          <button className="btn btn-primary" disabled={actionBusy} onClick={payAndSend}>{actionBusy ? 'Updating...' : 'Pay & send to kitchen'}</button>
        </>}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => run(`/orders/${id}/send`, { method: 'POST' })}>{actionBusy ? 'Updating...' : 'Send to kitchen'}</button>}
        {user.role === 'cashier' && o.status === 'ready' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('served')}>{actionBusy ? 'Updating...' : 'Mark as served'}</button>}
        {canOwnerCancel && <button className="btn btn-danger" disabled={cancelBusy} onClick={openCancelModal}>Cancel / void order</button>}
        {user.role !== 'kitchen' && <button className="btn" onClick={() => setReceiptOpen(true)}>Print receipt</button>}
        {user.role === 'kitchen' && o.status === 'sent' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('preparing')}>{actionBusy ? 'Updating...' : 'Start preparing'}</button>}
        {user.role === 'kitchen' && o.status === 'preparing' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('ready')}>{actionBusy ? 'Updating...' : 'Mark as ready'}</button>}
      </PageHeader>

      <ErrorBox message={actionError} />
      {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <p className="muted">This draft is paid and locked. Send it to the kitchen to continue.</p>}
      {o.special_requests && (
        <div className="request"><strong>Special requests</strong><p>{o.special_requests}</p></div>
      )}
      {o.status === 'cancelled' && (
        <div className="request">
          <strong>Cancellation details</strong>
          <p>{o.cancellation?.reason || 'This order was cancelled before cancellation details were recorded.'}</p>
          {o.cancellation && <p className="muted">Cancelled by {o.cancellation.cancelled_by_name} · {dateTime(o.cancellation.created_at)}</p>}
          {o.payment_status === 'paid' && o.cancellation && (
            <p>Payment outcome: {o.cancellation.payment_resolution === 'refunded' ? 'Refunded' : 'Not refunded'}</p>
          )}
        </div>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2>Order information</h2>
          <dl className="facts">
            <dt>Customer</dt><dd>{o.customer_name}</dd>
            <dt>Type</dt><dd>{ORDER_TYPES[o.order_type]}</dd>
            {o.table_no && <><dt>Table / area</dt><dd>{o.table_no}</dd></>}
            {o.guests && <><dt>Guests</dt><dd>{qty(o.guests)}</dd></>}
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
                  <td className="num">{qty(i.quantity)}</td>
                  {showPrices && <><td className="num">{peso(i.unit_price)}</td><td className="num">{peso(i.quantity * i.unit_price)}</td></>}
                </tr>
              ))}
            </tbody>
            {showPrices && <tfoot><tr><td colSpan="3">Total</td><td className="num"><strong>{peso(o.total)}</strong></td></tr></tfoot>}
          </table>
        </div>
      </section>
      {receiptOpen && user.role !== 'kitchen' && (
        <Modal
          title="Receipt"
          eyebrow={o.payment_status === 'paid' ? 'Payment complete' : 'Payment pending'}
          className="receipt-modal"
          showCloseButton
          onClose={() => setReceiptOpen(false)}
        >
          <div className="receipt-document">
            <header className="receipt-brand">
              <span className="receipt-brand-icon"><Icon name="cup" size={23} /></span>
              <div><strong>Cafe Munaco</strong><span>Madalunot, Calaca, Batangas</span></div>
            </header>
            <dl className="receipt-meta">
              <div><dt>Order</dt><dd>{o.order_no}</dd></div>
              <div><dt>Date</dt><dd>{new Date(o.paid_at || o.created_at).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>
              <div><dt>Cashier</dt><dd>{o.created_by_name}</dd></div>
              <div><dt>Type</dt><dd>{ORDER_TYPES[o.order_type]}</dd></div>
            </dl>
            <table className="receipt-items">
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_name}</td>
                    <td className="num">{qty(item.quantity)}</td>
                    <td className="num">{peso(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-totals">
              <div><span>Subtotal</span><strong>{peso(o.total)}</strong></div>
              <div className="receipt-total"><span>Total</span><strong>{peso(o.total)}</strong></div>
              <div><span>{o.payment_status === 'paid' ? `Paid · ${o.payment_method?.replace('_', '-')}` : 'Payment due'}</span><strong>{o.payment_status === 'paid' ? peso(o.total) : '—'}</strong></div>
            </div>
            <p className="receipt-thanks">Thank you for visiting Cafe Munaco.</p>
          </div>
          <footer className="receipt-actions">
            <button type="button" className="btn" onClick={() => window.print()}>Print receipt</button>
            <Link className="btn btn-primary" to="/orders/new" onClick={() => setReceiptOpen(false)}>New sale</Link>
          </footer>
        </Modal>
      )}

      {cancelModal && (
        <Modal title="Cancel / void order" onClose={() => setCancelModal(false)}>
          <form className="form" onSubmit={cancelAsOwner}>
            <p className="muted">This will cancel the order and notify the kitchen if it was sent for preparation.</p>
            <label>Reason for cancellation
              <textarea rows="3" maxLength="500" required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </label>
            {o.payment_status === 'paid' && (
              <label>Payment outcome
                <select required value={paymentResolution} onChange={(e) => setPaymentResolution(e.target.value)}>
                  <option value="">Choose an outcome</option>
                  <option value="refunded">Refunded to customer</option>
                  <option value="not_refunded">Not refunded / settled separately</option>
                </select>
              </label>
            )}
            <div className="form-actions">
              <button className="btn btn-danger" disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</button>
              <button type="button" className="btn" disabled={cancelBusy} onClick={() => setCancelModal(false)}>Keep order</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
