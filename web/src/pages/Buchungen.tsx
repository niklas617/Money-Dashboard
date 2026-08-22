import { ArrowLeft, Search, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Card, EmptyState, FadeIn, SectionHeader, Skeleton } from '../components/ui'
import { api, type Account, type Category, type Transaction } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEURSigned, MONTHS_DE } from '../lib/format'
import { BookingModal, TxRow } from './Accounts'

type Dir = 'ALL' | 'IN' | 'OUT'

export function Buchungen() {
  const navigate = useNavigate()
  const toast = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const [accId, setAccId] = useState<number | 'ALL'>('ALL')
  const [year, setYear] = useState<number | 'ALL'>('ALL')
  const [month, setMonth] = useState<number | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [dir, setDir] = useState<Dir>('ALL')

  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [confirmDel, setConfirmDel] = useState<Transaction | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [accs, cats] = await Promise.all([api.getAccounts(), api.getCategories()])
      setAccounts(accs)
      setCategories(cats)
      const cy = new Date().getFullYear()
      const lists = await Promise.all(accs.map((a) => api.getTransactions(a.id, cy).catch(() => [])))
      setTxs(lists.flat())
    } catch {
      /* leerer Zustand */
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const years = useMemo(() => {
    const set = new Set<number>()
    txs.forEach((t) => set.add(new Date(t.date).getFullYear()))
    return [...set].sort((a, b) => b - a)
  }, [txs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...txs]
      .filter((t) => {
        if (accId !== 'ALL' && t.account_id !== accId) return false
        const d = new Date(t.date)
        if (year !== 'ALL' && d.getFullYear() !== year) return false
        if (month !== 'ALL' && d.getMonth() !== month) return false
        if (dir === 'IN' && t.amount <= 0) return false
        if (dir === 'OUT' && t.amount >= 0) return false
        const cat = (catMap.get(t.category_id) ?? '').toLowerCase()
        return !q || cat.includes(q) || t.note.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [txs, accId, year, month, query, dir, catMap])

  const sum = filtered.reduce((s, t) => s + t.amount, 0)

  const removeTx = async (id: number) => {
    try {
      await api.deleteTransaction(id)
      toast.success('Buchung gelöscht.')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/konten')}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-mint"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Alle Buchungen</h1>
          <p className="text-[13px] text-text-muted">Nach Konto, Jahr &amp; Monat filtern</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2.5">
          {accounts.length > 1 && (
            <FilterSelect
              value={String(accId)}
              onChange={(v) => setAccId(v === 'ALL' ? 'ALL' : Number(v))}
              options={[{ v: 'ALL', l: 'Alle Konten' }, ...accounts.map((a) => ({ v: String(a.id), l: a.name }))]}
            />
          )}
          <FilterSelect
            value={String(year)}
            onChange={(v) => setYear(v === 'ALL' ? 'ALL' : Number(v))}
            options={[{ v: 'ALL', l: 'Alle Jahre' }, ...years.map((y) => ({ v: String(y), l: String(y) }))]}
          />
          <FilterSelect
            value={String(month)}
            onChange={(v) => setMonth(v === 'ALL' ? 'ALL' : Number(v))}
            options={[{ v: 'ALL', l: 'Alle Monate' }, ...MONTHS_DE.map((m, i) => ({ v: String(i), l: m }))]}
          />
        </div>
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
              onClick={() => setDir(f)}
              className={cn(
                'rounded-pill border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                dir === f
                  ? 'border-mint bg-mint text-on-mint'
                  : 'border-border bg-surface-high text-text-secondary hover:border-border-strong',
              )}
            >
              {f === 'ALL' ? 'Alle' : f === 'IN' ? 'Einnahmen' : 'Ausgaben'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[260px] rounded-lg" />
      ) : (
        <FadeIn>
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={`${filtered.length} ${filtered.length === 1 ? 'Buchung' : 'Buchungen'}`}
              trailing={
                <span className={cn('tnum text-[13px] font-bold', sum >= 0 ? 'text-mint' : 'text-negative')}>
                  {formatEURSigned(sum)}
                </span>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState icon={Wallet} title="Keine Buchungen" hint="Für diese Filter gibt es keine Buchungen." />
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {filtered.map((t) => (
                  <TxRow
                    key={t.id}
                    t={t}
                    category={catMap.get(t.category_id) ?? 'Unbekannt'}
                    onEdit={() => setEditTx(t)}
                    onDelete={() => setConfirmDel(t)}
                  />
                ))}
              </Card>
            )}
          </div>
        </FadeIn>
      )}

      <BookingModal
        open={!!editTx}
        onClose={() => setEditTx(null)}
        categories={categories}
        accountId={editTx?.account_id ?? accounts[0]?.id ?? 0}
        editTx={editTx}
        onSaved={load}
      />

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Buchung löschen?">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-relaxed text-text-secondary">
            Diese Buchung wirklich löschen? Das lässt sich nicht rückgängig machen.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={() => {
                if (confirmDel) removeTx(confirmDel.id)
                setConfirmDel(null)
              }}
              className="flex-1 justify-center rounded-md bg-negative/15 py-3 text-[14px] font-bold text-negative transition-colors hover:bg-negative/25"
            >
              Löschen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input appearance-none !w-auto min-w-[130px] flex-1 cursor-pointer sm:flex-none"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v} className="bg-surface-elevated">
          {o.l}
        </option>
      ))}
    </select>
  )
}
