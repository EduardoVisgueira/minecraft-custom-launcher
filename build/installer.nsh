; Pagina custom de opcoes (atalho no desktop + instalacao limpa).
; ASCII puro (makensis quebra com acento). Tudo guardado em !ifndef BUILD_UNINSTALLER:
; o desinstalador roda num pass separado do makensis e NAO insere o
; customPageAfterChangeDir -> sem o guard, as funcoes da pagina ficavam orfas
; nesse pass e geravam "warning treated as error".
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
  Var ApzDesktopChk
  Var ApzCleanChk
  Var ApzDesktopState
  Var ApzCleanState

  ; defaults: atalho marcado, instalacao limpa desmarcada
  !macro customInit
    StrCpy $ApzDesktopState 1
    StrCpy $ApzCleanState 0
  !macroend

  ; pagina inserida depois de escolher a pasta, antes de instalar
  !macro customPageAfterChangeDir
    Page custom ApzOptionsPageCreate ApzOptionsPageLeave
  !macroend

  ; aplica as escolhas durante a instalacao
  !macro customInstall
    ${If} $ApzCleanState == 1
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    ${EndIf}
    ${If} $ApzDesktopState == 1
      CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}
  !macroend

  Function ApzOptionsPageCreate
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 8u 100% 12u "Criar atalho na area de trabalho"
    Pop $ApzDesktopChk
    ${NSD_Check} $ApzDesktopChk
    ${NSD_CreateCheckbox} 0 28u 100% 20u "Instalacao limpa (apaga contas e o modpack ja baixado)"
    Pop $ApzCleanChk
    nsDialogs::Show
  FunctionEnd

  Function ApzOptionsPageLeave
    ${NSD_GetState} $ApzDesktopChk $ApzDesktopState
    ${NSD_GetState} $ApzCleanChk $ApzCleanState
  FunctionEnd
!endif

; remove o atalho do desktop ao desinstalar (roda no pass do desinstalador)
!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
!macroend
