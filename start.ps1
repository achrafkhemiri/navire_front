# Script de démarrage propre pour Angular
# Nettoie le cache et démarre le serveur de développement

Write-Host "🧹 Nettoyage du cache Angular..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .angular -ErrorAction SilentlyContinue

Write-Host "✅ Cache nettoyé!" -ForegroundColor Green
Write-Host "🚀 Démarrage du serveur Angular..." -ForegroundColor Cyan

ng serve
