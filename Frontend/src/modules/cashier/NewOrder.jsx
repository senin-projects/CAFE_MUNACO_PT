import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import { HAS_TABLE, NEEDS_SCHEDULE, ORDER_TYPES, peso, toLocalInput } from '../../utils.js'

const BLANK = { customer_name: '', order_type: 'dine_in', table_no: '', guests: '', scheduled_at: '', special_requests: '' }

// One screen for both "New Order" and "Edit order" (when the address has an :id)
export default function NewOrder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: menu, error: menuError } = useFetch('/menu')
  const [form, setForm] = useState(BLANK)
  const [cart, setCart] = useState({}) // menu item id -> { qty, notes }
  const [savedItems, setSavedItems] = useState([])
  const [category, setCategory] = useState('')
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
  const shown = (menu || []).filter((m) => m.is_available && (!category || m.category === category))
  const lines = Object.keys(cart).map((key) => {
    if (key.startsWith('deleted-')) {
      const saved = savedItems.find((item) => `deleted-${item.id}` === key)
      return saved ? { id: key, existingItemId: saved.id, name: saved.item_name, price: saved.unit_price, archived: true } : null
    }
    const item = (menu || []).find((m) => m.id === Number(key))
    if (!item) return null
    const saved = savedItems.find((i) => i.menu_item_id === item.id)
    return !item.is_available && saved ? { ...item, name: saved.item_name, price: saved.unit_price, retainedUnavailable: true } : item
  }).filter(Boolean)
  const total = lines.reduce((sum, m) => sum + m.price * cart[m.id].qty, 0)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const add = (m) => setCart({ ...cart, [m.id]: { qty: (cart[m.id]?.qty || 0) + 1, notes: cart[m.id]?.notes || '' } })
  const change = (m, delta) => {
    const next = { ...cart }
    const qty = (next[m.id]?.qty || 0) + delta
    if (qty <= 0) delete next[m.id]
    else next[m.id] = { ...next[m.id], qty }
    setCart(next)
  }
  const setNote = (m, notes) => setCart({ ...cart, [m.id]: { ...cart[m.id], notes } })
  const removeLine = (id) => setCart((current) => {
    const next = { ...current }
    delete next[id]
    return next
  })

  async function submit(continueToPayment) {
    setError('')
    setBusy(true)
    try {
      const body = {
        ...form,
        send: false,
        items: lines.map((m) => ({ menu_item_id: m.archived ? null : m.id, existing_item_id: m.existingItemId, quantity: cart[m.id].qty, notes: cart[m.id].notes })),
      }
      const res = id
        ? await api(`/orders/${id}`, { method: 'PUT', body })
        : await api('/orders', { method: 'POST', body })
      navigate(continueToPayment ? `/orders/${res.id}` : '/orders')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!menu && !menuError) return <Loading />
  if (!ready && !error) return <Loading />

  return (
    <>
      <PageHeader title={id ? 'Edit Order' : 'New Order'} subtitle={id ? 'You can change this order until it is sent to the kitchen.' : 'Fill in the details, pick the items, then send it to the kitchen.'} />
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
            <div className="chips">
              <button className={!category ? 'chip on' : 'chip'} onClick={() => setCategory('')}>All</button>
              {categories.map((c) => <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            <div className="menu-grid">
              {shown.map((m) => (
                <button key={m.id} className="menu-item" onClick={() => add(m)}>
                  <span>{m.name}</span>
                  <strong>{peso(m.price)}</strong>
                  {cart[m.id] && <em className="in-cart">{cart[m.id].qty}</em>}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="panel cart">
          <h2>Order summary</h2>
          {lines.length === 0 ? <p className="empty">Tap a menu item to add it.</p> : (
            <ul className="cart-lines">
              {lines.map((m) => (
                <li key={m.id}>
                  <div className="cart-top">
                    <span>{m.name}{(m.retainedUnavailable || m.archived) && <span className="muted"> (unavailable)</span>}</span>
                    <span>{peso(m.price * cart[m.id].qty)}</span>
                  </div>
                  <div className="cart-controls">
                    {!m.retainedUnavailable && !m.archived && <button className="qty-btn" onClick={() => change(m, -1)} aria-label={`Remove one ${m.name}`}>−</button>}
                    <span>{cart[m.id].qty}</span>
                    {m.retainedUnavailable || m.archived ? <button className="btn btn-quiet" onClick={() => removeLine(m.id)}>Remove unavailable item</button> : <button className="qty-btn" onClick={() => change(m, 1)} aria-label={`Add one ${m.name}`}>+</button>}
                    {!m.retainedUnavailable && !m.archived && <input placeholder="Item note" value={cart[m.id].notes} onChange={(e) => setNote(m, e.target.value)} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="cart-total"><span>Total</span><strong>{peso(total)}</strong></div>
          <button className="btn btn-primary wide" disabled={busy} onClick={() => submit(true)}>Continue to payment and sending</button>
          <button className="btn wide" disabled={busy} onClick={() => submit(false)}>Save draft</button>
        </aside>
      </div>
    </>
  )
}
