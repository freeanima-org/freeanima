; FreeAnima Desktop — NSIS 升级/卸载辅助
; 勿在 customInit 里 RMDir（会删掉 NSIS SetOutPath → 安装器闪退无窗口）。
; 参考 https://github.com/electron-userland/electron-builder/issues/6865

!macro deleteInstallRegistryKeys
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
!macroend

; 仅当进程已在运行时返回非空（避免冷启动旧版 exe 导致安装过程中弹出旧程序）
!macro isDesktopAppRunning
  Push $R7
  nsExec::ExecToStack `$SYSDIR\cmd.exe /c tasklist /FI "IMAGENAME eq FreeAnima-Desktop.exe" /FI "USERNAME eq %USERNAME%" /NH 2>nul`
  Pop $0
  Pop $R7
!macroend

!macro waitForDesktopAppExit
  StrCpy $R8 0
FreeAnimaWaitLoop:
  IntOp $R8 $R8 + 1
  IntCmp $R8 24 FreeAnimaWaitDone FreeAnimaWaitBody FreeAnimaWaitDone
FreeAnimaWaitBody:
  !insertmacro isDesktopAppRunning
  ${If} $R7 == ""
    Goto FreeAnimaWaitDone
  ${EndIf}
  Sleep 500
  Goto FreeAnimaWaitLoop
FreeAnimaWaitDone:
!macroend

!macro customKillDesktopApp
  !insertmacro isDesktopAppRunning
  ${If} $R7 != ""
    IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaKillForce
      DetailPrint "Closing FreeAnima Desktop..."
      ExecWait '"$INSTDIR\FreeAnima-Desktop.exe" --quit-for-install' $0
      Sleep 1500
    FreeAnimaKillForce:
    nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    !insertmacro waitForDesktopAppExit
  ${EndIf}
!macroend

; 替换默认 CHECK_APP_RUNNING：优雅退出 + 清目录/注册表，避免 ExecWait 旧 uninstaller 与覆盖解压卡死
!macro customCheckAppRunning
  StrCpy $R9 0
  IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaInstallProceed
    StrCpy $R9 1
  FreeAnimaInstallProceed:
  !insertmacro customKillDesktopApp
  ${If} $R9 == 1
    DetailPrint "Removing previous installation..."
    SetOutPath $TEMP
    !insertmacro deleteInstallRegistryKeys
    StrCpy $R8 0
  FreeAnimaRmLoop:
    RMDir /r "$INSTDIR"
    IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaRmDone
    IntOp $R8 $R8 + 1
    IntCmp $R8 5 FreeAnimaRmDone FreeAnimaRmRetry FreeAnimaRmDone
  FreeAnimaRmRetry:
    DetailPrint "Waiting for files to be released..."
    nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    Sleep 1000
    Goto FreeAnimaRmLoop
  FreeAnimaRmDone:
    Sleep 500
    CreateDirectory "$INSTDIR"
  ${EndIf}
!macroend

!macro customRemoveFiles
  SetOutPath $TEMP
  RMDir /r "$INSTDIR"
!macroend

!macro customUnInstallCheck
!macroend

!macro customUnInstallCheckCurrentUser
!macroend
