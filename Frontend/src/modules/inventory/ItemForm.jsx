import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api.js'
import { ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import { INVENTORY_CATEGORIES, UNITS } from '../../utils.js'

// "Add New Item" (no :id) and "Edit item" (with :id)
// [WBS 3.1.1] Implement inventory item create, update, and delete.
export default function ItemForm({ modal = false, onClose, onSaved }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', category: 'Seafood', unit: 'kg', quantity: '', reorder_level: '', is_fresh: true })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!id)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    api(`/inventory/${id}`)
      .then((i) => setForm({ name: i.name, category: i.category, unit: i.unit, quantity: i.quantity, reorder_level: i.reorder_level, is_fresh: !!i.is_fresh }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api(id ? `/inventory/${id}` : '/inventory', { method: id ? 'PUT' : 'POST', body: form })
      if (onSaved) onSaved()
      else navigate('/inventory')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  const formContent = (
    <form className={`panel form narrow${modal ? ' item-form-modal' : ''}`} onSubmit={submit}>
        <ErrorBox message={error} />
        <label>Item name<input value={form.name} onChange={set('name')} placeholder="Shrimp (hipon)" /></label>
        <div className="form-row">
          <label>Category
            <select value={form.category} onChange={set('category')}>{INVENTORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Unit
            <select value={form.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
        </div>
        <div className="form-row">
          {!id && <label>Starting quantity<input type="number" min="0" step="0.000001" value={form.quantity} onChange={set('quantity')} /></label>}
          <label>Reorder level<input type="number" min="0" step="0.000001" value={form.reorder_level} onChange={set('reorder_level')} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.is_fresh} onChange={set('is_fresh')} /> Fresh or perishable (seafood, meat, vegetables, dairy)</label>
        <p className="muted">You will see a warning when the quantity drops to the reorder level or below.</p>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>{id ? 'Save changes' : 'Add item'}</button>
          <button type="button" className="btn" onClick={onClose || (() => navigate('/inventory'))}>Cancel</button>
        </div>
      </form>
  )

  if (modal) return <Modal title="Add New Item" onClose={onClose} showCloseButton className="item-create-modal">{formContent}</Modal>

  return (
    <>
      <PageHeader title={id ? 'Edit Item' : 'Add New Item'} subtitle={id ? 'To change the quantity, use Stock in or Stock out so the history stays correct.' : 'Add a supply you want to track.'} />
      {formContent}
    </>
  )
}
