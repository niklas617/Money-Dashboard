import { ArrowDownLeft, ArrowUpDown, ArrowUpRight, Wallet } from 'lucide-react'
import { Card } from './ui'
import { cn } from '../lib/cn'
import { formatEUR, MONTHS_DE } from '../lib/format'

/**
 * Cashflow-Karte – 1:1-Portierung des Flutter-Widgets `MonthlyCashflowCard`.
 * Zeigt Einnahmen, Ausgaben und Überschuss des laufenden Monats plus eine
 * Burn-Rate-Leiste (Anteil der ausgegebenen Einnahmen). Gleiche Logik wie in der App:
 * Balken grün < 70 %, orange 70–90 %, rot > 90 %.
 */
export function CashflowCard({ income, expense }: { income: number; expense: number }) {
  const balance = income - expense
  const expenseRatio = income > 0 ? Math.min(expense / income, 1) : 0
  const monthName = MONTHS_DE[new Date().getMonth()]

  const barColor = expenseRatio > 0.9 ? 'bg-negative' : expenseRatio > 0.7 ? 'bg-warning' : 'bg-mint'

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={18} className="text-mint" />
          <span className="text-[15px] font-bold text-text-primary">Cashflow</span>
        </div>
        <span className="rounded-pill bg-surface-high px-2.5 py-1 text-[12px] font-semibold text-text-secondary">
          {monthName}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <CashflowColumn label="Einnahmen" value={income} colorClass="text-mint" icon={<ArrowDownLeft size={13} />} />
        <CashflowColumn label="Ausgaben" value={expense} colorClass="text-negative" icon={<ArrowUpRight size={13} />} />
        <CashflowColumn
          label="Überschuss"
          value={balance}
          colorClass={balance >= 0 ? 'text-mint' : 'text-negative'}
          icon={<Wallet size={13} />}
        />
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-pill bg-surface-high">
        <div
          className={cn('h-full rounded-pill transition-all duration-700', barColor)}
          style={{ width: `${expenseRatio * 100}%` }}
        />
      </div>
      <p className="mt-2.5 text-[12px] text-text-muted">
        {income > 0
          ? `${Math.floor(expenseRatio * 100)} % der Einnahmen ausgegeben`
          : 'Noch keine Einnahmen diesen Monat'}
      </p>
    </Card>
  )
}

function CashflowColumn({
  label,
  value,
  colorClass,
  icon,
}: {
  label: string
  value: number
  colorClass: string
  icon: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className={colorClass}>{icon}</span>
        <span className="truncate text-[11.5px] text-text-secondary">{label}</span>
      </div>
      <div className={cn('mt-1.5 tnum truncate text-[15px] font-bold', colorClass)}>{formatEUR(value)}</div>
    </div>
  )
}
