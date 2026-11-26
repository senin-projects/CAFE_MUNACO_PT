import { useState } from 'react'
import { useFetch } from '../../hooks.js'
import { qs } from '../../services/api.js'
import { Empty, ErrorBox, Loading, PageHeader } from '../../components/ui.jsx'
import { dateTime, qty } from '../../utils.js'

// Shared by inventory staff and the owner (both read-only)
export default function StockHistory({ embedded = false }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [days, setDays] = useState('30')
  const { data, error, loading } = useFetch(`/inventory/movements${qs({ q, type, days })}`)

  return (
    <>
      {!embedded && <PageHeader title="Stock History" subtitle="Every time stock came in or went out, and who recorded it." />}
      <div className="filters">
        <input className="search" placeholder="Search by item" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Movement type">
          <option value="">Stock in and out</option>
          <option value="in">Stock in only</option>
          <option value="out">Stock out only</option>
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : data?.length === 0 ? <Empty>No stock changes in this period.</Empty> : (
        <div className="table-wrap">
          <table className="stock-history-table">
            <thead><tr><th>When</th><th>Item</th><th>Change</th><th className="num">Quantity</th><th className="num">Balance after</th><th>Reason or supplier</th><th>Recorded by</th></tr></thead>
            <tbody>
              {data?.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{dateTime(m.created_at)}</td>
                  <td><strong>{m.item_name}</strong></td>
                  <td><span className={`badge move-${m.movement_type}`}>{m.movement_type === 'in' ? 'Stock in' : 'Stock out'}</span></td>
                  <td className="num">{m.movement_type === 'in' ? '+' : '−'}{qty(m.quantity)} {m.unit}</td>
                  <td className="num">{qty(m.balance_after)} {m.unit}</td>
                  <td>{m.supplier || m.reason || '–'}{m.note && <div className="note">{m.note}</div>}</td>
                  <td className="muted">{m.user_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
