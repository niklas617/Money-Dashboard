"""
Portfolio-Tab  —  wird von dashboard.py via render(api_request, API_URL) aufgerufen.
"""
from __future__ import annotations

import requests as http_requests
import pandas as pd
import plotly.express as px
import streamlit as st
from datetime import date


# ==========================================
# GECACHTE API-CALLS
# ==========================================

@st.cache_data(ttl=300, show_spinner=False)
def _fetch_summary(token: str, api_url: str) -> dict:
    try:
        r = http_requests.get(
            f"{api_url}/portfolio/summary",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        return r.json() if r.ok else {}
    except Exception:
        return {}


@st.cache_data(ttl=3600, show_spinner=False)
def _fetch_history(token: str, api_url: str) -> list:
    try:
        r = http_requests.get(
            f"{api_url}/portfolio/history",
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        return r.json() if r.ok else []
    except Exception:
        return []


def _clear_portfolio_cache() -> None:
    _fetch_summary.clear()
    _fetch_history.clear()


# ==========================================
# HAUPT-RENDER-FUNKTION
# ==========================================

def render(api_request, api_url: str) -> None:
    token: str = st.session_state.get("token", "")

    st.header("📈 Portfolio-Dashboard")

    # ---- Portfolio-Daten laden ----
    with st.spinner("Lade Portfolio & Live-Kurse …"):
        summary = _fetch_summary(token, api_url)

    holdings: list       = summary.get("holdings", [])
    total_value: float   = summary.get("total_value", 0.0)
    total_invested: float        = summary.get("total_invested", 0.0)
    total_unrealized_pnl: float  = summary.get("total_unrealized_pnl", 0.0)
    total_realized_pnl: float    = summary.get("total_realized_pnl", 0.0)
    total_pnl_pct: float              = summary.get("total_pnl_pct", 0.0)
    total_realized_pnl_pct: float     = summary.get("total_realized_pnl_pct", 0.0)

    # ==========================================
    # KPI-KARTEN
    # ==========================================
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("💼 Gesamtwert",      f"{total_value:,.2f} €")
    k2.metric("💳 Investiert",      f"{total_invested:,.2f} €")
    k3.metric(
        "📊 Unrealisiert P&L",
        f"{total_unrealized_pnl:+,.2f} €",
        delta=f"{total_pnl_pct:+.2f} %",
        delta_color="normal",
    )
    k4.metric(
        "✅ Realisiert P&L",
        f"{total_realized_pnl:+,.2f} €",
        delta=f"{total_realized_pnl_pct:+.2f} %" if total_realized_pnl_pct != 0.0 else None,
        delta_color="normal",
    )

    st.divider()

    # ==========================================
    # CHARTS (nur wenn Positionen vorhanden)
    # ==========================================
    if holdings:
        col_line, col_pie = st.columns([3, 2])

        with col_line:
            st.subheader("Wertentwicklung")
            with st.spinner("Lade historische Kurse …"):
                history = _fetch_history(token, api_url)

            if history:
                df_hist = pd.DataFrame(history)
                df_hist["date"] = pd.to_datetime(df_hist["date"])
                fig_area = px.area(
                    df_hist, x="date", y="value",
                    labels={"date": "Datum", "value": "Wert (€)"},
                    color_discrete_sequence=["#2ecc71"],
                )
                fig_area.update_layout(showlegend=False, margin=dict(t=10, b=0))
                st.plotly_chart(fig_area, use_container_width=True)
            else:
                st.info("Historische Kurse werden nach dem ersten Trade angezeigt.")

        with col_pie:
            st.subheader("Asset Allocation")
            df_pie = pd.DataFrame(
                [(h["symbol"], h["current_value"]) for h in holdings],
                columns=["Asset", "Wert (€)"],
            )
            fig_pie = px.pie(
                df_pie, values="Wert (€)", names="Asset",
                hole=0.4,
                color_discrete_sequence=px.colors.qualitative.Set3,
            )
            fig_pie.update_traces(textposition="inside", textinfo="percent+label")
            fig_pie.update_layout(showlegend=True, margin=dict(t=10, b=0))
            st.plotly_chart(fig_pie, use_container_width=True)

        st.divider()

        # ==========================================
        # HOLDINGS-TABELLE
        # ==========================================
        st.subheader("🏦 Positionen")
        df_h = pd.DataFrame(holdings)
        df_h["asset_type"] = df_h["asset_type"].map({"stock": "Aktie", "crypto": "Krypto"})
        df_display = df_h[[
            "symbol", "asset_name", "asset_type", "quantity",
            "avg_buy_in", "current_price", "current_value",
            "unrealized_pnl", "unrealized_pnl_pct", "realized_pnl",
        ]].rename(columns={
            "symbol":           "Symbol",
            "asset_name":       "Name",
            "asset_type":       "Typ",
            "quantity":         "Anzahl",
            "avg_buy_in":       "Ø Buy-In €",
            "current_price":    "Kurs €",
            "current_value":    "Wert €",
            "unrealized_pnl":   "Unreal. P&L €",
            "unrealized_pnl_pct": "Unreal. %",
            "realized_pnl":     "Real. P&L €",
        })

        def _color_pnl(val):
            if not isinstance(val, (int, float)):
                return ""
            return "color: green; font-weight:bold" if val >= 0 else "color: red; font-weight:bold"

        styled = (
            df_display.style
            .applymap(_color_pnl, subset=["Unreal. P&L €", "Unreal. %", "Real. P&L €"])
            .format({
                "Anzahl":       "{:.6g}",
                "Ø Buy-In €":  "{:,.8g}",  
                "Kurs €":      "{:,.8g}",  
                "Wert €":      "{:,.2f}",
                "Unreal. P&L €": "{:+.2f}",
                "Unreal. %":   "{:+.2f} %",
                "Real. P&L €": "{:+.2f}",
            })
        )
        st.dataframe(styled, use_container_width=True, hide_index=True)

    else:
        st.info("Noch keine Positionen. Füge unten deinen ersten Trade hinzu!")

    st.divider()

    # ==========================================
    # TRADE HINZUFÜGEN  —  Live-Suche (3 Schritte)
    # ==========================================
    st.subheader("➕ Trade hinzufügen")

    # ── Schritt 1: Freitext-Suche ──────────────────────────────────────────
    sc1, sc2 = st.columns([5, 1])
    with sc1:
        search_query = st.text_input(
            "Asset suchen",
            placeholder="z.B. Apple, PayPal, Bitcoin, Nvidia, Ethereum …",
            key="ptab_query",
            label_visibility="collapsed",
        ).strip()
    with sc2:
        search_clicked = st.button("🔍 Suchen", use_container_width=True, key="ptab_search_btn")

    if search_clicked:
        if not search_query:
            st.warning("Bitte einen Suchbegriff eingeben.")
        else:
            with st.spinner(f"Suche nach \"{search_query}\" …"):
                res = api_request("GET", "portfolio/search", params={"query": search_query})
            if res and res.ok:
                found = res.json()
                if found:
                    st.session_state.ptab_search_results = found
                    st.session_state.ptab_lookup = None   # altes Ergebnis verwerfen
                else:
                    st.warning(f"Keine Ergebnisse für \"{search_query}\" — Schreibweise prüfen.")
                    st.session_state.ptab_search_results = []
            else:
                st.error("Suche fehlgeschlagen – ist das Backend gestartet?")

    # ── Schritt 2: Treffer als Dropdown ────────────────────────────────────
    search_results: list = st.session_state.get("ptab_search_results", [])

    if search_results:
        options_display = [
            f"{'📈' if r['asset_type'] == 'stock' else '🪙'}  "
            f"{r['name']}  [{r['symbol']}]"
            + (f"  ·  {r['exchange']}" if r.get("exchange") else "")
            for r in search_results
        ]

        sel_col, btn_col = st.columns([4, 1])
        with sel_col:
            selected_idx = st.selectbox(
                "Ergebnisse",
                range(len(options_display)),
                format_func=lambda i: options_display[i],
                key="ptab_selected_idx",
                label_visibility="collapsed",
            )
        with btn_col:
            load_clicked = st.button(
                "💡 Kurs laden", use_container_width=True, key="ptab_load_btn"
            )

        if load_clicked:
            sel = search_results[selected_idx]
            with st.spinner(f"Lade Kursdaten für {sel['name']} …"):
                params = {"symbol": sel["symbol"], "asset_type": sel["asset_type"]}
                if sel.get("coin_id"):
                    params["coin_id"] = sel["coin_id"]
                res = api_request("GET", "portfolio/lookup", params=params)
            if res and res.ok:
                st.session_state.ptab_lookup = res.json()
            else:
                err = res.json().get("detail", res.text) if res else "Verbindungsfehler"
                st.error(f"❌ {err}")

    # ── Schritt 3: Asset-Karte + Trade-Formular ────────────────────────────
    lookup: dict | None = st.session_state.get("ptab_lookup")

    if lookup:
        st.markdown("---")
        info_col, form_col = st.columns([1, 2])

        # Linke Spalte: Asset-Info
        with info_col:
            logo = lookup.get("logo_url", "")
            if logo:
                st.image(logo, width=56)
            st.markdown(f"### {lookup['name']}")
            st.markdown(
                f"`{lookup['symbol']}` &nbsp;·&nbsp; "
                f"{'📈 Aktie' if lookup['asset_type'] == 'stock' else '🪙 Krypto'}",
                unsafe_allow_html=True,
            )
            price_eur = lookup.get("price_eur") or lookup.get("current_price", 0.0)
            price_usd = lookup.get("price_usd", 0.0)
            m1, m2 = st.columns(2)
            m1.metric("Kurs (USD)", f"${price_usd:,.4f}")
            m2.metric("Kurs (EUR)", f"{price_eur:,.4f} €")

        # Rechte Spalte: Trade-Formular
        with form_col:
            default_price = float(price_eur) if price_eur > 0 else 0.00000001

            with st.form("add_trade_form", clear_on_submit=True):
                f1, f2 = st.columns(2)
                with f1:
                    trade_type = st.selectbox(
                        "Trade-Typ",
                        ["BUY", "SELL"],
                        format_func=lambda x: "🟢 Kauf (BUY)" if x == "BUY" else "🔴 Verkauf (SELL)",
                    )
                    quantity = st.number_input(
                        "Anzahl *",
                        min_value=0.000001,
                        value=None,
                        step=0.001,
                        format="%.6f",
                        placeholder="0.000000",
                    )
                with f2:
                    price = st.number_input(
                        "Preis / Stück (€) *",
                        min_value=0.00000001,   # Erlaubt fast Null
                        value=default_price,    # Hier landet jetzt Qubic fehlerfrei
                        step=0.00000001,        # Erlaubt extrem kleine manuelle Anpassungen
                        format="%.8f",          # Zeigt bis zu 8 Nullen/Zahlen im Eingabefeld an
                        help="Vorausgefüllt mit Live-Kurs — für historische Trades anpassen.",
                    )
                    trade_date = st.date_input("Datum *", value=date.today())

                submitted = st.form_submit_button("💾 Trade speichern", type="primary")

            if submitted:
                if not quantity or quantity <= 0:
                    st.error("Bitte eine gültige Anzahl eingeben!")
                else:
                    payload = {
                        "symbol":         lookup["symbol"],
                        "asset_name":     lookup["name"],
                        "asset_type":     lookup["asset_type"],
                        "trade_type":     trade_type,
                        "quantity":       float(quantity),
                        "price_per_unit": float(price),
                        "date":           f"{trade_date.isoformat()}T12:00:00",
                    }
                    save_res = api_request("POST", "portfolio/trades", json=payload)
                    if save_res and save_res.status_code in (200, 201):
                        st.success(
                            f"✅ {trade_type} · {quantity:.6g} {lookup['symbol']} "
                            f"@ {price:.4f} € gespeichert!"
                        )
                        _clear_portfolio_cache()
                        st.session_state.pop("ptab_lookup", None)
                        st.session_state.pop("ptab_search_results", None)
                        st.rerun()
                    else:
                        err = save_res.text if save_res else "Verbindungsfehler"
                        st.error(f"Fehler beim Speichern: {err}")

    # ==========================================
    # TRADE-LOGBUCH
    # ==========================================
    st.divider()
    st.subheader("📋 Trade-Logbuch")

    res_trades = api_request("GET", "portfolio/trades")
    trades_raw: list = res_trades.json() if res_trades and res_trades.ok else []

    if not trades_raw:
        st.info("Noch keine Trades vorhanden.")
        return

    # --- Session State für das Editieren initialisieren ---
    if "ptab_edit_trade_id" not in st.session_state:
        st.session_state.ptab_edit_trade_id = None

    # Header
    cols_w = [1.3, 2.2, 0.9, 0.8, 1.1, 1.3, 1.3, 1.0] # Letzte Spalte etwas breiter für 2 Buttons
    headers = ["Datum", "Symbol / Name", "Typ", "Klasse", "Anzahl", "Preis", "Total", "Aktion"]
    h = st.columns(cols_w)
    for col, label in zip(h, headers):
        col.markdown(f"**{label}**")
    st.write("---")

    for trade in trades_raw:
        c1, c2, c3, c4, c5, c6, c7, c8 = st.columns(cols_w)
        c1.write(str(trade.get("date", ""))[:10])
        c2.write(f"**{trade['symbol']}** – {trade['asset_name']}")

        is_buy = trade["trade_type"] == "BUY"
        c3.markdown(
            f"<span style='color:{'green' if is_buy else 'red'}; font-weight:bold'>"
            f"{'Kauf' if is_buy else 'Verkauf'}</span>",
            unsafe_allow_html=True,
        )
        c4.write("Aktie" if trade["asset_type"] == "stock" else "Krypto")
        c5.write(f"{trade['quantity']:.6g}")
        c6.write(f"{trade['price_per_unit']:.4f} €")
        c7.write(f"{trade['quantity'] * trade['price_per_unit']:.2f} €")

        # Icons nebeneinander
        b1, b2 = c8.columns(2)
        
        # ✏️ Bearbeiten Button
        if b1.button("✏️", key=f"edit_trade_{trade['id']}"):
            st.session_state.ptab_edit_trade_id = trade['id']
            st.rerun()
            
        # 🗑️ Löschen Button
        if b2.button("🗑️", key=f"del_trade_{trade['id']}"):
            del_res = api_request("DELETE", f"portfolio/trades/{trade['id']}")
            if del_res and del_res.ok:
                _clear_portfolio_cache()
                st.rerun()

    # ==========================================
    # BEARBEITUNGS-FORMULAR (Pop-up Logik)
    # ==========================================
    if st.session_state.ptab_edit_trade_id:
        st.markdown("---")
        st.subheader("📝 Trade bearbeiten")
        
        trade_to_edit = next((t for t in trades_raw if t["id"] == st.session_state.ptab_edit_trade_id), None)
        
        if trade_to_edit:
            with st.form("edit_trade_form"):
                st.write(f"**{trade_to_edit['symbol']}** – {trade_to_edit['asset_name']}")
                
                f1, f2 = st.columns(2)
                with f1:
                    new_qty = st.number_input(
                        "Anzahl", 
                        value=float(trade_to_edit["quantity"]), 
                        min_value=0.000001, 
                        step=0.001, 
                        format="%.6f"
                    )
                with f2:
                    new_price = st.number_input(
                        "Preis / Stück (€)", 
                        value=float(trade_to_edit["price_per_unit"]), 
                        min_value=0.00000001,  # Angepasst!
                        step=0.00000001,       # Angepasst!
                        format="%.8f"          # Angepasst!
                    )
                
                c_btn1, c_btn2 = st.columns(2)
                
                # SPEICHERN
                if c_btn1.form_submit_button("💾 Ändern", type="primary"):
                    payload = {
                        "quantity": new_qty,
                        "price_per_unit": new_price
                    }
                    res = api_request("PUT", f"portfolio/trades/{trade_to_edit['id']}", json=payload)
                    
                    if res and res.ok:
                        st.success("Trade erfolgreich aktualisiert!")
                        st.session_state.ptab_edit_trade_id = None
                        _clear_portfolio_cache() # Extrem wichtig: Lädt die Diagramme & KPIs neu!
                        st.rerun()
                    else:
                        st.error("Fehler beim Speichern im Backend.")
                
                # ABBRECHEN
                if c_btn2.form_submit_button("Abbrechen"):
                    st.session_state.ptab_edit_trade_id = None
                    st.rerun()