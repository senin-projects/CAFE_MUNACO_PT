import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { HAS_TABLE, NEEDS_SCHEDULE, ORDER_TYPES, peso, qty, toLocalInput } from '../../utils.js'

const BLANK = { customer_name: '', order_type: 'dine_in', table_no: '', guests: '', scheduled_at: '', special_requests: '' }

// One screen for both "New Order" and "Edit order" (when the address has an :id)
export default function NewOrder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: menu, error: menuError } = useFetch('/menu')
  const [form, setForm] = useState(BLANK)
  const [cart, setCart] = useState({}) // menu item id -> { qty, notes }
  const [savedItems, setSavedItems] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('0')
  const [category, setCategory] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!id)

  // Edit mode: load the existing order into the form
  useEffect(() => {
    if (!id) return
    api(`/orders/${id}`)
      .then((o) => {
        if (o.status !== 'pending') {
          setError('This order was already sent to the kitchen, so it can no longer be edited.')
          return
        }
        setForm({
          customer_name: o.customer_name,
          order_type: o.order_type,
          table_no: o.table_no || '',
          guests: o.guests || '',
          scheduled_at: toLocalInput(o.scheduled_at),
          special_requests: o.special_requests || '',
        })
        setSavedItems(o.items)
        setCart(Object.fromEntries(o.items.map((i) => [i.menu_item_id === null ? `deleted-${i.id}` : i.menu_item_id, { qty: i.quantity, notes: i.notes || '' }])))
        setReady(true)
      })
      .catch((e) => setError(e.message))
  }, [id])

  const categories = useMemo(() => [...new Set((menu || []).map((m) => m.category))], [menu])
  const shown = (menu || []).filter((m) => {
    const query = menuSearch.trim().toLowerCase()
    const matchesSearch = !query || `${m.name} ${m.category}`.toLowerCase().includes(query)
    return (!category || m.category === category) && matchesSearch
  })
  const lines = Object.keys(cart).map((key) => {
    if (key.startsWith('deleted-')) {
      const saved = savedItems.find((item) => `deleted-${item.id}` === key)
      return saved ? { id: key, existingItemId: saved.id, name: saved.item_name, price: saved.unit_price, archived: true } : null
    }
    const item = (menu || []).find((m) => m.id === Number(key))
    if (!item) return null
    const saved = savedItems.find((i) => i.menu_item_id === item.id)
    return (!item.is_available || !item.has_recipe) && saved
      ? { ...item, name: saved.item_name, price: saved.unit_price, retainedUnavailable: true }
      : item
  }).filter(Boolean)
  const total = lines.reduce((sum, m) => sum + m.price * cart[m.id].qty, 0)
  const cashAmount = Number(cashReceived) || 0
  const changeDue = Math.max(0, cashAmount - total)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const add = (m) => setCart({ ...cart, [m.id]: { qty: (cart[m.id]?.qty || 0) + 1, notes: cart[m.id]?.notes || '' } })
  const change = (m, delta) => {
    const next = { ...cart }
    const qty = (next[m.id]?.qty || 0) + delta
    if (qty <= 0) delete next[m.id]
    else next[m.id] = { ...next[m.id], qty }
    setCart(next)
  }
  const removeLine = (id) => setCart((current) => {
    const next = { ...current }
    delete next[id]
    return next
  })

  async function submit(payAndSend) {
    setError('')
    if (payAndSend && !lines.length) {
      setError('Add at least one item to the order.')
      return
    }
    if (payAndSend && paymentMethod === 'cash' && cashAmount < total) {
      setError('Cash received must cover the order total.')
      return
    }
    setBusy(true)
    try {
      const body = {
        ...form,
        send: !id && payAndSend,
        payment_method: paymentMethod,
        items: lines.map((m) => ({ menu_item_id: m.archived ? null : m.id, existing_item_id: m.existingItemId, quantity: cart[m.id].qty, notes: cart[m.id].notes })),
      }
      const res = id
        ? await api(`/orders/${id}`, { method: 'PUT', body })
        : await api('/orders', { method: 'POST', body })
      if (id && payAndSend) {
        try {
          await api(`/orders/${res.id}/payment`, { method: 'POST', body: { method: paymentMethod } })
          await api(`/orders/${res.id}/send`, { method: 'POST' })
        } catch (e) {
          navigate(`/orders/${res.id}`)
          return
        }
      }
      navigate(payAndSend ? `/orders/${res.id}` : '/orders')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!menu && !menuError) return <Loading />
  if (!ready && !error) return <Loading />

  return (
    <>
      <PageHeader title={id ? 'Edit Order' : 'New Order'} subtitle={id ? 'You can change this order until it is sent to the kitchen.' : undefined} />
      <ErrorBox message={error || menuError} />

      <div className="order-layout">
        <div>
          <section className="panel form">
            <h2>Customer</h2>
            <div className="form-row">
              <label>Customer name<input value={form.customer_name} onChange={set('customer_name')} /></label>
              <label>Order type
                <select value={form.order_type} onChange={set('order_type')}>
                  {Object.entries(ORDER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              {HAS_TABLE.includes(form.order_type) && <label>Table or area<input value={form.table_no} onChange={set('table_no')} placeholder="T4, Garden 1, Hall" /></label>}
              {HAS_TABLE.includes(form.order_type) && <label>Guests<input type="number" min="1" value={form.guests} onChange={set('guests')} /></label>}
              {NEEDS_SCHEDULE.includes(form.order_type) && <label>Date and time<input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} /></label>}
            </div>
            <label>Special requests for the kitchen
              <textarea rows="2" value={form.special_requests} onChange={set('special_requests')} placeholder="Allergies, celebration notes, serving time" />
            </label>
          </section>

          <section className="panel">
            <h2>Menu</h2>
            <div className="menu-search">
              <span className="menu-search-icon" aria-hidden="true"><Icon name="search" size={24} /></span>
              <input
                type="search"
                className="search"
                placeholder="Search menu"
                aria-label="Search menu"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
              />
            </div>
            <div className="chips">
              <button className={!category ? 'chip on' : 'chip'} onClick={() => setCategory('')}>All</button>
              {categories.map((c) => <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            <div className="menu-grid">
              {shown.map((m) => {
                const canOrder = Boolean(m.is_available) && Boolean(m.has_recipe)
                const unavailableMessage = m.has_recipe ? 'Unavailable' : 'Recipe required'
                return (
                  <button
                    key={m.id}
                    className={`menu-item${canOrder ? '' : ' unavailable'}`}
                    disabled={!canOrder}
                    onClick={() => add(m)}
                    aria-label={canOrder ? `Add ${m.name}` : `${m.name} ${unavailableMessage.toLowerCase()}`}
                  >
                    <span>{m.name}</span>
                    <strong>{peso(m.price)}</strong>
                    {!canOrder && <em className="menu-unavailable">{unavailableMessage}</em>}
                    {cart[m.id] && <em className="in-cart">{qty(cart[m.id].qty)}</em>}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="panel cart">
          <h2>Order summary</h2>
          {lines.length === 0 ? <p className="empty">Tap a menu item to add it.</p> : (
            <ul className="cart-lines">
              {lines.map((m) => (
                <li key={m.id}>
                  <div className="cart-row">
                    <span className="cart-item-name">{m.name}{(m.retainedUnavailable || m.archived) && <span className="muted"> (unavailable)</span>}</span>
                    <div className="cart-quantity">
                    {!m.retainedUnavailable && !m.archived && <button className="qty-btn" onClick={() => change(m, -1)} aria-label={`Remove one ${m.name}`}>−</button>}
                    <span>{qty(cart[m.id].qty)}</span>
                    {m.retainedUnavailable || m.archived ? <button className="remove-unavailable" onClick={() => removeLine(m.id)}>Remove</button> : <button className="qty-btn" onClick={() => change(m, 1)} aria-label={`Add one ${m.name}`}>+</button>}
                    </div>
                    <strong className="cart-line-total">{peso(m.price * cart[m.id].qty)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="cart-total"><span>Total</span><strong>{peso(total)}</strong></div>
          <section className="payment-section" aria-label="Payment">
            <h3>Payment method</h3>
            <div className="payment-methods">
              {[
                ['cash', 'Cash'],
                ['e_wallet', 'GCash'],
                ['card', 'Card'],
              ].map(([method, label]) => (
                <button
                  key={method}
                  type="button"
                  className={`payment-method${paymentMethod === method ? ' selected' : ''}`}
                  aria-pressed={paymentMethod === method}
                  onClick={() => setPaymentMethod(method)}
                >
                  <span className={`payment-method-icon ${method}`} aria-hidden="true">
                    {method === 'cash' ? '₱' : method === 'e_wallet' ? '▯' : '▤'}
                  </span>
                  {label}
                </button>
              ))}
            </div>
            {paymentMethod === 'cash' && (
              <>
                <label className="cash-received">Cash received
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                </label>
                <div className="cash-change"><span>Change</span><strong>{peso(changeDue)}</strong></div>
              </>
            )}
          </section>
          <button className="btn btn-primary wide charge-btn" disabled={busy || !lines.length || (paymentMethod === 'cash' && cashAmount < total)} onClick={() => submit(true)}>
            {busy ? 'Updating...' : <>Place Order {peso(total)} <span aria-hidden="true">↗</span></>}
          </button>
          <button className="btn wide" disabled={busy} onClick={() => submit(false)}>{busy ? 'Updating...' : 'Save draft'}</button>
        </aside>
      </div>
    </>
  )
}
