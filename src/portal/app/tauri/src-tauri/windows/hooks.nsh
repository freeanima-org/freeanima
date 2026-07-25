; FreeAnima Portal — NSIS 升级辅助（移植自 Electron installer.nsh，适配 Tauri 产物名）
; 勿在 customInit 里 RMDir。PREINSTALL 在 CheckIfAppIsRunning 之前运行。

!macro NSIS_HOOK_PREINSTALL
  ; 优雅退出运行中的 Portal（安装器随后 CheckIfAppIsRunning / 覆盖文件）
  IfFileExists "$INSTDIR\${MAINBINARYNAME}.exe" 0 FreeAnimaPreInstallDone
    DetailPrint "Closing FreeAnima..."
    ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --quit-for-install' $0
    Sleep 1500
    nsExec::ExecToStack `$SYSDIR\cmd.exe /c taskkill /F /T /IM "${MAINBINARYNAME}.exe" /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    Pop $1
    Sleep 500
  FreeAnimaPreInstallDone:
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
