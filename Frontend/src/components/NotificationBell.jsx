import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFetch } from '../hooks.js'
import { api } from '../services/api.js'
import { dateTime } from '../utils.js'
import Icon from './Icon.jsx'

export default function NotificationBell() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useFetch('/notifications', { poll: 30000 })
  const [open, setOpen] = useState(false)
  const notifications = data || []
  const unread = notifications.filter((note) => !note.is_read).length

  async function markRead(ids) {
    try {
      await api('/notifications/read', { method: 'POST', body: { ids } })
    } catch {
      // Keep navigation available even if marking a notification read fails.
    } finally {
      reload()
    }
  }

  async function openNotification(note) {
    if (!note.is_read) await markRead([note.id])
    setOpen(false)
    navigate(note.to)
  }

  async function markAllRead() {
    await markRead(notifications.filter((note) => !note.is_read).map((note) => note.id))
  }

  return (
    <div className="notification-wrap">
      <button
        type="button"
        className="notification-trigger"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={21} />
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && <section className="notification-panel" aria-label="Notifications">
        <header className="notification-heading">
          <strong>Notifications</strong>
          {unread > 0 && <button type="button" className="link" onClick={markAllRead}>Mark all read</button>}
        </header>
        {error ? <p className="notification-empty">Could not load notifications.</p> : loading && notifications.length === 0 ? <p className="notification-empty">Loading…</p> : notifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : (
          <ul className="notification-list">
            {notifications.map((note) => (
              <li key={note.id}>
                <button type="button" className={`notification-item ${note.is_read ? 'read' : 'unread'}`} onClick={() => openNotification(note)}>
                  <span className="notification-title">{note.title}</span>
                  <span>{note.message}</span>
                  {note.created_at && <time>{dateTime(note.created_at)}</time>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>}
    </div>
  )
}
