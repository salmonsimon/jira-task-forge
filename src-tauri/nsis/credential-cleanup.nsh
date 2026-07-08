!macro JTF_DELETE_CREDENTIAL TARGET
  nsExec::ExecToLog '"$SYSDIR\cmdkey.exe" /delete:"${TARGET}"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Removing Jira Task Forge credentials from Windows Credential Manager"
  !insertmacro JTF_DELETE_CREDENTIAL "api-token.jira-task-forge:jira"
  !insertmacro JTF_DELETE_CREDENTIAL "api-key.jira-task-forge:openai"
  !insertmacro JTF_DELETE_CREDENTIAL "api-key.jira-task-forge:claude"
  !insertmacro JTF_DELETE_CREDENTIAL "api-key.jira-task-forge:gemini"
  !insertmacro JTF_DELETE_CREDENTIAL "integration-token.jira-task-forge:notion"
!macroend
