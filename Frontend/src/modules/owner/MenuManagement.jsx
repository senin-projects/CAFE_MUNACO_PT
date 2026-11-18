import { useState } from 'react'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import { peso } from '../../utils.js'

const BLANK = { name: '', category: '', price: '', is_available: true }

export default function MenuManagement() {
  const { data, error, loading, reload } = useFetch('/menu')
  const [modal, setModal] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')

  const categories = [...new Set((data || []).map((item) => item.category))].sort((a, b) => a.localeCompare(b))
  const filteredItems = (data || []).filter((item) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${item.name} ${item.category}`.toLowerCase().includes(query)
    const matchesCategory = !categoryFilter || item.category === categoryFilter
    const matchesAvailability = availabilityFilter === '' || String(Number(item.is_available)) === availabilityFilter
    return matchesSearch && matchesCategory && matchesAvailability
  })

  const open = (item = null) => {
    setForm(item ? { name: item.name, category: item.category, price: String(item.price), is_available: !!item.is_available } : BLANK)
    setFormError('')
    setModal(item)
    setModalOpen(true)
  }
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function save(e) {
    e.preventDefault()
    setFormError('')
    setBusy(true)
    try {
      await api(modal ? `/menu/${modal.id}` : '/menu', { method: modal ? 'PUT' : 'POST', body: form })
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(item) {
    setActionError('')
    try {
      await api(`/menu/${item.id}/availability`, { method: 'PATCH', body: { is_available: !item.is_available } })
      reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name} from the menu? Existing orders will keep their saved item name and price.`)) return
    setActionError('')
    try {
      await api(`/menu/${item.id}`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <PageHeader title="Menu Management" subtitle="Add and update items customers can order. Inventory supplies are managed separately.">
        <button className="btn btn-primary" onClick={() => open()}>Add menu item</button>
      </PageHeader>
      <ErrorBox message={error || actionError} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>No menu items yet. Add one to make it available to cashiers.</Empty> : <>
        <div className="filters">
          <input className="search" placeholder="Search menu item or category" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)} aria-label="Availability">
            <option value="">All availability</option>
            <option value="1">Available</option>
            <option value="0">Unavailable</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Category</th><th className="num">Price</th><th>Availability</th><th></th></tr></thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.is_available ? '' : 'inactive'}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.category}</td>
                  <td className="num">{peso(item.price)}</td>
                  <td><span className={`badge ${item.is_available ? 'stock-ok' : 'badge-cancelled'}`}>{item.is_available ? 'Available' : 'Unavailable'}</span></td>
                  <td className="row-actions">
                    <button className="link" onClick={() => open(item)}>Edit</button>
                    <button className={`link ${item.is_available ? 'danger' : ''}`} onClick={() => toggle(item)}>{item.is_available ? 'Mark unavailable' : 'Make available'}</button>
                    <button className="link danger" onClick={() => remove(item)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && <Empty>No menu items match these filters.</Empty>}
      </>}

      {modalOpen && (
        <Modal title={modal ? `Edit ${modal.name}` : 'Add menu item'} onClose={() => setModalOpen(false)}>
          <form className="form" onSubmit={save}>
            <ErrorBox message={formError} />
            <label>Item name<input value={form.name} onChange={set('name')} autoFocus maxLength={100} /></label>
            <label>Category<input value={form.category} onChange={set('category')} placeholder="Coffee, Meals, Desserts" maxLength={50} /></label>
            <label>Price<input type="number" min="0" max="99999999.99" step="0.01" value={form.price} onChange={set('price')} /></label>
            <label className="check"><input type="checkbox" checked={form.is_available} onChange={set('is_available')} /> Available for cashier orders</label>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy}>{modal ? 'Save changes' : 'Add item'}</button>
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
