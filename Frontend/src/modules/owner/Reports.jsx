import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../hooks.js'
import { Empty, ErrorBox, Loading, PageHeader, StatCard } from '../../components/ui.jsx'
import { formatCurrencyAxis, peso, qty } from '../../utils.js'
import Icon from '../../components/Icon.jsx'

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
    <section className="panel report-sales-panel">
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
    <section className="panel report-category-panel">
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
    <section className="panel report-best-selling-panel">
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

function getSalesAxisScale(rows) {
  const maxSales = Math.max(0, ...rows.map((row) => Number(row.sales) || 0))
  const roughStep = maxSales / 5
  const magnitude = roughStep > 0 ? 10 ** Math.floor(Math.log10(roughStep)) : 1
  const normalizedStep = roughStep / magnitude
  const niceStep = Math.max(1, (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude)
  const max = Math.max(1, Math.ceil(maxSales / niceStep) * niceStep)
  return { max, step: niceStep }
}

function DailyLineChart({ rows, days }) {
  const chartRef = useRef(null)
  const [width, setWidth] = useState(700)
  const [activeIndex, setActiveIndex] = useState(null)
  useEffect(() => {
    if (!chartRef.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])

  const height = 280
  const { max, step } = getSalesAxisScale(rows)
  const left = Math.max(58, Math.ceil(formatCurrencyAxis(max).length * 6.5 + 12))
  const right = 16
  const top = 18
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const baseline = top + plotHeight
  const slotWidth = rows.length ? plotWidth / rows.length : plotWidth
  const tickCount = Math.ceil(max / step)
  const points = rows.map((row, index) => ({
    ...row,
    x: left + slotWidth * (index + 0.5),
    y: top + plotHeight - ((Number(row.sales) || 0) / max) * plotHeight,
  }))
  const labelStep = Math.max(1, Math.ceil(rows.length / 8))
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const beforePrevious = points[index - 2] || previous
    const next = points[index + 1] || point
    const tension = 0.5
    const control1X = previous.x + (point.x - beforePrevious.x) / 6 * tension
    const control1Y = previous.y + (point.y - beforePrevious.y) / 6 * tension
    const control2X = point.x - (next.x - previous.x) / 6 * tension
    const control2Y = point.y - (next.y - previous.y) / 6 * tension
    return `${path} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point.x} ${point.y}`
  }, '')
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const tooltipWidth = 174
  const tooltipX = activePoint ? Math.min(Math.max(left, activePoint.x - tooltipWidth / 2), width - right - tooltipWidth) : 0
  const tooltipY = activePoint ? (activePoint.y > 86 ? activePoint.y - 70 : activePoint.y + 18) : 0

  return (
    <section className="panel report-daily-panel">
      <div className="report-chart-heading">
        <h2>Sales per day</h2>
        <span className="muted">Last {days} days</span>
      </div>
      {rows.length === 0 ? <Empty>No served sales in this period.</Empty> : (
        <div className="report-line-wrap" ref={chartRef}>
          <svg className="report-line-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Line graph of sales per day for the last ${days} days`}>
            {Array.from({ length: tickCount + 1 }, (_, index) => {
              const value = max - step * index
              const y = top + (value / max) * plotHeight
              return (
                <g key={value}>
                  <line x1={left} x2={width - right} y1={y} y2={y} className="report-line-grid" />
                  <text x={left - 8} y={y + 4} textAnchor="end" className="report-line-axis-label">{formatCurrencyAxis(value)}</text>
                </g>
              )
            })}
            {points.length > 1 && <path d={linePath} className="report-line-path" />}
            {points.map((point, index) => (
              <g key={point.day}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  className="report-line-dot"
                  tabIndex="0"
                  role="button"
                  aria-label={`${point.day}: sales ${peso(point.sales)}, ${qty(point.orders)} orders`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                />
                {(index % labelStep === 0 || index === points.length - 1) && (
                  <text x={point.x} y={height - 12} textAnchor="middle" className="report-line-axis-label">
                    {new Date(`${point.day}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </text>
                )}
              </g>
            ))}
            {activePoint && (
              <g className="report-line-tooltip" aria-hidden="true" pointerEvents="none">
                <line x1={activePoint.x} x2={activePoint.x} y1={top} y2={baseline} className="report-line-guide" />
                <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="56" rx="8" className="report-line-tooltip-box" />
                <text x={tooltipX + 12} y={tooltipY + 20} className="report-line-tooltip-date">
                  {new Date(`${activePoint.day}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </text>
                <text x={tooltipX + 12} y={tooltipY + 41} className="report-line-tooltip-sales">Sales: {peso(activePoint.sales)}</text>
              </g>
            )}
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
    <div className="reports-page">
      <PageHeader title="Sales analytics" subtitle="Sales trends from orders marked as served." className="report-page-head">
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Daily sales period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button type="button" className="icon-button" aria-label="Print report" title="Print report" onClick={() => window.print()}>
          <Icon name="printer" size={18} />
        </button>
      </PageHeader>

      <ErrorBox message={error} />
      {loading && !r ? <Loading /> : r && (
        <>
          <div className="reports-summary-layout">
            <section className="panel report-total-revenue">
              <div className="report-total-revenue-heading">
                <h2>Total revenue</h2>
                <span className="report-total-revenue-icon"><Icon name="chart" size={21} /></span>
              </div>
              <strong className="report-total-revenue-value">{peso(r.overview.total_revenue)}</strong>
              <span className="report-total-revenue-caption">Lifetime sales from served orders</span>
            </section>
            <div className="stats reports-summary-stats">
              <StatCard label="Sales today" value={peso(r.overview.sales_today)} />
              <StatCard label={`Sales (last ${days} days)`} value={peso(r.totals.sales)} />
              <StatCard label="Orders served" value={qty(r.totals.orders)} />
              <StatCard label="Products sold" value={qty(r.totals.items_sold)} />
            </div>
          </div>

          <DailyLineChart rows={dailyRows} days={days} />

          <div className="grid-2 reports-sales-grid">
            <SalesChart title="Monthly sales" subtitle="Last 12 months" rows={r.monthly} periodLabel={monthLabel} />
            <SalesChart title="Yearly sales" subtitle="Last 5 years" rows={r.yearly} periodLabel={(year) => year} />
          </div>

          <div className="grid-2 reports-detail-grid">
            <CategoryChart rows={r.by_category} days={days} />
            <BestSellingChart rows={r.top_items} days={days} />
          </div>
        </>
      )}
    </div>
  )
}
