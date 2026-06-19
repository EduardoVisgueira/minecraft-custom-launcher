# minecraft-custom-launcher

Launcher de Minecraft (Forge 1.20.1) em Electron + React. Login Microsoft/offline,
sincronização de modpack via manifest com hash, instâncias isoladas por modpack e config
remota atualizável sem rebuild.

Repositório de **código**. O **conteúdo** (config, banners, modpack) fica em outro repo
(`EduardoVisgueira/launcherz`), servido por `raw.githubusercontent.com` e lido em runtime.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Shell | Electron 32 (`electron-vite` para build) |
| UI | React 18 + Vite 5 |
| Minecraft/Forge | `@xmcl/core`, `@xmcl/installer` |
| HTTP | `undici` (dispatcher custom: IPv4 + segue redirect, sem retry-via-range) |
| Empacotamento | `electron-builder` (NSIS) |

---

## Arquitetura

Três contextos isolados (modelo padrão do Electron):

```
electron/main.js      → processo MAIN (Node): janela, IPC, launch, updater, auth, config
electron/preload.js   → bridge: expõe window.electronAPI no renderer (contextIsolation)
src/ (React)          → processo RENDERER: UI, sem acesso direto a Node
```

A UI **nunca** toca Node/FS direto — tudo passa por IPC via `window.electronAPI`.

### IPC (`preload.js` → `main.js`)

| `electronAPI.*` | Canal | Função |
|---|---|---|
| `getConfig()` | `get-config` | Config mesclada (síncrona, instantânea) |
| `refreshConfig()` | `refresh-config` | Rebaixa config remota e devolve mesclada |
| `saveSettings(s)` | `save-settings` | Grava settings do usuário |
| `authMicrosoft()` / `authOffline(user)` | `auth-*` | Login |
| `getAccounts()` / `setActiveAccount(uuid)` / `removeAccount(uuid)` | `*-account(s)` | Contas |
| `launchGame(opts)` / `killGame()` | `launch-game` / `kill-game` | Jogo |
| `checkUpdates()` | `check-updates` | Sincroniza modpack |
| `getSystemRam()` | `get-system-ram` | RAM física (limita o slider) |
| `getForgeVersions()` / `getInstalledForge()` | `get-*forge*` | Forge |
| `openExternal(url)` | `open-external` | Abre link (só http/https/mailto) |
| `windowMinimize/Maximize/Close()` | `window-*` | Controles da janela (frameless) |
| `onLog(cb)` / `onProgress(cb)` / `onGameClosed(cb)` | eventos | Streams main→renderer |

---

## Módulos (`electron/`)

### `main.js`
Ciclo de vida do app, `BrowserWindow` frameless, registro dos handlers IPC. No startup faz
`await refreshRemoteConfig()` **antes** de abrir a janela (offline-first: timeout de ~8s; se
falhar, segue com cache/bootstrap). DevTools (F12 / Ctrl+Shift+I) só quando `!app.isPackaged`.

### `config.js` — config em 3 camadas
`getConfig()` faz merge raso de:
1. **bootstrap** — `launcher-config.json` embutido no app (fallback offline).
2. **cache remoto** — `userData/cached-config.json` (baixado de `config_url`).
3. **settings** — `userData/settings.json` (RAM, Forge escolhido, etc.).

Precedência: `settings` > `cache remoto` > `bootstrap`. `refreshRemoteConfig()` baixa o
`config_url` (só `https`, segue redirect, timeout 8s) e grava no cache; **em falha não
sobrescreve o cache**; **pula** se `config_url` for vazio ou placeholder.

### `launcher.js` — launch + instâncias isoladas
Instala Forge sob demanda e lança via `@xmcl/core`. **Isolamento por instância:**

```
userData/minecraft/
├── assets/  libraries/  versions/      ← COMPARTILHADO entre instâncias
└── instances/<slug-do-modpack>/        ← mods, config, saves, resourcepacks, shaderpacks
```

No launch usa `gamePath = instanceDir` e `resourcePath = gameDir`, então cada modpack tem
mods/saves próprios mas reaproveita assets/libraries. `<slug>` vem do nome do modpack
(`slugify`). Também expõe `getForgeVersions`, `getInstalledForge`, `killGame`.

### `updater.js` — sincronização do modpack
Lê o `manifest.json` e baixa só o que mudou (compara hash local vs manifest).
- `hashFile(path, algo)` — `sha256` (arquivos do repo) ou `sha512` (mods de CDN), detectado pela chave da entrada.
- `sweep(root)` — remove arquivos das `managed_dirs` que não estão no manifest; **ignora
  entradas começando com `.`** (ex: `.connector`, dados de runtime) e **nunca** apaga diretórios.

### `auth.js`
Login Microsoft (OAuth em janela) e offline (UUID derivado do nick). `ensureValidToken(uuid)`
renova o token MS expirado antes do launch. Contas persistidas em `userData`.

---

## Renderer (`src/`)

```
src/
├── App.jsx                  shell + roteamento de telas (login ↔ home)
├── components/
│   ├── Login / AccountSelector       login MS/offline, troca de conta
│   ├── Home                          abas BASE · Transmissões · Terminal
│   ├── PlaySign                      botão JOGAR (letreiro: viga fixa + placa que balança)
│   ├── RamSlider                     manômetro de RAM + valor exato (popover via portal)
│   ├── ForgeSelector                 seletor de versão / indicador do modpack
│   ├── Slideshow / NewsPanel         banners e transmissões (da config remota)
│   ├── SystemBar / StatusBar / TitleBar / WindowControls   chrome da janela frameless
│   └── McDecor / Splash / SocialLinks
└── styles/global.css        tokens de tema (cores, fontes, biseis)
```

---

## Estrutura do projeto

```
.
├── electron/                main + preload (Node)
├── src/                     React (renderer)
├── assets/                  texturas, ícones, arte (copiado pro app)
├── scripts/                 dev.mjs (dev server) + scripts de teste
├── ferramentas/             gerar-manifest.ps1 (gera o manifest do modpack)
├── launcher-config.json     bootstrap embutido (fallback + config_url)
├── electron.vite.config.js  build dos 3 alvos
├── package.json             scripts + config do electron-builder
└── dist-app/                saída do build (instalador) — gitignored
```

---

## Desenvolvimento

```bash
npm install
npm run dev      # electron-vite dev + HMR (renderer em http://localhost:5173)
npm run build    # electron-vite build && electron-builder → dist-app/
```

`npm run dev` usa `scripts/dev.mjs` (gerencia a porta 5173 e sobe Vite + Electron).

### Saída do build
`electron-vite` gera `dist/` (renderer) e `dist-electron/{main,preload}/`; `electron-builder`
empacota em **`dist-app/MC Launcher Setup <versão>.exe`** (NSIS, x64). `extraResources` copia
`launcher-config.json` e `assets/` para `resources/` do app instalado.

---

## Notas de build / gotchas

- **`undici` precisa ficar externo** (não bundlar). Se o Rollup empacota, quebra o
  `require('node:sqlite')` lazy do `SqliteCacheStore` → `No such built-in module: node:sqlite`
  no Electron (Node 20 não tem `node:sqlite`). Ver `EXTERNALS` em `electron.vite.config.js`.
- **Java 17** é necessário para rodar MC 1.20.1. Se `JAVA_HOME` apontar para outra versão, o
  launch pode falhar — o launcher procura um Java 17 válido.
- **`winCodeSign` / symlink:** na primeira build o `electron-builder` extrai o `winCodeSign`,
  que cria symlink — pode exigir **Modo de Desenvolvedor** do Windows (ou admin).
- **Sem assinatura de código:** o `.exe` não é assinado → o SmartScreen pode avisar na 1ª
  execução ("Mais informações" → "Executar assim mesmo").
- **Ícone:** ainda usa o ícone padrão do Electron (definir `build.win.icon` para customizar).

---

## Dados em runtime (máquina do usuário)

```
%APPDATA%/minecraft-custom-launcher/
├── cached-config.json   última config remota baixada
├── settings.json        preferências (RAM, conta ativa, Forge)
└── minecraft/           assets/libraries/versions + instances/<modpack>/
```

---

## Repositórios

| Repo | Papel |
|---|---|
| `minecraft-custom-launcher` (este) | Código do launcher |
| `launcherz` | Conteúdo: `launcher-config.json`, `manifest.json`, `banners/`, `config/`, `kubejs/` |

`config_url` e `modpack.manifest_url` (no `launcher-config.json`) apontam para o `launcherz`
via `raw.githubusercontent.com`.
