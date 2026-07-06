; FreeAnima Desktop — NSIS 升级/卸载辅助
; 勿在 customInit 里 RMDir（会删掉 NSIS SetOutPath → 安装器闪退无窗口）。
; 参考 https://github.com/electron-userland/electron-builder/issues/6865

!macro writeInstallLog MESSAGE
  Push $R0
  FileOpen $R0 "$TEMP\FreeAnima-Desktop-install.log" a
  FileSeek $R0 0 END
  FileWrite $R0 "${MESSAGE}$\r$\n"
  FileClose $R0
  Pop $R0
!macroend

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
  IntCmp $R8 30 FreeAnimaWaitDone FreeAnimaWaitBody FreeAnimaWaitDone
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
      !insertmacro writeInstallLog "Closing FreeAnima Desktop..."
      ExecWait '"$INSTDIR\FreeAnima-Desktop.exe" --quit-for-install' $0
      Sleep 2000
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
    !insertmacro writeInstallLog "Removing previous installation at $INSTDIR"
    SetOutPath $TEMP
    !insertmacro deleteInstallRegistryKeys
    StrCpy $R8 0
  FreeAnimaRmLoop:
    RMDir /r "$INSTDIR"
    IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaRmDone
    IntOp $R8 $R8 + 1
    IntCmp $R8 20 FreeAnimaRmFailed FreeAnimaRmRetry FreeAnimaRmFailed
  FreeAnimaRmRetry:
    DetailPrint "Waiting for files to be released..."
    !insertmacro writeInstallLog "Waiting for files to be released (attempt $R8)..."
    nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    Sleep 1500
    Goto FreeAnimaRmLoop
  FreeAnimaRmFailed:
    !insertmacro writeInstallLog "Failed to remove $INSTDIR after 20 attempts"
    MessageBox MB_OK|MB_ICONEXCLAMATION "无法删除旧版安装目录，请手动关闭 FreeAnima Desktop 后删除：$\n$INSTDIR$\n$\n安装日志：%TEMP%\FreeAnima-Desktop-install.log" /SD IDOK
    Abort "无法删除旧版安装目录"
  FreeAnimaRmDone:
    !insertmacro writeInstallLog "Previous installation removed"
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
