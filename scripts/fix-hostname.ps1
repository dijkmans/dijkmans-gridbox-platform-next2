<#
.SYNOPSIS
    Fix hostname op een bestaande Gridbox Pi en reboot zodat rpi-connect de juiste naam toont.

.PARAMETER IP
    IP-adres van de Pi (bijv. 192.168.1.50)

.PARAMETER BoxId
    Gewenste box-ID als hostname (bijv. gbox-007)

.EXAMPLE
    .ix-hostname.ps1 -IP 192.168.1.50 -BoxId gbox-007
#>
param(
    [Parameter(Mandatory)]
    [string]$IP,

    [Parameter(Mandatory)]
    [string]$BoxId
)

$ErrorActionPreference = "Stop"

Write-Host "Verbinden met $IP om hostname in te stellen op '$BoxId'..."

# Haal huidige hostname op
$currentHostname = ssh "pi@$IP" "hostname" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "SSH verbinding mislukt naar $IP"
    exit 1
}
$currentHostname = $currentHostname.Trim()
Write-Host "Huidige hostname: $currentHostname"

if ($currentHostname -eq $BoxId) {
    Write-Host "Hostname is al '$BoxId', niets te doen."
    exit 0
}

Write-Host "Instellen hostname op '$BoxId'..."

$commands = @(
    "sudo hostnamectl set-hostname $BoxId",
    "sudo sed -i 's/$currentHostname/$BoxId/g' /etc/hosts"
)

foreach ($cmd in $commands) {
    Write-Host "  > $cmd"
    ssh "pi@$IP" $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Commando mislukt: $cmd"
        exit 1
    }
}

Write-Host "Hostname ingesteld. Pi wordt herstart zodat rpi-connect de nieuwe naam registreert..."
ssh "pi@$IP" "sudo reboot" 2>&1 | Out-Null

Write-Host ""
Write-Host "Klaar. Pi herstart - wacht ~30 seconden en controleer connect.raspberrypi.com op naam '$BoxId'."
