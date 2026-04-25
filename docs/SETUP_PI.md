# Setup nieuwe Raspberry Pi gridbox

## Vereisten

- Raspberry Pi met Raspberry Pi OS (bookworm of nieuwer)
- Internetverbinding via RUT241 router
- `service-account.json` beschikbaar (van Google Cloud / Firebase project)
- Box ID bekend (bijv. `gbox-007`)
- API base URL bekend (`https://gridbox-api-960191535038.europe-west1.run.app`)

---

## Stap 1 — Git clone

```bash
cd /home/pi
git clone https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git
```

---

## Stap 2 — service-account.json plaatsen

Kopieer het `service-account.json` bestand naar een veilige locatie buiten de repo:

```bash
mkdir -p /home/pi/gridbox-secrets
cp /boot/firmware/service-account.json /home/pi/gridbox-secrets/service-account.json
chmod 600 /home/pi/gridbox-secrets/service-account.json
```

> Bij een nieuwe installatie via het SD-script wordt `service-account.json` automatisch op de bootpartitie gezet en door `gridbox-bootstrap-init.sh` gekopieerd.

---

## Stap 3 — Symlink aanmaken

Maak een symlink vanuit de repo naar de secrets map:

```bash
ln -s /home/pi/gridbox-secrets/service-account.json \
      /home/pi/dijkmans-gridbox-platform-next2/service-account.json
```

Controleer:

```bash
ls -la /home/pi/dijkmans-gridbox-platform-next2/service-account.json
```

---

## Stap 4 — box_config.json aanmaken

Maak het configuratiebestand aan voor deze box:

```bash
cat > /home/pi/dijkmans-gridbox-platform-next2/box_config.json << 'EOF'
{
  "deviceId": "gbox-007",
  "apiBaseUrl": "https://gridbox-api-960191535038.europe-west1.run.app"
}
EOF
```

Vervang `gbox-007` door het juiste box ID.

> `box_config.json` staat in `.gitignore` en wordt nooit in de repo opgeslagen.

---

## Stap 5 — gridbox.service installeren en starten

Kopieer het service bestand naar systemd:

```bash
sudo cp /home/pi/dijkmans-gridbox-platform-next2/gridbox.service \
        /etc/systemd/system/gridbox.service
```

Herlaad systemd en activeer de service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gridbox.service
sudo systemctl start gridbox.service
```

Controleer de status:

```bash
sudo systemctl status gridbox.service
sudo journalctl -u gridbox.service -n 50 -f
```

---

## Verificatie

Na het starten verschijnt binnen 60 seconden een heartbeat in Firestore onder `boxes/{deviceId}`.

Controleer in het Operations Center (`/operations`) of de box online komt.

---

## Opmerkingen

- `runtime_config.json` wordt automatisch aangemaakt door de bootstrap flow als de box via een provisioning is aangemeld
- De Pi update zichzelf automatisch naar de `targetVersion` die in Firestore staat
- Bij problemen: `sudo journalctl -u gridbox.service -n 100`

---

## rpi-connect (remote toegang)

rpi-connect is een `--user` service die draait onder de `pi` gebruiker, niet als systeem service.
Dit betekent dat standaard `systemctl` commando's niet werken — je moet altijd `DBUS_SESSION_BUS_ADDRESS` en `XDG_RUNTIME_DIR` meegeven, of direct als de `pi` gebruiker uitvoeren.

### Waarom expliciete stop/restart nodig is

rpi-connect loopt na een update vast als de service niet expliciet herstart wordt. De combinatie van `rpi-connect on` (oud gedrag) activeert alleen de verbinding als die uitstaat, maar herstart geen vastgelopen instantie. Daarom wordt in `update.sh` (v1.0.93+) rpi-connect expliciet gestopt vóór de update en herstart daarna.

### Handmatige restart van rpi-connect

```bash
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 systemctl --user restart rpi-connect
```

Status controleren:

```bash
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 rpi-connect status
```

### Eerste installatie (bootstrap)

`gridbox-bootstrap-init.sh` installeert rpi-connect-lite, schakelt linger in zodat de user service bij boot start, en start rpi-connect direct op. Dit werkt alleen correct als `loginctl enable-linger pi` vóór de `systemctl --user` aanroepen staat.

### Changelog

| Versie | Wijziging |
|--------|-----------|
| v1.0.93 | `update.sh`: expliciete stop voor update en restart daarna (commit 5f91534) |
| v1.0.93 | `gridbox-bootstrap-init.sh`: correcte DBUS/XDG_RUNTIME_DIR variabelen en directe start na enable |

---

## Service-naam

De service heet `gridbox.service`. Dit is de naam waarmee systemd de listener beheert.

In Firestore staat onder `software.serviceName` de te gebruiken naam. Als dit veld niet gezet is, gebruikt de listener `gridbox.service` als standaard.

Controleer op de Pi:

```bash
sudo systemctl status gridbox.service
```

Bij een gefaalde update kun je het restart-log inzien:

```bash
cat /tmp/gridbox-restart.log
```
