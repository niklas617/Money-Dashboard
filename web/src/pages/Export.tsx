import { CandlestickChart, FileSpreadsheet, FileText, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../components/Toast'
import { Card, FadeIn, Skeleton } from '../components/ui'
import { api, type Trade, type Transaction } from '../lib/api'
import { downloadCSV, printPDF } from '../lib/export'
import { formatDate } from '../lib/format'

const deNum = (n: number, max = 2) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: max })
const deQty = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 6 })

export function Export() {
  const toast = useToast()
  const [trades, setTrades] = useState<Trade[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [catNames, setCatNames] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const year = new Date().getFullYear()
        const [tr, accounts, cats] = await Promise.all([
          api.getTrades(),
          api.getAccounts(),
          api.getCategories(),
        ])
        const txLists = await Promise.all(
          accounts.map((a) => api.getTransactions(a.id, year).catch(() => [])),
        )
        // Der /filter-Endpoint ignoriert das Jahr und liefert ALLE Buchungen –
        // fuer den Jahres-Export daher clientseitig aufs laufende Jahr filtern.
        const allTx = txLists
          .flat()
          .filter((t) => new Date(t.date).getFullYear() === year)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setTrades(tr)
        setTxs(allTx)
        setCatNames(new Map(cats.map((c) => [c.id, c.name])))
      } catch {
        /* egal */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const year = new Date().getFullYear()

  // --- Trades ---
  const tradeHeaders = ['Datum', 'Symbol', 'Name', 'Typ', 'Klasse', 'Anzahl', 'Preis (€)', 'Total (€)']
  const tradeRows = () =>
    trades.map((t) => [
      formatDate(t.date),
      t.symbol,
      t.asset_name,
      t.trade_type === 'BUY' ? 'Kauf' : 'Verkauf',
      t.asset_type === 'stock' ? 'Aktie' : 'Krypto',
      deQty(t.quantity),
      deNum(t.price_per_unit, 8),
      deNum(t.quantity * t.price_per_unit),
    ])

  // --- Buchungen ---
  const txHeaders = ['Datum', 'Kategorie', 'Notiz', 'Betrag (€)']
  const txRows = () =>
    txs.map((t) => [
      formatDate(t.date),
      catNames.get(t.category_id) ?? 'Unbekannt',
      t.note,
      deNum(t.amount),
    ])

  const exportTradesCsv = () => downloadCSV(`trades_${year}.csv`, tradeHeaders, tradeRows())
  const exportTradesPdf = () => {
    const ok = printPDF({ title: 'Trades', subtitle: `${trades.length} Einträge`, headers: tradeHeaders, rows: tradeRows() })
    if (!ok) toast.error('Popup blockiert – bitte Popups für diese Seite erlauben.')
  }
  const exportTxCsv = () => downloadCSV(`buchungen_${year}.csv`, txHeaders, txRows())
  const exportTxPdf = () => {
    const ok = printPDF({ title: `Buchungen ${year}`, subtitle: `${txs.length} Einträge`, headers: txHeaders, rows: txRows() })
    if (!ok) toast.error('Popup blockiert – bitte Popups für diese Seite erlauben.')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-[150px] rounded-lg" />
        <Skeleton className="h-[150px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text-primary">Export</h1>
        <p className="text-[13px] text-text-muted">Als CSV (Excel/Sheets) oder als formatiertes PDF</p>
      </div>

      <FadeIn>
        <ExportCard
          icon={<CandlestickChart size={22} />}
          color="#35E0A1"
          title="Trades"
          count={`${trades.length} Einträge`}
          disabled={trades.length === 0}
          onCsv={exportTradesCsv}
          onPdf={exportTradesPdf}
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <ExportCard
          icon={<Receipt size={22} />}
          color="#63A9FF"
          title={`Buchungen ${year}`}
          count={`${txs.length} Einträge`}
          disabled={txs.length === 0}
          onCsv={exportTxCsv}
          onPdf={exportTxPdf}
        />
      </FadeIn>
    </div>
  )
}

function ExportCard({
  icon,
  color,
  title,
  count,
  disabled,
  onCsv,
  onPdf,
}: {
  icon: React.ReactNode
  color: string
  title: string
  count: string
  disabled: boolean
  onCsv: () => void
  onPdf: () => void
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-md border"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 24%, transparent)`,
          }}
        >
          {icon}
        </span>
        <div>
          <div className="text-[16px] font-bold text-text-primary">{title}</div>
          <div className="text-[12.5px] text-text-muted">{count}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={onCsv} disabled={disabled} className="btn-ghost justify-center disabled:opacity-40">
          <FileSpreadsheet size={17} /> CSV
        </button>
        <button onClick={onPdf} disabled={disabled} className="btn-primary justify-center disabled:opacity-40">
          <FileText size={17} /> PDF
        </button>
      </div>
    </Card>
  )
}
