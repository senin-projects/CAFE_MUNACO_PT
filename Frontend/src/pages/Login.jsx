import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { ErrorBox } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="login">
      <div className="login-art">
        <Icon name="cup" size={40} />
        <h1>Cafe Munaco</h1>
        <p>Madalunot, Calaca, Batangas</p>
      </div>

      <form className="login-form" onSubmit={submit}>
        <h2>Sign in</h2>
        <ErrorBox message={error} />
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

      </form>
    </div>
  )
}
