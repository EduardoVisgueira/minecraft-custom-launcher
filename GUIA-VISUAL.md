# 🎨 Guia visual — onde mexer em cada coisa

Mapa de tudo que aparece na tela: **o que é**, **onde mexer pra mover/mudar** e **o que dá pra apagar**.

> **Como editar ao vivo:** com `npm run dev` rodando → **F12** no launcher pra experimentar (temporário) → salva no arquivo (VS Code) pra valer. Só funciona em dev; o `.exe` final precisa de `npm run build`.
>
> **Dica:** quase tudo de posição é `transform: translateY(Xpx)` (sobe/desce), `translateX(Xpx)` (lados) ou `margin`/`padding`. Número maior = mais pra baixo/direita.

---

## 🟩 Barra do topo — `src/components/SystemBar.css` (+ `.jsx`)
| Elemento | Classe | Mexer / Apagar |
|---|---|---|
| Status "SISTEMA ONLINE · hora · operador" | `.sysbar-status` | Texto vem do `.jsx`. Apagar item = remover no `SystemBar.jsx`. |
| Relógio | (no `.jsx`, `useClock`) | Pra tirar: remover `{clock}` no `SystemBar.jsx`. |
| Botões minimizar/fechar | `WindowControls` | **Não apagar** (controlam a janela). |

## 🗂️ Abas (BASE / TRANSMISSÕES / TERMINAL / LOJA) — `Home.css`
| Elemento | Classe | Mexer / Apagar |
|---|---|---|
| A barra de abas | `.tab-nav` | Altura: `.tab-nav-inner { height }`. |
| Cada aba | `.tab-btn` | Cor/tamanho do texto aqui. |
| Ícones sociais (Discord/YouTube) | `.tab-nav-socials .social-btn` | Apagar = some o botão (config controla o link). |

---

## 🏠 Aba BASE (tela principal) — `src/components/Home.css`

### Fundo (slideshow)
| Elemento | Classe | Mexer / Apagar |
|---|---|---|
| Imagens que passam | `.base-bg` | As imagens vêm do GitHub (`slideshow_images`). |
| Escurecimento por cima | `.base-bg-overlay` | **Mais claro** = baixar os valores de `rgba(...,0.X)`. |
| Grade enferrujada nas laterais | `.base-bg-grate` | 🗑️ **Pode apagar** (decorativo). |
| Barras de quarentena (direita) | `.base-bg-bars` | 🗑️ **Pode apagar** (decorativo). |
| Correntes penduradas no topo | `.base-chains` | 🗑️ **Pode apagar** (decorativo). |

### Posição da fileira central (os 3 blocos)
| O que | Classe | Como mover |
|---|---|---|
| **Descer/subir os 3 blocos juntos** | `.base-screen` | `padding-top` (maior = mais pra baixo). Já está alto pra mostrar o banner. |
| Alinhamento vertical | `.base-screen` | `align-items: end` (embaixo) / `center` (meio). |
| Espaço entre as 3 colunas | `.base-screen` | `gap`. |

### Bloco da ESQUERDA (modpack)
| Elemento | Classe | Mexer / Apagar |
|---|---|---|
| "● Zona de Quarentena · Setor Ativo" | `.readout-eyebrow` | Texto no `.jsx`. |
| A bolinha que pisca | `.readout-dot` | 🗑️ Pode apagar (é só enfeite que pisca). |
| Título "ZONA MORTA" | `.base-modpack-name` | Tamanho/fonte aqui. (nome vem do config) |
| Chip do modpack/Forge | `.base-badge--accent` | É o **seletor**. Cor/tamanho aqui. |
| Tag de versão (v2.4) | `.base-badge` | — |
| Selo ✓ Instalado / ⚠ Atualizar | `.base-badge--ok` / `.base-badge--warn` | Cores aqui. |

### Centro (LETREIRO = botão JOGAR)
| O que | Classe (arquivo) | Como mover |
|---|---|---|
| **Descer/subir só o letreiro** | `.vault-stage` → `transform: translateY(...)` | Maior = mais pra baixo. |
| Tamanho do letreiro | `.play-sign { width }` (em `Home.css`) | — |
| Texto "ENTRAR NA ZONA" | `.play-sign-text` / `.play-sign-line` | Cor/tamanho. (a arte é `PlaySign.jsx`) |
| Legenda "ZONA MORTA · v2.4" | `.mc-play-sub` | 🗑️ Pode apagar. |

### Bloco da DIREITA (RAM)
| Elemento | Classe | Mexer / Apagar |
|---|---|---|
| "● Recursos do Abrigo · Unidade 01" | `.readout-eyebrow` (2ª) | Texto no `.jsx`. |
| Painel da memória | `.base-dial` | Caixa do RAM. |
| Manômetro (relógio) | `.ram-gauge` | 🗑️ Pode apagar (decorativo). |
| Slider de RAM | `RamSlider` | **Não apagar** (controla a memória). |
| Botão Sincronizar/Atualizar | `.btn-update` | Cor/posição aqui. |

---

## 🎨 Cores e fontes — `src/styles/global.css`
| O que | Variável |
|---|---|
| Cor de destaque (verde) | `--accent` (`#84cc16`) — muda o tema todo |
| Fonte dos títulos | `--font-display` |
| Fonte pixel (letreiro) | `'Silkscreen'` (importada no topo do `Home.css`) |

---

## ⚠️ Regras de ouro
- **🗑️ "Pode apagar"** = some sem quebrar nada (é enfeite).
- **Não apagar:** `RamSlider`, `WindowControls`, `.base-badge--accent` (seletor), o `PlaySign` (botão jogar).
- **Conteúdo** (nome, imagens, notícias, versão) **NÃO** fica aqui — fica no GitHub (`launcherz`), e atualiza sem reinstalar.
- Mexeu e quebrou? `Ctrl+Z` no VS Code, ou me chama que eu reverto.
