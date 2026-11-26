import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from './services/api.js'
import { loginRequest } from './services/login.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// [WBS 5.1.1] Implement login and session handling.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onSignedOut = () => setUser(null)
    window.addEventListener('munaco:signed-out', onSignedOut)
    return () => window.removeEventListener('munaco:signed-out', onSignedOut)
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>{children}</AuthContext.Provider>
}
