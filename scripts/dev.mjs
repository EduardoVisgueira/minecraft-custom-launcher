// Wrapper de desenvolvimento.
//
// Por que existe: quando o launcher é iniciado a partir de um processo que já é
// Electron (alguns terminais/IDEs embarcados, ex.: VS Code rodando tarefas), a
// variável de ambiente ELECTRON_RUN_AS_NODE pode estar herdada. Ela força o
// electron.exe a rodar como Node.js puro — fazendo `require('electron')`
// retornar o caminho do binário em vez da API (app, BrowserWindow...), o que
// quebra o app na inicialização.
//
// Para um usuário comum rodando `npm run dev` num terminal normal, essa variável
// não existe e este script é um no-op inofensivo. Mantê-lo garante que o dev
// funcione em qualquer ambiente.

import { spawn } from 'node:child_process'

delete process.env.ELECTRON_RUN_AS_NODE

const isWin = process.platform === 'win32'
const bin = isWin ? 'electron-vite.cmd' : 'electron-vite'

const child = spawn(bin, ['dev'], {
  stdio: 'inherit',
  shell: isWin,
  env: process.env
})

child.on('exit', (code) => process.exit(code ?? 0))
