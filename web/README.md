# Finanz-Dashboard · Web-Frontend

Modernes Web-Frontend (React + Vite + TypeScript + Tailwind) im „Zentara"-Design
(tiefes Schwarz + Mint) – der Nachfolger des Streamlit-Dashboards.
Spricht mit demselben FastAPI-Backend wie die Flutter-App.

## Entwicklung starten

```bash
cd web
npm install      # einmalig
npm run dev      # startet auf http://localhost:5173
```

Im Dev laufen alle API-Aufrufe über den **Vite-Proxy** unter `/api` → dieser
leitet serverseitig an das gehostete Render-Backend weiter. Dadurch gibt es
**kein CORS-Problem** während der Entwicklung – unabhängig davon, ob das
Backend-Deployment schon CORS aktiv hat.

Backend-Ziel des Proxys: `vite.config.ts` → Konstante `BACKEND`.

## Production-Build

```bash
npm run build    # erzeugt dist/
npm run preview  # dist/ lokal testen
```

Für den Prod-Build muss die Backend-URL gesetzt werden, weil dann **kein**
Proxy mehr existiert und der Browser direkt mit dem Backend spricht:

```
# web/.env
VITE_API_URL=https://money-dashboard-8blm.onrender.com
```

> **Wichtig für Production:** Sobald das Frontend im Browser direkt (cross-origin)
> mit dem Backend spricht, muss das Backend **CORS** senden. Die dafür nötige
> `CORSMiddleware` wurde in `backend/app/main.py` ergänzt – das Backend muss
> also einmal **neu deployed** werden, damit der Prod-Build funktioniert.
> Ebenso sind die neuen Endpoints `DELETE /accounts/{id}` und
> `DELETE /categories/{id}` erst nach einem Deploy verfügbar.

Hosting-Tipp: Als Single-Page-App braucht der Host ein SPA-Fallback
(alle Routen → `index.html`). Auf Netlify/Vercel/Cloudflare Pages ist das Standard.

## Struktur

```
src/
  lib/        api.ts (API-Client), auth.tsx (Login-Status), format.ts (EUR/Datum)
  components/ Design-System: Card, Charts (AreaChart, Donut), Modal, Toast, AppShell …
  pages/      Login, Overview (Übersicht), Portfolio, Accounts (Konten), Settings
```
