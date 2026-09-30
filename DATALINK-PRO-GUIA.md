# 🔐 DataLink Pro - Guia Completo

## 🎯 Visão Geral

DataLink Pro é um sistema profissional de comunicação segura offline que implementa criptografia de nível militar e múltiplos canais de transmissão. Desenvolvido para especialistas em comunicação privada e uso educacional.

---

## 📋 Funcionalidades Principais

### 1. 💬 Chat Criptografado Full-Duplex

**Recursos:**
- Comunicação em tempo real
- Seleção de canal (QR Code, Som, Luz)
- Criptografia configurável (AES-256, RSA-2048, PGP, OTP)
- Compressão de dados (LZ-String, GZip)
- Correção de erro (Hamming, Reed-Solomon, CRC-32)
- Histórico de mensagens
- Estatísticas de latência

**Como Usar:**
1. Selecione o canal de transmissão
2. Escolha o método de criptografia
3. Digite sua mensagem
4. Clique em "📤 Enviar"
5. A mensagem é criptografada e transmitida

---

### 2. 🔐 Criptografia Avançada

#### AES-256-GCM (Simétrico)
- **Algoritmo:** Advanced Encryption Standard
- **Tamanho da Chave:** 256 bits
- **Modo:** GCM (Galois/Counter Mode)
- **Derivação:** PBKDF2 com 100.000 iterações
- **Segurança:** Nível militar

**Como Usar:**
1. Digite o texto na caixa "Texto"
2. Insira uma chave de 32 caracteres
3. Clique em "🔐 Criptografar"
4. O resultado aparece em Base64
5. Para descriptografar, cole o resultado e clique em "🔓 Descriptografar"

#### RSA-2048 (Assimétrico)
- **Algoritmo:** RSA
- **Tamanho da Chave:** 2048 bits
- **Esquema:** OAEP com SHA-256
- **Uso:** Troca segura de chaves

**Como Usar:**
1. Clique em "🔑 Gerar Par de Chaves"
2. Digite o texto
3. Clique em "🔐 Criptografar" (usa chave pública)
4. Clique em "🔓 Descriptografar" (usa chave privada)

#### PGP/GPG (Simulado)
- **Formato:** OpenPGP
- **Funcionalidades:** Criptografia, assinatura, verificação
- **Identificação:** ID único por chave

**Como Usar:**
1. Clique em "🔑 Gerar Chaves PGP"
2. Digite o texto
3. Clique em "🔐 Criptografar"
4. Clique em "✍️ Assinar" para assinar digitalmente
5. Clique em "✅ Verificar" para validar assinatura

#### One-Time Pad (Inquebrável)
- **Algoritmo:** XOR com chave aleatória
- **Tamanho:** 256 bytes
- **Segurança:** Matematicamente inquebrável
- **Requisito:** Chave deve ser tão longa quanto a mensagem

**Como Usar:**
1. Clique em "🎲 Gerar Chave OTP"
2. Salve a chave (compartilhe com o receptor por canal seguro)
3. Digite o texto
4. Clique em "🔐 Criptografar"
5. Para descriptografar, use a mesma chave

---

### 3. 🔑 Gerenciamento de Chaves

**Recursos:**
- Geração de chaves (AES, RSA-2048, RSA-4096, PGP, OTP)
- Exportar chaves (JSON)
- Importar chaves
- Limpar todas as chaves
- Visualização de chaves geradas

**Como Usar:**
1. Selecione o tipo de chave
2. Clique em "🔑 Gerar Chave"
3. Copie ou salve a chave
4. Compartilhe com o receptor por canal seguro

---

### 4. 📱 QR Code Avançado

**Recursos:**
- 4 níveis de correção de erro (L: 7%, M: 15%, Q: 25%, H: 30%)
- Tamanho ajustável (100-800px)
- Margem configurável (0-10 módulos)
- Criptografia opcional (AES-256, Base64)
- Download em PNG

**Como Usar:**
1. Digite o conteúdo
2. Selecione o nível de correção
3. Ajuste tamanho e margem
4. Escolha criptografia (opcional)
5. Clique em "⚡ Gerar QR Code"
6. Clique em "💾 Salvar PNG"

---

### 5. 📁 Transmissão de Arquivos

**Recursos:**
- Divisão automática em chunks
- Criptografia AES-256-GCM ou PGP
- Compressão LZ-String
- Hash SHA-256 para verificação de integridade
- Chunk size configurável (50-500 caracteres)
- Geração de múltiplos QR Codes
- Download em lote

**Como Usar:**
1. Clique na área de upload ou arraste um arquivo
2. Selecione criptografia (AES ou PGP)
3. Selecione compressão (LZ-String ou nenhuma)
4. Ajuste o tamanho do chunk
5. Clique em "⚡ Gerar QR Codes"
6. Clique em "💾 Salvar Todos"

**No Receptor:**
1. Escaneie cada QR Code na ordem
2. Concatene os dados
3. Descomprima (se necessário)
4. Descriptografe (se necessário)
5. Verifique o hash SHA-256
6. Reconstrua o arquivo

---

### 6. 🔊 Modem de Áudio Avançado

**Recursos:**
- **FSK (Frequency Shift Keying):** 2 frequências para 0 e 1
- **ASK (Amplitude Shift Keying):** Amplitude varia para 0 e 1
- **PSK (Phase Shift Keying):** Fase varia para 0 e 1
- Velocidade ajustável (20-500ms por bit)
- Frequências configuráveis
- Amplitude ajustável (0.1-1.0)
- Visualização FFT em tempo real
- Medidor de sinal

**Como Usar (Transmitir):**
1. Digite os dados
2. Selecione modulação (FSK, ASK, PSK)
3. Ajuste velocidade (ms/bit)
4. Configure frequências (para FSK)
5. Ajuste amplitude
6. Clique em "🔊 Transmitir"

**Como Usar (Receber):**
1. Clique em "🎤 Escutar"
2. Permita acesso ao microfone
3. Aproxime do transmissor
4. Observe o FFT em tempo real
5. Os dados recebidos aparecem na caixa

**Dicas:**
- Use FSK para maior confiabilidade
- Velocidade lenta (200-500ms) para ambientes ruidosos
- Velocidade rápida (20-50ms) para ambientes silenciosos
- Frequências recomendadas: 800Hz (0) e 1200Hz (1)

---

### 7. 💡 Transmissão por Luz

**Recursos:**
- **OOK (On-Off Keying):** Branco = 1, Preto = 0
- **PWM (Pulse Width Modulation):** Largura do pulso varia
- **PPM (Pulse Position Modulation):** Posição do pulso varia
- Velocidade ajustável (50-1000ms por bit)
- Cores configuráveis para 0 e 1
- Visualização de brilho em tempo real
- Recepção por câmera

**Como Usar (Transmitir):**
1. Digite os dados
2. Selecione modulação (OOK, PWM, PPM)
3. Ajuste velocidade (ms/bit)
4. Configure cores (cor para 1 e cor para 0)
5. Clique em "💡 Transmitir"
6. A tela pisca conforme os dados

**Como Usar (Receber):**
1. Clique em "📷 Iniciar Câmera"
2. Permita acesso à câmera
3. Aponte para a tela do transmissor
4. Observe o gráfico de brilho
5. Os dados recebidos aparecem na caixa

**Dicas:**
- Use OOK para simplicidade
- Reduza luz ambiente para melhor recepção
- Aumente brilho da tela do transmissor
- Velocidade lenta (300-1000ms) para maior confiabilidade
- Distância ideal: 1-2 metros

---

### 8. 📷 Leitor de QR Code

**Recursos:**
- Captura por câmera
- Detecção em tempo real
- Histórico de QR Codes detectados
- Suporte a múltiplos formatos

**Como Usar:**
1. Clique em "📷 Iniciar"
2. Permita acesso à câmera
3. Aponte para um QR Code
4. O código é detectado automaticamente
5. Os dados aparecem na lista

---

### 9. 🔒 Hash e Integridade

**Recursos:**
- SHA-256 (256 bits)
- SHA-512 (512 bits)
- Suporte a texto e arquivos
- Verificação de integridade
- Cópia rápida

**Como Usar:**
1. Digite o texto ou arraste um arquivo
2. Clique em "🔐 Calcular Hash"
3. Copie o hash SHA-256 ou SHA-512
4. Para verificar, cole o hash esperado
5. Clique em "✅ Verificar"

---

### 10. 🖼️ Steganografia

**Recursos:**
- Esconder mensagens em imagens
- Extração de mensagens ocultas
- Criptografia opcional com senha
- Suporte a PNG, JPG, BMP
- Capacidade: ~1 byte por pixel

**Como Usar (Esconder):**
1. Selecione uma imagem
2. Digite a mensagem secreta
3. Insira uma senha (opcional)
4. Clique em "🔐 Esconder Mensagem"
5. Clique em "💾 Salvar Imagem"

**Como Usar (Extrair):**
1. Selecione a imagem com mensagem oculta
2. Insira a senha (se criptografada)
3. Clique em "🔓 Extrair Mensagem"
4. A mensagem aparece na caixa

**Dicas:**
- Use imagens PNG para melhor qualidade
- Imagens maiores podem esconder mais dados
- Senha forte para maior segurança
- Não comprima a imagem após esconder

---

### 11. 📊 Estatísticas e Logs

**Recursos:**
- Mensagens enviadas/recebidas
- Bytes transmitidos
- QR Codes gerados
- Erros detectados
- Tempo ativo
- Logs completos com timestamp
- Exportar estatísticas (JSON)
- Limpar estatísticas

**Como Usar:**
1. Clique na aba "📊 Stats"
2. Visualize as estatísticas em tempo real
3. Clique em "📤 Exportar Estatísticas" para salvar
4. Clique em "🗑️ Limpar" para resetar

---

## 🔧 Configurações Avançadas

### Correção de Erro

**Hamming(7,4):**
- Corrige 1 bit errado por bloco de 7 bits
- Eficiência: 57%
- Use para: Canais com pouco ruído

**Reed-Solomon:**
- Corrige múltiplos erros
- Eficiência: 70-90%
- Use para: Canais com ruído moderado

**CRC-32:**
- Detecta erros (não corrige)
- Eficiência: 100%
- Use para: Verificação de integridade

### Compressão

**LZ-String:**
- Compressão rápida
- Taxa: 50-70%
- Use para: Texto e dados repetitivos

**GZip:**
- Compressão eficiente
- Taxa: 60-80%
- Use para: Arquivos grandes

**Sem Compressão:**
- Dados brutos
- Use para: Dados já comprimidos ou criptografados

---

## 🎓 Casos de Uso

### 1. Comunicação Escolar Offline

**Cenário:** Dois alunos sem internet querem se comunicar

**Solução:**
1. Ambos abrem DataLink Pro
2. Aluno A digita mensagem no chat
3. Seleciona canal "QR Code"
4. Criptografia "AES-256"
5. Clica em "Enviar"
6. QR Code é gerado
7. Aluno B escaneia com câmera
8. Mensagem é descriptografada
9. Aluno B responde pelo mesmo processo

### 2. Transferência de Arquivos Segura

**Cenário:** Transferir documento confidencial entre computadores sem rede

**Solução:**
1. Computador A: Aba "📁 Arquivo"
2. Seleciona arquivo
3. Criptografia "AES-256-GCM"
4. Compressão "LZ-String"
5. Gera QR Codes
6. Computador B: Escaneia cada QR
7. Reconstrói arquivo
8. Verifica hash SHA-256
9. Descriptografa com mesma chave

### 3. Comunicação por Som em Ambiente Ruidoso

**Cenário:** Comunicar em fábrica com muito ruído

**Solução:**
1. Aba "🔊 Som"
2. Modulação "FSK"
3. Velocidade "500ms/bit" (lenta)
4. Frequências: 400Hz e 600Hz (fora da faixa de ruído)
5. Amplitude: 0.8 (alta)
6. Transmite dados críticos

### 4. Comunicação Secreta por Luz

**Cenário:** Trocar informações sem ser detectado

**Solução:**
1. Aba "💡 Luz"
2. Modulação "OOK"
3. Velocidade "1000ms/bit" (muito lenta)
4. Cores: Branco suave e cinza escuro (discreto)
5. Transmite em ambiente com luz controlada
6. Receptor usa câmera com filtro

### 5. Steganografia para Mensagens Ocultas

**Cenário:** Esconder mensagem em foto de perfil

**Solução:**
1. Aba "🖼️ Stego"
2. Seleciona foto
3. Digita mensagem secreta
4. Insere senha forte
5. Esconde mensagem
6. Salva imagem
7. Compartilha imagem normalmente
8. Receptor extrai com senha

---

## 🔐 Segurança

### Níveis de Segurança

**Nível 1 - Básico:**
- Sem criptografia
- Sem compressão
- Sem correção de erro
- Use para: Dados não sensíveis

**Nível 2 - Padrão:**
- AES-256-GCM
- LZ-String
- Hamming(7,4)
- Use para: Comunicação geral

**Nível 3 - Alto:**
- RSA-2048
- GZip
- Reed-Solomon
- Use para: Dados sensíveis

**Nível 4 - Militar:**
- One-Time Pad
- Sem compressão
- Reed-Solomon
- Use para: Dados classificados

### Boas Práticas

1. **Troca de Chaves:**
   - Use canal seguro para trocar chaves
   - Nunca envie chaves pelo mesmo canal dos dados
   - Use RSA para trocar chaves AES

2. **One-Time Pad:**
   - Chave deve ser verdadeiramente aleatória
   - Chave deve ser tão longa quanto a mensagem
   - Chave deve ser usada apenas uma vez
   - Destrua a chave após uso

3. **Steganografia:**
   - Use senhas fortes
   - Não reutilize imagens
   - Não comprima após esconder
   - Teste extração antes de compartilhar

4. **Canais de Transmissão:**
   - QR Code: Mais confiável, menor capacidade
   - Som: Médio alcance, sensível a ruído
   - Luz: Curto alcance, discreto
   - Combine canais para maior segurança

---

## 🚀 Performance

### Taxas de Transmissão

**QR Code:**
- Capacidade: ~150 caracteres por QR
- Velocidade: Instantâneo (visual)
- Confiabilidade: Alta

**Som (FSK):**
- Velocidade: 2-50 bits/segundo
- Alcance: 5-10 metros
- Confiabilidade: Média-Alta

**Luz (OOK):**
- Velocidade: 1-20 bits/segundo
- Alcance: 1-5 metros
- Confiabilidade: Média

**Arquivos:**
- Depende do tamanho e número de QR Codes
- Recomendação: < 50KB por transmissão

---

## 📚 Recursos Educacionais

### Conceitos de Criptografia

**Criptografia Simétrica (AES):**
- Mesma chave para criptografar e descriptografar
- Rápida e eficiente
- Desafio: Troca segura de chaves

**Criptografia Assimétrica (RSA):**
- Par de chaves (pública e privada)
- Resolve problema de troca de chaves
- Mais lenta que simétrica

**One-Time Pad:**
- Matematicamente inquebrável
- Chave aleatória do tamanho da mensagem
- Impraticável para uso geral

**Hash (SHA-256/512):**
- Função unidirecional
- Verificação de integridade
- Não pode ser revertido

### Conceitos de Comunicação

**Modulação:**
- FSK: Frequência varia
- ASK: Amplitude varia
- PSK: Fase varia
- OOK: Liga/desliga

**Correção de Erro:**
- Hamming: Corrige 1 bit
- Reed-Solomon: Corrige múltiplos
- CRC: Detecta erros

**Compressão:**
- LZ-String: Rápida
- GZip: Eficiente
- Reduz tamanho dos dados

### Conceitos de Segurança

**Confidencialidade:**
- Criptografia
- Steganografia
- Canais seguros

**Integridade:**
- Hash
- Assinatura digital
- CRC

**Autenticidade:**
- Assinatura PGP
- Certificados
- Chaves públicas

---

## 🐛 Solução de Problemas

### QR Code não gera
- Verifique se o texto não é muito longo
- Reduza o nível de correção de erro
- Aumente o tamanho do QR

### Som não transmite/recebe
- Verifique permissão do microfone
- Aumente amplitude
- Reduza velocidade
- Use ambiente silencioso
- Aproxime os dispositivos

### Luz não transmite/recebe
- Reduza luz ambiente
- Aumente brilho da tela
- Reduza velocidade
- Aproxime câmera da tela
- Use cores contrastantes

### Arquivo não reconstrói
- Verifique ordem dos QR Codes
- Todos os QR Codes foram escaneados?
- Mesma chave de criptografia?
- Hash SHA-256 confere?

### Câmera não funciona
- Permita acesso à câmera
- Verifique se outra app está usando
- Recarregue a página
- Use Chrome ou Firefox

### Steganografia não funciona
- Use imagem PNG
- Não comprima após esconder
- Mesma senha para extrair
- Imagem não foi modificada

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte este guia
2. Verifique a seção de solução de problemas
3. Teste com dados simples primeiro
4. Use configurações padrão
5. Verifique permissões do navegador

---

## 🎉 Conclusão

DataLink Pro é um sistema completo de comunicação segura offline que implementa tecnologias de nível profissional. Ideal para:

- **Educação:** Ensinar criptografia e comunicação
- **Pesquisa:** Testar protocolos de comunicação
- **Segurança:** Comunicação offline segura
- **Emergência:** Comunicação sem infraestrutura
- **Privacidade:** Proteção de dados sensíveis

**Desenvolvido com ❤️ para comunicação segura e privada.**

---

**DataLink Pro v2.0 - Comunicação Segura Offline**
