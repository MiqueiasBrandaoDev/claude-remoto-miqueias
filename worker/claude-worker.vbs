' Supervisor do worker do Painel IA (claude-remoto-miqueias).
' - Mantem o worker SEMPRE rodando: se cair, espera 3s e sobe de novo.
' - Roda 100% escondido (sem janela de terminal).
' - Uma copia deste arquivo fica na pasta Startup do Windows, entao ele sobe
'   sozinho quando o usuario loga (liga o PC e entra na conta).
' Log em worker.log dentro da pasta do worker.
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\documentos\PROJETOS_AIOS\painel-ia-camozzi\worker"
Do
  sh.Run "cmd /c node worker.js 1>> worker.log 2>&1", 0, True
  WScript.Sleep 3000
Loop
