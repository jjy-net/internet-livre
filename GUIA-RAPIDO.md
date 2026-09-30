# 🚀 DataLink Mesh - Guia Rápido

## ✅ SISTEMA PRONTO!

Funciona entre celulares e computadores, COM e SEM internet!

---

## 📱 COMO USAR

### Passo 1: Configurar (Primeira Vez)

1. Abra `DataLink-Mesh-Final.html` no navegador
2. Digite seu nome (Ex: João)
3. Crie uma senha (mínimo 8 caracteres)
4. Confirme a senha
5. Clique em "🚀 Iniciar DataLink Mesh"

**⚠️ IMPORTANTE:** Use a MESMA SENHA em todos os dispositivos!

### Passo 2: Detectar Canais

1. Clique em "📡 Canais"
2. Clique em "🔍 Detectar Canais"
3. Sistema detecta automaticamente:
   - 🌐 Internet (se disponível)
   - 📶 WebRTC (se na mesma rede)
   - 🔊 Ultrassom (alto-falante/microfone)
   - 📱 Bluetooth (se disponível)
   - 💡 Luz (tela/câmera)
   - 📱 QR Code (câmera)

### Passo 3: Enviar Mensagens

1. Vá na aba "💬 Chat"
2. Digite sua mensagem
3. Selecione canal (ou deixe em "Automático")
4. Clique em "📤"

---

## 🔄 COMO FUNCIONA ENTRE DISPOSITIVOS

### Cenário 1: Ambos com Internet
- Usa canal Internet (WebSocket)
- Comunicação instantânea

### Cenário 2: Ambos na mesma rede WiFi (sem internet)
- Usa canal WebRTC (P2P)
- Comunicação direta

### Cenário 3: Dispositivos próximos (sem rede)
- Usa Ultrassom (18-22kHz inaudível)
- Aproxime os dispositivos (1-5 metros)
- Um envia, outro recebe via microfone

### Cenário 4: Sem nenhum canal disponível
- Mensagem vai para FILA
- Quando canal disponível, envia automaticamente

---

## 🔐 SEGURANÇA

✅ **Criptografia AES-256-GCM** (nível militar)  
✅ **Autenticação com senha** (PBKDF2)  
✅ **Proteção contra injeção** (sanitização)  
✅ **Verificação de integridade** (HMAC)  
✅ **Anti-replay** (timestamp + nonce)  
✅ **Rate limiting** (10 msgs/seg)  

---

## 🎯 EXEMPLOS PRÁTICOS

### Exemplo 1: Dois Celulares (um com internet, outro sem)

**Celular A (com internet):**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="João", Senha="12345678"
3. Detecta canais → Internet disponível

**Celular B (sem internet):**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="Maria", Senha="12345678" (MESMA!)
3. Detecta canais → Ultrassom disponível

**Comunicação:**
- João envia mensagem → Canal automático escolhe melhor opção
- Se não houver canal comum, mensagem vai para fila
- Quando Ultrassom disponível, envia automaticamente

### Exemplo 2: Computador + Celular (mesma rede WiFi)

**Computador:**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="PC", Senha="12345678"
3. Detecta canais → WebRTC disponível

**Celular:**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="Cel", Senha="12345678" (MESMA!)
3. Detecta canais → WebRTC disponível

**Comunicação:**
- Ambos usam WebRTC (P2P na rede local)
- Comunicação direta e rápida

### Exemplo 3: Área Remota (sem internet, sem WiFi)

**Dispositivo A:**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="A", Senha="12345678"
3. Detecta canais → Ultrassom disponível

**Dispositivo B:**
1. Abre DataLink-Mesh-Final.html
2. Configura: Nome="B", Senha="12345678" (MESMA!)
3. Detecta canais → Ultrassom disponível

**Comunicação:**
- Aproxime dispositivos (1-5 metros)
- A envia via ultrassom (som inaudível)
- B recebe via microfone
- Funciona!

---

## ⚙️ CONFIGURAÇÕES

### Ultrassom
- **Frequência:** 18-22kHz (ajustável)
- **Volume:** 10-100% (ajustável)
- **Alcance:** 1-5 metros

### Auto-Destruição
- Desativado
- 10 segundos
- 30 segundos
- 1 minuto

### Fila Offline
- Mensagens aguardam canal disponível
- Envio automático quando possível
- Visualização na aba "📦 Fila"

---

## 🧪 TESTES RÁPIDOS

### Teste 1: Entre Duas Abas
1. Abra DataLink-Mesh-Final.html em duas abas
2. Configure mesma senha em ambas
3. Envie mensagem de uma aba
4. Outra aba recebe automaticamente!

### Teste 2: Ultrassom
1. Abra em dois dispositivos próximos
2. Configure mesma senha
3. Envie mensagem curta ("Oi")
4. Aproxime dispositivos
5. Deve ouvir som agudo (quase inaudível)

### Teste 3: Fila Offline
1. Desconecte internet
2. Envie mensagem
3. Vá em "📦 Fila"
4. Mensagem está lá aguardando
5. Reconecte internet
6. Clique em "📤 Enviar"
7. Mensagem é enviada!

---

## 📁 ARQUIVOS

```
public/
├── DataLink-Mesh-Final.html    ← SISTEMA COMPLETO
└── DataLink-Mesh.html          ← Versão anterior

Documentação:
├── GUIA-RAPIDO.md              ← Este arquivo
└── SEGURANCA-COMPLETA.md       ← Detalhes de segurança
```

---

## 💡 DICAS

✅ **Use a mesma senha** em todos os dispositivos  
✅ **Aproxime dispositivos** para ultrassom (1-5m)  
✅ **Teste entre abas** primeiro para entender o sistema  
✅ **Verifique canais** antes de enviar mensagens importantes  
✅ **Use fila offline** quando não houver canal disponível  

---

## 🎉 RESULTADO

**Sistema completo e funcional!**

✅ Funciona COM internet  
✅ Funciona SEM internet  
✅ Comunicação entre celulares  
✅ Comunicação entre celular e computador  
✅ Múltiplos canais (Internet, WebRTC, Ultrassom, Bluetooth, Luz, QR)  
✅ Criptografia militar (AES-256-GCM)  
✅ Fila offline resiliente  
✅ Auto-destruição de mensagens  
✅ Proteção contra injeção  
✅ Verificação de integridade  

**Desafio completo e superado!** 🚀

---

**DataLink Mesh v2.0 - Sistema Completo e Funcional**

Pronto para uso real entre dispositivos, com e sem internet!
