import { createContext, useContext } from 'react'

export type AuthState = {
  token: string | null
  user: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  googleLogin: (idToken: string) => Promise<void>
  logout: () => void
  setUser: (u: string) => void
  applyToken: (token: string, user: string) => void
}

// Eigenes, stabiles Modul (nur Context + Hook, keine Komponente) -> Vite Fast Refresh
// tauscht diese Datei nicht aus, die Context-Identität bleibt über HMR erhalten.
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider genutzt werden')
  return ctx
}
