# Deploy-Anleitung — Finanz-Dashboard

Backend (FastAPI) auf **Render** · Frontend (React/Vite) auf **Firebase Hosting** unter
`dashboard.zentara-solutions.de`.

> **Reihenfolge wichtig:** erst Backend deployen (damit die neuen Endpoints/Tabellen existieren),
> dann Google-Origins eintragen, dann Frontend. Sonst laufen Login & neue Features ins Leere.

---

## 0 · Änderungen committen & pushen

Alle Backend- und Frontend-Änderungen liegen aktuell nur lokal. Zuerst sichern:

```bash
cd C:/Users/ns051/Desktop/Programmieren/dashboard
git add -A
git commit -m "Web-Frontend + Backend: Saldo-Fix, coin_id, Budgets, Alerts, Google-Login, CORS"
git push
```

- [ ] Änderungen committet
- [ ] gepusht (falls Render Auto-Deploy vom Repo nutzt, startet damit schon der Backend-Deploy)

---

## A · Backend auf Render

Das Backend startet mit `uvicorn backend.app.main:app`. Beim Start legt `init_db()` **automatisch**
die neuen Tabellen (`budget`, `pricealert`) an und rüstet die Spalten `coin_id` und `opening_balance`
nach — additiv, keine Datenverluste. **Keine neuen Python-Pakete** nötig (requirements bleibt gleich).

1. Render-Dashboard → dein Service (`money-dashboard-8blm`).
2. Deploy auslösen:
   - Auto-Deploy an? → der `git push` aus Schritt 0 hat ihn schon gestartet.
   - Sonst: **Manual Deploy → Deploy latest commit**.
3. Environment-Variablen prüfen (Settings → Environment):
   - `DATABASE_URL` — Neon-Postgres (muss gesetzt sein)
   - `SECRET_KEY` — für JWT (fester Wert empfohlen; ändern loggt alle aus)
   - `GEMINI_API_KEY` — **nötig für den KI-Kontoauszug-Scan** (sonst 500)
4. Deploy-Logs beobachten bis „Live".

Checks:
- [ ] Deploy „Live"
- [ ] `https://money-dashboard-8blm.onrender.com/health` → `{"status":"ok","db":"connected"}`
- [ ] `https://money-dashboard-8blm.onrender.com/docs` zeigt die neuen Routen (`/budgets`, `/alerts`, `/accounts` PUT, `/auth/google/token`)

---

## B · Google-Login freischalten (Google Cloud Console)

Der Web-Login nutzt Google Identity Services mit der bestehenden OAuth-Client-ID
`8469072467-…`. Die Origins müssen eingetragen sein, sonst rendert der Button nicht.

1. [console.cloud.google.com](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. OAuth-2.0-Client-ID `8469072467-…` öffnen.
3. Unter **Authorized JavaScript origins** hinzufügen:
   - `https://dashboard.zentara-solutions.de`
   - `https://money-app-3ae83.web.app`  *(zum Testen, bevor die Subdomain aktiv ist)*
4. Speichern (Wirkung nach ein paar Minuten).

- [ ] Beide Origins eingetragen & gespeichert

---

## C · Frontend auf Firebase Hosting

Config liegt schon bereit: `web/firebase.json` (SPA-Rewrite), `web/.firebaserc`
(Projekt `money-app-3ae83`), `web/.env.production` (`VITE_API_URL` → Render).

Einmalig — Firebase CLI installieren & einloggen:

```bash
npm install -g firebase-tools
firebase login
```

Bauen & deployen (aus dem `web/`-Ordner, da liegt die `firebase.json`):

```bash
cd C:/Users/ns051/Desktop/Programmieren/dashboard/web
npm install
npm run build
firebase deploy --only hosting
```

- [ ] `firebase login` erfolgreich
- [ ] `npm run build` ohne Fehler (erzeugt `web/dist`)
- [ ] `firebase deploy` erfolgreich → App live unter `https://money-app-3ae83.web.app`
- [ ] Test-Login unter der web.app-URL funktioniert (inkl. Google-Button)

---

## D · Subdomain `dashboard.zentara-solutions.de`

1. Firebase-Console → **Hosting** → **Add custom domain**.
2. `dashboard.zentara-solutions.de` eingeben.
3. Firebase zeigt DNS-Einträge (i. d. R. zwei **A-Records** + evtl. ein TXT zur Verifizierung).
4. Bei deinem Domain-/DNS-Anbieter für den Host `dashboard` diese Einträge setzen.
5. Warten, bis Firebase „Connected" zeigt und das SSL-Zertifikat ausgestellt ist (Minuten bis ~24 h).

- [ ] Custom Domain in Firebase hinzugefügt
- [ ] DNS-Records beim Anbieter gesetzt
- [ ] Firebase zeigt „Connected" + HTTPS aktiv
- [ ] `https://dashboard.zentara-solutions.de` lädt die App

---

## E · Verifizieren (End-to-End)

- [ ] Login mit Passwort **und** Google
- [ ] Übersicht zeigt korrektes Gesamtvermögen (inkl. Anfangssaldo)
- [ ] Konten → „Abgleichen" setzt den Kontostand (kein 404 mehr)
- [ ] Portfolio → Krypto-Trade anlegen; Kurs erscheint korrekt im Portfolio (nicht 0 €)
- [ ] Budgets: Limit setzen → erscheint bei „Aktive Budgets"
- [ ] Kurs-Alerts: Alert anlegen/löschen
- [ ] Export: CSV lädt, PDF öffnet das Druck-Fenster
- [ ] KI-Scan: Foto hochladen → Buchungen werden eingetragen (setzt `GEMINI_API_KEY` voraus)

---

## Danach (optional)

- Portfolio-Link auf der Agentur-Seite `zentara-solutions.de` von der alten Streamlit-URL auf
  `https://dashboard.zentara-solutions.de` umstellen.
- Die alte Streamlit-App (`frontend/`) kann still auslaufen — bleibt als Fallback im Repo.

## Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| Google-Button erscheint nicht | Origin fehlt in der OAuth-Client-ID (Teil B) oder DNS noch nicht aktiv |
| Login/Requests scheitern mit CORS-Fehler | Backend nicht neu deployed (CORS-Middleware fehlt noch live) |
| „Abgleichen" / Budgets / Alerts → 404 | Backend nicht neu deployed (neue Endpoints/Tabellen fehlen) |
| Krypto zeigt 0 € im Portfolio | Trade **vor** dem Update angelegt (ohne `coin_id`) → neu anlegen, oder Alt-Coin nicht in der Map |
| KI-Scan → 500 | `GEMINI_API_KEY` auf Render nicht gesetzt |
| `…/konten` beim Neuladen 404 | SPA-Rewrite fehlt — `web/firebase.json` muss deployt sein |
