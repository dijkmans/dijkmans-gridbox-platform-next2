#!/usr/bin/env python3
"""
Gridbox gbox-015 - Relay diagnose script
Nagaan of de relais sturing hebben gehad (rolluik)

Gebruik:
  python diagnose-relay-gbox015.py

Token ophalen via browser:
  1. Open gridbox-platform.web.app (aangemeld)
  2. F12 → Console → plak:
     (await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js'))
       .getAuth().currentUser.getIdToken(true).then(t => console.log(t))
  3. Kopieer de token en vul in bij AUTH_TOKEN hieronder
"""

import sys
import requests
from datetime import datetime, timedelta, timezone

# ─── CONFIG ───────────────────────────────────────────────────
BOX_ID    = "gbox-015"
API_URL   = "https://gridbox-api-960191535038.europe-west1.run.app"
HOURS_BACK = 48

# Plak je Firebase ID token hier (zonder "Bearer "):
AUTH_TOKEN = "JOUW_FIREBASE_ID_TOKEN_HIER"

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json",
}

# ─── KLEUREN ──────────────────────────────────────────────────
GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
CYAN   = "\033[36m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}[OK]{RESET} {msg}")
def err(msg):  print(f"  {RED}[!!]{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}[--]{RESET} {msg}")
def info(msg): print(f"  {CYAN}[..]{RESET} {msg}")
def head(msg): print(f"\n{BOLD}== {msg} =={RESET}")


# ─── 1. API bereikbaar? ───────────────────────────────────────
def check_health():
    head("CHECK 1 — API bereikbaar")
    try:
        r = requests.get(f"{API_URL}/health", timeout=10)
        r.raise_for_status()
        ok(f"API bereikbaar: {r.json()}")
    except Exception as e:
        err(f"API NIET bereikbaar: {e}")
        sys.exit(1)


# ─── 2. Token geldig? ─────────────────────────────────────────
def check_auth():
    head("CHECK 2 — Authenticatie")
    if AUTH_TOKEN == "JOUW_FIREBASE_ID_TOKEN_HIER":
        err("AUTH_TOKEN is nog niet ingevuld — pas het script aan")
        sys.exit(1)
    r = requests.get(f"{API_URL}/portal/me", headers=HEADERS, timeout=10)
    if r.status_code == 401:
        err("Token ongeldig of verlopen")
        sys.exit(1)
    data = r.json()
    ok(f"Aangemeld als: {data.get('email')}")
    info(f"Role: {data.get('membership', {}).get('role')}  |  customerId: {data.get('membership', {}).get('customerId')}")


# ─── 3. Box status ────────────────────────────────────────────
def check_box_status():
    head(f"CHECK 3 — Box status: {BOX_ID}")
    r = requests.get(f"{API_URL}/portal/boxes/{BOX_ID}", headers=HEADERS, timeout=10)
    if not r.ok:
        err(f"Box ophalen mislukt ({r.status_code}): {r.text[:200]}")
        return

    box = r.json()
    status    = box.get("status", "onbekend")
    heartbeat = box.get("software", {}).get("lastHeartbeatIso") or box.get("updatedAt", "—")
    version   = box.get("software", {}).get("versionRaspberry") or box.get("scriptVersion", "—")
    is_open   = box.get("state", {}).get("boxIsOpen")
    last_src  = box.get("state", {}).get("lastActionSource", "—")
    last_at   = box.get("state", {}).get("lastActionAt", "—")

    if status == "online":
        ok(f"Status: ONLINE")
    else:
        err(f"Status: {status.upper()} — Pi is waarschijnlijk offline")

    info(f"Versie Pi      : {version}")
    info(f"Heartbeat      : {heartbeat}")
    info(f"Rolluik positie: {'OPEN' if is_open else 'DICHT' if is_open is False else 'onbekend'}")
    info(f"Laatste actie  : {last_src} om {last_at}")

    if heartbeat and heartbeat != "—":
        try:
            hb = datetime.fromisoformat(heartbeat.replace("Z", "+00:00"))
            diff = datetime.now(timezone.utc) - hb
            minutes = int(diff.total_seconds() / 60)
            if minutes < 3:
                ok(f"Heartbeat {int(diff.total_seconds())}s geleden — Pi actief")
            elif minutes < 10:
                warn(f"Heartbeat {minutes} minuten geleden — Pi traag")
            else:
                err(f"Heartbeat {minutes} minuten geleden — Pi OFFLINE")
        except Exception:
            pass


# ─── 4. Relay events ophalen ──────────────────────────────────
def check_relay_events():
    head(f"CHECK 4 — Relay events afgelopen {HOURS_BACK} uur")

    r = requests.get(f"{API_URL}/portal/boxes/{BOX_ID}/events", headers=HEADERS, timeout=15)
    if not r.ok:
        err(f"Events ophalen mislukt ({r.status_code}): {r.text[:200]}")
        return

    data  = r.json()
    items = data.get("items", [])
    info(f"Totaal events opgehaald: {len(items)}")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=HOURS_BACK)

    relay_events = []
    for item in items:
        ts_raw = item.get("timestamp", "")
        if not ts_raw:
            continue
        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        except Exception:
            continue
        if ts < cutoff:
            continue

        event_type = item.get("type", "")
        if event_type in ("command_open", "command_close", "command_stop"):
            relay_events.append({
                "ts":    ts,
                "type":  event_type,
                "label": item.get("label", ""),
                "sev":   item.get("severity", "info"),
            })

    if not relay_events:
        warn(f"Geen relay-commando's gevonden in de afgelopen {HOURS_BACK} uur")
        return

    ok(f"{len(relay_events)} relay-commando('s) gevonden:")
    print()

    for ev in sorted(relay_events, key=lambda x: x["ts"]):
        ts_fmt    = ev["ts"].strftime("%d-%m-%Y %H:%M:%S")
        color     = GREEN if ev["type"] == "command_open" else RED if ev["type"] == "command_close" else YELLOW
        direction = "▲ OPEN " if ev["type"] == "command_open" else "▼ DICHT" if ev["type"] == "command_close" else "■ STOP "
        sev_flag  = f"  {RED}[FOUT]{RESET}" if ev["sev"] == "error" else ""
        print(f"  {ts_fmt}  {color}{direction}{RESET}  {ev['label']}{sev_flag}")

    print()

    opens  = sum(1 for e in relay_events if e["type"] == "command_open")
    closes = sum(1 for e in relay_events if e["type"] == "command_close")
    errors = sum(1 for e in relay_events if e["sev"] == "error")

    info(f"Samenvatting: {opens}× OPEN  |  {closes}× DICHT  |  {errors}× FOUT")
    if errors:
        err(f"{errors} commando('s) mislukt — controleer listener.py logs op de Pi")
    if opens == 0 and closes == 0:
        warn("Rolluik heeft in deze periode geen sturing ontvangen")


# ─── 5. SMS-logs controleren ─────────────────────────────────
def check_sms_logs():
    head("CHECK 5 — SMS-logs (inkomende berichten)")
    r = requests.get(f"{API_URL}/portal/boxes/{BOX_ID}/smslogs", headers=HEADERS, timeout=10)
    if not r.ok:
        warn(f"SMS-logs niet beschikbaar ({r.status_code})")
        return

    logs = r.json().get("items", [])
    cutoff = datetime.now(timezone.utc) - timedelta(hours=HOURS_BACK)

    recent = []
    for log in logs:
        ts_raw = log.get("receivedAt") or log.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            if ts >= cutoff:
                recent.append({"ts": ts, **log})
        except Exception:
            pass

    if not recent:
        warn(f"Geen SMS-berichten in de afgelopen {HOURS_BACK} uur")
        return

    ok(f"{len(recent)} SMS-bericht(en) ontvangen:")
    for msg in sorted(recent, key=lambda x: x["ts"]):
        ts_fmt = msg["ts"].strftime("%d-%m-%Y %H:%M:%S")
        body   = msg.get("body") or msg.get("message", "—")
        sender = msg.get("from") or msg.get("sender", "—")
        print(f"  {ts_fmt}  {sender}  →  {body}")


# ─── MAIN ─────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n{'='*50}")
    print(f"  GRIDBOX RELAY DIAGNOSE  —  {BOX_ID}")
    print(f"  Periode: afgelopen {HOURS_BACK} uur")
    print(f"{'='*50}")

    check_health()
    check_auth()
    check_box_status()
    check_relay_events()
    check_sms_logs()

    print(f"\n{'='*50}")
    print(f"  DIAGNOSE AFGEROND")
    print(f"{'='*50}\n")
