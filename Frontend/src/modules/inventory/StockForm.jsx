import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import { qty } from '../../utils.js'

const OUT_REASONS = ['Used in kitchen', 'Spoiled', 'Wasted', 'Returned to supplier', 'Event or advance order', 'Other']

// "Stock In" (type="in") and "Stock Out" (type="out")
export default function StockForm({ type, embedded = false }) {
  const [params] = useSearchParams()
  const { data: items, error: loadError, reload } = useFetch('/inventory')
  const [form, setForm] = useState({ item: params.get('item') || '', quantity: '', supplier: '', reason: type === 'out' ? OUT_REASONS[0] : 'Delivery', note: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  // reset the form when switching between the Stock In and Stock Out pages
  useEffect(() => {
    setForm((f) => ({ ...f, quantity: '', supplier: '', note: '', reason: type === 'out' ? OUT_REASONS[0] : 'Delivery' }))
    setError('')
    setDone('')
  }, [type])

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const selected = items?.find((i) => String(i.id) === String(form.item))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone('')
    if (!form.item) return setError('Choose an item first.')
    setBusy(true)
    try {
      const res = await api(`/inventory/${form.item}/stock-${type}`, { method: 'POST', body: form })
      setDone(`${type === 'in' ? 'Received' : 'Removed'} ${qty(form.quantity)} ${res.item.unit} of ${res.item.name}. Now ${qty(res.item.quantity)} ${res.item.unit} on hand.`)
      setForm({ ...form, quantity: '', supplier: '', note: '' })
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!items && !loadError) return <Loading />

  return (
    <>
      {!embedded && (
        <PageHeader
          title={type === 'in' ? 'Stock In' : 'Stock Out'}
          subtitle={type === 'in' ? 'Record supplies you purchased or received.' : 'Record supplies that were used or removed.'}
        />
      )}
      <form className="panel form narrow" onSubmit={submit}>
        <ErrorBox message={error || loadError} />
        {done && <div className="alert alert-ok" role="status">{done}</div>}

        <label>Item
          <select value={form.item} onChange={set('item')}>
            <option value="">Choose an item</option>
            {items?.map((i) => <option key={i.id} value={i.id}>{i.name} ({qty(i.quantity)} {i.unit} on hand)</option>)}
          </select>
        </label>

        <label>Quantity{selected ? ` (${selected.unit})` : ''}
          <input type="number" min="0" step="0.000001" value={form.quantity} onChange={set('quantity')} />
        </label>

        {type === 'in' ? (
          <label>Supplier<input value={form.supplier} onChange={set('supplier')} placeholder="Calaca Fish Port" /></label>
        ) : (
          <label>Reason
            <select value={form.reason} onChange={set('reason')}>{OUT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
        )}

        <label>Note (optional)<input value={form.note} onChange={set('note')} /></label>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>{type === 'in' ? 'Record stock in' : 'Record stock out'}</button>
        </div>
      </form>
    </>
  )
}
