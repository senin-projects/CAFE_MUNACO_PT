import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard } from '../../components/ui.jsx'
import { peso, qty } from '../../utils.js'

const monthLabel = (value) => new Date(`${value}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })

function dailySeries(rows, days) {
  const salesByDay = new Map(rows.map((row) => [row.day, row]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - index - 1))
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return salesByDay.get(day) || { day, sales: 0, orders: 0 }
  })
}

function SalesChart({ title, subtitle, rows, periodLabel }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.sales) || 0))
  return (
    <section className="panel">
      <div className="report-chart-heading">
        <h2>{title}</h2>
        <span className="muted">{subtitle}</span>
      </div>
      {rows.length === 0 ? <Empty>No served sales in this period.</Empty> : (
        <div className="report-chart-scroll">
          <div className="report-chart" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} role="img" aria-label={`${title} chart`}>
            {rows.map((row) => (
              <div className="report-chart-column" key={row.period} title={`${periodLabel(row.period)}: ${peso(row.sales)} from ${qty(row.orders)} orders`}>
                <span className="report-chart-value">{peso(row.sales)}</span>
                <div className="report-chart-track">
                  <div className="report-chart-bar" style={{ height: `${Math.max(3, (Number(row.sales) / max) * 100)}%` }} />
                </div>
                <span className="report-chart-label">{periodLabel(row.period)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

const CATEGORY_COLORS = ['#9d5538', '#c89755', '#6f8059', '#68818b', '#80647e', '#c17855', '#a7a35b', '#6e665e']

function CategoryChart({ rows, days }) {
  const total = rows.reduce((sum, row) => sum + Number(row.sales || 0), 0)
  let accumulated = 0
  const slices = rows.map((row, index) => {
    const start = accumulated
    accumulated += total ? (Number(row.sales || 0) / total) * 100 : 0
    return { ...row, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length], start, end: accumulated }
  })
  const gradient = slices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(', ')

  return (
    <section className="panel">
      <div className="report-chart-heading">
        <h2>Sales by menu category</h2>
        <span className="muted">Last {days} days</span>
      </div>
      {rows.length === 0 || total === 0 ? <Empty>No served sales in this period.</Empty> : (
        <div className="category-chart-layout">
          <div className="category-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Doughnut chart of sales by menu category, total ${peso(total)}`}>
            <div className="category-donut-hole"><strong>{peso(total)}</strong><span>Total sales</span></div>
          </div>
          <ul className="category-legend">
            {slices.map((slice) => (
              <li key={slice.category}>
                <span className="category-legend-name"><i style={{ backgroundColor: slice.color }} />{slice.category}</span>
                <strong>{peso(slice.sales)}</strong>
                <span className="muted">{Math.round((Number(slice.sales) / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function BestSellingChart({ rows, days }) {
  const max = Math.max(1, ...rows.map((item) => Number(item.quantity) || 0))
  return (
    <section className="panel">
      <div className="report-chart-heading">
        <h2>Best-selling items</h2>
        <span className="muted">Last {days} days · units sold</span>
      </div>
      {rows.length === 0 ? <Empty>No served items in this period.</Empty> : (
        <ol className="best-selling-list">
          {rows.map((item, index) => (
            <li key={item.item_name}>
              <div className="best-selling-label"><strong>{index + 1}. {item.item_name}</strong><span>{qty(item.quantity)} sold · {peso(item.sales)}</span></div>
              <div className="hbar"><div style={{ width: `${(Number(item.quantity) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DailyLineChart({ rows, days }) {
  const chartRef = useRef(null)
  const [width, setWidth] = useState(700)
  useEffect(() => {
    if (!chartRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])

  const height = 280
  const left = 58
  const right = 16
  const top = 18
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const max = Math.max(1, ...rows.map((row) => Number(row.sales) || 0))
  const points = rows.map((row, index) => ({
    ...row,
    x: left + (rows.length < 2 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth),
    y: top + plotHeight - ((Number(row.sales) || 0) / max) * plotHeight,
  }))
  const labelStep = Math.max(1, Math.ceil(rows.length / 8))
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const beforePrevious = points[index - 2] || previous
    const next = points[index + 1] || point
    const control1X = previous.x + (point.x - beforePrevious.x) / 6
    const control1Y = previous.y + (point.y - beforePrevious.y) / 6
    const control2X = point.x - (next.x - previous.x) / 6
    const control2Y = point.y - (next.y - previous.y) / 6
    return `${path} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point.x} ${point.y}`
  }, '')

  return (
    <section className="panel">
      <div className="report-chart-heading">
        <h2>Sales per day</h2>
        <span className="muted">Last {days} days</span>
      </div>
      {rows.length === 0 ? <Empty>No served sales in this period.</Empty> : (
        <div className="report-line-wrap" ref={chartRef}>
          <svg className="report-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Line graph of sales per day for the last ${days} days`}>
            {[0, 1, 2, 3].map((step) => {
              const y = top + (plotHeight / 3) * step
              const value = max * (1 - step / 3)
              return (
                <g key={step}>
                  <line x1={left} x2={width - right} y1={y} y2={y} className="report-line-grid" />
                  <text x={left - 8} y={y + 4} textAnchor="end" className="report-line-axis-label">{peso(value)}</text>
                </g>
              )
            })}
            {points.length > 1 && <path d={linePath} className="report-line-path" />}
            {points.map((point, index) => (
              <g key={point.day}>
                <circle cx={point.x} cy={point.y} r="4.5" className="report-line-point">
                  <title>{`${point.day}: ${peso(point.sales)} from ${qty(point.orders)} orders`}</title>
                </circle>
                {(index % labelStep === 0 || index === points.length - 1) && (
                  <text x={point.x} y={height - 12} textAnchor="middle" className="report-line-axis-label">
                    {new Date(`${point.day}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  )
}

export default function Reports() {
  const [days, setDays] = useState('7')
  const { data: r, error, loading } = useFetch(`/reports/summary?days=${days}`)
  const dailyRows = dailySeries(r?.daily || [], Number(days))

  return (
    <>
      <PageHeader title="Overview" subtitle="Sales from orders marked as served.">
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Daily sales period">
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
            <StatCard label={`Sales (last ${days} days)`} value={peso(r.totals.sales)} />
            <StatCard label="Orders served" value={qty(r.totals.orders)} />
            <StatCard label="Average order" value={peso(r.totals.average)} />
          </div>

          <DailyLineChart rows={dailyRows} days={days} />

          <div className="grid-2">
            <SalesChart title="Monthly sales" subtitle="Last 12 months" rows={r.monthly} periodLabel={monthLabel} />
            <SalesChart title="Yearly sales" subtitle="Last 5 years" rows={r.yearly} periodLabel={(year) => year} />
          </div>

          <div className="grid-2">
            <CategoryChart rows={r.by_category} days={days} />
            <BestSellingChart rows={r.top_items} days={days} />
          </div>
        </>
      )}
    </>
  )
}
