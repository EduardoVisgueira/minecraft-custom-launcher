# Guia de Configuração — MC Launcher

**Tudo é configurado em UM arquivo: `launcher-config.json`.** Não precisa mexer em código.

> No launcher instalado (.exe), o arquivo fica em:
> `C:\Program Files\MC Launcher\resources\launcher-config.json`
> (e as imagens em `...\resources\assets\slideshow\`)
> Edite com o Bloco de Notas e salve. Reabra o launcher para ver as mudanças.

---

## 1. Nome e versão do modpack (o "Meu Modpack" e "v1.0.0")

```json
"modpack": {
  "name": "Meu Modpack",          ← aparece grande no topo (hero)
  "manifest_url": "https://...",  ← URL do auto-updater (ver seção 5)
  "version": "1.0.0"              ← aparece na badge "v1.0.0"
}
```
**Sim, é automático** — o launcher lê esses valores e mostra na tela. Basta editar aqui.

## 2. Versão do Forge

```json
"forge_version": "1.20.1-47.4.10"
```
Esse é o **padrão**. Mas o jogador também pode **clicar no badge do Forge** e escolher outra versão no seletor (busca embutida). Formato: `<minecraft>-<forge>`.

## 3. Imagens de fundo (slideshow)

1. Coloque os arquivos (`.jpg` ou `.png`) na pasta `assets/slideshow/`.
2. Liste-os aqui (na ordem do slideshow):
```json
"slideshow_images": [
  "assets/slideshow/mine1.jpg",
  "assets/slideshow/mine2.jpg",
  "assets/slideshow/mine3.png"
],
"slideshow_interval_ms": 5000     ← tempo de cada imagem (ms)
```
**Dica:** use nomes sem espaços (mine1.jpg, não "Mine 1.jpg"). Tamanhos diferentes funcionam — a imagem é ajustada automaticamente.

## 4. Novidades (aba "Novidades")

Cada item é um bloco. Adicione/edite quantos quiser:
```json
"news": [
  {
    "title": "Servidor atualizado!",
    "body": "Adicionamos 15 mods novos e corrigimos lag.",
    "date": "2026-06-08"
  },
  {
    "title": "Evento de fim de semana",
    "body": "Dobro de XP sábado e domingo.",
    "date": "2026-06-10"
  }
]
```

## 5. Loja, Discord, YouTube (links)

```json
"store_url": "https://sualoja.com",
"social_links": {
  "discord": "https://discord.gg/seulink",
  "youtube": "https://youtube.com/@seucanal"
}
```
- A **Loja** é apenas um **botão que abre o site no navegador** (como um anúncio que leva pra loja) — não é o site embutido dentro do launcher.
- Discord e YouTube funcionam igual (abrem no navegador).
- Deixe `""` (vazio) para esconder um botão.

## 6. RAM e cor do tema

```json
"ram": { "default_mb": 4096, "min_mb": 2048, "max_mb": 16384 },
"theme": { "accent_color": "#10b981", "background_overlay_opacity": 0.75 }
```
- `default_mb`: RAM inicial do slider. O máximo real é limitado pela RAM do PC do jogador.
- `accent_color`: cor de destaque (botões, badges). Aceita qualquer cor hex.

## 7. Textos e rótulos customizáveis

```json
"login_title": "Bem-vindo ao Meu Servidor",   ← título da tela de login
"login_subtitle": "Entre e venha jogar",       ← subtítulo da tela de login
"play_button_label": "JOGAR AGORA",            ← texto do botão de jogar
"store_label": "Loja VIP"                       ← texto do botão da Loja
```
Todos são **opcionais** — se ausentes, usam o texto padrão.

## 8. Aviso / MOTD (faixa no topo da Home)

Mostra uma faixa discreta e dispensável no topo (bom para "manutenção às 20h"):
```json
"announcement": {
  "text": "Manutenção hoje às 20h.",
  "type": "warning"        ← "info" (verde) ou "warning" (amarelo)
}
```
Deixe `"text": ""` (vazio) para esconder a faixa. O jogador pode fechá-la.

## 9. Links sociais expandidos

Agora aceita: `discord`, `youtube`, `twitter`, `instagram`, `tiktok`, `telegram`, `website`.
Só os preenchidos aparecem (cada um com seu ícone):
```json
"social_links": {
  "discord": "https://discord.gg/seulink",
  "twitter": "https://x.com/seuperfil",
  "tiktok": "https://tiktok.com/@seuperfil",
  "website": "https://seusite.com"
}
```

## 10. Logo customizado (opcional)

Além de `accent_color`, o tema aceita um logo remoto (https). Se ausente, usa o ícone padrão:
```json
"theme": {
  "accent_color": "#10b981",
  "background_overlay_opacity": 0.75,
  "logo_url": "https://exemplo.com/logo.png"
}
```

---

## 🌐 Launcher CONNECTED — atualize o conteúdo SEM reinstalar nos jogadores

Em vez de editar o `launcher-config.json` no PC de cada jogador, você pode hospedar
**um único arquivo de config na internet** e o launcher o busca toda vez que abre.
Assim, ao mudar nome, banners, novidades, avisos, etc., **todos veem na próxima abertura**.

### Como funciona
- O `launcher-config.json` embutido no app vira um **bootstrap**: contém `config_url`
  (a URL do config online) + todos os valores de **fallback** (usados offline).
- Ao abrir, o launcher mostra uma tela **"Sincronizando…"**, baixa o config de `config_url`
  e o guarda em cache. Se o servidor não responder em ~8s (ou estiver offline), ele **abre
  normalmente** com o último cache ou o bootstrap. **Nunca trava.**
- As camadas se mesclam assim: **bootstrap → config online → ajustes do jogador (RAM/Forge)**.

### Passo a passo
1. No `launcher-config.json` embutido, defina a URL:
   ```json
   "config_url": "https://exemplo.com/launcher-config.json"
   ```
   (Enquanto for `exemplo.com`, o launcher ignora e usa só o bootstrap — bom para testar offline.)
2. Crie o arquivo que ficará online (veja `launcher-config.remote.example.json`). Ele tem
   **os mesmos campos**, MENOS o `config_url`. Banners devem ser **URLs https://**.
3. Hospede o arquivo. Opções:
   - **GitHub (grátis):** crie um repositório, adicione o `launcher-config.json`, e use a URL
     **raw**: `https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/launcher-config.json`.
     Para atualizar, basta editar o arquivo no GitHub (commit).
   - **Seu próprio servidor/site:** suba o `.json` e use a URL pública (precisa ser **https**).
4. Pronto. Para publicar uma atualização, **edite o arquivo hospedado** — os jogadores
   recebem na próxima vez que abrirem o launcher.

> ⚠️ A `config_url` e todas as URLs de imagem/logo **precisam ser `https://`** (segurança).
> URLs `http://` são rejeitadas.

### Banners remotos
Em `slideshow_images`, você pode misturar caminhos locais (`assets/...`, só no bootstrap)
e **URLs https://** (recomendado no config online):
```json
"slideshow_images": [
  "https://exemplo.com/banners/banner1.jpg",
  "https://exemplo.com/banners/banner2.jpg"
]
```

---

## Auto-updater do modpack

O `manifest_url` aponta para um arquivo JSON hospedado no seu servidor, que lista os mods/configs do modpack com seus hashes SHA256. Quando o jogador clica em **Atualizar**, o launcher baixa só o que mudou. Enquanto `manifest_url` contiver `SEU_SERVIDOR`, o updater fica desativado (sem erro).
