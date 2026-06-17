; 安装/升级前结束 sidecar，避免 companion-sidecar.exe 被占用无法覆盖。
; Tauri 默认 CheckIfAppIsRunning 只处理主程序 companion-shell.exe。

!macro NSIS_HOOK_PREINSTALL
  nsis_tauri_utils::KillProcessCurrentUser "companion-sidecar.exe"
  Pop $R0
  nsis_tauri_utils::KillProcessCurrentUser "companion-shell.exe"
  Pop $R0
  Sleep 1500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsis_tauri_utils::KillProcessCurrentUser "companion-sidecar.exe"
  Pop $R0
  nsis_tauri_utils::KillProcessCurrentUser "companion-shell.exe"
  Pop $R0
  Sleep 1500
!macroend
