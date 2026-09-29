# 🚀 Gerador de QR Code Offline - Instalação no Windows 11

Este aplicativo pode ser instalado como um **programa executável** no Windows 11! Ele funcionará 100% offline, terá ícone na área de trabalho e abrirá em janela própria.

---

## 📥 Como Instalar como App (Executável)

### Método 1: Microsoft Edge (Recomendado)

1. **Abra o aplicativo** no Microsoft Edge
2. Clique no ícone **"..."** (três pontos) no canto superior direito
3. Vá em **"Apps"**
4. Clique em **"Instalar este site como aplicativo"**
5. Confirme clicando em **"Instalar"**
6. ✅ Pronto! O app aparecerá no Menu Iniciar e na Área de Trabalho

### Método 2: Google Chrome

1. **Abra o aplicativo** no Google Chrome
2. Procure o **ícone de instalação** (⊕) na barra de endereço
   - Se não aparecer, clique nos **"..."** → **"Salvar e compartilhar"** → **"Instalar página como aplicativo"**
3. Clique em **"Instalar"**
4. ✅ Pronto! O app será instalado como programa

### Método 3: Botão de Instalação Automática

1. **Abra o aplicativo** no navegador
2. Se disponível, aparecerá um botão **"Instalar App"** no topo da página
3. Clique no botão
4. Confirme a instalação
5. ✅ Pronto!

---

## ✅ Após a Instalação

- **Ícone na Área de Trabalho:** O app terá um ícone roxo com QR Code
- **Menu Iniciar:** Aparecerá na lista de aplicativos
- **Janela Própria:** Abre em janela independente, sem barra de endereço
- **100% Offline:** Funciona sem internet após a primeira abertura
- **Sem Navegador:** Não precisa abrir o navegador para usar

---

## 🔧 Como Usar

### Gerar QR Code
1. **Cole ou digite** qualquer conteúdo na caixa de texto
   - Texto simples
   - URLs/Links
   - Senhas
   - E-mails
   - Telefones
   - Wi-Fi
   - Qualquer caractere

2. **Ajuste as configurações:**
   - **Correção de Erro:** L (7%), M (15%), Q (25%), H (30%)
   - **Tamanho:** De 100px a 800px
   - **Margem:** De 0 a 10 módulos
   - **Cores:** Personalize as cores do QR Code

3. **Baixe ou copie:**
   - Download em PNG ou SVG
   - Copiar imagem para área de transferência

### Modelos Prontos
- 🔗 URL/Link
- 📶 Wi-Fi
- 📧 E-mail
- 📱 Telefone
- 👤 Contato (vCard)
- 💬 SMS

---

## 💾 Como Salvar os Arquivos para Uso Offline

### Opção 1: Hospedar Localmente (Recomendado)

1. Baixe todos os arquivos do projeto
2. Coloque em uma pasta (ex: `C:\QRCodeApp`)
3. Use um servidor local simples:
   ```bash
   # Se tiver Python instalado:
   cd C:\QRCodeApp
   python -m http.server 8000
   ```
4. Acesse: `http://localhost:8000`
5. Instale como app usando um dos métodos acima

### Opção 2: Abrir Diretamente

1. Abra o arquivo `dist/index.html` diretamente no navegador
2. Instale como app
3. Funcionará offline após a primeira abertura

---

## 🔒 Privacidade e Segurança

- ✅ **100% Offline:** Nenhum dado é enviado para servidores
- ✅ **Processamento Local:** Tudo é gerado no seu computador
- ✅ **Sem Rastreamento:** Sem cookies, analytics ou telemetria
- ✅ **Sem Internet:** Funciona completamente offline após instalação
- ✅ **Código Aberto:** Todo o código é visível e auditável

---

## 🎯 Recursos

- ✅ Geração de QR Code em tempo real
- ✅ Suporte a qualquer caractere (texto, links, senhas, etc.)
- ✅ 4 níveis de correção de erro (L, M, Q, H)
- ✅ Tamanho ajustável (100px - 800px)
- ✅ Margem configurável
- ✅ Cores personalizáveis
- ✅ 8 temas de cores prontos
- ✅ Modelos prontos (Wi-Fi, vCard, SMS, etc.)
- ✅ Download em PNG e SVG
- ✅ Copiar imagem para área de transferência
- ✅ Histórico de QR Codes gerados
- ✅ Funciona 100% offline
- ✅ Instalável como app no Windows 11

---

## 🛠️ Requisitos

- **Navegador:** Microsoft Edge, Google Chrome ou qualquer navegador moderno
- **Sistema:** Windows 10/11
- **Internet:** Necessária apenas na primeira vez (depois funciona offline)

---

## 📝 Notas Importantes

1. **Primeira Abertura:** Precisa de internet para carregar o app pela primeira vez
2. **Cache:** Após a primeira abertura, tudo é armazenado em cache local
3. **Atualizações:** Se houver atualizações, o app baixará automaticamente quando online
4. **Desinstalar:** No app instalado, clique nos "..." → "Desinstalar"

---

## 🆘 Solução de Problemas

### O botão de instalação não aparece?
- Certifique-se de estar usando Edge ou Chrome
- Verifique se o app já não está instalado
- Tente limpar o cache do navegador

### O app não funciona offline?
- Acesse o app pelo menos uma vez com internet
- Verifique se o Service Worker foi registrado (F12 → Application → Service Workers)

### Como desinstalar?
- No app instalado: clique nos "..." no canto superior → "Desinstalar"
- Ou: Configurações do Windows → Apps → Encontre o app → Desinstalar

---

## 📄 Licença

Este projeto é livre para uso pessoal e comercial.

---

**Desenvolvido com ❤️ para funcionar 100% offline no Windows 11**
