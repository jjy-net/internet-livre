# 🎯 Gerador de QR Code Offline

<div align="center">

![QR Code Generator](https://img.shields.io/badge/QR_Code-Generator-purple?style=for-the-badge)
![Offline](https://img.shields.io/badge/100%25-Offline-green?style=for-the-badge)
![Windows 11](https://img.shields.io/badge/Windows_11-Compatível-blue?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Instalável-orange?style=for-the-badge)

**Gerador de QR Code que funciona 100% offline, instalável como app no Windows 11**

[Instalar no Windows 11](#-como-instalar-no-windows-11) • [Recursos](#-recursos) • [Como Usar](#-como-usar)

</div>

---

## 🚀 O que é isso?

Um **aplicativo web progressivo (PWA)** que gera QR Codes e pode ser **instalado como um programa executável** no Windows 11. Funciona 100% offline, sem enviar dados para servidores, com ícone na área de trabalho e janela própria.

### ✨ Características Principais

- 📱 **Instalável como App** no Windows 11 (Edge/Chrome)
- 🔒 **100% Offline** - Nenhum dado sai do seu computador
- 🎨 **Personalizável** - Cores, tamanho, margem, correção de erro
- 📋 **Cole Qualquer Coisa** - Texto, links, senhas, Wi-Fi, contatos
- 💾 **Download** em PNG ou SVG
- 📜 **Histórico** dos últimos QR Codes gerados
- ⚡ **Tempo Real** - Gera automaticamente enquanto digita

---

## 💻 Como Instalar no Windows 11

### Método 1: Microsoft Edge (Recomendado)

1. Abra o app no **Microsoft Edge**
2. Clique nos **"..."** (três pontos) no canto superior direito
3. Vá em **"Apps"** → **"Instalar este site como aplicativo"**
4. Confirme clicando em **"Instalar"**
5. ✅ Pronto! O app aparecerá no Menu Iniciar e na Área de Trabalho

### Método 2: Google Chrome

1. Abra o app no **Google Chrome**
2. Clique no **ícone de instalação** (⊕) na barra de endereço
3. Clique em **"Instalar"**
4. ✅ Pronto!

### Método 3: Botão Automático

1. Abra o app no navegador
2. Se disponível, clique no botão **"Instalar App"** no topo da página
3. Confirme a instalação
4. ✅ Pronto!

📖 **Instruções detalhadas:** Veja o arquivo [INSTRUCOES_INSTALACAO.md](INSTRUCOES_INSTALACAO.md)

---

## 🎯 Recursos

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

## 🛠️ Como Usar

### Uso Básico

1. **Cole ou digite** o conteúdo na caixa de texto
   - Use `Ctrl+V` para colar rapidamente
   - Ou clique em "Colar da Área de Transferência"

2. **O QR Code é gerado automaticamente** enquanto você digita

3. **Ajuste as configurações** se necessário:
   - Correção de erro
   - Tamanho
   - Margem
   - Cores

4. **Baixe ou copie** o QR Code:
   - Clique em "Baixar PNG" ou "Baixar SVG"
   - Ou "Copiar Imagem" para colar em outro lugar

### Exemplos de Uso

#### Wi-Fi
```
WIFI:T:WPA;S:NomeDaRede;P:SenhaDaRede;;
```

#### E-mail
```
mailto:email@exemplo.com
```

#### Telefone
```
tel:+5511999999999
```

#### Contato Completo (vCard)
```
BEGIN:VCARD
VERSION:3.0
FN:João Silva
TEL:+5511999999999
EMAIL:joao@exemplo.com
ORG:Empresa
TITLE:Desenvolvedor
END:VCARD
```

---

## 🔒 Privacidade e Segurança

### ✅ O que este app faz:
- Processa tudo localmente no seu navegador
- Gera QR Codes usando JavaScript puro
- Armazena histórico apenas na memória da sessão
- Funciona 100% offline após a primeira abertura

### ❌ O que este app NÃO faz:
- ❌ Não envia dados para servidores
- ❌ Não coleta informações pessoais
- ❌ Não usa cookies de rastreamento
- ❌ Não precisa de internet para funcionar (após instalação)
- ❌ Não tem analytics ou telemetria

---

## 📦 Tecnologias

- **React** - Interface de usuário
- **TypeScript** - Tipagem estática
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **qrcode** - Geração de QR Code
- **Service Worker** - Cache offline
- **PWA** - Progressive Web App

---

## 🚀 Desenvolvimento

### Instalação

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd qr-code-generator

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev
```

### Build para Produção

```bash
# Gere os arquivos de produção
npm run build

# Os arquivos estarão em dist/
```

### Estrutura do Projeto

```
├── public/
│   ├── manifest.json    # PWA manifest
│   ├── sw.js           # Service Worker
│   └── icon.svg        # Ícone do app
├── src/
│   ├── App.tsx         # Componente principal
│   ├── main.tsx        # Entry point
│   └── index.css       # Estilos globais
├── index.html          # HTML principal
└── package.json        # Dependências
```

---

## 📝 Notas Importantes

### Primeira Abertura
- Precisa de internet na **primeira vez** para carregar o app
- Após isso, funciona **100% offline**

### Cache
- O Service Worker armazena todos os arquivos em cache
- Atualizações são baixadas automaticamente quando online

### Desinstalar
- No app instalado: clique nos "..." → "Desinstalar"
- Ou: Configurações do Windows → Apps → Desinstalar

### Compatibilidade
- ✅ Microsoft Edge (recomendado)
- ✅ Google Chrome
- ✅ Firefox (com limitações PWA)
- ✅ Qualquer navegador moderno

---

## 🆘 Solução de Problemas

### O botão de instalação não aparece?
- Use Microsoft Edge ou Google Chrome
- Verifique se o app já não está instalado
- Limpe o cache do navegador

### O app não funciona offline?
- Acesse o app pelo menos uma vez com internet
- Verifique se o Service Worker foi registrado (F12 → Application → Service Workers)

### Como atualizar?
- O app atualiza automaticamente quando online
- Ou baixe a versão mais recente e reinstale

---

## 📄 Licença

Este projeto é livre para uso pessoal e comercial.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novos recursos
- Melhorar a documentação
- Enviar pull requests

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique o arquivo [INSTRUCOES_INSTALACAO.md](INSTRUCOES_INSTALACAO.md)
2. Consulte a seção de [Solução de Problemas](#-solução-de-problemas)

---

<div align="center">

**Feito com ❤️ para funcionar 100% offline**

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
