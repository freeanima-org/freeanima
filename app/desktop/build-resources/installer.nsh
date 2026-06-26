; FreeAnima Desktop — NSIS 升级/卸载辅助
; 勿在 customInit 里 RMDir（会删掉 NSIS SetOutPath → 安装器闪退无窗口）。
; 参考 https://github.com/electron-userland/electron-builder/issues/6865

!macro customKillDesktopApp
  nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
  Pop $0
  Sleep 300
!macroend

; 替换默认 CHECK_APP_RUNNING；在点击「安装」时再次结束进程并清注册表，避免 ExecWait 旧 uninstaller 卡死
!macro customCheckAppRunning
  !insertmacro customKillDesktopApp
  IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 +3
  DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
!macroend

!macro customRemoveFiles
  SetOutPath $TEMP
  RMDir /r "$INSTDIR"
!macroend

!macro customUnInstallCheck
!macroend

!macro customUnInstallCheckCurrentUser
!macroend

; Function 须在宏内定义，${UNINSTALL_REGISTRY_KEY} 等常量仅在主脚本展开后才可用
!macro customPageAfterChangeDir
  Function FreeAnimaPreInstallCleanup
    IfFileExists "$INSTDIR\FreeAnima-Desktop.exe" 0 FreeAnimaPreInstallDone
    SetOutPath $TEMP
    nsExec::Exec `$SYSDIR\cmd.exe /c taskkill /F /T /IM FreeAnima-Desktop.exe /FI "USERNAME eq %USERNAME%" 2>nul`
    Pop $0
    Sleep 300
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
  FreeAnimaPreInstallDone:
    Abort
  FunctionEnd
  Page custom FreeAnimaPreInstallCleanup
!macroend
