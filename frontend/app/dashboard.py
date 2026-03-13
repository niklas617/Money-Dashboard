import streamlit as st
import requests
import pandas as pd
import plotly.express as px  # WICHTIG: Für die Diagramme!
import os
from datetime import date

# --- KONFIGURATION ---
try:
    API_URL = st.secrets["API_URL"]
except:
    API_URL = os.getenv("API_URL", "http://localhost:8000")

# --- PAGE SETUP ---
st.set_page_config(page_title="Finanz-Dashboard", layout="wide")

if "token" not in st.session_state:
    st.session_state.token = None
if "user" not in st.session_state:
    st.session_state.user = None


# --- API HELPERS ---
def api_request(method, endpoint, **kwargs):
    headers = kwargs.get("headers", {})
    if st.session_state.token:
        headers["Authorization"] = f"Bearer {st.session_state.token}"

    url = f"{API_URL}/{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, **kwargs)
        elif method == "POST":
            response = requests.post(url, headers=headers, **kwargs)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, **kwargs)
        elif method == "PUT":  # Ergänzt für die Edit-Logik
            response = requests.put(url, headers=headers, **kwargs)

        if response.status_code == 401:
            st.session_state.token = None
            st.rerun()
        return response
    except Exception as e:
        st.error(f"Verbindungsfehler: {e}")
        return None


def reset_booking_form():
    # Wir löschen die Keys direkt im Session State
    if "amt_key" in st.session_state:
        del st.session_state["amt_key"]
    if "cat_key" in st.session_state:
        del st.session_state["cat_key"]
    if "note_key" in st.session_state:
        del st.session_state["note_key"]
    # Das Radio-Button-Feld setzen wir auf den Standard zurück
    st.session_state["typ_key"] = "Ausgabe"


# --- LOGIN ---
def login_page():
    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        st.title("🔐 Login")
        tab1, tab2 = st.tabs(["Anmelden", "Registrieren"])
        with tab1:
            u = st.text_input("User")
            p = st.text_input("Passwort", type="password")
            if st.button("Login", width="stretch"):
                res = requests.post(
                    f"{API_URL}/auth/token", data={"username": u, "password": p}
                )
                if res.status_code == 200:
                    st.session_state.token = res.json()["access_token"]
                    st.session_state.user = u
                    st.rerun()
                else:
                    st.error("Fehler beim Login")
        with tab2:
            nu = st.text_input("Neuer User")
            np = st.text_input("Neues Passwort", type="password")
            if st.button("Registrieren", width="stretch"):
                res = requests.post(
                    f"{API_URL}/auth/register",
                    json={"username": nu, "password": np},
                )
                if res.status_code == 200:
                    st.success("Erstellt! Standard-Kategorien wurden angelegt.")
                else:
                    st.error(f"Fehler: {res.text}")


# --- DASHBOARD ---
def main_dashboard():
    # Sidebar
    st.sidebar.title(f"👋 Hallo, {st.session_state.user}")

    # Daten laden
    res_acc = api_request("GET", "accounts/")
    accounts = res_acc.json() if res_acc and res_acc.status_code == 200 else []

    res_cat = api_request("GET", "categories/")
    categories = res_cat.json() if res_cat and res_cat.status_code == 200 else []

    # LOGIK: Sperre wenn keine Konten
    if not accounts:
        st.warning("👋 Willkommen! Um zu starten, lege bitte zuerst ein Konto an.")
        with st.expander("🏦 Erstes Konto erstellen", expanded=True):
            n_acc = st.text_input("Kontoname (z.B. Girokonto)")
            curr = st.selectbox("Währung", ["EUR", "USD"])
            if st.button("Los geht's!"):
                api_request("POST", "accounts/", json={"name": n_acc, "currency": curr})
                st.rerun()
        return

    # Konto-Auswahl in der Sidebar
    acc_map = {a["name"]: a["id"] for a in accounts}
    selected_acc_name = st.sidebar.selectbox("🏦 Aktuelles Konto", list(acc_map.keys()))
    selected_acc_id = acc_map[selected_acc_name]

    if st.sidebar.button("Logout"):
        st.session_state.token = None
        st.rerun()

    # --- DATEN FÜR DIAGRAMME LADEN ---
    current_year = date.today().year
    res_tx = api_request(
        "GET", f"transactions/filter?account_id={selected_acc_id}&year={current_year}"
    )
    transactions = res_tx.json() if res_tx and res_tx.status_code == 200 else []

    # DataFrame erstellen
    df = pd.DataFrame()
    if transactions:
        df = pd.DataFrame(transactions)
        df["amount"] = pd.to_numeric(df["amount"])
        df["full_datetime"] = pd.to_datetime(df["date"])
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%d.%m.%Y")
        cat_map_rev = {c["id"]: c["name"] for c in categories}

        if "category_id" in df.columns:
            df["Kategorie"] = df["category_id"].map(cat_map_rev).fillna("Unbekannt")
        else:
            df["Kategorie"] = "Unbekannt"

    # --- TABS FÜR STRUKTUR ---
    tab_overview, tab_bookings, tab_settings = st.tabs(
        ["📊 Übersicht & Charts", "📝 Buchungen", "⚙️ Einstellungen"]
    )

    # ==========================================
    # TAB 1: ÜBERSICHT
    # ==========================================
    with tab_overview:
        st.header(f"Finanzstatus: {selected_acc_name} ({current_year})")

        if df.empty:
            st.info("Noch keine Daten für Diagramme vorhanden.")
        else:
            # KPIs
            income = df[df["amount"] > 0]["amount"].sum()
            expenses = df[df["amount"] < 0]["amount"].sum()
            balance = income + expenses

            kpi1, kpi2, kpi3 = st.columns(3)
            kpi1.metric("Einnahmen", f"{income:.2f} €", delta_color="normal")
            kpi2.metric("Ausgaben", f"{expenses:.2f} €", delta_color="inverse")
            kpi3.metric("Saldo (Jahr)", f"{balance:.2f} €", delta=f"{balance:.2f} €")

            st.divider()

            # Balkendiagramm
            df_bar = pd.DataFrame(
                {"Typ": ["Einnahmen", "Ausgaben"], "Betrag": [income, abs(expenses)]}
            )
            fig_bar = px.bar(
                df_bar,
                x="Typ",
                y="Betrag",
                color="Typ",
                color_discrete_map={"Einnahmen": "#2ecc71", "Ausgaben": "#e74c3c"},
                title="Einnahmen vs. Ausgaben",
            )
            fig_bar.update_layout(bargap=0.6)
            st.plotly_chart(fig_bar, width="stretch")

         with c_pie1:
                st.subheader("Einnahmen 📈")
                df_inc = df[df["amount"] > 0]
                if not df_inc.empty:
                    fig_inc = px.pie(
                        df_inc, 
                        values="amount", 
                        names="Kategorie", 
                        hole=0.4,
                        labels={"amount": "Einnahmen"}  # <-- HIER ist der Trick!
                    )
                    st.plotly_chart(fig_inc, width="stretch")
                else:
                    st.info("Keine Einnahmen.")

            with c_pie2:
                st.subheader("Ausgaben 📉")
                df_exp = df[df["amount"] < 0].copy()
                df_exp["Ausgaben"] = df_exp["amount"].abs()
                if not df_exp.empty:
                    fig_exp = px.pie(df_exp, values="Ausgaben", names="Kategorie", hole=0.4)
                    st.plotly_chart(fig_exp, width="stretch")
                else:
                    st.info("Keine Ausgaben.")

            st.divider()
            st.subheader("Verlauf des Kontostands")
            if not df.empty:
                df_line = df.copy()
                df_line["sort_date"] = pd.to_datetime(df_line["date"], format="%d.%m.%Y")
                df_daily = df_line.groupby(["sort_date", "date"])["amount"].sum().reset_index()
                df_daily = df_daily.sort_values("sort_date")
                df_daily["Kontostand"] = df_daily["amount"].cumsum()

                fig_line = px.line(df_daily, x="date", y="Kontostand", markers=True, title="Entwicklung über Zeit")
                st.plotly_chart(fig_line, width="stretch")

    # ==========================================
    # TAB 2: BUCHUNGEN
    # ==========================================
    with tab_bookings:
        with st.expander("➕ Neue Buchung hinzufügen", expanded=True):
            if not categories:
                st.error("Keine Kategorien vorhanden!")
            else:
                with st.form("booking_form", clear_on_submit=True):
                    c1, c2 = st.columns(2)
                    with c1:
                        amt = st.number_input("Betrag (€)", value=None, placeholder="0,00", step=0.01, format="%.2f", key="amt_key")
                        typ = st.radio("Art", ["Ausgabe", "Einnahme"], horizontal=True, key="typ_key")
                    with c2:
                        cat_map = {c["name"]: c["id"] for c in categories}
                        sel_cat = st.selectbox("Kategorie", list(cat_map.keys()), index=None, placeholder="Wähle eine Kategorie", key="cat_key")
                        note = st.text_input("Notiz", placeholder="Z.B. Einkauf", key="note_key")
                    
                    if st.form_submit_button("Buchung speichern", type="primary"):
                        if amt is None or sel_cat is None:
                            st.error("Bitte Betrag und Kategorie angeben!")
                        else:
                            val = -amt if typ == "Ausgabe" else amt
                            data = {
                                "amount": val, "note": note, "account_id": selected_acc_id,
                                "category_id": cat_map[sel_cat], "date": date.today().isoformat(),
                            }
                            res = api_request("POST", "transactions/", json=data)
                            if res and res.status_code in [200, 201]:
                                st.success("Gespeichert!")
                                st.rerun()

        st.subheader("📅 Buchungen durchsuchen")
        col_y, col_m = st.columns(2)
        year = col_y.number_input("Jahr", value=2026, step=1)
        month = col_m.selectbox("Monat", [None] + list(range(1, 13)))

        params = {"account_id": selected_acc_id, "year": int(year)}
        if month: params["month"] = int(month)

        flt = api_request("GET", "transactions/filter", params=params)
        filtered_txs = flt.json() if flt and flt.ok else []

        # --- EDIT MODAL LOGIK ---
        if "edit_tx_id" in st.session_state and st.session_state.edit_tx_id:
            st.divider()
            st.subheader("📝 Buchung bearbeiten")
            tx_to_edit = next((t for t in filtered_txs if t["id"] == st.session_state.edit_tx_id), None)
            
            if tx_to_edit:
                with st.form("edit_form"):
                    new_amt = st.number_input("Betrag", value=float(abs(tx_to_edit["amount"])))
                    new_note = st.text_input("Notiz", value=tx_to_edit["note"])
                    col_a, col_b = st.columns(2)
                    if col_a.form_submit_button("Speichern"):
                        final_val = -new_amt if tx_to_edit["amount"] < 0 else new_amt
                        payload = {
                            "amount": final_val, "note": new_note, "category_id": tx_to_edit["category_id"],
                            "account_id": tx_to_edit["account_id"], "date": tx_to_edit["date"]
                        }
                        res = api_request("PUT", f"transactions/{tx_to_edit['id']}", json=payload)
                        if res and res.ok:
                            st.success("Aktualisiert!")
                            del st.session_state.edit_tx_id
                            st.rerun()
                    if col_b.form_submit_button("Abbrechen"):
                        del st.session_state.edit_tx_id
                        st.rerun()
            st.divider()

        if filtered_txs:
            filtered_txs.sort(key=lambda x: x.get("id", 0), reverse=True)
            st.write("---")
            h1, h2, h3, h4, h5, h6 = st.columns([2, 2, 3, 2, 1, 1])
            h1.markdown("**Datum**"); h2.markdown("**Kategorie**"); h3.markdown("**Notiz**"); h4.markdown("**Betrag**")
            st.write("---")
            cat_lookup = {c["id"]: c["name"] for c in categories}

            for tx in filtered_txs:
                c1, c2, c3, c4, c5, c6 = st.columns([2, 2, 3, 2, 1, 1])
                c1.write(tx.get("date", "")[:10])
                c2.write(cat_lookup.get(tx.get("category_id"), "Unbekannt"))
                c3.write(tx.get("note", ""))
                amt = tx.get("amount", 0)
                color = "red" if amt < 0 else "green"
                c4.markdown(f"<span style='color:{color}; font-weight:bold'>{amt:.2f} €</span>", unsafe_allow_html=True)
                
                if c5.button("✏️", key=f"edit_f_{tx['id']}"):
                    st.session_state.edit_tx_id = tx["id"]
                    st.rerun()
                if c6.button("🗑️", key=f"del_f_{tx['id']}"):
                    res = api_request("DELETE", f"transactions/{tx['id']}")
                    if res and res.status_code == 200:
                        st.success("Gelöscht!")
                        st.rerun()
        else:
            st.info("Keine Buchungen gefunden.")

    # ==========================================
    # TAB 3: EINSTELLUNGEN
    # ==========================================
    with tab_settings:
        c1, c2 = st.columns(2)
        with c1:
            st.subheader("Neues Konto")
            n_acc = st.text_input("Name", key="n_acc")
            curr = st.selectbox("Währung", ["EUR", "USD"], key="curr")
            if st.button("Konto anlegen"):
                api_request("POST", "accounts/", json={"name": n_acc, "currency": curr})
                st.rerun()
        with c2:
            st.subheader("Neue Kategorie")
            n_cat = st.text_input("Kategorie Name", key="n_cat")
            if st.button("Kategorie anlegen"):
                api_request("POST", "categories/", json={"name": n_cat})
                st.rerun()
            st.divider()
            if st.button("🔄 Standard-Kategorien laden"):
                defaults = ["Lebensmittel", "Miete", "Gehalt", "Freizeit", "Transport", "Sparen"]
                for d in defaults: api_request("POST", "categories/", json={"name": d})
                st.rerun()


# --- APP START ---
if st.session_state.token:
    main_dashboard()
else:
    login_page()
