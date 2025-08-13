@echo off
title 🚀 Atualizando Site Place IA...
cd /d "C:\Users\andyg\programa_place"

:: Cor do terminal
color 0C

:: Cabeçalho
echo =======================================
echo 🚀 Iniciando atualização do Place IA...
echo =======================================

:: Barra de progresso fake (só visual)
setlocal enabledelayedexpansion
for /l %%i in (1,1,20) do (
    set /a bar=%%i*5
    <nul set /p=Progresso: [!bar!%%] █
    timeout /nobreak /t 1 >nul
    echo.
)

:: Puxa última versão
git pull >nul 2>&1

:: Adiciona alterações
git add . >nul 2>&1

:: Commit automático
set data=%date%
set hora=%time%
git commit -m "Atualização automática em %data% %hora%" >nul 2>&1

:: Envia pro GitHub
git push >nul 2>&1

:: Final
echo =======================================
echo ✅ Site atualizado com sucesso!
echo =======================================

:: Toca som
powershell -c (New-Object Media.SoundPlayer "C:\Windows\Media\tada.wav").PlaySync();

timeout /t 2 >nul
exit
