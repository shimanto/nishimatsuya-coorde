' Hidden launcher for scheduled batch/cmd files.
' Runs the given .cmd/.bat with NO console window; the script still writes its own log.
'
' ASCII-only comments on purpose: if this file is ever executed via cmd.exe by
' mistake, no multibyte (cp932) text can be misread as a command. This avoids the
' "'...' is not recognized as an internal or external command" mojibake error.
'
' Usage: wscript.exe run-hidden.vbs "<full-path-to-cmd>"
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count >= 1 Then
  ' 0 = hidden window, True = wait so the task reflects real duration and exit code
  ret = sh.Run("cmd /c """ & WScript.Arguments(0) & """", 0, True)
  WScript.Quit(ret)
End If
