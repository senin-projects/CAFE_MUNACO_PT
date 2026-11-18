import { useState } from 'react'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard } from '../../components/ui.jsx'
import { ORDER_TYPES, STATUS_LABEL, peso, qty } from '../../utils.js'

export default function Reports() {
  const [days, setDays] = useState('30')
  const { data: r, error, loading } = useFetch(`/reports/summary?days=${days}`)
  const maxDay = Math.max(1, ...(r?.daily.map((d) => d.sales) || [1]))
  const maxType = Math.max(1, ...(r?.by_type.map((t) => t.sales) || [1]))

  return (
    <>
      <PageHeader title="Business Reports" subtitle="Sales count only orders that were marked as served.">
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
      </PageHeader>

      <ErrorBox message={error} />
      {loading && !r ? <Loading /> : r && (
        <>
          <div className="stats">
            <StatCard label="Sales" value={peso(r.totals.sales)} />
            <StatCard label="Orders served" value={r.totals.orders} />
            <StatCard label="Average order" value={peso(r.totals.average)} />
            <StatCard label="Stock deliveries recorded" value={r.stock_in} />
          </div>

          <section className="panel">
            <h2>Sales per day</h2>
            {r.daily.length === 0 ? <Empty>No served orders in this period.</Empty> : (
              <div className="bars" role="img" aria-label="Bar chart of sales per day">
                {r.daily.map((d) => (
                  <div className="bar-col" key={d.day} title={`${d.day}: ${peso(d.sales)} from ${qty(d.orders)} orders`}>
                    <span className="bar-value">{peso(d.sales)}</span>
                    <div className="bar" style={{ height: `${Math.max(4, (d.sales / maxDay) * 100)}%` }} />
                    <span className="bar-label">{new Date(d.day + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="panel">
              <h2>Sales by order type</h2>
              {r.by_type.length === 0 ? <Empty>No data yet.</Empty> : (
                <ul className="hbars">
                  {r.by_type.map((t) => (
                    <li key={t.order_type}>
                      <div className="hbar-top"><span>{ORDER_TYPES[t.order_type]}</span><span>{peso(t.sales)} <span className="muted">({qty(t.orders)})</span></span></div>
                      <div className="hbar"><div style={{ width: `${(t.sales / maxType) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2>Best-selling items</h2>
              {r.top_items.length === 0 ? <Empty>No data yet.</Empty> : (
                <ul className="rows">
                  {r.top_items.map((i) => (
                    <li key={i.item_name}><strong>{i.item_name}</strong><span className="muted">{qty(i.quantity)} sold · {peso(i.sales)}</span></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2>All orders by status</h2>
              <ul className="rows">
                {r.order_status.map((s) => <li key={s.status}><span>{STATUS_LABEL[s.status]}</span><strong>{qty(s.count)}</strong></li>)}
              </ul>
            </section>

            <section className="panel">
              <h2>Why stock was removed</h2>
              {r.stock_out_reasons.length === 0 ? <Empty>No stock was removed in this period.</Empty> : (
                <ul className="rows">
                  {r.stock_out_reasons.map((s) => <li key={s.reason}><span>{s.reason}</span><strong>{qty(s.count)}</strong></li>)}
                </ul>
              )}
            </section>
          </div>

          <section className="panel">
            <h2>Items to restock</h2>
            {r.low_stock.length === 0 ? <Empty>All items are above their reorder level.</Empty> : (
              <ul className="rows">
                {r.low_stock.map((i) => <li key={i.id}><strong>{i.name}</strong><span className="muted">{qty(i.quantity)} of {qty(i.reorder_level)} {i.unit}</span></li>)}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}
