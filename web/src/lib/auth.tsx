import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  setUnauthorizedHandler,
} from './api'
import { AuthContext, type AuthState } from './auth-context'

// Kompatibilitaets-Re-Export: bestehende Imports `from '../lib/auth'` bleiben gueltig.
export { useAuth } from './auth-context'
export type { AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [user, setUsr] = useState<string | null>(() => getStoredUser())

  const logout = useMemo(
    () => () => {
      clearToken()
      setTok(null)
      setUsr(null)
    },
    [],
  )

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      setTok(null)
      setUsr(null)
    })

    // Auth ueber Browser-Tabs hinweg synchron halten:
    // Meldet man sich in einem Tab ab/an, ziehen die anderen nach.
    const onStorage = () => {
      setTok(getToken())
      setUsr(getStoredUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const applyToken = (t: string, u: string) => {
    setToken(t)
    setStoredUser(u)
    setTok(t)
    setUsr(u)
  }

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password)
    applyToken(res.access_token, username)
  }

  const register = async (username: string, password: string) => {
    await api.register(username, password)
  }

  const googleLogin = async (idToken: string) => {
    const res = await api.googleLogin(idToken)
    applyToken(res.access_token, res.username)
  }

  const setUser = (u: string) => {
    setStoredUser(u)
    setUsr(u)
  }

  const value: AuthState = {
    token,
    user,
    isAuthenticated: !!token,
    login,
    register,
    googleLogin,
    logout,
    setUser,
    applyToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
