#!/bin/bash
set -e
BOOT="/boot/firmware"
WORK_DIR="/home/pi/dijkmans-gridbox-platform-next2"

echo "[BOOTSTRAP] Hardware groepen instellen voor gebruiker pi..."
usermod -a -G gpio,i2c,spi,input,netdev,video,audio,dialout,cdrom,games,users,plugdev,render,adm pi

if [ ! -d "$WORK_DIR" ]; then
  git clone https://github.com/dijkmans/dijkmans-gridbox-platform-next2.git "$WORK_DIR"
fi

cp "$BOOT/box_bootstrap.json" "$WORK_DIR/"
cp "$BOOT/service-account.json" "$WORK_DIR/"

BOX_ID=$(python3 -c "import json; d=json.load(open('$WORK_DIR/box_bootstrap.json', encoding='utf-8-sig')); print(d['boxId'])")
echo "{\"deviceId\": \"$BOX_ID\"}" > "$WORK_DIR/box_config.json"

rm -f "$BOOT/box_bootstrap.json"
touch "$WORK_DIR/.bootstrap_initialized"

cd "$WORK_DIR"
pip3 install -r requirements.txt --break-system-packages

systemctl enable gridbox.service

# Install Raspberry Pi Connect Lite
apt-get install -y rpi-connect-lite

# Enable rpi-connect as user service for pi
sudo -u pi systemctl --user enable rpi-connect

# Enable linger so user service starts without login
loginctl enable-linger pi

echo "[BOOTSTRAP] Watchdog installeren en instellen..."
if ! dpkg -s watchdog &>/dev/null; then
  apt-get install -y watchdog
fi
echo "watchdog-device = /dev/watchdog" > /etc/watchdog.conf
echo "watchdog-timeout = 15" >> /etc/watchdog.conf
echo "max-load-1 = 24" >> /etc/watchdog.conf
systemctl enable watchdog
systemctl start watchdog
echo "[BOOTSTRAP] Watchdog actief."

echo "[BOOTSTRAP] Klaar. Herstart aanbevolen voor groepswijzigingen."
