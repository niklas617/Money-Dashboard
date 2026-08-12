import { Check, Pencil, PiggyBank, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Card, EmptyState, FadeIn, Overline, SectionHeader, Skeleton, Spinner } from '../components/ui'
import { api, type Budget, type Category } from '../lib/api'
import { cn } from '../lib/cn'
import { formatEUR, MONTHS_DE } from '../lib/format'

export function Budgets() {
  const toast = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [spent, setSpent] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Category | null>(null)

  const load = async () => {
    try {
      const now = new Date()
      const [cats, buds, accounts] = await Promise.all([
        api.getCategories(),
        api.getBudgets(),
        api.getAccounts(),
      ])
      // Ausgaben diesen Monat pro Kategorie
      const results = await Promise.all(
        accounts.map((a) => api.getTransactions(a.id, now.getFullYear()).catch(() => [])),
      )
      const m = new Map<number, number>()
      for (const txs of results) {
        for (const t of txs) {
          const d = new Date(t.date)
          if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.amount < 0) {
            m.set(t.category_id, (m.get(t.category_id) ?? 0) + Math.abs(t.amount))
          }
        }
      }
      setCategories(cats)
      setBudgets(buds)
      setSpent(m)
    } catch {
      /* egal */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.category_id, b.monthly_limit])), [budgets])
  const withBudget = categories.filter((c) => budgetMap.has(c.id))
  const withoutBudget = categories.filter((c) => !budgetMap.has(c.id))

  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spent.get(b.category_id) ?? 0), 0)

  const saveBudget = async (categoryId: number, limit: number | null) => {
    try {
      if (limit == null) {
        await api.deleteBudget(categoryId)
        toast.success('Budget entfernt.')
      } else {
        await api.setBudget(categoryId, limit)
        toast.success('Budget gespeichert.')
      }
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-52 rounded-md" />
        <Skeleton className="h-[170px] rounded-lg" />
        <Skeleton className="h-[220px] rounded-lg" />
      </div>
    )
  }

  const month = MONTHS_DE[new Date().getMonth()]

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Sparziele &amp; Budgets</h1>
        <p className="text-[13px] text-text-muted">Monatslimits pro Kategorie · {month}</p>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Noch keine Kategorien"
          hint={'Lege unter „Einstellungen" Kategorien an, dann kannst du hier Budgets setzen.'}
        />
      ) : (
        <>
          {budgets.length > 0 && (
            <FadeIn>
              <SummaryCard spent={totalSpent} limit={totalLimit} month={month} />
            </FadeIn>
          )}

          {withBudget.length > 0 && (
            <FadeIn delay={0.05}>
              <div className="flex flex-col gap-3">
                <SectionHeader title="Aktive Budgets" />
                <div className="flex flex-col gap-3">
                  {withBudget.map((c) => (
                    <BudgetTile
                      key={c.id}
                      category={c}
                      limit={budgetMap.get(c.id)!}
                      spent={spent.get(c.id) ?? 0}
                      onEdit={() => setEdit(c)}
                    />
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={0.1}>
            <div className="flex flex-col gap-3">
              <SectionHeader title="Kategorien ohne Budget" />
              {withoutBudget.length === 0 ? (
                <p className="rounded-md border border-border bg-surface px-4 py-4 text-center text-[13px] text-text-muted">
                  Alle Kategorien haben ein Budget. 🎉
                </p>
              ) : (
                <Card className="divide-y divide-border overflow-hidden">
                  {withoutBudget.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold text-text-primary">{c.name}</div>
                        <div className="text-[11.5px] text-text-muted">
                          Diesen Monat: {formatEUR(spent.get(c.id) ?? 0)}
                        </div>
                      </div>
                      <button onClick={() => setEdit(c)} className="chip hover:text-mint">
                        <Plus size={14} /> Budget
                      </button>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </FadeIn>
        </>
      )}

      <BudgetModal
        category={edit}
        current={edit ? budgetMap.get(edit.id) ?? null : null}
        onClose={() => setEdit(null)}
        onSave={(limit) => {
          if (edit) saveBudget(edit.id, limit)
          setEdit(null)
        }}
      />
    </div>
  )
}

function SummaryCard({ spent, limit, month }: { spent: number; limit: number; month: string }) {
  const ratio = limit > 0 ? Math.min(1, spent / limit) : 0
  const over = spent > limit && limit > 0
  return (
    <Card gradient className="p-6">
      <div className="flex items-center justify-between">
        <Overline>Budget · {month}</Overline>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12.5px] font-bold',
            over ? 'border-negative/30 bg-negative/[0.14] text-negative' : 'border-mint/30 bg-mint/[0.14] text-mint',
          )}
        >
          {over ? <TriangleAlert size={13} /> : <Check size={13} strokeWidth={2.6} />}
          {over ? 'Überschritten' : `${Math.round(ratio * 100)} %`}
        </span>
      </div>
      <AnimatedNumber
        value={spent}
        format={formatEUR}
        className="mt-3 block tnum text-[34px] font-extrabold leading-none tracking-[-0.03em] text-text-primary"
      />
      <p className="mt-1.5 text-[13px] font-semibold text-text-secondary">von {formatEUR(limit)} geplant</p>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-surface-high">
        <div
          className={cn('h-full rounded-pill transition-all duration-700', over ? 'bg-negative' : 'bg-mint')}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
    </Card>
  )
}

function BudgetTile({
  category,
  limit,
  spent,
  onEdit,
}: {
  category: Category
  limit: number
  spent: number
  onEdit: () => void
}) {
  const ratio = limit > 0 ? Math.min(1, spent / limit) : 0
  const over = spent > limit
  const barColor = over ? 'bg-negative' : ratio > 0.8 ? 'bg-warning' : 'bg-mint'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-text-primary">{category.name}</span>
        <span className={cn('tnum text-[13px] font-semibold', over ? 'text-negative' : 'text-text-secondary')}>
          {formatEUR(spent)} / {formatEUR(limit)}
        </span>
        <button
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-info"
        >
          <Pencil size={15} />
        </button>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-surface-high">
        <div className={cn('h-full rounded-pill transition-all duration-700', barColor)} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
      <p className={cn('mt-2 text-[12px]', over ? 'text-negative' : 'text-text-muted')}>
        {over ? `Budget um ${formatEUR(spent - limit)} überschritten` : `Noch ${formatEUR(limit - spent)} übrig`}
      </p>
    </Card>
  )
}

function BudgetModal({
  category,
  current,
  onClose,
  onSave,
}: {
  category: Category | null
  current: number | null
  onClose: () => void
  onSave: (limit: number | null) => void
}) {
  const toast = useToast()
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (category) setVal(current != null ? String(current) : '')
  }, [category, current])

  return (
    <Modal open={!!category} onClose={onClose} title={category ? `Budget · ${category.name}` : ''}>
      {category && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Monatslimit (€)</span>
            <input value={val} inputMode="decimal" onChange={(e) => setVal(e.target.value)} placeholder="z. B. 300" className="input" autoFocus />
          </label>
          <button
            onClick={() => {
              const v = parseFloat(val.replace(',', '.'))
              if (!v || v <= 0) return toast.error('Bitte ein gültiges Limit eingeben.')
              setSaving(true)
              onSave(v)
            }}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? <Spinner size={18} className="border-on-mint/40 border-t-on-mint" /> : 'Speichern'}
          </button>
          {current != null && (
            <button
              onClick={() => onSave(null)}
              className="flex items-center justify-center gap-2 rounded-sm border border-negative/40 bg-negative/10 py-3 text-[14px] font-bold text-negative transition-colors hover:bg-negative/20"
            >
              <Trash2 size={16} /> Budget entfernen
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
