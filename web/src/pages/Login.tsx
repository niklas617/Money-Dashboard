import { motion } from 'framer-motion'
import { ArrowRight, Lock, LineChart, User } from 'lucide-react'
import { useCallback, useState } from 'react'
import { GoogleButton } from '../components/GoogleButton'
import { Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'

export function Login() {
  const { login, register, googleLogin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogle = useCallback(
    async (idToken: string) => {
      try {
        await googleLogin(idToken)
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Google-Anmeldung fehlgeschlagen.'
        toast.error(msg)
      }
    },
    [googleLogin, toast],
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Bitte Benutzername und Passwort eingeben.')
      return
    }
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
        toast.success('Konto erstellt! Du kannst dich jetzt anmelden.')
        await login(username, password)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Etwas ist schiefgelaufen.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient-Glow im Hintergrund */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-mint/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[320px] w-[420px] rounded-full bg-info/[0.05] blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-mint shadow-glow">
            <LineChart size={28} className="text-on-mint" strokeWidth={2.6} />
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-text-primary">Finanz-Dashboard</h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            Dein Vermögen. Deine Trades. Auf einen Blick.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface/80 p-1.5 shadow-card-lg backdrop-blur-xl">
          {/* Tabs */}
          <div className="relative grid grid-cols-2 rounded-md bg-bg-alt p-1">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'relative z-10 rounded-sm py-2.5 text-[13.5px] font-bold transition-colors',
                  tab === t ? 'text-on-mint' : 'text-text-secondary',
                )}
              >
                {tab === t && (
                  <motion.span
                    layoutId="login-tab"
                    className="absolute inset-0 -z-10 rounded-sm bg-gradient-mint"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                {t === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3 p-4">
            <Field
              icon={<User size={17} />}
              placeholder="Benutzername oder E-Mail"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <Field
              icon={<Lock size={17} />}
              placeholder="Passwort"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />

            <button type="submit" disabled={loading} className="btn-primary mt-1 w-full">
              {loading ? (
                <Spinner size={18} className="border-on-mint/40 border-t-on-mint" />
              ) : (
                <>
                  {tab === 'login' ? 'Einloggen' : 'Konto erstellen'}
                  <ArrowRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="my-1 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-text-muted">oder</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Google */}
            <GoogleButton onCredential={handleGoogle} />
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-text-muted">
          Kurse live von Yahoo Finance &amp; CoinGecko · Beträge in EUR
        </p>
      </motion.div>
    </div>
  )
}

function Field({
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-11"
      />
    </div>
  )
}
