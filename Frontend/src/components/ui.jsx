import { STATUS_LABEL, formatNumber } from '../utils.js'

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
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null

  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`}>
      <div className="stat-value">{numericValue === null ? value : formatNumber(numericValue)}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export const Loading = () => <p className="muted pad">Loading…</p>
export const ErrorBox = ({ message }) => (message ? <div className="alert alert-error" role="alert">{message}</div> : null)
export const Empty = ({ children }) => <p className="empty">{children}</p>

export function Modal({ title, onClose, children, eyebrow, className = '', showCloseButton = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          {showCloseButton && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
