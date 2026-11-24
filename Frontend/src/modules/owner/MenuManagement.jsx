import { useState } from 'react'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import { peso } from '../../utils.js'
import Icon from '../../components/Icon.jsx'

const BLANK = { name: '', category: '', price: '', is_available: true }
const MENU_CATEGORIES = ['coffee', 'non-coffee', 'main course', 'desserts', 'pastries', 'beverage']
const CATEGORY_ICONS = {
  coffee: 'cup',
  'non-coffee': 'icedCup',
  'main course': 'utensils',
  desserts: 'cake',
  pastries: 'croissant',
  beverage: 'glass',
}
const LEGACY_CATEGORY_NAMES = {
  seafood: 'main course',
  meat: 'main course',
  vegetables: 'main course',
  sides: 'main course',
  mains: 'main course',
  packages: 'main course',
  drinks: 'beverage',
  beverages: 'beverage',
}
const categoryIcon = (category) => {
  const key = String(category || '').trim().toLowerCase()
  return CATEGORY_ICONS[LEGACY_CATEGORY_NAMES[key] || key] || 'list'
}

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

  async function toggleAvailability() {
    if (!modal) return
    const is_available = !form.is_available
    setFormError('')
    setBusy(true)
    try {
      await api(`/menu/${modal.id}/availability`, { method: 'PATCH', body: { is_available } })
      setForm((current) => ({ ...current, is_available }))
      setModal((current) => ({ ...current, is_available }))
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
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
          <table className="menu-management-table">
            <colgroup>
              <col className="menu-col-item" />
              <col className="menu-col-category" />
              <col className="menu-col-price" />
              <col className="menu-col-availability" />
              <col className="menu-col-actions" />
            </colgroup>
            <thead><tr><th>Item</th><th>Category</th><th className="num">Price</th><th>Availability</th><th aria-label="Actions"></th></tr></thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.is_available ? '' : 'inactive'}>
                  <td className="menu-item-cell-wrap">
                    <span className="menu-item-cell">
                      <span className="menu-category-icon"><Icon name={categoryIcon(item.category)} size={19} /></span>
                      <strong>{item.name}</strong>
                    </span>
                  </td>
                  <td className="menu-category-label">{item.category}</td>
                  <td className="num">{peso(item.price)}</td>
                  <td><span className={`badge ${item.is_available ? 'stock-ok' : 'badge-cancelled'}`}>{item.is_available ? 'Available' : 'Unavailable'}</span></td>
                  <td className="menu-row-actions">
                    <span className="menu-row-action-buttons">
                      <button type="button" className="icon-button" onClick={() => open(item)} aria-label={`Edit ${item.name}`} title="Edit">
                        <Icon name="edit" size={17} />
                      </button>
                      <button type="button" className="icon-button icon-button-danger" onClick={() => remove(item)} aria-label={`Delete ${item.name}`} title="Delete">
                        <Icon name="trash" size={17} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && <Empty>No menu items match these filters.</Empty>}
      </>}

      {modalOpen && (
        <Modal
          title={modal ? 'Edit a product' : 'Add a product'}
          eyebrow={modal ? 'EDIT PRODUCT' : 'NEW PRODUCT'}
          className="menu-product-modal"
          showCloseButton
          onClose={() => setModalOpen(false)}
        >
          <form className="form menu-product-form" onSubmit={save}>
            <ErrorBox message={formError} />
            <label className="menu-product-name">Product name *<input value={form.name} onChange={set('name')} placeholder="e.g. Cafe Latte" autoFocus maxLength={100} required /></label>
            <label>Category
              <span className="menu-category-select">
                <select value={form.category} onChange={set('category')} required>
                  <option value="" disabled>Select a category</option>
                  {form.category && !MENU_CATEGORIES.includes(form.category) && <option value={form.category}>{form.category} (current category)</option>}
                  {MENU_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <span className="menu-category-selected" title={form.category ? `${form.category} icon` : 'Category icon'}>
                  <Icon name={categoryIcon(form.category)} size={18} />
                </span>
              </span>
            </label>
            <label>Price (₱) *<input type="number" min="0" max="99999999.99" step="0.01" value={form.price} onChange={set('price')} required /></label>
            {modal && <>
              <div className="menu-availability-control">
                <span className={`badge ${form.is_available ? 'stock-ok' : 'badge-cancelled'}`}>
                  {form.is_available ? 'Available' : 'Unavailable'}
                </span>
                <button type="button" className="btn" disabled={busy} onClick={toggleAvailability}>
                  {form.is_available ? 'Mark unavailable' : 'Make available'}
                </button>
              </div>
            </>}
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
