import sys
import os
import streamlit.components.v1 as components

sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st
import requests
import pandas as pd
import plotly.express as px
import portfolio_tab
from datetime import date
from datetime import datetime

# --- KONFIGURATION ---
try:
    API_URL = st.secrets["API_URL"]
except Exception:
    API_URL = os.getenv("API_URL", "https://money-dashboard-8blm.onrender.com")

# --- PAGE SETUP ---
st.set_page_config(
    page_title="Finanz-Dashboard",
    page_icon="💰",
    layout="wide",
)

# NEU: Token aus der URL auslesen (falls wir gerade von Google zurückkommen)
if "token" in st.query_params:
    st.session_state.token = st.query_params["token"]
    st.session_state.user = st.query_params.get("user", "Google User")
    # URL wieder aufräumen, damit der ewig lange Token verschwindet
    st.query_params.clear() 

if "token" not in st.session_state:
    st.session_state.token = None
if "user" not in st.session_state:
    st.session_state.user = None


# ==========================================
# API HELPER
# ==========================================


def api_request(method, endpoint, **kwargs):
    headers = kwargs.pop("headers", {})
    if st.session_state.token:
        headers["Authorization"] = f"Bearer {st.session_state.token}"
    url = f"{API_URL}/{endpoint}"
    try:
        response = getattr(requests, method.lower())(url, headers=headers, **kwargs)
        if response.status_code == 401:
            st.session_state.token = None
            st.rerun()
        return response
    except Exception as e:
        st.error(f"Verbindungsfehler: {e}")
        return None


# ==========================================
# LOGIN
# ==========================================

def login_page():
    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        st.title("🔐 Login")

           # --- DEIN ALTER CODE (Bleibt erhalten) ---
        tab1, tab2 = st.tabs(["Anmelden", "Registrieren"])
        with tab1:
            u = st.text_input("Benutzername")
            p = st.text_input("Passwort", type="password")
            if st.button("Login", use_container_width=True):
                res = requests.post(f"{API_URL}/auth/token", data={"username": u, "password": p})
                if res.status_code == 200:
                    st.session_state.token = res.json()["access_token"]
                    st.session_state.user = u
                    st.rerun()
                else:
                    st.error("Falscher Benutzername oder Passwort")
        with tab2:
            nu = st.text_input("Neuer Benutzername")
            np = st.text_input("Neues Passwort", type="password")
            if st.button("Registrieren", use_container_width=True):
                res = requests.post(
                    f"{API_URL}/auth/register",
                    json={"username": nu, "password": np},
                )
                if res.status_code == 200:
                    st.success("Konto erstellt! Standard-Kategorien wurden angelegt.")
                else:
                    st.error(f"Fehler: {res.text}")

                    st.divider()
        

     
        
        # 1. HIER DEINE WEB-CLIENT-ID EINTRAGEN
        GOOGLE_WEB_CLIENT_ID = "8469072467-3bjur2tltvse1op2sslj5s0unpl0gmi4.apps.googleusercontent.com"
        
        # 2. Das ist der Endpunkt in deinem FastAPI Backend, der den Token empfängt
# dashboard.py
        REDIRECT_URI = "https://money-dashboard-8blm.onrender.com/auth/google/web"                     # 3. Wir bauen den offiziellen Google-Login-Link zusammen
        google_auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={GOOGLE_WEB_CLIENT_ID}&"
            f"redirect_uri={REDIRECT_URI}&"
            f"response_type=id_token&"
            f"scope=email%20profile&"
            f"nonce=zentara123&"
            f"response_mode=form_post"
        )

        st.link_button("🚀 Mit Google anmelden", google_auth_url, use_container_width=True)
        # ----------------------------------------

        
       

     


# ==========================================
# SIDEBAR NAVIGATION
# ==========================================


def render_sidebar(accounts: list) -> tuple:
    """Gibt (page, selected_acc_id) zurück."""
    with st.sidebar:
        st.markdown(f"### 👋 {st.session_state.user}")
        st.divider()

        page = st.radio(
            "Bereich",
            ["🏦 Konten", "📈 Portfolio"],
            label_visibility="collapsed",
        )

        st.divider()

        selected_acc_id = None
        if page == "🏦 Konten" and accounts:
            acc_map = {a["name"]: a["id"] for a in accounts}
            selected_acc_name = st.selectbox("Aktives Konto", list(acc_map.keys()))
            selected_acc_id = acc_map[selected_acc_name]

        st.divider()
        if st.button("🔓 Logout", use_container_width=True):
            st.session_state.token = None
            st.rerun()

    return page, selected_acc_id


# ==========================================
# KONTEN-BEREICH
# ==========================================


def render_konten(accounts: list, selected_acc_id):
    res_cat = api_request("GET", "categories/")
    categories = res_cat.json() if res_cat and res_cat.status_code == 200 else []

    if not accounts:
        st.warning("👋 Willkommen! Lege zuerst ein Konto an.")
        with st.expander("🏦 Erstes Konto erstellen", expanded=True):
            n_acc = st.text_input("Kontoname (z.B. Volksbank Girokonto)")
            curr = st.selectbox("Währung", ["EUR", "USD"])
            if st.button("Los geht's!"):
                api_request("POST", "accounts/", json={"name": n_acc, "currency": curr})
                st.rerun()
        return

    current_year = date.today().year
    res_tx = api_request(
        "GET", f"transactions/filter?account_id={selected_acc_id}&year={current_year}"
    )
    transactions = res_tx.json() if res_tx and res_tx.status_code == 200 else []

    df = pd.DataFrame()
    if transactions:
        df = pd.DataFrame(transactions)
        df["amount"] = pd.to_numeric(df["amount"])
    
    # --- HIER IST DEIN NEUER CODE ---
        df["full_datetime"] = pd.to_datetime(df["date"], errors="coerce")
        df["full_datetime"] = df["full_datetime"].fillna(pd.Timestamp.today())
    
    # Das Datum für die Anzeige formatieren (nutzt jetzt das reparierte full_datetime)
        df["date"] = df["full_datetime"].dt.strftime("%d.%m.%Y")
    
        cat_map_rev = {c["id"]: c["name"] for c in categories}
        df["Kategorie"] = df["category_id"].map(cat_map_rev).fillna("Unbekannt")

        tab_overview, tab_bookings, tab_settings = st.tabs(
        ["📊 Übersicht & Charts", "📝 Buchungen", "⚙️ Einstellungen"]
)

# ------------------------------------------
# TAB 1: ÜBERSICHT
# ------------------------------------------
    with tab_overview:
    # --- HIER SIND 8 LEERZEICHEN VORNE ---
        acc_name = next((a["name"] for a in accounts if a["id"] == selected_acc_id), "")
        st.header(f"📊 Übersicht: {acc_name}")

        if df.empty:
            st.info("Noch keine Buchungen für dieses Jahr vorhanden.")
        else:
        # --- HIER SIND 12 LEERZEICHEN VORNE ---
        
        # --- 1. FILTER-DROPDOWN ---
            heute = datetime.now()
            monate = [
            "Januar", "Februar", "März", "April", "Mai", "Juni", 
            "Juli", "August", "September", "Oktober", "November", "Dezember"
        ]
        
        # Dropdown für den Monat anzeigen (Standard ist der aktuelle Monat)
        gewaehlter_monat_name = st.selectbox(
            "Monat auswerten:", 
            monate, 
            index=heute.month - 1
        )
        # Den Namen wieder in eine Zahl für Pandas verwandeln (Januar = 1)
        gewaehlter_monat_zahl = monate.index(gewaehlter_monat_name) + 1

        # --- 2. BERECHNUNG MIT PANDAS ---
        # A) Gesamtsaldo (Alle Buchungen des Jahres)
        gesamt_income = df[df["amount"] > 0]["amount"].sum()
        gesamt_expenses = df[df["amount"] < 0]["amount"].sum()
        aktuelles_saldo = gesamt_income + gesamt_expenses

        # B) Monatssaldo (Gefiltert auf den gewählten Monat)
        df_monat = df[df["full_datetime"].dt.month == gewaehlter_monat_zahl]
        
        einnahmen_monat = df_monat[df_monat["amount"] > 0]["amount"].sum()
        ausgaben_monat = df_monat[df_monat["amount"] < 0]["amount"].sum()

        # --- 3. KENNZAHLEN ANZEIGEN ---
        kpi1, kpi2, kpi3 = st.columns(3)
        kpi1.metric("Gesamt-Kontostand", f"{aktuelles_saldo:,.2f} €")
        kpi2.metric(f"Einnahmen ({gewaehlter_monat_name})", f"+{einnahmen_monat:,.2f} €")
        kpi3.metric(f"Ausgaben ({gewaehlter_monat_name})", f"{ausgaben_monat:,.2f} €", delta_color="inverse")

        st.divider()

       # --- 4. DIAGRAMME (Synchronisiert mit Monat) ---

      # --- BALKENDIAGRAMM ---
        df_bar = pd.DataFrame(
            {
                "Typ": ["Einnahmen", "Ausgaben"],
                # NEU: Wir nutzen jetzt die gefilterten Monats-Werte!
                "Betrag": [einnahmen_monat, abs(ausgaben_monat)], 
            }
        )
        fig_bar = px.bar(
            df_bar,
            x="Typ",
            y="Betrag",
            color="Typ",
            color_discrete_map={"Einnahmen": "#2ecc71", "Ausgaben": "#e74c3c"},
            title=f"Einnahmen vs. Ausgaben im {gewaehlter_monat_name}",
        )
        fig_bar.update_layout(bargap=0.6, showlegend=False)
        st.plotly_chart(fig_bar, width="stretch")

        c_pie1, c_pie2 = st.columns(2)

        # --- 5. TORTENDIAGRAMME Einnahmen ---

        with c_pie1:
            st.subheader(f"Einnahmen nach Kategorie")
            # Nutzt jetzt df_monat statt df
            df_inc = df_monat[df_monat["amount"] > 0]
            if not df_inc.empty:
                fig_inc = px.pie(
                    df_inc,
                    values="amount",
                    names="Kategorie",
                    hole=0.4,
                    labels={"amount": "Einnahmen"},
                )
                st.plotly_chart(fig_inc, width="stretch")
            else:
                st.info(f"Keine Einnahmen im {gewaehlter_monat_name}.")

        # --- 6. TORTENDIAGRAMME Ausgaben ---

        with c_pie2:
            st.subheader(f"Ausgaben nach Kategorie")
            # Nutzt jetzt df_monat statt df
            df_exp = df_monat[df_monat["amount"] < 0].copy()
            df_exp["Ausgaben"] = df_exp["amount"].abs()
            if not df_exp.empty:
                fig_exp = px.pie(
                    df_exp, values="Ausgaben", names="Kategorie", hole=0.4
                )
                st.plotly_chart(fig_exp, width="stretch")
            else:
                st.info(f"Keine Ausgaben im {gewaehlter_monat_name}.")

            st.divider()

        # --- 7. KONTOVERLAUF (LINE CHART) ---

            st.subheader("Verlauf des Kontostands")
            df_line = df.copy()
            df_line["sort_date"] = pd.to_datetime(df_line["date"], format="%d.%m.%Y")
            df_daily = (
                df_line.groupby(["sort_date", "date"])["amount"].sum().reset_index()
            )
            df_daily = df_daily.sort_values("sort_date")
            df_daily["Kontostand"] = df_daily["amount"].cumsum()

        # ... (dein restlicher Code vorher: df_daily berechnung) ...
            
            fig_line = px.line(
                df_daily,
                x="date",
                y="Kontostand",
                markers=True,
                title="Entwicklung über Zeit",
                labels={"date": "Datum", "Kontostand": "Saldo (€)"},
            )

            fig_line.update_traces(
                mode="lines+markers",
                line=dict(color="#2ecc71", width=3), 
                marker=dict(size=8),
                fill="tozeroy" 
            )
            
            fig_line.update_layout(
                paper_bgcolor="rgba(0,0,0,0)", # Transparenter Hintergrund
                plot_bgcolor="rgba(0,0,0,0)",  # Transparenter Chart-Bereich
                hovermode="x unified",         # Zeigt alle Infos beim Drüberfahren an
                xaxis=dict(showgrid=False),    # Gitterlinien aus für cleanen Look
                yaxis=dict(showgrid=True, gridcolor="#eee")
            )
            
            st.plotly_chart(fig_line, use_container_width=True)

    # ------------------------------------------
    # TAB 2: BUCHUNGEN
    # ------------------------------------------
    with tab_bookings:
        # --- NEU: KI SCANNER ---
        with st.expander("🤖 Kontoauszug scannen (KI)", expanded=False):
            st.info("Lade einen Screenshot oder ein Foto hoch. Gemini liest die Buchungen aus und trägt sie automatisch ein!")
            uploaded_file = st.file_uploader("Bild auswählen", type=["png", "jpg", "jpeg"])
            
            if uploaded_file is not None:
                if st.button("Jetzt analysieren & eintragen", type="primary", use_container_width=True):
                    with st.spinner("Gemini studiert deinen Kontoauszug... 🔍"):
                        
                        # Wir schicken das Bild ans Backend (Das bauen wir im nächsten Schritt!)
                        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                        headers = {"Authorization": f"Bearer {st.session_state.token}"}
                        
                        try:
                            # HINWEIS: Dieser Endpunkt existiert noch nicht im Backend, das machen wir gleich!
                            res = requests.post(
                                f"{API_URL}/transactions/scan", 
                                headers=headers, 
                                files=files, 
                                data={"account_id": selected_acc_id}
                                )
                            
                            if res.status_code == 200:
                                result = res.json()
                                st.success(f"Erfolg! {result.get('count', 0)} Buchungen wurden gefunden und gespeichert.")
                                st.rerun()
                            else:
                                st.error(f"Fehler vom Backend: {res.text}")
                        except Exception as e:
                            st.error(f"Fehler beim Senden: {e}")
                            
         # --- ALTE MANUELLE EINGABE (Bleibt bestehen) ---                   
        with st.expander("➕ Neue Buchung", expanded=True):
            if not categories:
                st.error("Keine Kategorien vorhanden. Bitte erst Kategorien anlegen.")
            else:
                with st.form("booking_form", clear_on_submit=True):
                    c1, c2 = st.columns(2)
                    with c1:
                        amt = st.number_input(
                            "Betrag (€)",
                            value=None,
                            placeholder="0,00",
                            step=0.01,
                            format="%.2f",
                        )
                        typ = st.radio("Art", ["Ausgabe", "Einnahme"], horizontal=True)
                    with c2:
                        cat_map = {c["name"]: c["id"] for c in categories}
                        sel_cat = st.selectbox(
                            "Kategorie",
                            list(cat_map.keys()),
                            index=None,
                            placeholder="Wähle eine Kategorie",
                        )
                        note = st.text_input("Notiz", placeholder="Z.B. Einkauf Rewe")

                    if st.form_submit_button("💾 Buchung speichern", type="primary"):
                        if amt is None or sel_cat is None:
                            st.error("Bitte Betrag und Kategorie angeben!")
                        else:
                            val = -amt if typ == "Ausgabe" else amt
                            res = api_request(
                                "POST",
                                "transactions/",
                                json={
                                    "amount": val,
                                    "note": note,
                                    "account_id": selected_acc_id,
                                    "category_id": cat_map[sel_cat],
                                    "date": date.today().isoformat(),
                                },
                            )
                            if res and res.status_code in (200, 201):
                                st.success("Gespeichert!")
                                st.rerun()

        st.subheader("📅 Buchungen durchsuchen")
        col_y, col_m = st.columns(2)
        year = col_y.number_input("Jahr", value=current_year, step=1)
        month = col_m.selectbox("Monat", [None] + list(range(1, 13)))

        params = {"account_id": selected_acc_id, "year": int(year)}
        if month:
            params["month"] = int(month)

        flt = api_request("GET", "transactions/filter", params=params)
        filtered_txs = flt.json() if flt and flt.ok else []


        # --- Buchungen bearbeiten ---
    edit_id = st.session_state.get("edit_tx_id")

    
    if edit_id:
        st.divider()
        st.subheader("📝 Buchung bearbeiten")
        
        # Hier nutzen wir jetzt unsere sichere Variable "edit_id"
        tx_to_edit = next(
            (t for t in filtered_txs if t["id"] == edit_id),
            None,
        )
        
        if tx_to_edit:
            try:
                altes_datum = datetime.fromisoformat(tx_to_edit["date"].replace("Z", "+00:00")).date()
            except Exception:
                altes_datum = date.today()

            with st.form("edit_form"):
                new_amt = st.number_input(
                    "Betrag", value=float(abs(tx_to_edit["amount"]))
                )
                new_note = st.text_input("Notiz", value=tx_to_edit["note"])
                new_date = st.date_input("Datum", value=altes_datum)
                
                col_a, col_b = st.columns(2)
                if col_a.form_submit_button("Speichern"):
                    final_val = -new_amt if tx_to_edit["amount"] < 0 else new_amt
                    res = api_request(
                        "PUT",
                        f"transactions/{tx_to_edit['id']}",
                        json={
                            "amount": final_val,
                            "note": new_note,
                            "category_id": tx_to_edit["category_id"],
                            "account_id": tx_to_edit["account_id"],
                            "date": new_date.isoformat(),
                        },
                    )
                    if res and res.ok:
                        st.success("Aktualisiert!")
                        # NEU: Sicheres Löschen (stürzt nicht ab, wenn die ID schon weg ist)
                        st.session_state.pop("edit_tx_id", None)
                        st.rerun()
                        
                if col_b.form_submit_button("Abbrechen"):
                    # NEU: Sicheres Löschen
                    st.session_state.pop("edit_tx_id", None)
                    st.rerun()
        st.divider()

    with st.expander("📋 Alle Buchungen anzeigen", expanded=True):
        if filtered_txs:
            filtered_txs.sort(key=lambda x: x.get("id", 0), reverse=True)
            st.write("---")
            h1, h2, h3, h4, h5, h6 = st.columns([2, 2, 3, 2, 1, 1])
            h1.markdown("**Datum**")
            h2.markdown("**Kategorie**")
            h3.markdown("**Notiz**")
            h4.markdown("**Betrag**")
            st.write("---")
            
            cat_lookup = {c["id"]: c["name"] for c in categories}
            
            for tx in filtered_txs:
              # 1. Datum umwandeln
                raw_date = tx.get("date", "")
                try:
                    # Wandelt '2026-07-19' zu '19.07.2026' um
                    formatted_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).strftime("%d.%m.%Y")
                except:
                    formatted_date = raw_date[:10] # Fallback falls das Format mal nicht passt
                
                c1, c2, c3, c4, c5, c6 = st.columns([2, 2, 3, 2, 1, 1])
                
                # 2. Das formatierte Datum hier ausgeben
                c1.write(formatted_date) 
                
                c2.write(cat_lookup.get(tx.get("category_id"), "Unbekannt"))
                c3.write(tx.get("note", ""))
                
                amt_val = tx.get("amount", 0)
                clr = "red" if amt_val < 0 else "green"
                c4.markdown(
                    f"{amt_val:.2f} €",
                    unsafe_allow_html=True,
                )
                
                if c5.button("✏️", key=f"edit_{tx['id']}"):
                    st.session_state.edit_tx_id = tx["id"]
                    st.rerun()
                if c6.button("🗑️", key=f"del_{tx['id']}"):
                    res = api_request("DELETE", f"transactions/{tx['id']}")
                    if res and res.status_code == 200:
                        st.rerun()
        else:
            st.info("Keine Buchungen gefunden.")

    # ------------------------------------------
    # TAB 3: EINSTELLUNGEN
    # ------------------------------------------
    with tab_settings:
        c1, c2 = st.columns(2)
        with c1:
            st.subheader("🏦 Neues Konto anlegen")
            n_acc = st.text_input("Kontoname", key="n_acc")
            curr = st.selectbox("Währung", ["EUR", "USD"], key="curr")
            if st.button("Konto anlegen"):
                api_request("POST", "accounts/", json={"name": n_acc, "currency": curr})
                st.rerun()
            st.divider()
            st.subheader("🗂️ Vorhandene Konten")
            for a in accounts:
                st.write(f"• {a['name']} ({a['currency']})")
        with c2:
            st.subheader("🏷️ Neue Kategorie")
            n_cat = st.text_input("Kategoriename", key="n_cat")
            if st.button("Kategorie anlegen"):
                api_request("POST", "categories/", json={"name": n_cat})
                st.rerun()
            st.divider()
            if st.button("🔄 Standard-Kategorien laden"):
                for d in [
                    "Lebensmittel",
                    "Miete",
                    "Gehalt",
                    "Freizeit",
                    "Transport",
                    "Sparen",
                ]:
                    api_request("POST", "categories/", json={"name": d})
                st.rerun()

                # ------------------------------------------
    # TAB 3: EINSTELLUNGEN
    # ------------------------------------------
    with tab_settings:
        c1, c2 = st.columns(2)
        # ... [Dein bisheriger Code für Konten und Kategorien anlegen] ...
        
        # --- NEU: KONTO LÖSCHEN (GEFAHRENZONE) ---
        st.divider()
        st.subheader("Kontoeinstellungen & Konto löschen")

        # --- PROFIL BEARBEITEN ---
        # --- Nutzername ändern ---
        st.subheader("👤 Profil")
        with st.expander("Benutzernamen ändern"):
            new_name = st.text_input("Neuer Benutzername", value=st.session_state.user)
            
            if st.button("💾 Namen speichern"):
                if new_name == st.session_state.user:
                    st.warning("Das ist bereits dein aktueller Name.")
                elif len(new_name) < 3:
                    st.error("Der Name muss mindestens 3 Zeichen lang sein.")
                else:
                    # Request an das Backend senden
                    res = api_request("PUT", "auth/update-username", json={"new_username": new_name})
                    
                    if res and res.status_code == 200:
                        data = res.json()
                        # Den neuen Namen und den frischen Token direkt im Session State speichern
                        st.session_state.user = data["new_username"]
                        st.session_state.token = data["new_token"]
                        
                        st.success("Dein Name wurde erfolgreich geändert!")
                        st.rerun()
                    elif res and res.status_code == 400:
                        # Zeigt die Fehlermeldung vom Backend an (z. B. "Name vergeben")
                        st.error(res.json().get("detail", "Fehler beim Speichern."))

        # --- PASSWORT BEARBEITEN MANUELLER LOGIN ---
        with st.expander("Passwort festlegen / ändern"):
            st.info("Wenn du dich mit Google angemeldet hast, kannst du hier ein Passwort festlegen, um dich in Zukunft auch manuell einloggen zu können.")
            
            new_pwd = st.text_input("Neues Passwort", type="password")
            new_pwd_confirm = st.text_input("Passwort bestätigen", type="password")
            
            if st.button("🔐 Passwort speichern"):
                if len(new_pwd) < 6:
                    st.error("Das Passwort muss mindestens 6 Zeichen lang sein.")
                elif new_pwd != new_pwd_confirm:
                    st.error("Die Passwörter stimmen nicht überein.")
                else:
                    # Request an das Backend senden
                    res = api_request("PUT", "auth/set-password", json={"new_password": new_pwd})
                    
                    if res and res.status_code == 200:
                        st.success("Dein Passwort wurde erfolgreich gespeichert! Du kannst dich beim nächsten Mal manuell damit einloggen.")
                    else:
                        st.error("Fehler beim Speichern des Passworts.")

        # --- KONTO LÖSCHEN ---
        with st.expander("Konto endgültig löschen"):
            st.warning(
                "Achtung: Diese Aktion kann nicht rückgängig gemacht werden. "
                "Alle deine Konten, Kategorien, Buchungen, Trades und dein Profil "
                "werden sofort und unwiderruflich gelöscht."
            )
            
            # Doppelte Absicherung
            confirm_delete = st.checkbox("Ich bin mir sicher und möchte mein Konto unwiderruflich löschen.")
            
            if confirm_delete:
                if st.button("🚨 Konto jetzt löschen", type="primary", use_container_width=True):
                    # API Request an unsere neue Backend-Route
                    res = api_request("DELETE", "auth/delete-account")
                    
                    if res and res.status_code == 200:
                        # Lokale Sitzung sofort beenden
                        st.session_state.token = None
                        st.session_state.user = None
                        st.success("Dein Konto wurde erfolgreich gelöscht. Du wirst abgemeldet.")
                        st.rerun()
                    else:
                        st.error("Fehler beim Löschen des Kontos. Bitte versuche es später erneut.")


# ==========================================
# APP START
# ==========================================

if st.session_state.token:
    res_acc = api_request("GET", "accounts/")
    accounts = res_acc.json() if res_acc and res_acc.status_code == 200 else []

    page, selected_acc_id = render_sidebar(accounts)

    if page == "🏦 Konten":
        render_konten(accounts, selected_acc_id)
    else:
        portfolio_tab.render(api_request, API_URL)
else:
    login_page()
