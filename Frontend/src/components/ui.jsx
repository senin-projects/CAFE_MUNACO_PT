import { STATUS_LABEL } from '../utils.js'

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{STATUS_LABEL[status] || status}</span>

export function StockBadge({ status }) {
  const label = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' }[status]
  return <span className={`badge stock-${status}`}>{label}</span>
}

export function StatCard({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export const Loading = () => <p className="muted pad">Loading…</p>
export const ErrorBox = ({ message }) => (message ? <div className="alert alert-error" role="alert">{message}</div> : null)
export const Empty = ({ children }) => <p className="empty">{children}</p>

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
