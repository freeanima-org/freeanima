; 安装/升级前结束 sidecar Bun 进程，避免 companion-bun.exe 被占用无法覆盖。

!macro NSIS_HOOK_PREINSTALL
  nsis_tauri_utils::KillProcessCurrentUser "companion-bun.exe"
  Pop $R0
  nsis_tauri_utils::KillProcessCurrentUser "companion-shell.exe"
  Pop $R0
  Sleep 1500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsis_tauri_utils::KillProcessCurrentUser "companion-bun.exe"
  Pop $R0
  nsis_tauri_utils::KillProcessCurrentUser "companion-shell.exe"
  Pop $R0
  Sleep 1500
!macroend
