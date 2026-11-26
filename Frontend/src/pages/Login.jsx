import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { ErrorBox } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login">
        <div className="login-art">
          <img className="login-logo" src="/assets/cafe_munaco_original_transparent.png" alt="Cafe Munaco — Refined Brews, Elevated Spirits" />

          <span className="login-art-location">                </span>
          <svg className="login-art-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="login-art-outline-desktop" vectorEffect="non-scaling-stroke" d="M 5 3 H 95 Q 97 3 97 5 L 86.3 95 Q 86 97 84 97 H 5 Q 3 97 3 95 V 5 Q 3 3 5 3 Z" />
            <path className="login-art-outline-mobile" vectorEffect="non-scaling-stroke" d="M 5 3 H 95 Q 97 3 97 5 V 83.3 Q 97 85.3 95 85.66 L 5 96.46 Q 3 96.7 3 94.7 V 5 Q 3 3 5 3 Z" />
          </svg>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="login-form-heading">
            <span className="login-brand-name">CAFE MUNACO · MADALUNOT</span>
            <h2>Welcome     </h2>
          
          </div>
          <ErrorBox message={error} />
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </label>
          <label>
            Password
            <span className="login-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (!e.target.value) setShowPassword(false)
                }}
                autoComplete="current-password"
              />
              {password.length > 0 && (
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} />
                </button>
              )}
            </span>
          </label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  )
}
