# MC Launcher

Launcher personalizado de Minecraft com suporte a Forge, contas Premium e Offline, auto-updater de modpack e menu in-game customizado.

## Funcionalidades

- **Contas duplas** — Login Microsoft (Premium) e conta Offline
- **Forge configurável** — versão definida no `launcher-config.json`, sem tocar no código
- **Auto-updater** — sincroniza o modpack via manifest HTTP (só baixa o que mudou)
- **Slideshow** — loop de imagens tanto no launcher quanto no menu in-game (FancyMenu)
- **RAM configurável** — slider com presets de 1GB a 16GB
- **Feed de notícias** — gerenciado diretamente no `launcher-config.json`
- **Links sociais** — Discord, YouTube e loja configuráveis
- **Sem Singleplayer** — botão removido do menu in-game via FancyMenu config pack
- **Open Source** — MIT License

## Configuração

Edite o arquivo **`launcher-config.json`** na raiz do projeto:

```json
{
  "launcher_name": "Nome do Launcher",
  "forge_version": "1.20.1-47.4.10",
  "slideshow_images": ["assets/slideshow/bg1.png"],
  "social_links": {
    "discord": "https://discord.gg/...",
    "youtube": "https://youtube.com/..."
  },
  "store_url": "https://...",
  "modpack": {
    "manifest_url": "https://seu-servidor.com/manifest.json"
  }
}
```

### Formato do manifest.json (auto-updater)

Hospede este arquivo no seu servidor:

```json
{
  "version": "1.0.0",
  "managed_dirs": ["mods", "config"],
  "files": [
    {
      "path": "mods/exemplo.jar",
      "url": "https://seu-servidor.com/mods/exemplo.jar",
      "sha256": "abc123..."
    }
  ]
}
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Gerar build Windows (.exe)
npm run build
```

## Menu in-game (FancyMenu)

O diretório `fancymenu-config/` contém o config pack para o FancyMenu. Leia o `README.txt` dentro dele para instruções de instalação.

## Licença

MIT
