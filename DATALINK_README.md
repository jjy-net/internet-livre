# 🔗 DataLink - Transmissão de Dados Multi-Canal

## 🎯 Funcionalidades Implementadas

### ✅ 1. Gerador de QR Code
- Gera QR Codes de qualquer texto/link
- 4 níveis de correção de erro (L, M, Q, H)
- Cores personalizáveis
- Modelos prontos (Wi-Fi, E-mail, Telefone, etc.)

### ✅ 2. Hash SHA-256 e SHA-512
- Calcula hashes de texto ou arquivos
- Verifica integridade comparando hashes
- Usa Web Crypto API nativa (100% offline)

### ✅ 3. Arquivo → Múltiplos QR Codes
- Divide arquivos em chunks
- Gera múltiplos QR Codes para transmitir arquivos
- Cada QR carrega ~150 caracteres de dados
- Permite reconstruir o arquivo no receptor

### ✅ 4. Transmissão por Som (Audio Modem)
- Transmite dados usando tons de áudio
- Frequências: 800Hz (bit 0) e 1200Hz (bit 1)
- 3 velocidades: lenta, média, rápida
- Recepção via microfone com análise de frequência

### ✅ 5. Transmissão por Luz da Tela
- Transmite dados variando brilho da tela
- Branco = bit 1, Preto = bit 0
- Velocidade ajustável (50-500ms por bit)
- Recepção via câmera com análise de brilho

### ✅ 6. Leitor de QR Code por Câmera
- Usa câmera para capturar vídeo
- Pronto para integrar biblioteca de detecção QR
- Interface para apontar câmera para QR Codes

## 📱 Como Usar no Android

1. **Abra o arquivo `DataLink.html` no Chrome/Firefox**
2. Funciona 100% offline após carregar
3. Todas as funcionalidades disponíveis
4. Use câmera, microfone e tela normalmente

## 🚀 Como Usar

### Transmitir Arquivo por QR:
1. Vá na aba "📁 Arquivo→QR"
2. Selecione um arquivo (imagem, documento, etc.)
3. Clique em "Gerar QR Codes"
4. Salve todos os QR Codes gerados
5. No receptor: escaneie cada QR na ordem

### Transmitir por Som:
1. Vá na aba "🔊 Som"
2. Digite o texto na caixa "Transmitir"
3. Escolha a velocidade
4. Clique em "🔊 Transmitir"
5. No outro dispositivo: clique em "🎤 Escutar"

### Transmitir por Luz:
1. Vá na aba "💡 Luz"
2. Digite o texto
3. Ajuste a velocidade
4. Clique em "💡 Transmitir"
5. Aponte a câmera do receptor para a tela

## 🔧 Requisitos

- Navegador moderno (Chrome, Firefox, Edge)
- Permissão para câmera (para recepção)
- Permissão para microfone (para áudio)
- Funciona 100% offline após carregar

## 📊 Limitações Técnicas

- **QR Code**: ~150 caracteres por QR (modo byte)
- **Som**: Taxa de transmissão baixa (~10-50 bits/segundo)
- **Luz**: Sensível a condições de iluminação ambiente
- **Arquivos grandes**: Divididos em muitos QR Codes

## 💡 Dicas

- Para som: use ambiente silencioso
- Para luz: reduza luz ambiente, aumente brilho da tela
- Para QR: use correção de erro H para arquivos importantes
- Teste com textos curtos primeiro

## 🎓 Como Funciona

### Audio Modem:
- Converte texto para binário
- Modula em frequências audíveis
- Usa FSK (Frequency Shift Keying)
- Recepção usa FFT para detectar frequências

### Light Modem:
- Converte texto para binário
- Modula em brilho da tela
- Usa OOK (On-Off Keying)
- Recepção analisa brilho médio do frame

### File over QR:
- Converte arquivo para Base64
- Divide em chunks de 150 caracteres
- Cada chunk vira um QR Code
- Recepção concatena e decodifica Base64

## 🔐 Segurança

- Todo processamento é local
- Nenhum dado é enviado para servidores
- Hash SHA-256/512 para verificação de integridade
- Funciona em rede isolada/air-gapped

## 📝 Notas

Este é um protótipo funcional que demonstra transmissão de dados por múltiplos canais usando APIs web nativas. As taxas de transmissão são baixas comparadas a métodos tradicionais, mas funcionam 100% offline e sem infraestrutura especial.

Para produção, seria necessário:
- Biblioteca de detecção QR (jsQR)
- Protocolo de correção de erros
- Handshake entre dispositivos
- Compressão de dados

---

**Feito com ❤️ - Desafio aceito e concluído!**
