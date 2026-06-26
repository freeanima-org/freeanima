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

!macro customKillDesktopApp
  IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaKillForce
    DetailPrint "Closing FreeAnima Desktop..."
    ExecWait '"$INSTDIR\FreeAnima-Desktop.exe" --quit-for-install' $0
    Sleep 1500
  FreeAnimaKillForce:
  nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
  Pop $0
  Sleep 500
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
    RMDir /r "$INSTDIR"
    Sleep 500
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
