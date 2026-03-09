# release.ps1 - Automatiseer je release naar GitHub
$version = Read-Host "Welke versie release je? (bijv. 1.0.1)"

# 1. Alles toevoegen aan Git
git add .

# 2. Commit met de versie naam
git commit -m "Release: Versie $version"

# 3. Tag aanmaken
git tag -a "v$version" -m "Release $version"

# 4. Push alles naar GitHub
git push origin main
git push origin "v$version"

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "🚀 Versie $version is succesvol gepusht en getagd naar GitHub!" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
