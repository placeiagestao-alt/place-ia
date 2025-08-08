@echo off
echo.
echo Removendo bloqueios de segurança de arquivos .exe...
echo.

for %%f in (*.exe) do (
  echo Desbloqueando: %%f
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%%f' -ErrorAction SilentlyContinue"
)

echo.
echo Concluído! Pressione qualquer tecla para sair.
pause >nul


