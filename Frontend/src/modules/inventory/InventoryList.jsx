import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFetch } from '../../hooks.js'
import { api, qs } from '../../services/api.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard, StockBadge } from '../../components/ui.jsx'
import { INVENTORY_CATEGORIES, dateTime, qty } from '../../utils.js'
import Icon from '../../components/Icon.jsx'
import ItemForm from './ItemForm.jsx'

// "Inventory List" for inventory staff, "Inventory Overview" (readOnly) for the owner
export default function InventoryList({ readOnly }) {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [fresh, setFresh] = useState(false)
  const [low, setLow] = useState(() => params.get('low') === '1')
  const [overviewFilter, setOverviewFilter] = useState(() => params.get('low') === '1' ? 'low' : '')
  const [showAddItem, setShowAddItem] = useState(false)
  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const { data, error, loading, reload } = useFetch(`/inventory${qs({
    q,
    category,
    fresh: readOnly ? (overviewFilter === 'fresh' ? '1' : '') : (fresh ? '1' : ''),
    low: readOnly ? (overviewFilter === 'low' ? '1' : '') : (low ? '1' : ''),
  })}`, { poll: 30000 })

  const lowCount = data?.filter((i) => i.stock_status !== 'ok').length ?? 0

  async function removeItem(item) {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return
    setActionError('')
    setDeletingId(item.id)
    try {
      await api(`/inventory/${item.id}`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function renderTable(items) {
    return (
      <div className="table-wrap inventory-table-wrap">
        <table className={`inventory-table${readOnly ? ' read-only' : ''}`}>
          <thead>
            <tr><th>Item</th><th>Fresh</th><th>Category</th><th className="num">On hand</th><th className="num">Reorder at</th><th>Status</th><th>Updated</th>{!readOnly && <th className="inventory-actions-heading">Actions</th>}</tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td data-label="Item">
                  <div className="inventory-item-cell">
                    <strong className="inventory-item-name">{i.name}</strong>
                    {Boolean(i.is_fresh) && <span className="tag inventory-fresh-mobile">Fresh</span>}
                  </div>
                </td>
                <td data-label="Fresh">{Boolean(i.is_fresh) ? <span className="tag">Fresh</span> : <span className="muted">—</span>}</td>
                <td data-label="Category"><span className="inventory-category">{i.category}</span></td>
                <td className="num" data-label="On hand">
                  <span className="inventory-quantity"><span className="inventory-quantity-value">{qty(i.quantity)}</span><span className="inventory-quantity-unit">{i.unit}</span></span>
                </td>
                <td className="num" data-label="Reorder at">
                  <span className="inventory-quantity"><span className="inventory-quantity-value">{qty(i.reorder_level)}</span><span className="inventory-quantity-unit">{i.unit}</span></span>
                </td>
                <td data-label="Status"><StockBadge status={i.stock_status} /></td>
                <td className="inventory-updated" data-label="Updated">{dateTime(i.updated_at)}</td>
                {!readOnly && (
                  <td className="inventory-actions-cell" data-label="Actions">
                    <div className="inventory-row-actions">
                      <Link className="inventory-stock-action" to={`/stock-management?tab=in&item=${i.id}`}>
                        <Icon name="download" size={17} />
                        <span>Stock In</span>
                      </Link>
                      <Link className="inventory-stock-action" to={`/stock-management?tab=out&item=${i.id}`}>
                        <Icon name="upload" size={17} />
                        <span>Stock Out</span>
                      </Link>
                      <details className="inventory-more">
                        <summary className="icon-button" aria-label={`More actions for ${i.name}`} title="More actions">
                          <Icon name="moreVertical" size={19} />
                        </summary>
                        <div className="inventory-action-menu">
                          <Link className="inventory-action-option" to={`/inventory/${i.id}/edit`}>
                            <Icon name="edit" size={16} /> Edit
                          </Link>
                          <button
                            type="button"
                            className="inventory-action-option danger"
                            disabled={deletingId === i.id}
                            onClick={() => removeItem(i)}
                          >
                            <Icon name="trash" size={16} />
                            {deletingId === i.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </details>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={readOnly ? 'Inventory Overview' : 'Inventory Management'}
        subtitle={readOnly ? 'Current quantities and availability. View only.' : undefined}
      >
        {!readOnly && <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>Add new item</button>}
      </PageHeader>

      <div className="stats">
        <StatCard label="Total Item" value={data?.length ?? '–'} />
        <StatCard label="Low or out of stock" value={lowCount} tone={lowCount ? 'warn' : ''} />
        <StatCard label="Fresh products shown" value={data?.filter((i) => i.is_fresh).length ?? '–'} />
      </div>

      <div className="filters">
        <input className="search" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {INVENTORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {readOnly ? (
          <select value={overviewFilter} onChange={(e) => setOverviewFilter(e.target.value)} aria-label="Inventory filter">
            <option value="">All items</option>
            <option value="fresh">Fresh products only</option>
            <option value="low">Low stock only</option>
          </select>
        ) : (
          <>
            <label className="check"><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Fresh products only</label>
            <label className="check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low stock only</label>
          </>
        )}
      </div>

      <ErrorBox message={error || actionError} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>No items match these filters.</Empty> : renderTable(data ?? [])}
      {showAddItem && (
        <ItemForm
          modal
          onClose={() => setShowAddItem(false)}
          onSaved={() => {
            setShowAddItem(false)
            reload()
          }}
        />
      )}
    </>
  )
}
