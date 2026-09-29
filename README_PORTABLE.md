# 🚀 Gerador de QR Code Offline - Versão Portable (EXE)

<div align="center">

![Portable App](https://img.shields.io/badge/Portable-EXE-green?style=for-the-badge)
![Windows 11](https://img.shields.io/badge/Windows_11-Compatible-blue?style=for-the-badge)
![Offline](https://img.shields.io/badge/100%25-Offline-purple?style=for-the-badge)

**Aplicativo executável portátil para Windows - Sem instalação necessária!**

</div>

---

## 📦 O que é isso?

Um **aplicativo executável (.exe)** que funciona como um programa normal do Windows. Você pode:
- ✅ Copiar para um pendrive e usar em qualquer computador
- ✅ Executar sem instalação
- ✅ Usar 100% offline
- ✅ Ter ícone na área de trabalho
- ✅ Abrir em janela própria

---

## 🎯 Como Criar o Executável Portable

### Pré-requisitos

Antes de criar o executável, você precisa ter instalado:

1. **Node.js** (versão 16 ou superior)
   - Download: https://nodejs.org/
   - Escolha a versão LTS (recomendada)

2. **Git** (opcional, para clonar o projeto)
   - Download: https://git-scm.com/

### Passo a Passo

#### Método 1: Script Automático (Recomendado)

1. **Extraia todos os arquivos** do projeto para uma pasta
2. **Clique duas vezes** no arquivo `criar-executavel.bat`
3. **Aguarde** o processo de compilação (pode levar 2-5 minutos)
4. **Pronto!** O executável estará na pasta `release/`

#### Método 2: Manual (Linha de Comando)

Abra o **Prompt de Comando** ou **PowerShell** na pasta do projeto e execute:

```bash
# 1. Instalar dependências
npm install

# 2. Compilar a aplicação
npm run build

# 3. Gerar o executável portable
npx electron-builder --win portable
```

O executável será criado em: `release/Gerador QR Code Offline-Portable.exe`

---

## 💻 Como Usar o Executável

### Executar
1. **Localize** o arquivo `Gerador QR Code Offline-Portable.exe` na pasta `release/`
2. **Clique duas vezes** para executar
3. **Pronto!** O aplicativo abrirá em uma janela própria

### Usar como Portable
- **Copie** o arquivo `.exe` para um pendrive
- **Execute** em qualquer computador com Windows
- **Não precisa instalar** nada!

### Criar Atalho na Área de Trabalho
1. **Clique com o botão direito** no arquivo `.exe`
2. Selecione **"Enviar para"** → **"Área de trabalho (criar atalho)"**
3. Pronto! Agora você tem um atalho na área de trabalho

---

## 🎨 Funcionalidades

### Geração de QR Code
- ✅ Qualquer caractere (texto, links, senhas, emojis, etc.)
- ✅ Geração em tempo real
- ✅ Preview instantâneo

### Correção de Erro
- **L (Baixa)** - Recupera ~7% dos dados
- **M (Média)** - Recupera ~15% dos dados (padrão)
- **Q (Quartil)** - Recupera ~25% dos dados
- **H (Alta)** - Recupera ~30% dos dados

### Personalização
- 📏 Tamanho: 100px a 800px
- 📐 Margem: 0 a 10 módulos
- 🎨 Cores personalizáveis (QR e fundo)
- 🎭 8 temas de cores prontos

### Modelos Prontos
- 🔗 URL/Link
- 📶 Wi-Fi (com senha)
- 📧 E-mail
- 📱 Telefone
- 👤 Contato (vCard)
- 💬 SMS

### Exportação
- 💾 Download em PNG
- 💾 Download em SVG (vetorial)
- 📋 Copiar imagem para área de transferência

### Histórico
- 📜 Últimos 20 QR Codes gerados
- ⚡ Recarregar configurações anteriores
- 🗑️ Limpar histórico

---

## 🔒 Privacidade e Segurança

### ✅ O que este app faz:
- Processa tudo localmente no seu computador
- Gera QR Codes usando JavaScript puro
- Armazena histórico apenas na memória da sessão
- Funciona 100% offline

### ❌ O que este app NÃO faz:
- ❌ Não envia dados para servidores
- ❌ Não coleta informações pessoais
- ❌ Não usa cookies de rastreamento
- ❌ Não precisa de internet para funcionar
- ❌ Não tem analytics ou telemetria

---

## 🛠️ Desenvolvimento

### Estrutura do Projeto

```
├── electron/
│   └── main.js           # Processo principal do Electron
├── src/
│   ├── App.tsx           # Componente principal React
│   ├── main.tsx          # Entry point
│   └── index.css         # Estilos globais
├── public/
│   ├── icon.svg          # Ícone do app
│   ├── manifest.json     # PWA manifest
│   └── sw.js            # Service Worker
├── dist/                 # Build do React (gerado)
├── release/             # Executável gerado (após build)
├── criar-executavel.bat # Script para criar .exe
├── rodar-app.bat        # Script para rodar em dev
├── electron-builder.json # Config do electron-builder
└── package.json         # Dependências
```

### Comandos Disponíveis

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (React)
npm run dev

# Rodar em modo desenvolvimento (Electron + React)
npm run electron-dev

# Compilar para produção
npm run build

# Gerar executável portable
npm run dist:win

# Gerar executável portable (comando direto)
npx electron-builder --win portable
```

---

## 📝 Notas Importantes

### Tamanho do Executável
- O executável terá aproximadamente **80-120 MB**
- Isso é normal para apps Electron (inclui o Chromium)
- O app é comprimido e otimizado

### Primeiro Uso
- O app pode demorar alguns segundos para abrir na primeira vez
- Isso é normal, pois está descompactando recursos
- Nas próximas vezes, abrirá mais rápido

### Antivírus
- Alguns antivírus podem alertar sobre o .exe
- Isso é normal para apps Electron não assinados
- Você pode adicionar uma exceção no antivírus
- Ou assinar o executável com um certificado digital

### Atualizações
- Para atualizar, gere um novo executável
- Substitua o arquivo .exe antigo
- Não há atualização automática em apps portable

---

## 🆘 Solução de Problemas

### O script `criar-executavel.bat` não funciona?
- Verifique se o Node.js está instalado: `node --version`
- Execute o Prompt de Comando como Administrador
- Verifique se há espaço em disco suficiente

### O executável não abre?
- Verifique se o Windows SmartScreen está bloqueando
  - Clique em "Mais informações" → "Executar mesmo assim"
- Tente executar como Administrador
- Verifique se o antivírus não está bloqueando

### O app está lento?
- Feche outros aplicativos pesados
- Verifique se há atualizações do Windows
- O app usa mais RAM que apps nativos (normal para Electron)

### Como reduzir o tamanho do executável?
- Edite `electron-builder.json` e mude `"compression": "maximum"`
- Remova recursos não utilizados do código
- Use UPX para comprimir o executável (avançado)

---

## 📦 Distribuição

### Como Distribuir o App

1. **Gere o executável** usando o script `criar-executavel.bat`
2. **Teste** o executável em diferentes computadores
3. **Distribua** o arquivo `.exe` como quiser:
   - Por e-mail
   - Por pendrive
   - Por download na web
   - Por rede local

### Assinar o Executável (Opcional)

Para evitar avisos do Windows SmartScreen:

1. Compre um certificado digital de código
2. Use o comando:
```bash
signtool sign /f certificado.pfx /p senha /tr http://timestamp.digicert.com /td sha256 /fd sha256 "Gerador QR Code Offline-Portable.exe"
```

---

## 🎯 Casos de Uso

### Para Empresas
- Distribuir para funcionários sem necessidade de instalação
- Usar em computadores corporativos sem permissão de administrador
- Colocar em pendrives para uso em diferentes máquinas

### Para Eventos
- Criar QR Codes para Wi-Fi do evento
- Gerar QR Codes de contato para palestrantes
- Distribuir em pendrives para participantes

### Para Uso Pessoal
- Ter sempre disponível em um pendrive
- Usar em computadores de amigos/família
- Não precisar instalar nada no computador

---

## 📄 Licença

Este projeto é livre para uso pessoal e comercial.

---

## 🤝 Suporte

Para dúvidas ou problemas:
1. Verifique se o Node.js está instalado corretamente
2. Consulte a seção de [Solução de Problemas](#-solução-de-problemas)
3. Verifique os logs no console do Electron (F12)

---

<div align="center">

**Feito com ❤️ para funcionar como executável portable no Windows**

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
