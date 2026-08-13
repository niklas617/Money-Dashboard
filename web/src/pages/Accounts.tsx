import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  PencilLine,
  Plus,
  Scale,
  ScanLine,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { AreaChart } from '../components/AreaChart'
import { CHART_COLORS, Donut } from '../components/Donut'
import { Modal } from '../components/Modal'
import { ScanReceiptModal } from '../components/ScanReceiptModal'
import { useToast } from '../components/Toast'
import {
  Card,
  EmptyState,
  FadeIn,
  Overline,
  SectionHeader,
  Skeleton,
  Spinner,
} from '../components/ui'
import { api, type Account, type Category, type Transaction } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEUR, formatEURSigned, MONTHS_DE, parseAmount } from '../lib/format'

type TxFilter = 'ALL' | 'IN' | 'OUT'

export function Accounts() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeAcc, setActiveAcc] = useState<number | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([]) // laufendes Jahr
  const [allTimeSum, setAllTimeSum] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(false)
  const [year] = useState(() => new Date().getFullYear())
  const [addOpen, setAddOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [creatingAcc, setCreatingAcc] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TxFilter>('ALL')

  const activeAccount = accounts.find((a) => a.id === activeAcc) ?? null

  const loadBase = async () => {
    try {
      const [accs, cats] = await Promise.all([api.getAccounts(), api.getCategories()])
      setAccounts(accs)
      setCategories(cats)
      if (accs.length > 0 && activeAcc == null) setActiveAcc(accs[0].id)
    } catch {
      /* egal */
    } finally {
      setLoading(false)
    }
  }

  // Laufendes Jahr fuer Liste/Analytics + Summe ALLER Buchungen (10 Jahre parallel)
  const loadTx = async (accId: number) => {
    setLoadingTx(true)
    try {
      const years = Array.from({ length: 10 }, (_, i) => year - i)
      const all = await Promise.all(years.map((y) => api.getTransactions(accId, y).catch(() => [])))
      setTxs(all[0])
      setAllTimeSum(all.flat().reduce((s, t) => s + t.amount, 0))
    } catch {
      setTxs([])
      setAllTimeSum(0)
    } finally {
      setLoadingTx(false)
    }
  }

  useEffect(() => {
    loadBase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeAcc != null) loadTx(activeAcc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcc])

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  // --- Kennzahlen ---
  const now = new Date()
  const opening = activeAccount?.opening_balance ?? 0
  const balance = opening + allTimeSum

  const yearStats = useMemo(() => {
    let income = 0
    let expense = 0
    const inc = new Map<string, number>()
    const exp = new Map<string, number>()
    let mIncome = 0
    let mExpense = 0
    for (const t of txs) {
      const name = catMap.get(t.category_id) ?? 'Unbekannt'
      if (t.amount > 0) {
        income += t.amount
        inc.set(name, (inc.get(name) ?? 0) + t.amount)
      } else {
        expense += Math.abs(t.amount)
        exp.set(name, (exp.get(name) ?? 0) + Math.abs(t.amount))
      }
      const d = new Date(t.date)
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        if (t.amount > 0) mIncome += t.amount
        else mExpense += Math.abs(t.amount)
      }
    }
    const toSlices = (m: Map<string, number>) =>
      [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    return { income, expense, mIncome, mExpense, incomeSlices: toSlices(inc), expenseSlices: toSlices(exp) }
  }, [txs, catMap, now])

  // Kontostand-Verlauf: kumuliert ab Jahresanfangssaldo
  const balanceSeries = useMemo(() => {
    if (txs.length === 0) return []
    const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const yearNet = txs.reduce((s, t) => s + t.amount, 0)
    let running = balance - yearNet // Kontostand zu Jahresbeginn
    return sorted.map((t) => {
      running += t.amount
      return { date: String(t.date).slice(0, 10), value: running }
    })
  }, [txs, balance])

  const visibleTxs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...txs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((t) => {
        const cat = (catMap.get(t.category_id) ?? '').toLowerCase()
        const matchQ = !q || cat.includes(q) || t.note.toLowerCase().includes(q)
        const matchF =
          filter === 'ALL' || (filter === 'IN' && t.amount > 0) || (filter === 'OUT' && t.amount < 0)
        return matchQ && matchF
      })
  }, [txs, query, filter, catMap])

  const createFirstAccount = async () => {
    setCreatingAcc(true)
    try {
      const acc = await api.createAccount('Girokonto', 'EUR')
      toast.success('Konto angelegt!')
      await loadBase()
      setActiveAcc(acc.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Anlegen.')
    } finally {
      setCreatingAcc(false)
    }
  }

  const removeTx = async (id: number) => {
    try {
      await api.deleteTransaction(id)
      toast.success('Buchung gelöscht.')
      if (activeAcc != null) loadTx(activeAcc)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  const reconcile = async (real: number) => {
    if (activeAcc == null) return
    try {
      await api.updateAccount(activeAcc, { opening_balance: real - allTimeSum })
      toast.success('Kontostand abgeglichen.')
      await loadBase()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-[150px] rounded-lg" />
        <Skeleton className="h-[260px] rounded-lg" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Konten</h1>
        <EmptyState
          icon={Wallet}
          title="Noch kein Konto"
          hint="Lege ein Konto an, um Einnahmen und Ausgaben zu erfassen."
          action={
            <button onClick={createFirstAccount} disabled={creatingAcc} className="btn-primary">
              {creatingAcc ? <Spinner size={16} className="border-on-mint/40 border-t-on-mint" /> : <Plus size={17} />}
              Konto „Girokonto" anlegen
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Konten</h1>
          <p className="text-[13px] text-text-muted">Kontostand, Buchungen &amp; Analysen</p>
        </div>
        <button onClick={() => setChooserOpen(true)} className="btn-primary !px-4 !py-2.5">
          <Plus size={18} strokeWidth={2.6} />
          <span className="hidden sm:inline">Buchung</span>
        </button>
      </div>

      {accounts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveAcc(a.id)}
              className={cn(
                'shrink-0 rounded-pill border px-4 py-2 text-[13px] font-bold transition-colors',
                activeAcc === a.id
                  ? 'border-mint bg-mint/15 text-mint'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong',
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {loadingTx ? (
        <Skeleton className="h-[150px] rounded-lg" />
      ) : (
        <FadeIn>
          {/* --- KONTOSTAND-HERO --- */}
          <Card gradient className="p-6">
            <div className="flex items-center justify-between">
              <Overline>Kontostand{activeAccount ? ` · ${activeAccount.name}` : ''}</Overline>
              <button onClick={() => setReconcileOpen(true)} className="chip hover:text-mint">
                <Scale size={13} /> Abgleichen
              </button>
            </div>
            <AnimatedNumber
              value={balance}
              format={formatEUR}
              className={cn(
                'mt-3 block tnum text-[38px] font-extrabold leading-none tracking-[-0.03em]',
                balance >= 0 ? 'text-mint' : 'text-negative',
              )}
            />
            <p className="mt-2.5 text-[12px] text-text-muted">
              Anfangssaldo {formatEUR(opening)} · Buchungen {formatEURSigned(allTimeSum)}
            </p>
            <div className="mt-4 flex gap-8">
              <HeroMini label={`Einnahmen ${year}`} value={yearStats.income} color="text-mint" />
              <HeroMini label={`Ausgaben ${year}`} value={yearStats.expense} color="text-negative" />
            </div>
          </Card>
        </FadeIn>
      )}

      {!loadingTx && (
        <>
          {/* --- Monats-Cashflow --- */}
          <FadeIn delay={0.05}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <Overline>Cashflow · {MONTHS_DE[now.getMonth()]}</Overline>
                <span
                  className={cn(
                    'tnum text-[13px] font-bold',
                    yearStats.mIncome - yearStats.mExpense >= 0 ? 'text-mint' : 'text-negative',
                  )}
                >
                  {formatEURSigned(yearStats.mIncome - yearStats.mExpense)}
                </span>
              </div>
              <IncomeExpenseBars income={yearStats.mIncome} expense={yearStats.mExpense} />
            </Card>
          </FadeIn>

          {/* --- Analytics: 2 Kuchendiagramme --- */}
          {(yearStats.incomeSlices.length > 0 || yearStats.expenseSlices.length > 0) && (
            <FadeIn delay={0.08}>
              <div className="flex flex-col gap-3">
                <SectionHeader title={`Analyse ${year}`} />
                <div className="grid gap-4 lg:grid-cols-2">
                  {yearStats.incomeSlices.length > 0 && (
                    <PieCard
                      title="Einnahmen nach Kategorie"
                      slices={yearStats.incomeSlices}
                      total={yearStats.income}
                    />
                  )}
                  {yearStats.expenseSlices.length > 0 && (
                    <PieCard
                      title="Ausgaben nach Kategorie"
                      slices={yearStats.expenseSlices}
                      total={yearStats.expense}
                    />
                  )}
                </div>
              </div>
            </FadeIn>
          )}

          {/* --- Kontostand-Verlauf --- */}
          {balanceSeries.length > 1 && (
            <FadeIn delay={0.1}>
              <Card className="p-5">
                <Overline>Kontostand-Verlauf {year}</Overline>
                <div className="mt-3">
                  <AreaChart data={balanceSeries} formatValue={formatEUR} height={210} />
                </div>
              </Card>
            </FadeIn>
          )}

          {/* --- Buchungen mit Suche/Filter --- */}
          <FadeIn delay={0.12}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Buchungen" trailing={<span className="chip">{visibleTxs.length}</span>} />

              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buchung suchen (Kategorie / Notiz) …"
                    className="input pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  {(['ALL', 'IN', 'OUT'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'rounded-pill border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                        filter === f
                          ? 'border-mint bg-mint text-on-mint'
                          : 'border-border bg-surface-high text-text-secondary hover:border-border-strong',
                      )}
                    >
                      {f === 'ALL' ? 'Alle' : f === 'IN' ? 'Einnahmen' : 'Ausgaben'}
                    </button>
                  ))}
                </div>
              </div>

              {visibleTxs.length === 0 ? (
                <EmptyState icon={Wallet} title="Keine Buchungen" hint={`Für ${year} sind keine passenden Buchungen vorhanden.`} />
              ) : (
                <Card className="divide-y divide-border overflow-hidden">
                  {visibleTxs.map((t) => (
                    <TxRow
                      key={t.id}
                      t={t}
                      category={catMap.get(t.category_id) ?? 'Unbekannt'}
                      onEdit={() => setEditTx(t)}
                      onDelete={() => removeTx(t.id)}
                    />
                  ))}
                </Card>
              )}
            </div>
          </FadeIn>
        </>
      )}

      <BookingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
        accountId={activeAcc!}
        onSaved={() => activeAcc != null && loadTx(activeAcc)}
      />
      <BookingModal
        open={!!editTx}
        onClose={() => setEditTx(null)}
        categories={categories}
        accountId={activeAcc!}
        editTx={editTx}
        onSaved={() => activeAcc != null && loadTx(activeAcc)}
      />
      <ReconcileModal
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        current={balance}
        onConfirm={reconcile}
      />
      <ActionChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onScan={() => {
          setChooserOpen(false)
          setScanOpen(true)
        }}
        onManual={() => {
          setChooserOpen(false)
          setAddOpen(true)
        }}
      />
      <ScanReceiptModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        accountId={activeAcc!}
        onSaved={() => activeAcc != null && loadTx(activeAcc)}
      />
    </div>
  )
}

function ActionChooser({
  open,
  onClose,
  onScan,
  onManual,
}: {
  open: boolean
  onClose: () => void
  onScan: () => void
  onManual: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Buchung hinzufügen">
      <div className="flex flex-col gap-3">
        <ChooserTile
          icon={<ScanLine size={22} />}
          color="#B79BFF"
          title="KI-Kontoauszug-Scan"
          subtitle="Foto hochladen – Gemini trägt ein"
          onClick={onScan}
        />
        <ChooserTile
          icon={<PencilLine size={22} />}
          color="#35E0A1"
          title="Manuelle Buchung"
          subtitle="Betrag & Kategorie selbst eintragen"
          onClick={onManual}
        />
      </div>
    </Modal>
  )
}

function ChooserTile({
  icon,
  color,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode
  color: string
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border"
        style={{
          color,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
        }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-bold text-text-primary">{title}</div>
        <div className="text-[12px] text-text-muted">{subtitle}</div>
      </div>
    </button>
  )
}

function HeroMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={cn('mt-0.5 tnum text-[15px] font-bold', color)}>{formatEUR(value)}</div>
    </div>
  )
}

function IncomeExpenseBars({ income, expense }: { income: number; expense: number }) {
  const max = Math.max(income, expense, 1)
  return (
    <div className="mt-4 flex flex-col gap-4">
      <Bar label="Einnahmen" value={income} pct={(income / max) * 100} color="#35E0A1" icon={<ArrowDownLeft size={14} />} />
      <Bar label="Ausgaben" value={expense} pct={(expense / max) * 100} color="#FF6B6B" icon={<ArrowUpRight size={14} />} />
    </div>
  )
}

function Bar({ label, value, pct, color, icon }: { label: string; value: number; pct: number; color: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className="tnum text-[13px] font-bold text-text-primary">{formatEUR(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-elevated">
        <div className="h-full rounded-pill transition-all duration-700" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function PieCard({ title, slices, total }: { title: string; slices: { label: string; value: number }[]; total: number }) {
  return (
    <Card className="p-5">
      <Overline>{title}</Overline>
      <div className="mt-3 flex items-center gap-4">
        <Donut slices={slices} centerLabel="Gesamt" centerValue={formatEUR(total).replace(' €', '')} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {slices.slice(0, 6).map((c, i) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-primary">{c.label}</span>
              <span className="tnum text-[12px] font-semibold text-text-secondary">
                {total > 0 ? ((c.value / total) * 100).toFixed(0) : 0} %
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function TxRow({
  t,
  category,
  onEdit,
  onDelete,
}: {
  t: Transaction
  category: string
  onEdit: () => void
  onDelete: () => void
}) {
  const isIncome = t.amount > 0
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm',
          isIncome ? 'bg-mint/15 text-mint' : 'bg-negative/15 text-negative',
        )}
      >
        {isIncome ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-text-primary">{t.note || category}</div>
        <div className="text-[11.5px] text-text-muted">
          {category} · {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </div>
      </div>
      <span className={cn('tnum shrink-0 text-[14px] font-bold', isIncome ? 'text-mint' : 'text-negative')}>
        {formatEURSigned(t.amount)}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-info">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-negative">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function ReconcileModal({
  open,
  onClose,
  current,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  current: number
  onConfirm: (real: number) => void
}) {
  const [val, setVal] = useState('')
  useEffect(() => {
    if (open) setVal(current.toFixed(2))
  }, [open, current])
  return (
    <Modal open={open} onClose={onClose} title="Mit Bank abgleichen">
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] leading-relaxed text-text-secondary">
          Gib den aktuellen Kontostand aus deiner Bank-App ein. Der Anfangssaldo wird automatisch so gesetzt,
          dass es exakt passt — und die Übersicht rechnet damit.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-secondary">Echter Kontostand (€)</span>
          <input value={val} inputMode="decimal" onChange={(e) => setVal(e.target.value)} className="input" autoFocus />
        </label>
        <button
          onClick={() => {
            const real = parseAmount(val)
            if (Number.isNaN(real)) return
            onConfirm(real)
            onClose()
          }}
          className="btn-primary w-full"
        >
          Speichern
        </button>
      </div>
    </Modal>
  )
}

function BookingModal({
  open,
  onClose,
  categories,
  accountId,
  onSaved,
  editTx,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  accountId: number
  onSaved: () => void
  editTx?: Transaction | null
}) {
  const toast = useToast()
  const isEdit = !!editTx
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editTx) {
        setType(editTx.amount >= 0 ? 'income' : 'expense')
        setAmount(String(Math.abs(editTx.amount)))
        setNote(editTx.note)
        setCategoryId(editTx.category_id)
        setDate(new Date(editTx.date).toISOString().slice(0, 10))
      } else {
        setType('expense')
        setAmount('')
        setNote('')
        setCategoryId(categories[0]?.id ?? null)
        setDate(new Date().toISOString().slice(0, 10))
      }
    }
  }, [open, editTx, categories])

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt || amt <= 0) return toast.error('Bitte einen gültigen Betrag eingeben.')
    if (categoryId == null) return toast.error('Bitte eine Kategorie wählen.')
    const signed = type === 'expense' ? -Math.abs(amt) : Math.abs(amt)
    setSaving(true)
    try {
      const payload = { amount: signed, note, account_id: accountId, category_id: categoryId, date: `${date}T12:00:00` }
      if (isEdit && editTx) {
        await api.updateTransaction(editTx.id, payload)
        toast.success('Buchung aktualisiert.')
      } else {
        await api.createTransaction(payload)
        toast.success('Buchung gespeichert.')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Buchung bearbeiten' : 'Neue Buchung'}>
      {categories.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-text-muted">
          Lege zuerst unter „Einstellungen" eine Kategorie an.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'rounded-md border py-3 text-[14px] font-bold transition-all',
                  type === t
                    ? t === 'income'
                      ? 'border-mint bg-mint/15 text-mint'
                      : 'border-negative bg-negative/15 text-negative'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong',
                )}
              >
                {t === 'income' ? 'Einnahme' : 'Ausgabe'}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Betrag (€)</span>
            <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="input" autoFocus />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Kategorie</span>
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} className="input appearance-none">
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface-elevated">
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Notiz</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Einkauf Rewe" className="input" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Datum</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input [color-scheme:dark]" />
          </label>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Spinner size={18} className="border-on-mint/40 border-t-on-mint" /> : isEdit ? 'Änderungen speichern' : 'Buchung speichern'}
          </button>
        </div>
      )}
    </Modal>
  )
}
