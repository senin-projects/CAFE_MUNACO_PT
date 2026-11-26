import { useState } from 'react'
import { api } from '../../services/api.js'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, Modal, PageHeader } from '../../components/ui.jsx'
import { peso } from '../../utils.js'
import Icon from '../../components/Icon.jsx'
import { getCompatibleUnits } from '../../../../Shared/units.js'

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

// [WBS 2.2.1] Implement menu item create, update, delete, and availability.
// [WBS 2.2.2] Implement ingredient recipes per menu item.
export default function MenuManagement() {
  const { data, error, loading, reload } = useFetch('/menu')
  const [modal, setModal] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [inventoryItems, setInventoryItems] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalLoadError, setModalLoadError] = useState(false)
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
    const availableForOrders = Boolean(item.is_available) && Boolean(item.has_recipe) && Boolean(item.inventory_available)
    const matchesAvailability = availabilityFilter === '' || String(Number(availableForOrders)) === availabilityFilter
    return matchesSearch && matchesCategory && matchesAvailability
  })
  const unassignedIngredients = inventoryItems.filter(
    (ingredient) => !ingredients.some((assigned) => Number(assigned.ingredient_id) === Number(ingredient.id)),
  )
  const availableIngredients = unassignedIngredients.filter(
    (ingredient) => String(ingredient.name || '').toLowerCase().includes(ingredientSearch.trim().toLowerCase()),
  )

  const open = async (item = null) => {
    setForm(item ? { name: item.name, category: item.category, price: String(item.price), is_available: !!item.is_available } : BLANK)
    setIngredients([])
    setInventoryItems([])
    setIngredientSearch('')
    setSelectedIngredientId('')
    setFormError('')
    setModalLoadError(false)
    setModal(item)
    setModalOpen(true)
    setModalLoading(true)
    try {
      const inventoryRequest = api('/inventory')
      const menuItemRequest = item ? api(`/menu/${item.id}`) : Promise.resolve(null)
      const [inventoryResult, menuItemResult] = await Promise.allSettled([
        inventoryRequest,
        menuItemRequest,
      ])

      if (inventoryResult.status === 'rejected') {
        throw inventoryResult.reason
      }

      setInventoryItems(inventoryResult.value)
      const menuItem = menuItemResult.status === 'fulfilled' ? menuItemResult.value : null
      if (menuItemResult.status === 'rejected' && item) {
        throw menuItemResult.reason
      }
      setIngredients(menuItem?.ingredients.map((ingredient) => ({
        ...ingredient,
        quantity_required: String(ingredient.quantity_required),
      })) || [])
    } catch (err) {
      setFormError(err.message)
      setModalLoadError(true)
    } finally {
      setModalLoading(false)
    }
  }
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  function addIngredient() {
    const item = inventoryItems.find((ingredient) => String(ingredient.id) === selectedIngredientId)
    if (!item || ingredients.some((ingredient) => Number(ingredient.ingredient_id) === item.id)) return
    setIngredients((current) => [...current, {
      ingredient_id: item.id,
      name: item.name,
      category: item.category,
      current_stock: item.quantity,
      inventory_unit: item.unit,
      quantity_required: '',
      unit_of_measurement: item.unit,
    }])
    setSelectedIngredientId('')
    setIngredientSearch('')
  }

  async function save(e) {
    e.preventDefault()
    setFormError('')
    setBusy(true)
    try {
      await api(modal ? `/menu/${modal.id}` : '/menu', {
        method: modal ? 'PUT' : 'POST',
        body: {
          ...form,
          ingredients: ingredients.map(({ ingredient_id, quantity_required, unit_of_measurement }) => ({
            ingredient_id,
            quantity_required: Number(quantity_required),
            unit_of_measurement,
          })),
        },
      })
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
    if (!window.confirm(`Delete ${item.name}? Its recipe will be removed, but existing order history will be preserved.`)) return
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
      <PageHeader title="Menu Management">
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
                <tr key={item.id} className={item.is_available && item.has_recipe && item.inventory_available ? '' : 'inactive'}>
                  <td className="menu-item-cell-wrap">
                    <span className="menu-item-cell">
                      <span className="menu-category-icon"><Icon name={categoryIcon(item.category)} size={19} /></span>
                      <strong>{item.name}</strong>
                    </span>
                  </td>
                  <td className="menu-category-label">{item.category}</td>
                  <td className="num">{peso(item.price)}</td>
                  <td>
                    <span className={`badge ${item.is_available && item.has_recipe && item.inventory_available ? 'stock-ok' : 'badge-cancelled'}`}>
                      {!item.has_recipe
                        ? 'Recipe required'
                        : !item.inventory_available
                          ? item.has_out_of_stock_ingredient ? 'Ingredient out of stock' : 'Insufficient ingredient stock'
                          : item.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
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
            <section className="menu-ingredients">
              <div className="menu-ingredients-heading">
                <div>
                  <h3>Ingredients / Recipe</h3>
                  <p>Set the quantity needed per serving and choose a compatible unit.</p>
                </div>
              </div>
              <div className="recipe-ingredient-picker">
                <label>Search or select ingredient
                  <input
                    type="text"
                    list="menu-ingredient-options"
                    value={ingredientSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setIngredientSearch(value)
                      const selected = unassignedIngredients.find((ingredient) => ingredient.name.toLowerCase() === value.trim().toLowerCase())
                      setSelectedIngredientId(selected ? String(selected.id) : '')
                    }}
                    placeholder="Type or choose an ingredient"
                    autoComplete="off"
                  />
                  <datalist id="menu-ingredient-options">
                    {availableIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.name} />
                    ))}
                  </datalist>
                </label>
                <button type="button" className="btn" onClick={addIngredient} disabled={!selectedIngredientId || modalLoading}>Add ingredient</button>
              </div>
              {ingredientSearch.trim() && availableIngredients.length === 0 && <p className="recipe-empty">No matching ingredients.</p>}
              {modalLoading ? <p className="muted">Loading inventory and recipe…</p> : ingredients.length ? (
                <div className="recipe-ingredient-list">
                  {ingredients.map((ingredient) => (
                    <div className="recipe-ingredient-row" key={ingredient.ingredient_id}>
                      <div className="recipe-ingredient-name">
                        <strong>{ingredient.name}</strong>
                        <span>{ingredient.category}</span>
                      </div>
                      <label>Quantity needed per serving
                        <input
                          type="number"
                          min="0.01"
                          max="99999999.99"
                          step="0.01"
                          required
                          value={ingredient.quantity_required}
                          onChange={(e) => setIngredients((current) => current.map((entry) => (
                            entry.ingredient_id === ingredient.ingredient_id
                              ? { ...entry, quantity_required: e.target.value }
                              : entry
                          )))}
                        />
                      </label>
                      <div className="recipe-ingredient-unit">
                        <label>Unit
                          <select
                            value={ingredient.unit_of_measurement}
                            onChange={(e) => setIngredients((current) => current.map((entry) => (
                              entry.ingredient_id === ingredient.ingredient_id
                                ? { ...entry, unit_of_measurement: e.target.value }
                                : entry
                            )))}
                          >
                            {getCompatibleUnits(ingredient.inventory_unit, ingredient.unit_of_measurement).map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="recipe-ingredient-stock">
                        <span>Available</span>
                        <strong>{ingredient.current_stock} {ingredient.inventory_unit}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn recipe-remove"
                        onClick={() => setIngredients((current) => current.filter((entry) => entry.ingredient_id !== ingredient.ingredient_id))}
                        aria-label={`Remove ${ingredient.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="recipe-empty">{inventoryItems.length ? 'No ingredients assigned yet.' : 'No inventory ingredients are registered yet.'}</p>}
            </section>
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
              <button className="btn btn-primary" disabled={busy || modalLoading || modalLoadError}>{modal ? 'Save changes' : 'Add item'}</button>
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
