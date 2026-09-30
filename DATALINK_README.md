# 🚀 DataLink - Transmissão Universal de Dados

## 📋 O que é?

DataLink é um programa completo que permite transmitir e receber dados de diversas formas:
- 🔲 **QR Code** - Gerar e escanear códigos QR
- 🔐 **Hash SHA256/SHA512** - Gerar e verificar integridade de arquivos
- 📤 **Transmissão por QR Code** - Enviar arquivos divididos em múltiplos QR codes
- 🔊 **Transmissão por Som** - Enviar dados via ondas sonoras (FSK)
- 💡 **Transmissão por Luz** - Enviar dados variando o brilho da tela
- 📷 **Recepção por Câmera** - Receber dados via câmera (QR, luz, vídeo)
- 🎤 **Recepção por Microfone** - Receber dados via som

## 🎯 Como Usar

### 1. Abrir o Programa

**No Windows:**
- Dê duplo clique em `Abrir-DataLink.bat`
- Ou abra `DataLink.html` diretamente no navegador

**No Android/Celular:**
- Copie o arquivo `DataLink.html` para o celular
- Abra com qualquer navegador (Chrome, Firefox, etc.)
- Funciona 100% offline!

### 2. Funcionalidades

#### 🔲 **Aba QR Code**
- Digite qualquer texto, link, senha, Wi-Fi, etc.
- Clique em "Gerar QR Code"
- Ajuste correção de erro (L, M, Q, H)
- Mude tamanho e cores
- Salve como PNG

**Modelos Prontos:**
- 🔗 Link (URL)
- 📶 Wi-Fi (com senha)
- 📧 E-mail
- 📱 Telefone
- 👤 Contato (vCard)
- 💬 SMS

#### 🔐 **Aba Hash**
- **Gerar Hash:** Digite texto ou selecione arquivo
- **SHA-256:** Hash de 64 caracteres
- **SHA-512:** Hash de 128 caracteres
- **Verificar:** Cole um hash e compare com o texto original
- **Verificar Arquivo:** Selecione um arquivo e compare com hash conhecido

**Exemplo de uso:**
1. Gere o hash SHA-256 de um arquivo importante
2. Envie o arquivo e o hash separadamente
3. No destino, verifique se o hash bate
4. Se bater = arquivo íntegro ✓
5. Se não bater = arquivo corrompido ✗

#### 📤 **Aba Transmitir**

**Transmitir por QR Code:**
1. Selecione um arquivo (imagem, música, vídeo, documento)
2. Clique em "Gerar QR Codes"
3. O arquivo é dividido em múltiplos QR codes
4. Cada QR code contém um pedaço do arquivo
5. O receptor escaneia todos os QR codes na ordem
6. O arquivo é reconstruído automaticamente

**Transmitir por Som:**
1. Selecione um arquivo
2. Clique em "Transmitir por Som"
3. O programa emite sons (modulação FSK)
4. O receptor usa o microfone para captar
5. Os dados são decodificados automaticamente

**Reproduzir Sequência:**
- Mostra um QR code por vez em loop
- Útil para transmitir para múltiplos receptores
- Ajustável via código (velocidade padrão: 1.5s por QR)

#### 📥 **Aba Receber**

**Receber por Câmera (QR Code):**
1. Clique em "Iniciar Câmera"
2. Aponte para os QR codes
3. O programa escaneia automaticamente
4. Reconstrói o arquivo quando todos os chunks são recebidos
5. Baixe o arquivo recebido

**Receber por Som:**
1. Clique em "Iniciar Microfone"
2. O programa escuta os sons transmitidos
3. Decodifica automaticamente (FSK)
4. Mostra os dados recebidos
5. Salve como arquivo

#### 💡 **Aba Luz**

**Transmitir por Luz:**
1. Selecione um arquivo
2. Clique em "Iniciar Transmissão"
3. A tela pisca em branco/preto (dados em binário)
4. O receptor usa a câmera para captar
5. Os dados são decodificados

**Receber por Luz:**
1. Clique em "Iniciar Câmera"
2. Aponte para a tela transmissora
3. O programa analisa as variações de brilho
4. Decodifica os dados automaticamente

#### 🔊 **Aba Som**

**Transmitir por Som (FSK):**
1. Digite texto para transmitir
2. Ajuste frequências (padrão: 800Hz e 1600Hz)
3. Ajuste duração por bit (padrão: 50ms)
4. Clique em "Transmitir"
5. O programa emite sons modulados

**Receber por Som:**
1. Clique em "Iniciar Escuta"
2. O programa analisa o áudio do microfone
3. Detecta as frequências (800Hz = 0, 1600Hz = 1)
4. Decodifica os bits automaticamente
5. Mostra o texto recebido
6. Salve como arquivo

## 📱 Como Usar no Android

### Método 1: Arquivo Local
1. Copie `DataLink.html` para o celular (USB, Bluetooth, e-mail)
2. Abra com Chrome, Firefox ou qualquer navegador
3. Funciona 100% offline!

### Método 2: Servidor Local (avançado)
1. No PC, abra um servidor HTTP na pasta do projeto:
   ```bash
   python -m http.server 8000
   ```
2. No celular (mesma rede WiFi), acesse:
   ```
   http://IP-DO-PC:8000/public/DataLink.html
   ```
3. Substitua `IP-DO-PC` pelo IP do seu computador

### Método 3: Hospedar Online
1. Faça upload do `DataLink.html` para qualquer hosting gratuito:
   - GitHub Pages
   - Netlify
   - Vercel
2. Acesse pelo celular via URL

## 🔧 Como Funciona Cada Tecnologia

### QR Code
- **Capacidade:** ~3KB por QR code (com correção L)
- **Transmissão de arquivos grandes:** Divide em múltiplos QR codes
- **Formato:** `DL:X/Y:dados` onde X=número do chunk, Y=total, dados=base64
- **Reconstrução:** Junta todos os chunks na ordem

### Som (FSK - Frequency Shift Keying)
- **Funcionamento:** Como um modem antigo
- **Frequência 800Hz:** Representa bit 0
- **Frequência 1600Hz:** Representa bit 1
- **Velocidade:** ~20 bits/segundo (ajustável)
- **Alcance:** Funciona em qualquer ambiente com som
- **Limitação:** Lento, mas funciona através de paredes!

### Luz
- **Funcionamento:** Tela pisca branco/preto
- **Branco:** Bit 1
- **Preto:** Bit 0
- **Velocidade:** ~10 bits/segundo (ajustável)
- **Recepção:** Câmera analisa brilho médio
- **Vantagem:** Silencioso, não incomoda

### Vídeo
- **Funcionamento:** Similar à luz, mas com padrões visuais
- **Transmissão:** Mostra QR codes em sequência no vídeo
- **Recepção:** Câmera escaneia QR codes do vídeo
- **Vantagem:** Alta capacidade (cada QR = ~3KB)

## 🎯 Casos de Uso

### 1. Transferir Arquivo entre Computadores (sem internet)
- **Cenário:** Dois PCs sem internet, apenas com som
- **Solução:** Use transmissão por som (FSK)
- **Velocidade:** ~20 bits/s (lento, mas funciona!)

### 2. Compartilhar Wi-Fi
- **Cenário:** Visitante quer conectar no Wi-Fi
- **Solução:** Gere QR code com modelo "Wi-Fi"
- **Resultado:** Visitante escaneia e conecta automaticamente

### 3. Verificar Integridade de Arquivo
- **Cenário:** Enviar arquivo importante por e-mail
- **Solução:** Gere hash SHA-256 do arquivo
- **Resultado:** Destinatário verifica se arquivo não foi corrompido

### 4. Transmitir Dados Silenciosamente
- **Cenário:** Ambiente silencioso (biblioteca, reunião)
- **Solução:** Use transmissão por luz
- **Resultado:** Dados transmitidos sem som

### 5. Backup de Arquivos via QR Code
- **Cenário:** Backup de texto pequeno (senhas, chaves)
- **Solução:** Gere QR code, imprima, guarde em local seguro
- **Resultado:** Backup físico, impossível de hackear

## ⚙️ Configurações Avançadas

### Correção de Erro (QR Code)
- **L (Low):** ~7% recuperação - Mais dados, menos proteção
- **M (Medium):** ~15% recuperação - Balanceado (padrão)
- **Q (Quartile):** ~25% recuperação - Mais proteção
- **H (High):** ~30% recuperação - Máxima proteção

### FSK (Som)
- **Frequência 0:** 800Hz (padrão)
- **Frequência 1:** 1600Hz (padrão)
- **Duração do bit:** 50ms (padrão)
- **Velocidade:** 1000ms / 50ms = 20 bits/s

### Luz
- **Velocidade:** 100ms por bit (padrão)
- **Brilho máximo:** #FFFFFF (branco)
- **Brilho mínimo:** #000000 (preto)

## 🐛 Solução de Problemas

### QR Code não gera
- **Problema:** Texto muito longo
- **Solução:** Use correção de erro L ou divida em partes

### Som não é recebido
- **Problema:** Microfone com ruído
- **Solução:** Aumente volume, aproxime dispositivos
- **Alternativa:** Use fones de ouvido para transmitir

### Luz não é recebida
- **Problema:** Ambiente muito claro
- **Solução:** Escureça o ambiente ou aproxime dispositivos
- **Alternativa:** Aumente contraste (branco mais branco, preto mais preto)

### Câmera não funciona
- **Problema:** Permissão negada
- **Solução:** Permita acesso à câmera no navegador
- **Alternativa:** Use transmissão manual (copiar/colar QR codes)

### Arquivo não reconstrói
- **Problema:** QR codes fora de ordem
- **Solução:** Escaneie na ordem correta (1/10, 2/10, 3/10...)
- **Alternativa:** Use transmissão por som ou luz

## 📊 Limitações

### QR Code
- **Máximo por QR:** ~3KB (com correção L)
- **Arquivos grandes:** Divididos em múltiplos QR codes
- **Velocidade:** Manual (escanear um por um)

### Som (FSK)
- **Velocidade:** ~20 bits/s (muito lento)
- **Arquivo de 1MB:** ~11 horas para transmitir
- **Recomendado:** Textos pequenos, configurações

### Luz
- **Velocidade:** ~10 bits/s (mais lento que som)
- **Arquivo de 1MB:** ~22 horas para transmitir
- **Recomendado:** Textos muito pequenos

### Vídeo
- **Velocidade:** Depende da taxa de frames
- **Arquivo de 1MB:** ~5 minutos (30 FPS, 3KB por QR)
- **Recomendado:** Arquivos até 10MB

## 🔒 Segurança

### Dados Transmitidos
- **QR Code:** Visível para qualquer pessoa
- **Som:** Audível para qualquer pessoa nearby
- **Luz:** Visível para qualquer pessoa nearby
- **Vídeo:** Visível para qualquer pessoa nearby

### Criptografia
- **Atual:** Nenhuma (dados em claro)
- **Recomendação:** Criptografe arquivos antes de transmitir
- **Sugestão:** Use 7-Zip com senha antes de transmitir

### Hash
- **SHA-256:** Seguro para verificação de integridade
- **SHA-512:** Mais seguro, mas mais longo
- **Uso:** Verificar se arquivo não foi alterado

## 🚀 Futuras Melhorias

- [ ] Criptografia AES antes de transmitir
- [ ] Compressão de dados (gzip)
- [ ] Protocolo de handshake (confirmação de recebimento)
- [ ] Transmissão bidirecional simultânea (full-duplex real)
- [ ] Suporte a Bluetooth/WiFi Direct
- [ ] App nativo Android/iOS
- [ ] Transmissão por ultrassom (inaudível)
- [ ] Transmissão por infravermelho
- [ ] QR codes animados (maior capacidade)

## 📝 Licença

Este projeto é livre para uso pessoal e comercial.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sugestões de melhorias:
- Otimização de velocidade
- Novos métodos de transmissão
- Melhorias na interface
- Documentação adicional

## 📞 Suporte

Para dúvidas ou problemas:
1. Leia este README completo
2. Verifique a seção de Solução de Problemas
3. Teste com arquivos pequenos primeiro
4. Ajuste as configurações conforme necessário

---

**DataLink - Transmita dados de qualquer forma, em qualquer lugar, sem internet!** 🚀
