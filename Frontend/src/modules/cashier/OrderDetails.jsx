import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
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
const SHORT_STEP_LABEL = { created_at: 'Created', sent_at: 'Sent', preparing_at: 'Prep', ready_at: 'Ready', served_at: 'Served', cancelled: 'Cancel' }

export default function OrderDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const { data: o, error, loading, reload } = useFetch(`/orders/${id}`, { poll: 15000 })
  const [actionError, setActionError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [actionBusy, setActionBusy] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [paymentResolution, setPaymentResolution] = useState('')
  const [inventoryResolution, setInventoryResolution] = useState('')
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

  const cashierCanCancel = user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid'
  const needsPaymentResolution = user.role === 'owner' && o.payment_status === 'paid'
  const needsInventoryResolution = user.role === 'owner' && ['preparing', 'ready'].includes(o.status)

  async function cancelOrder(event) {
    event.preventDefault()
    if (actionBusy) return
    setActionError('')
    setActionBusy(true)
    try {
      const body = {}
      if (user.role === 'owner') {
        body.reason = cancelReason
        if (needsPaymentResolution) body.payment_resolution = paymentResolution
        if (needsInventoryResolution) body.inventory_resolution = inventoryResolution
      }
      await api(`/orders/${id}/cancel`, { method: 'POST', body })
      setCancelOpen(false)
      reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActionBusy(false)
    }
  }

  const progressSteps = [
    ...STEPS.map(([key, label]) => ({ key, label, at: o[key] })),
    ...(o.status === 'cancelled' ? [{ key: 'cancelled', label: 'Cancelled', at: o.cancellation?.created_at }] : []),
  ]

  return (
    <>
      <PageHeader title={<span className="order-number">{o.order_no}</span>} subtitle={ORDER_TYPES[o.order_type]}>
        <StatusBadge status={o.status} />
        {user.role === 'kitchen' && (
          <Link
            className="icon-button"
            to={location.state?.from === '/kitchen/history' ? '/kitchen/history' : '/kitchen/orders'}
            aria-label={location.state?.from === '/kitchen/history' ? 'Back to Order History' : 'Back to Orders'}
            title={location.state?.from === '/kitchen/history' ? 'Back to Order History' : 'Back to Orders'}
          >
            <Icon name="arrowLeft" size={18} />
          </Link>
        )}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && (
          <Link className="btn" to={`/orders/${o.id}/edit`}>Edit order</Link>
        )}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'unpaid' && <>
          <select aria-label="Payment method" disabled={actionBusy} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="e_wallet">GCash</option><option value="card">Card</option></select>
          <button className="btn btn-primary" disabled={actionBusy} onClick={payAndSend}>{actionBusy ? 'Updating...' : 'Pay & send to kitchen'}</button>
        </>}
        {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => run(`/orders/${id}/send`, { method: 'POST' })}>{actionBusy ? 'Updating...' : 'Send to kitchen'}</button>}
        {user.role === 'cashier' && o.status === 'ready' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('served')}>{actionBusy ? 'Updating...' : 'Mark as served'}</button>}
        {cashierCanCancel && (
          <button
            className="btn"
            disabled={actionBusy}
            onClick={() => {
              setCancelReason('')
              setPaymentResolution('')
              setInventoryResolution('')
              setCancelOpen(true)
            }}
          >
            Cancel order
          </button>
        )}
        {user.role === 'cashier' && <button className="btn" onClick={() => setReceiptOpen(true)}>Print receipt</button>}
        {user.role !== 'kitchen' && (
          <Link className="icon-button" to="/orders" aria-label="Back to Orders" title="Back to Orders">
            <Icon name="arrowLeft" size={18} />
          </Link>
        )}
        {user.role === 'kitchen' && o.status === 'sent' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('preparing')}>{actionBusy ? 'Updating...' : 'Start preparing'}</button>}
        {user.role === 'kitchen' && o.status === 'preparing' && <button className="btn btn-primary" disabled={actionBusy} onClick={() => setStatus('ready')}>{actionBusy ? 'Updating...' : 'Mark as ready'}</button>}
      </PageHeader>

      <ErrorBox message={actionError} />
      {cancelOpen && (
        <Modal
          title="Cancel order"
          eyebrow="ORDER CANCELLATION"
          showCloseButton
          onClose={() => setCancelOpen(false)}
        >
          <form className="form" onSubmit={cancelOrder}>
            {user.role === 'owner' && (
              <label>Reason for cancellation
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} required />
              </label>
            )}
            {needsPaymentResolution && (
              <label>Payment outcome
                <select value={paymentResolution} onChange={(event) => setPaymentResolution(event.target.value)} required>
                  <option value="">Choose an outcome</option>
                  <option value="refunded">Customer was refunded</option>
                  <option value="not_refunded">Customer was not refunded</option>
                </select>
              </label>
            )}
            {needsInventoryResolution && (
              <label>Ingredients used for this order
                <select value={inventoryResolution} onChange={(event) => setInventoryResolution(event.target.value)} required>
                  <option value="">Choose an outcome</option>
                  <option value="consumed">Consumed or wasted — keep stock deducted</option>
                  <option value="restocked">Fully restocked — add ingredients back to inventory</option>
                </select>
              </label>
            )}
            {needsInventoryResolution && (
              <p className="muted">Choose “Fully restocked” only if all deducted ingredients were safely returned to inventory.</p>
            )}
            {cashierCanCancel && <p className="muted">This unpaid draft has not been sent to the kitchen.</p>}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={actionBusy}>
                {actionBusy ? 'Cancelling...' : 'Confirm cancellation'}
              </button>
              <button type="button" className="btn" disabled={actionBusy} onClick={() => setCancelOpen(false)}>Keep order</button>
            </div>
          </form>
        </Modal>
      )}
      {user.role === 'cashier' && o.status === 'pending' && o.payment_status === 'paid' && <p className="muted">This draft is paid and locked. Send it to the kitchen to continue.</p>}

      <section className="panel order-progress-panel">
        <h2>Progress</h2>
        <ol className="timeline order-timeline" style={{ gridTemplateColumns: `repeat(${progressSteps.length}, minmax(0, 1fr))` }}>
          {progressSteps.map(({ key, label, at }) => (
            <li key={key} className={key === 'cancelled' ? 'cancelled-step' : at ? 'done' : ''}>
              <span className="order-progress-label"><span className="order-progress-label-full">{label}</span><span className="order-progress-label-short">{SHORT_STEP_LABEL[key]}</span></span>
              <span className="muted">
                {at ? <><span className="order-progress-date-full">{dateTime(at)}</span><span className="order-progress-date-short">{new Date(at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span></> : key === 'cancelled' ? '—' : 'Waiting'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel order-info-panel">
        <h2>Customer & order information</h2>
        <div className="order-customer-summary">
          <div><span className="muted">Customer</span><strong>{o.customer_name}</strong></div>
          <span className="badge">{ORDER_TYPES[o.order_type]}</span>
        </div>
        <dl className="facts order-info-facts">
          {o.table_no && <div><dt>Table / area</dt><dd>{o.table_no}</dd></div>}
          {o.guests && <div><dt>Guests</dt><dd>{qty(o.guests)}</dd></div>}
          {o.scheduled_at && <div><dt>Scheduled for</dt><dd>{dateTime(o.scheduled_at)}</dd></div>}
          <div><dt>Taken by</dt><dd>{o.created_by_name}</dd></div>
          {o.prepared_by_name && <div><dt>Prepared by</dt><dd>{o.prepared_by_name}</dd></div>}
          {user.role !== 'kitchen' && <div><dt>Payment</dt><dd>{o.payment_status === 'paid' ? `Paid · ${o.payment_method?.replace('_', '-')}` : 'Unpaid'}</dd></div>}
        </dl>
        {o.special_requests && (
          <details className="order-extra-note">
            <summary>Special requests</summary>
            <p>{o.special_requests}</p>
          </details>
        )}
        {o.status === 'cancelled' && (
          <details className="order-extra-note">
            <summary>Cancellation details</summary>
            <p>{o.cancellation?.reason || 'This order was cancelled before cancellation details were recorded.'}</p>
            {o.cancellation && <p className="muted">Cancelled by {o.cancellation.cancelled_by_name} · {dateTime(o.cancellation.created_at)}</p>}
            {o.payment_status === 'paid' && o.cancellation && (
              <p>Payment outcome: {o.cancellation.payment_resolution === 'refunded' ? 'Refunded' : 'Not refunded'}</p>
            )}
            {o.cancellation?.inventory_resolution && o.cancellation.inventory_resolution !== 'not_applicable' && (
              <p>Ingredients: {o.cancellation.inventory_resolution === 'restocked' ? 'fully restocked' : 'consumed or wasted'}</p>
            )}
          </details>
        )}
      </section>

      <section className="panel order-items-panel">
        <header className="order-items-heading">
          <div>
            <h2>Order items</h2>
            <span className="muted">{qty(o.items.reduce((sum, item) => sum + Number(item.quantity), 0))} items</span>
          </div>
          {showPrices && <div className="order-items-total"><span className="muted">Order total</span><strong>{peso(o.total)}</strong></div>}
        </header>
        <div className="table-wrap flat">
          <table className={`order-items-table ${showPrices ? 'with-prices' : 'kitchen-view'}`}>
            <thead>
              <tr><th>Item</th><th className="num">Qty</th>{showPrices && <><th className="num">Unit price</th><th className="num">Subtotal</th></>}</tr>
            </thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td><strong className="order-item-name">{i.item_name}</strong>{i.notes && <div className="note">{i.notes}</div>}</td>
                  <td className="num">{qty(i.quantity)}</td>
                  {showPrices && <><td className="num">{peso(i.unit_price)}</td><td className="num">{peso(i.quantity * i.unit_price)}</td></>}
                </tr>
              ))}
            </tbody>
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

    </>
  )
}
