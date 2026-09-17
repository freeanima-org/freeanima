; FreeAnima Portal — NSIS 升级辅助（移植自 Electron installer.nsh，适配 Tauri 产物名）
; 勿在 customInit 里 RMDir。PREINSTALL 在 CheckIfAppIsRunning 之前运行。
; --quit-for-install 须经单实例转发到已运行主进程；仅进程在跑时才 ExecWait（避免冷启动旧 UI）。

; $R7 非空 = 当前用户下 ${MAINBINARYNAME}.exe 仍在跑（用 find 判退出码，避免 tasklist 无匹配时的 INFO 文案误判）
!macro isPortalAppRunning
  nsExec::ExecToStack `$SYSDIR\cmd.exe /c tasklist /FI "IMAGENAME eq ${MAINBINARYNAME}.exe" /FI "USERNAME eq %USERNAME%" /NH 2>nul | find /I "${MAINBINARYNAME}.exe" >nul`
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $R7 "1"
  ${Else}
    StrCpy $R7 ""
  ${EndIf}
!macroend

!macro waitForPortalAppExit
  StrCpy $R8 0
FreeAnimaWaitLoop:
  IntOp $R8 $R8 + 1
  IntCmp $R8 24 FreeAnimaWaitDone FreeAnimaWaitBody FreeAnimaWaitDone
FreeAnimaWaitBody:
  !insertmacro isPortalAppRunning
  ${If} $R7 == ""
    Goto FreeAnimaWaitDone
  ${EndIf}
  Sleep 500
  Goto FreeAnimaWaitLoop
FreeAnimaWaitDone:
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro isPortalAppRunning
  ${If} $R7 != ""
    IfFileExists "$INSTDIR\${MAINBINARYNAME}.exe" 0 FreeAnimaKillForce
      DetailPrint "Closing FreeAnima..."
      ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --quit-for-install' $0
      Sleep 1500
    FreeAnimaKillForce:
    nsExec::ExecToStack `$SYSDIR\cmd.exe /c taskkill /F /T /IM "${MAINBINARYNAME}.exe" /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    Pop $1
    !insertmacro waitForPortalAppExit
    !insertmacro isPortalAppRunning
    ${If} $R7 != ""
      DetailPrint "Retrying taskkill..."
      nsExec::ExecToStack `$SYSDIR\cmd.exe /c taskkill /F /T /IM "${MAINBINARYNAME}.exe" /FI "USERNAME eq %USERNAME%" 2>nul`
      Pop $0
      Pop $1
      Sleep 1000
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
