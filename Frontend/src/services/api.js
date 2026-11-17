// Small wrapper around fetch(): adds the login token and turns errors into messages.
const TOKEN_KEY = 'munaco_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running (npm run dev in the server folder).')
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null)
    window.dispatchEvent(new Event('munaco:signed-out'))
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

// qs({ q: 'abc', status: '' }) -> "?q=abc"  (empty values are dropped)
export function qs(params) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && s.set(k, v))
  const out = s.toString()
  return out ? `?${out}` : ''
}
