import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../../hooks.js'
import { qs } from '../../services/api.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard, StockBadge } from '../../components/ui.jsx'
import { INVENTORY_CATEGORIES, dateTime, qty } from '../../utils.js'

// "Inventory List" for inventory staff, "Inventory Overview" (readOnly) for the owner
export default function InventoryList({ readOnly }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [fresh, setFresh] = useState(false)
  const [low, setLow] = useState(false)
  const { data, error, loading } = useFetch(`/inventory${qs({ q, category, fresh: fresh ? '1' : '', low: low ? '1' : '' })}`, { poll: 30000 })

  const lowCount = data?.filter((i) => i.stock_status !== 'ok').length ?? 0

  return (
    <>
      <PageHeader
        title={readOnly ? 'Inventory Overview' : 'Inventory List'}
        subtitle={readOnly ? 'Current quantities and availability. View only.' : 'Everything in the kitchen and storeroom.'}
      >
        {!readOnly && <Link className="btn btn-primary" to="/inventory/new">Add new item</Link>}
      </PageHeader>

      <div className="stats">
        <StatCard label="Items shown" value={data?.length ?? '–'} />
        <StatCard label="Low or out of stock" value={lowCount} tone={lowCount ? 'warn' : ''} />
        <StatCard label="Fresh products shown" value={data?.filter((i) => i.is_fresh).length ?? '–'} />
      </div>

      <div className="filters">
        <input className="search" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {INVENTORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Fresh products only</label>
        <label className="check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low stock only</label>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>No items match these filters.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th>Category</th><th className="num">On hand</th><th className="num">Reorder at</th><th>Status</th><th>Updated</th>{!readOnly && <th></th>}</tr>
            </thead>
            <tbody>
              {data?.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong>{i.is_fresh ? <span className="tag">Fresh</span> : null}</td>
                  <td>{i.category}</td>
                  <td className="num">{qty(i.quantity)} {i.unit}</td>
                  <td className="num muted">{qty(i.reorder_level)} {i.unit}</td>
                  <td><StockBadge status={i.stock_status} /></td>
                  <td className="muted">{dateTime(i.updated_at)}</td>
                  {!readOnly && (
                    <td className="row-actions">
                      <Link className="link" to={`/inventory/stock-in?item=${i.id}`}>Stock in</Link>
                      <Link className="link" to={`/inventory/stock-out?item=${i.id}`}>Stock out</Link>
                      <Link className="link" to={`/inventory/${i.id}/edit`}>Edit</Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
