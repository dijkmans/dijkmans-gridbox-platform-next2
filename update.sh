#!/bin/bash
set -e

echo "[UPDATE] rpi-connect stoppen voor update..."
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 systemctl --user stop rpi-connect || true

echo "[UPDATE] Laatste versie ophalen..."
git fetch --all
VERSION=${1:-$(git tag | sort -V | tail -1)}
echo "[UPDATE] Versie: $VERSION"
git checkout $VERSION

echo "[UPDATE] gridbox.service installeren..."
cp /home/pi/dijkmans-gridbox-platform-next2/gridbox.service /etc/systemd/system/gridbox.service
systemctl daemon-reload
echo "[UPDATE] gridbox.service geïnstalleerd en daemon herladen."

echo "[UPDATE] rpi-connect-lite installeren indien nodig..."
if ! dpkg -s rpi-connect-lite &>/dev/null; then
  apt-get install -y rpi-connect-lite
else
  echo "[UPDATE] rpi-connect-lite is al geinstalleerd."
fi

echo "[UPDATE] Linger inschakelen voor gebruiker pi..."
loginctl enable-linger pi

echo "[UPDATE] Watchdog installeren en instellen..."
if ! dpkg -s watchdog &>/dev/null; then
  apt-get install -y watchdog
fi
echo "watchdog-device = /dev/watchdog" > /etc/watchdog.conf
echo "watchdog-timeout = 15" >> /etc/watchdog.conf
echo "max-load-1 = 24" >> /etc/watchdog.conf
systemctl enable watchdog
systemctl start watchdog
echo "[UPDATE] Watchdog actief."

echo "[UPDATE] ffmpeg installeren indien nodig..."
if ! dpkg -s ffmpeg &>/dev/null; then
  apt-get install -y ffmpeg
  echo "[UPDATE] ffmpeg geïnstalleerd."
else
  echo "[UPDATE] ffmpeg is al geïnstalleerd."
fi

echo "[UPDATE] rpi-connect user service inschakelen..."
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 systemctl --user enable rpi-connect

echo "[UPDATE] gridbox.service herstarten..."
systemctl restart gridbox.service

echo "[UPDATE] rpi-connect herstarten..."
sudo -u pi DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus" XDG_RUNTIME_DIR=/run/user/1000 systemctl --user restart rpi-connect

echo "[UPDATE] rpi-connect herstart. Controleer status na script met: rpi-connect status"
systemctl status gridbox.service --no-pager || true

echo "[UPDATE] Klaar."
