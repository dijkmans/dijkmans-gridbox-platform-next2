path = "src/listener.py"
with open(path, "rb") as f:
    raw = f.read()

crlf = b"\r\n" in raw
src = raw.decode("utf-8", errors="replace")

def fix(s):
    return s.replace("\n", "\r\n") if crlf else s

# ============================================================
# FIX 1: get_box_rut_credentials()
# ============================================================
old_creds = fix('''def get_box_rut_credentials():
    """Haalt RUT241-credentials op uit boxes/{boxId}.hardware.rut.config."""
    try:
        box_data = box_doc_ref.get().to_dict() or {}
        config = ((box_data.get("hardware") or {}).get("rut") or {}).get("config") or {}
        if not config.get("ip") or not config.get("username") or not config.get("password"):
            return None
        return {"ip": config["ip"], "username": config["username"], "password": config["password"]}
    except Exception as e:
        log(f"WARN: get_box_rut_credentials: {e}")
        return None''')

new_creds = fix('''def get_box_rut_credentials():
    """Haalt RUT241-credentials op uit boxes/{boxId}.hardware.rut.config.
    Als IP ontbreekt: valt terug op het automatisch gedetecteerde gateway IP.
    Als username ontbreekt: gebruikt 'root' als Teltonika-standaard.
    Password blijft altijd verplicht.
    """
    try:
        box_data = box_doc_ref.get().to_dict() or {}
        config = ((box_data.get("hardware") or {}).get("rut") or {}).get("config") or {}
        observed = ((box_data.get("hardware") or {}).get("rut") or {}).get("observed") or {}

        ip = config.get("ip") or observed.get("ip") or get_gateway_ip()
        if not ip:
            log("WARN: get_box_rut_credentials: geen RUT IP beschikbaar")
            return None

        username = config.get("username") or "root"

        password = config.get("password")
        if not password:
            log("WARN: get_box_rut_credentials: geen wachtwoord geconfigureerd voor RUT241")
            return None

        return {"ip": ip, "username": username, "password": password}
    except Exception as e:
        log(f"WARN: get_box_rut_credentials: {e}")
        return None''')

if old_creds in src:
    src = src.replace(old_creds, new_creds, 1)
    print("OK get_box_rut_credentials gepatcht")
else:
    print("MISS get_box_rut_credentials niet gevonden")

# ============================================================
# FIX 2: Hardware detectie loop
# ============================================================
old_hw = fix('''        # Hardware detectie
        hw_update: dict = {}

        gateway_ip = get_gateway_ip()
        if gateway_ip:
            hw_update["hardware.rut.observed.ip"] = gateway_ip
            hw_update["hardware.rut.observed.lastSeenAt"] = now_iso()
            gateway_serial = get_gateway_serial()
            if gateway_serial:
                hw_update["hardware.rut.observed.serial"] = gateway_serial
            gateway_mac = get_gateway_mac_fallback()
            if gateway_mac:
                hw_update["hardware.rut.observed.mac"] = gateway_mac

        # Haal DHCP leases op van RUT241 en schrijf naar Firestore (voor camera-detectie via backend)
        try:
            rut_creds = get_box_rut_credentials()
            if rut_creds:
                leases = fetch_rut241_leases(rut_creds["ip"], rut_creds["username"], rut_creds["password"])
                hw_update["hardware.rut.observed.leases"] = leases
                hw_update["hardware.rut.observed.leasesUpdatedAt"] = now_iso()
        except Exception as e:
            log(f"WARN: lease-fetch RUT241 mislukt: {e}")''')

new_hw = fix('''        # Hardware detectie
        hw_update: dict = {}

        gateway_ip = get_gateway_ip()
        if gateway_ip:
            hw_update["hardware.rut.observed.ip"] = gateway_ip
            hw_update["hardware.rut.observed.lastSeenAt"] = now_iso()
            gateway_serial = get_gateway_serial()
            if gateway_serial:
                hw_update["hardware.rut.observed.serial"] = gateway_serial
            gateway_mac = get_gateway_mac_fallback()
            if gateway_mac:
                hw_update["hardware.rut.observed.mac"] = gateway_mac

            # Auto-sync rut.config: vul IP en username automatisch in als die ontbreken
            box_data_fresh = box_doc_ref.get().to_dict() or {}
            rut_config = ((box_data_fresh.get("hardware") or {}).get("rut") or {}).get("config") or {}
            rut_observed_fresh = ((box_data_fresh.get("hardware") or {}).get("rut") or {}).get("observed") or {}

            if not rut_config.get("ip"):
                hw_update["hardware.rut.config.ip"] = gateway_ip
                log(f"INFO: rut.config.ip automatisch ingesteld op {gateway_ip}")

            if not rut_config.get("username"):
                hw_update["hardware.rut.config.username"] = "root"
                log("INFO: rut.config.username automatisch ingesteld op root")

            # Detecteer routerwissel via serienummer
            if gateway_serial:
                vorig_serial = rut_observed_fresh.get("serial")
                nieuwe_router = vorig_serial and vorig_serial != gateway_serial
                if nieuwe_router:
                    log(f"INFO: Nieuwe RUT241 gedetecteerd! Oud serial: {vorig_serial} -> Nieuw: {gateway_serial}")
                    _herstel_camera_lease_na_routerwissel(box_data_fresh, gateway_ip, rut_config)

        # Haal DHCP leases op van RUT241 en schrijf naar Firestore (voor camera-detectie via backend)
        try:
            rut_creds = get_box_rut_credentials()
            if rut_creds:
                leases = fetch_rut241_leases(rut_creds["ip"], rut_creds["username"], rut_creds["password"])
                hw_update["hardware.rut.observed.leases"] = leases
                hw_update["hardware.rut.observed.leasesUpdatedAt"] = now_iso()
        except Exception as e:
            log(f"WARN: lease-fetch RUT241 mislukt: {e}")''')

if old_hw in src:
    src = src.replace(old_hw, new_hw, 1)
    print("OK Hardware detectie loop gepatcht")
else:
    print("MISS Hardware detectie loop niet gevonden")

# ============================================================
# FIX 3: Hulpfunctie voor set_rut241_static_lease_via_ssh
# ============================================================
old_anchor = fix('''def set_rut241_static_lease_via_ssh(ip, username, password, mac, lease_ip, hostname="camera-gridbox"):''')

new_anchor = fix('''def _herstel_camera_lease_na_routerwissel(box_data: dict, gateway_ip: str, rut_config: dict) -> None:
    """Herstelt de camera static lease op een nieuwe RUT241 na routerwissel."""
    try:
        cam_assignment = ((box_data.get("hardware") or {}).get("camera") or {}).get("assignment") or {}
        cam_mac = cam_assignment.get("mac")
        cam_ip = cam_assignment.get("ip")

        if not cam_mac or not cam_ip:
            log("INFO: _herstel_camera_lease: geen camera assignment — niets te herstellen")
            return

        creds = get_box_rut_credentials()
        if not creds:
            log("WARN: _herstel_camera_lease: geen RUT credentials")
            return

        log(f"INFO: _herstel_camera_lease: lease herstellen voor camera {cam_mac} -> {cam_ip}")
        set_rut241_static_lease_via_ssh(
            ip=creds["ip"],
            username=creds["username"],
            password=creds["password"],
            mac=cam_mac,
            lease_ip=cam_ip,
            hostname="camera-gridbox"
        )
        log("INFO: _herstel_camera_lease: static lease hersteld na routerwissel")
        box_doc_ref.update({
            "hardware.rut.observed.leaseRestoredAt": now_iso(),
            "hardware.rut.observed.leaseRestoredReason": "routerwissel"
        })
    except Exception as e:
        log(f"WARN: _herstel_camera_lease fout: {type(e).__name__}: {e}")


def set_rut241_static_lease_via_ssh(ip, username, password, mac, lease_ip, hostname="camera-gridbox"):''')

if old_anchor in src:
    src = src.replace(old_anchor, new_anchor, 1)
    print("OK _herstel_camera_lease_na_routerwissel toegevoegd")
else:
    print("MISS set_rut241_static_lease_via_ssh niet gevonden als ankerpunt")

with open(path, "wb") as f:
    f.write(src.encode("utf-8"))

print("listener.py geschreven")
