# Guia do Servidor — hospedar o launcher no GitHub (grátis)

Este é o conteúdo que vai no **seu repositório GitHub**. Com ele, você controla o
launcher de todos os jogadores **sem reinstalar nada** neles: muda banner, novidade,
versão do modpack — e todos recebem na próxima vez que abrem o launcher.

```
SEU_REPO/
├─ launcher-config.json     ← o "painel de controle" (nome, banners, links, versão)
├─ banners/                 ← imagens de fundo do launcher
└─ modpack/
   ├─ gerar-manifest.ps1    ← script que cria o manifest (você roda no Windows)
   ├─ manifest.json         ← gerado pelo script (lista os mods)
   ├─ mods/                 ← os .jar do seu modpack
   └─ config/               ← as configs do seu modpack
```

---

## 1. Criar o repositório (uma vez só)

1. Crie uma conta no [github.com](https://github.com) (grátis).
2. Crie um repositório **público** (ex.: `meu-launcher`).
3. Suba o conteúdo desta pasta (`launcher-config.json`, `banners/`, `modpack/`).

> A URL "raw" dos seus arquivos fica assim:
> `https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/<arquivo>`
> Troque `SEU_USUARIO` e `SEU_REPO` nos arquivos pelo seu usuário e repositório reais.

## 2. Conectar o launcher ao seu repositório (uma vez só)

No `launcher-config.json` **embutido no launcher** (o que o Eduardo te entrega), o
campo `config_url` deve apontar para o seu repositório:
```json
"config_url": "https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/launcher-config.json"
```
Pronto — a partir daí o launcher sempre lê deste arquivo online.

## 3. Personalizar (nome, links, banners, novidades)

Edite o `launcher-config.json` deste repositório:
- `launcher_name`, `login_title`, `play_button_label` — textos
- `social_links` (discord, youtube, etc.) e `store_url` — seus links reais
- `slideshow_images` — URLs dos banners (suba as imagens em `banners/`)
- `news` — suas novidades
- `theme.accent_color` — cor do tema

Salvou e subiu (commit)? **Todos os jogadores veem na próxima abertura.**

## 4. Adicionar / atualizar o MODPACK

1. Coloque os mods em `modpack/mods/` e as configs em `modpack/config/`.
2. Na pasta `modpack/`, clique com o direito em **`gerar-manifest.ps1` → "Executar com PowerShell"**.
   - Ele pede a URL base. Cole:
     `https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/modpack`
   - Ele cria o `manifest.json` automaticamente (lista todos os mods + verificação de integridade).
3. Suba (commit) as pastas `mods/`, `config/` e o `manifest.json` no GitHub.
4. **Importante:** no `launcher-config.json`, aumente o número da versão:
   ```json
   "modpack": { "version": "1.0.1", ... }
   ```
   É isso que faz o botão **"Atualizar"** acender pros jogadores. Ao clicar, eles
   baixam só o que mudou.

## 5. Resumo do dia a dia

| Você quer... | O que fazer |
|--------------|-------------|
| Trocar um banner | Suba a nova imagem em `banners/` e ajuste `slideshow_images` |
| Postar novidade | Adicione um item em `news` |
| Lançar update de mods | Atualize `mods/`, rode o `gerar-manifest.ps1`, suba tudo, **aumente `modpack.version`** |
| Mudar Discord/loja | Edite `social_links` / `store_url` |

> ⚠️ Tudo precisa ser **https** (o GitHub raw já é). O launcher rejeita `http://` por segurança.
> Se o GitHub estiver fora do ar ou o jogador offline, o launcher abre com a última
> versão que ele já tinha — **nunca trava**.
