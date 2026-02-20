import os
import streamlit as st
import requests
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL") or st.secrets.get("API_URL", "http://localhost:8000")
st.set_page_config(page_title="Money Dashboard", layout="wide")

# --- Initialisierung ---
if "edit_tx_id" not in st.session_state:
    st.session_state.edit_tx_id = None

# ==========================================
# SEITENLEISTE (SIDEBAR) & NAVIGATION
# ==========================================
st.sidebar.title("💰 Dashboard")

# 1. Konten laden für die globale Auswahl
acc_r = requests.get(f"{API_URL}/accounts/")
accounts = acc_r.json() if acc_r.ok else []

selected_acc_id = None
if accounts:
    st.sidebar.subheader("🏦 Aktuelles Konto")
    acc_map = {f"{a['name']} ({a['currency']})": a["id"] for a in accounts}
    selected_label = st.sidebar.selectbox("Konto wählen", list(acc_map.keys()), label_visibility="collapsed")
    selected_acc_id = acc_map[selected_label]
else:
    st.sidebar.warning("Bitte lege zuerst ein Konto an.")

st.sidebar.divider()

# 2. Das Hauptmenü
page = st.sidebar.radio(
    "Navigation", 
    ["📊 Übersicht & Charts", "💸 Buchungen verwalten", "⚙️ Einstellungen (Konten & Kategorien)"]
)

# ==========================================
# SEITE 1: ÜBERSICHT & CHARTS
# ==========================================
if page == "📊 Übersicht & Charts":
    st.title("📊 Übersicht & Charts")
    
    if not selected_acc_id:
        st.info("Lege unter 'Einstellungen' ein Konto an, um Charts zu sehen.")
    else:
        # --- Zeitreihe (Kontostand-Verlauf) ---
        ts_r = requests.get(f"{API_URL}/accounts/{selected_acc_id}/timeseries")
        if ts_r.ok and ts_r.json():
            df_ts = pd.DataFrame(ts_r.json())
            df_ts["day"] = pd.to_datetime(df_ts["day"])
            st.subheader("Kontostand-Verlauf")
            
            fig_ts = px.line(df_ts, x="day", y="balance", markers=True)
            fig_ts.update_traces(
                line_shape='spline', line=dict(width=3, color="#1f77b4"), marker=dict(size=8),
                hovertemplate="<b>Datum:</b> %{x|%d.%m.%Y}<br><b>Kontostand:</b> %{y:.2f} €<extra></extra>"
            )
            fig_ts.update_layout(yaxis_title="Kontostand (€)", hovermode="x unified", xaxis=dict(title="", showgrid=False, tickformat="%d.%m.%Y"))
            st.plotly_chart(fig_ts, use_container_width=True)
        else:
            st.info("Noch keine Zeitreihe vorhanden.")

        st.divider()

        # --- Kreisdiagramme (Einnahmen & Ausgaben) ---
        st.subheader("Verteilung nach Kategorie")
        col_chart1, col_chart2 = st.columns(2)
        
        with col_chart1:
            chart_r_inc = requests.get(f"{API_URL}/reports/chart-data", params={"account_id": selected_acc_id, "tx_type": "income"})
            if chart_r_inc.ok and chart_r_inc.json():
                df_inc = pd.DataFrame(chart_r_inc.json())
                if df_inc["total"].sum() > 0:
                    fig_inc = px.pie(df_inc, values='total', names='category', hole=0.4, title="Einnahmen 📈")
                    st.plotly_chart(fig_inc, use_container_width=True)
                else:
                    st.info("Noch keine Einnahmen verbucht.")
                    
        with col_chart2:
            chart_r_exp = requests.get(f"{API_URL}/reports/chart-data", params={"account_id": selected_acc_id, "tx_type": "expense"})
            if chart_r_exp.ok and chart_r_exp.json():
                df_exp = pd.DataFrame(chart_r_exp.json())
                if df_exp["total"].sum() > 0:
                    fig_exp = px.pie(df_exp, values='total', names='category', hole=0.4, title="Ausgaben 📉")
                    st.plotly_chart(fig_exp, use_container_width=True)
                else:
                    st.info("Noch keine Ausgaben verbucht.")

        # --- Income vs Expense (Balkendiagramm) ---
        ie_r = requests.get(f"{API_URL}/accounts/{selected_acc_id}/income-expense")
        if ie_r.ok:
            ie = ie_r.json()
            st.subheader("Einnahmen vs. Ausgaben")
            df_ie = pd.DataFrame({"Typ": ["Einnahmen", "Ausgaben"], "Betrag": [ie["income"], ie["expense"]]})
            fig_bar = px.bar(df_ie, x="Typ", y="Betrag", color="Typ", color_discrete_map={"Einnahmen": "#2ca02c", "Ausgaben": "#d62728"})
            fig_bar.update_layout(yaxis=dict(rangemode='tozero', fixedrange=True), xaxis=dict(fixedrange=True), showlegend=False)
            st.plotly_chart(fig_bar, use_container_width=True)


# ==========================================
# SEITE 2: BUCHUNGEN VERWALTEN
# ==========================================
elif page == "💸 Buchungen verwalten":
    st.title("💸 Buchungen")

    if not selected_acc_id:
        st.warning("Bitte lege zuerst ein Konto an.")
    else:
        # Kategorien laden
        cat_r = requests.get(f"{API_URL}/categories/")
        categories = cat_r.json() if cat_r.ok else []
        cat_map = {"(keine)": None}
        cat_map |= {c["name"]: c["id"] for c in categories}

        # --- Neue Buchung anlegen ---
        with st.expander("➕ Neue Buchung eintragen", expanded=True):
            with st.form("create_tx"):
                col_a, col_b = st.columns(2)
                amount = col_a.number_input("Betrag (Einnahme +, Ausgabe -)", value=0.0, step=1.0)
                selected_category = col_b.selectbox("Kategorie", list(cat_map.keys()))
                note = st.text_input("Notiz", placeholder="z.B. Miete, Gehalt, Einkauf")
                submitted_tx = st.form_submit_button("Buchung speichern")

                if submitted_tx:
                    r = requests.post(f"{API_URL}/transactions", json={"account_id": selected_acc_id, "amount": amount, "note": note, "category_id": cat_map[selected_category]})
                    if r.ok:
                        st.success("Erfolgreich gespeichert!")
                        st.rerun()

        st.divider()

        # --- Filter & Liste ---
        st.subheader("📅 Buchungen durchsuchen")
        col_y, col_m = st.columns(2)
        year = col_y.number_input("Jahr", value=2026, step=1)
        month = col_m.selectbox("Monat", [None] + list(range(1, 13)))

        params = {"account_id": selected_acc_id, "year": int(year)}
        if month:
            params["month"] = int(month)

        flt = requests.get(f"{API_URL}/transactions/filter", params=params)
        filtered_txs = flt.json() if flt.ok else []

        if filtered_txs:
            col_date, col_note, col_amt, col_edit, col_del = st.columns([2, 4, 2, 1, 1])
            col_date.markdown("**Datum**")
            col_note.markdown("**Notiz**")
            col_amt.markdown("**Betrag**")
            st.write("---")
            
            for tx in filtered_txs:
                c1, c2, c3, c4, c5 = st.columns([2, 4, 2, 1, 1])
                datum_roh = tx.get("created_at", "")[:10]
                datum_str = f"{datum_roh[8:10]}.{datum_roh[5:7]}.{datum_roh[0:4]}" if len(datum_roh) == 10 else datum_roh
                    
                c1.write(datum_str)
                c2.write(tx.get("note", ""))
                c3.write(f"{tx.get('amount', 0):.2f} €")
                
                if c4.button("✏️", key=f"edit_f_{tx['id']}"):
                    st.session_state.edit_tx_id = tx['id']
                    st.rerun()
                if c5.button("🗑️", key=f"del_f_{tx['id']}"):
                    requests.delete(f"{API_URL}/transactions/{tx['id']}")
                    st.rerun()
        else:
            st.info("Für diesen Zeitraum gibt es keine Buchungen.")

        # --- Bearbeitungs-Formular ---
        if st.session_state.edit_tx_id is not None:
            st.write("---")
            st.subheader("Buchung bearbeiten ✏️")
            tx_to_edit = next((t for t in filtered_txs if t['id'] == st.session_state.edit_tx_id), None)
            
            if tx_to_edit:
                with st.form("edit_form_filtered"):
                    new_note = st.text_input("Notiz", value=tx_to_edit.get("note", ""))
                    new_amount = st.number_input("Betrag", value=float(tx_to_edit.get("amount", 0)), step=1.0)
                    col_save, col_cancel = st.columns(2)
                    if col_save.form_submit_button("Änderungen speichern"):
                        requests.put(f"{API_URL}/transactions/{tx_to_edit['id']}", json={"amount": new_amount, "note": new_note, "category_id": tx_to_edit.get("category_id")})
                        st.session_state.edit_tx_id = None
                        st.rerun()
                if st.button("❌ Abbrechen"):
                    st.session_state.edit_tx_id = None
                    st.rerun()


# ==========================================
# SEITE 3: EINSTELLUNGEN
# ==========================================
elif page == "⚙️ Einstellungen (Konten & Kategorien)":
    st.title("⚙️ Einstellungen")
    
    # --- Konten verwalten ---
    st.subheader("🏦 Konten")
    with st.form("create_account"):
        name = st.text_input("Konto-Name", placeholder="z.B. Volksbank Giro")
        currency = st.selectbox("Währung", ["EUR", "USD", "CHF"], index=0)
        if st.form_submit_button("Konto anlegen"):
            r = requests.post(f"{API_URL}/accounts/", json={"name": name, "currency": currency})
            if r.ok:
                st.success(f"Konto angelegt!")
                st.rerun()

            else:
             st.info("Noch keine Konten vorhanden.")

    st.divider()

    # --- Kategorien verwalten ---
    st.subheader("🏷️ Kategorien")
    cat_r = requests.get(f"{API_URL}/categories/")
    categories = cat_r.json() if cat_r.ok else []

    if not categories:
        st.info("Erster Start erkannt: Standard-Kategorien werden eingerichtet...")
        standard_kategorien = ["Lebensmittel & Haushalt", "Wohnen & Miete", "Versicherungen & Steuern", "Mobilität & Auto", "Freizeit & Hobby", "Shopping", "Gesundheit", "Sparen & Investieren", "Gehalt", "Geschenke & Boni"]
        for cat in standard_kategorien:
            requests.post(f"{API_URL}/categories/", json={"name": cat})
        st.rerun()

    with st.form("create_category"):
        new_cat_name = st.text_input("Eigene Kategorie hinzufügen", placeholder="z.B. Haustier, Streaming-Abos...")
        if st.form_submit_button("Speichern") and new_cat_name:
            r = requests.post(f"{API_URL}/categories/", json={"name": new_cat_name})
            if r.ok:
                st.success(f"Kategorie '{new_cat_name}' angelegt!")
                st.rerun()
