#!/bin/bash
set -e

echo "[UPDATE] Laatste versie ophalen..."
git fetch --all
VERSION=${1:-$(git tag | sort -V | tail -1)}
echo "[UPDATE] Versie: $VERSION"
git checkout $VERSION

echo "[UPDATE] rpi-connect-lite installeren indien nodig..."
if ! dpkg -s rpi-connect-lite &>/dev/null; then
  apt-get install -y rpi-connect-lite
else
  echo "[UPDATE] rpi-connect-lite is al geinstalleerd."
fi

echo "[UPDATE] Linger inschakelen voor gebruiker pi..."
loginctl enable-linger pi

echo "[UPDATE] rpi-connect user service inschakelen..."
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 systemctl --user enable rpi-connect

echo "[UPDATE] gridbox.service herstarten..."
systemctl restart gridbox.service

echo "[UPDATE] rpi-connect starten..."
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 rpi-connect on

echo "[UPDATE] Status:"
sudo -u pi rpi-connect status || true
systemctl status gridbox.service --no-pager || true

echo "[UPDATE] Klaar."
