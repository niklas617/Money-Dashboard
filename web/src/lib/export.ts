// Export-Helfer ohne externe Abhaengigkeiten.
// CSV: Semikolon-getrennt + UTF-8-BOM (Excel/Sheets-freundlich, deutsche Komma-Dezimalzahlen bleiben intakt).
// PDF: formatiertes Druck-Fenster -> der Browser speichert es als PDF.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCsv(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(';'))
  const csv = '﻿' + lines.join('\r\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Oeffnet ein sauber formatiertes Druck-Fenster (Nutzer speichert als PDF). */
export function printPDF(opts: { title: string; subtitle?: string; headers: string[]; rows: string[][] }): boolean {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return false // Popup blockiert

  const thead = `<tr>${opts.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`
  const tbody = opts.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')

  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })

  w.document.write(`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 32px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 3px solid #23B584; padding-bottom: 12px; margin-bottom: 4px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: -0.02em; }
  .brand { font-size: 12px; font-weight: 700; color: #23B584; letter-spacing: 2px; }
  .sub { color: #666; font-size: 12px; margin: 8px 0 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f3f5f4; color: #333; font-weight: 700; padding: 8px 10px; border-bottom: 2px solid #e2e6e4; }
  td { padding: 7px 10px; border-bottom: 1px solid #eef1f0; }
  tr:nth-child(even) td { background: #fafbfb; }
  .foot { margin-top: 22px; color: #999; font-size: 10.5px; text-align: right; }
  @media print { body { margin: 12mm; } .foot { position: fixed; bottom: 8mm; right: 12mm; } }
</style></head>
<body onload="setTimeout(function(){window.print();}, 250)">
  <div class="head"><h1>${escapeHtml(opts.title)}</h1><span class="brand">FINANZ&nbsp;DASHBOARD</span></div>
  ${opts.subtitle ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>` : '<div class="sub"></div>'}
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  <div class="foot">Erstellt am ${escapeHtml(date)}</div>
</body></html>`)
  w.document.close()
  return true
}
