// Zentraler API-Client fuer das FastAPI-Backend.
//
// Dev:  VITE_API_URL ist leer  -> "/api" -> Vite-Proxy leitet an Render weiter (kein CORS).
// Prod: VITE_API_URL = https://money-dashboard-8blm.onrender.com (Backend hat jetzt CORS aktiv).

const API_BASE: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'https://money-dashboard-8blm.onrender.com')

const TOKEN_KEY = 'md_token'
const USER_KEY = 'md_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
export function getStoredUser(): string | null {
  return localStorage.getItem(USER_KEY)
}
export function setStoredUser(user: string) {
  localStorage.setItem(USER_KEY, user)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Callback, das die App bei 401 aufruft (Logout + Redirect zum Login)
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

type ReqOptions = {
  method?: string
  json?: unknown
  form?: Record<string, string>
  body?: BodyInit
  headers?: Record<string, string>
  signal?: AbortSignal
  auth?: boolean
}

async function request<T>(endpoint: string, opts: ReqOptions = {}): Promise<T> {
  const { method = 'GET', json, form, body, signal } = opts
  const headers: Record<string, string> = { ...(opts.headers || {}) }

  const token = getToken()
  if (opts.auth !== false && token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let payload: BodyInit | undefined = body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(json)
  } else if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(form).toString()
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  let res: Response
  try {
    // cache: 'no-store' -> immer frische Daten (kein Anzeigen alter, gecachter Werte
    // beim Seitenwechsel / App-Öffnen).
    res = await fetch(url, { method, headers, body: payload, signal, cache: 'no-store' })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Verbindungsfehler – Backend nicht erreichbar.')
  }

  if (res.status === 401) {
    onUnauthorized?.()
    throw new ApiError(401, 'Sitzung abgelaufen. Bitte neu anmelden.')
  }

  if (!res.ok) {
    let detail = `Fehler ${res.status}`
    try {
      const data = await res.json()
      detail = typeof data?.detail === 'string' ? data.detail : detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// ---------- Typen ----------
export type Holding = {
  symbol: string
  asset_name: string
  asset_type: 'stock' | 'crypto'
  quantity: number
  avg_buy_in: number
  current_price: number
  current_value: number
  invested: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  realized_pnl: number
}

export type PortfolioSummary = {
  holdings: Holding[]
  total_value: number
  total_invested: number
  total_unrealized_pnl: number
  total_realized_pnl: number
  total_realized_pnl_pct: number
  total_pnl_pct: number
}

export type Trade = {
  id: number
  symbol: string
  asset_name: string
  asset_type: 'stock' | 'crypto'
  trade_type: 'BUY' | 'SELL'
  quantity: number
  price_per_unit: number
  coin_id?: string | null
  date: string
  user_id?: number
}

export type SearchResult = {
  symbol: string
  name: string
  asset_type: 'stock' | 'crypto'
  exchange?: string
  coin_id?: string | null
}

export type LookupResult = {
  symbol: string
  name: string
  price_usd: number
  price_eur: number
  current_price: number
  native_currency: string
  logo_url: string
  asset_type: 'stock' | 'crypto'
  coin_id?: string | null
}

export type NetWorthPoint = {
  date: string
  portfolio_value: number
  fiat_value: number
  total_value: number
}

export type HistoryPoint = { date: string; value: number }

export type Account = {
  id: number
  name: string
  currency: string
  opening_balance?: number
  user_id?: number
}
export type Budget = { id: number; category_id: number; monthly_limit: number; user_id?: number }
export type PriceAlert = {
  id: number
  symbol: string
  asset_type: 'stock' | 'crypto'
  target_price: number
  above: boolean
  enabled?: boolean
  user_id?: number
}
export type Category = { id: number; name: string; user_id?: number }
export type Transaction = {
  id: number
  amount: number
  note: string
  date: string
  account_id: number
  category_id: number
  user_id?: number
}

// ---------- API ----------
export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>('/auth/token', {
      method: 'POST',
      form: { username, password },
      auth: false,
    }),
  register: (username: string, password: string) =>
    request('/auth/register', { method: 'POST', json: { username, password }, auth: false }),
  googleLogin: (id_token: string) =>
    request<{ access_token: string; token_type: string; username: string }>('/auth/google/token', {
      method: 'POST',
      json: { id_token },
      auth: false,
    }),
  updateUsername: (new_username: string) =>
    request<{ message: string; new_username: string; new_token: string }>('/auth/update-username', {
      method: 'PUT',
      json: { new_username },
    }),
  setPassword: (new_password: string) =>
    request('/auth/set-password', { method: 'PUT', json: { new_password } }),
  deleteAccount: () => request('/auth/delete-account', { method: 'DELETE' }),

  // Portfolio
  portfolioSummary: (signal?: AbortSignal) =>
    request<PortfolioSummary>('/portfolio/summary', { signal }),
  portfolioHistory: (signal?: AbortSignal) =>
    request<HistoryPoint[]>('/portfolio/history', { signal }),
  netWorthHistory: (signal?: AbortSignal) =>
    request<NetWorthPoint[]>('/portfolio/net-worth', { signal }),
  getTrades: (signal?: AbortSignal) => request<Trade[]>('/portfolio/trades', { signal }),
  createTrade: (payload: Partial<Trade>) =>
    request<Trade>('/portfolio/trades', { method: 'POST', json: payload }),
  updateTrade: (id: number, payload: { quantity?: number; price_per_unit?: number; trade_type?: string; date?: string }) =>
    request<Trade>(`/portfolio/trades/${id}`, { method: 'PUT', json: payload }),
  deleteTrade: (id: number) => request(`/portfolio/trades/${id}`, { method: 'DELETE' }),
  searchAsset: (query: string, signal?: AbortSignal) =>
    request<SearchResult[]>(`/portfolio/search${qs({ query })}`, { signal }),
  lookupAsset: (symbol: string, asset_type: string, coin_id?: string | null) =>
    request<LookupResult>(`/portfolio/lookup${qs({ symbol, asset_type, coin_id: coin_id ?? undefined })}`),

  // Accounts / Categories
  getAccounts: (signal?: AbortSignal) => request<Account[]>('/accounts/', { signal }),
  createAccount: (name: string, currency: string, opening_balance = 0) =>
    request<Account>('/accounts/', { method: 'POST', json: { name, currency, opening_balance } }),
  updateAccount: (
    id: number,
    data: { name?: string; currency?: string; opening_balance?: number },
  ) => request<Account>(`/accounts/${id}`, { method: 'PUT', json: data }),
  deleteAccountById: (id: number) => request(`/accounts/${id}`, { method: 'DELETE' }),
  getCategories: (signal?: AbortSignal) => request<Category[]>('/categories/', { signal }),
  createCategory: (name: string) =>
    request<Category>('/categories/', { method: 'POST', json: { name } }),
  deleteCategory: (id: number) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Budgets (Monatslimit pro Kategorie)
  getBudgets: (signal?: AbortSignal) => request<Budget[]>('/budgets/', { signal }),
  setBudget: (category_id: number, monthly_limit: number) =>
    request<Budget>(`/budgets/${category_id}`, { method: 'PUT', json: { monthly_limit } }),
  deleteBudget: (category_id: number) => request(`/budgets/${category_id}`, { method: 'DELETE' }),

  // Kurs-Alerts (serverseitige Liste)
  getAlerts: (signal?: AbortSignal) => request<PriceAlert[]>('/alerts', { signal }),
  createAlert: (payload: { symbol: string; asset_type: string; target_price: number; above: boolean }) =>
    request<PriceAlert>('/alerts', { method: 'POST', json: payload }),
  deleteAlert: (id: number) => request(`/alerts/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (account_id: number, year: number, signal?: AbortSignal) =>
    request<Transaction[]>(`/transactions/filter${qs({ account_id, year })}`, { signal }),
  createTransaction: (payload: {
    amount: number
    note: string
    account_id: number
    category_id: number
    date: string
  }) => request<Transaction>('/transactions/', { method: 'POST', json: payload }),
  updateTransaction: (
    id: number,
    payload: { amount: number; note: string; category_id: number; account_id: number; date: string },
  ) => request<Transaction>(`/transactions/${id}`, { method: 'PUT', json: payload }),
  deleteTransaction: (id: number) => request(`/transactions/${id}`, { method: 'DELETE' }),
  // KI-Kontoauszug-Scan: Bild hochladen -> Gemini liest Buchungen aus und speichert sie.
  scanBankStatement: (accountId: number, file: File) => {
    const form = new FormData()
    form.append('account_id', String(accountId))
    form.append('file', file)
    // Kein Content-Type setzen -> der Browser vergibt die multipart-Boundary selbst.
    return request<{ status: string; count: number }>('/transactions/scan', {
      method: 'POST',
      body: form,
    })
  },
}

export { API_BASE }
