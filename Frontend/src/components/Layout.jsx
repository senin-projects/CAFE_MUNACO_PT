import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { NAV } from '../nav.js'
import { ROLE_LABEL } from '../utils.js'
import Icon from './Icon.jsx'

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [landscapeNavHidden, setLandscapeNavHidden] = useState(false)
  const location = useLocation()

  return (
    <div className={`shell ${user.role === 'owner' ? 'owner-shell' : ''}${landscapeNavHidden ? ' landscape-nav-hidden' : ''}`}>
      <button
        className="landscape-nav-toggle"
        type="button"
        onClick={() => setLandscapeNavHidden((hidden) => !hidden)}
        aria-label={landscapeNavHidden ? 'Show navigation' : 'Hide navigation'}
        title={landscapeNavHidden ? 'Show navigation' : 'Hide navigation'}
      >
        <Icon name={landscapeNavHidden ? 'menu' : 'arrowLeft'} size={19} />
      </button>
      <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Open menu">
        <Icon name="menu" size={22} />
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Icon name="cup" size={24} />
          <span>Cafe Munaco</span>
        </div>

        <nav onClick={() => setOpen(false)}>
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end ?? false} className={({ isActive }) => (
              isActive || location.state?.from === item.to ? 'active' : ''
            )}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="who">
          <strong>{user.full_name}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
          <button onClick={logout}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
