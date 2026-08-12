import { AlertTriangle, Check, Plus, Tag, Trash2, User, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Card, FadeIn, Overline, SectionHeader, Skeleton, Spinner } from '../components/ui'
import { api, type Account, type Category } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'

export function Settings() {
  const toast = useToast()
  const { user, setUser, logout } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const [newAcc, setNewAcc] = useState('')
  const [newAccCur, setNewAccCur] = useState('EUR')
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)

  const [username, setUsername] = useState(user ?? '')
  const [savingName, setSavingName] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = async () => {
    try {
      const [accs, cats] = await Promise.all([api.getAccounts(), api.getCategories()])
      setAccounts(accs)
      setCategories(cats)
    } catch {
      /* egal */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addAccount = async () => {
    if (!newAcc.trim()) return
    setBusy(true)
    try {
      await api.createAccount(newAcc.trim(), newAccCur)
      setNewAcc('')
      toast.success('Konto angelegt.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    } finally {
      setBusy(false)
    }
  }

  const delAccount = async (id: number) => {
    try {
      await api.deleteAccountById(id)
      toast.success('Konto gelöscht.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    }
  }

  const addCategory = async () => {
    if (!newCat.trim()) return
    setBusy(true)
    try {
      await api.createCategory(newCat.trim())
      setNewCat('')
      toast.success('Kategorie angelegt.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    } finally {
      setBusy(false)
    }
  }

  const delCategory = async (id: number) => {
    try {
      await api.deleteCategory(id)
      toast.success('Kategorie gelöscht.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    }
  }

  const saveUsername = async () => {
    if (username.trim().length < 3) return toast.error('Name muss mind. 3 Zeichen haben.')
    if (username === user) return toast.info('Das ist bereits dein Name.')
    setSavingName(true)
    try {
      const res = await api.updateUsername(username.trim())
      setUser(res.new_username)
      toast.success('Name geändert.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async () => {
    if (pwd.length < 6) return toast.error('Passwort muss mind. 6 Zeichen haben.')
    if (pwd !== pwd2) return toast.error('Passwörter stimmen nicht überein.')
    setSavingPwd(true)
    try {
      await api.setPassword(pwd)
      setPwd('')
      setPwd2('')
      toast.success('Passwort gespeichert.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    } finally {
      setSavingPwd(false)
    }
  }

  const deleteAccount = async () => {
    try {
      await api.deleteAccount()
      toast.success('Konto gelöscht. Du wirst abgemeldet.')
      setTimeout(logout, 900)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-44 rounded-md" />
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Einstellungen</h1>
        <p className="text-[13px] text-text-muted">Profil, Konten &amp; Kategorien verwalten</p>
      </div>

      {/* Profil */}
      <FadeIn>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Profil" />
          <Card className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2">
              <Overline>Benutzername</Overline>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="input pl-10" />
                </div>
                <button onClick={saveUsername} disabled={savingName} className="btn-ghost !py-3">
                  {savingName ? <Spinner size={16} /> : <Check size={17} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <Overline>Passwort setzen / ändern</Overline>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Neues Passwort"
                  autoComplete="new-password"
                  className="input"
                />
                <input
                  type="password"
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  placeholder="Bestätigen"
                  autoComplete="new-password"
                  className="input"
                />
              </div>
              <button onClick={savePassword} disabled={savingPwd} className="btn-ghost mt-1 self-start">
                {savingPwd ? <Spinner size={16} /> : 'Passwort speichern'}
              </button>
            </div>
          </Card>
        </div>
      </FadeIn>

      {/* Konten */}
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Konten" trailing={<span className="chip">{accounts.length}</span>} />
          <Card className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={newAcc} onChange={(e) => setNewAcc(e.target.value)} placeholder="Kontoname" className="input flex-1" />
              <select value={newAccCur} onChange={(e) => setNewAccCur(e.target.value)} className="input appearance-none sm:w-28">
                <option className="bg-surface-elevated">EUR</option>
                <option className="bg-surface-elevated">USD</option>
              </select>
              <button onClick={addAccount} disabled={busy || !newAcc.trim()} className="btn-primary">
                <Plus size={17} strokeWidth={2.6} /> Anlegen
              </button>
            </div>
            <div className="mt-4 flex flex-col divide-y divide-border">
              {accounts.length === 0 && <p className="py-4 text-center text-[13px] text-text-muted">Noch keine Konten.</p>}
              {accounts.map((a) => (
                <ManageRow
                  key={a.id}
                  icon={<Wallet size={16} className="text-info" />}
                  title={a.name}
                  sub={a.currency}
                  onDelete={() => delAccount(a.id)}
                  confirmMsg={`Konto „${a.name}" und alle zugehörigen Buchungen löschen?`}
                />
              ))}
            </div>
          </Card>
        </div>
      </FadeIn>

      {/* Kategorien */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Kategorien" trailing={<span className="chip">{categories.length}</span>} />
          <Card className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Kategoriename" className="input flex-1" />
              <button onClick={addCategory} disabled={busy || !newCat.trim()} className="btn-primary">
                <Plus size={17} strokeWidth={2.6} /> Anlegen
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.length === 0 && <p className="py-4 text-center text-[13px] text-text-muted">Noch keine Kategorien.</p>}
              {categories.map((c) => (
                <span key={c.id} className="group inline-flex items-center gap-2 rounded-pill border border-border bg-surface-high py-1.5 pl-3.5 pr-2 text-[13px] font-semibold text-text-primary">
                  <Tag size={13} className="text-mint" />
                  {c.name}
                  <button
                    onClick={() => delCategory(c.id)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-negative/20 hover:text-negative"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </FadeIn>

      {/* Gefahrenzone */}
      <FadeIn delay={0.15}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Gefahrenzone" />
          <Card className="border-negative/25 bg-negative/[0.04] p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-negative/15 text-negative">
                <AlertTriangle size={19} />
              </span>
              <div className="flex-1">
                <div className="text-[14.5px] font-bold text-text-primary">Konto unwiderruflich löschen</div>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  Alle Konten, Kategorien, Buchungen und Trades werden dauerhaft entfernt.
                </p>
              </div>
            </div>
            <button onClick={() => setDeleteOpen(true)} className="mt-4 w-full rounded-sm border border-negative/40 bg-negative/10 py-3 text-[14px] font-bold text-negative transition-colors hover:bg-negative/20">
              Konto löschen
            </button>
          </Card>
        </div>
      </FadeIn>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} />
    </div>
  )
}

function ManageRow({
  icon,
  title,
  sub,
  onDelete,
  confirmMsg,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  onDelete: () => void
  confirmMsg: string
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-high">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-text-primary">{title}</div>
        {sub && <div className="text-[11.5px] text-text-muted">{sub}</div>}
      </div>
      {confirm ? (
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[11px] text-text-muted sm:inline">Sicher?</span>
          <button onClick={onDelete} className="rounded-sm bg-negative/15 px-2.5 py-1.5 text-[12px] font-bold text-negative">
            Löschen
          </button>
          <button onClick={() => setConfirm(false)} className="rounded-sm px-2 py-1.5 text-[12px] text-text-muted">
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          title={confirmMsg}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-negative"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

function DeleteAccountModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  useEffect(() => {
    if (!open) setConfirmText('')
  }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Konto löschen">
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] leading-relaxed text-text-secondary">
          Diese Aktion kann <span className="font-bold text-negative">nicht rückgängig</span> gemacht werden. Tippe zur Bestätigung{' '}
          <span className="font-bold text-text-primary">LÖSCHEN</span> ein.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="LÖSCHEN"
          className="input"
          autoFocus
        />
        <button
          onClick={onConfirm}
          disabled={confirmText.trim().toUpperCase() !== 'LÖSCHEN'}
          className={cn(
            'w-full rounded-sm py-3 text-[14px] font-bold transition-colors',
            confirmText.trim().toUpperCase() === 'LÖSCHEN'
              ? 'bg-negative text-white hover:bg-negative/90'
              : 'cursor-not-allowed bg-surface-high text-text-muted',
          )}
        >
          Konto endgültig löschen
        </button>
      </div>
    </Modal>
  )
}
