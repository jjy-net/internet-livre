# 💬 DataLink Chat - Guia Completo

## 🎯 O Que É

DataLink Chat é um sistema de chat online completo com:
- ✅ Login com nome e senha
- ✅ Criptografia AES-256-GCM
- ✅ Reset automático a cada 12 horas
- ✅ Mensagens auto-destrutivas configuráveis
- ✅ Lista de usuários online em tempo real
- ✅ Limpeza automática de cache e cookies
- ✅ Opção de excluir mensagens individuais ou todas
- ✅ 100% offline (usa localStorage)

---

## 🚀 Como Usar

### Passo 1: Abrir o Chat

**No Windows:**
1. Vá até a pasta `public/`
2. Dê duplo clique em `ABRIR-CHAT.bat`
3. O navegador abre automaticamente

**No Android:**
1. Copie `DataLink-Chat.html` para o celular
2. Abra com Chrome ou Firefox
3. Pronto!

---

### Passo 2: Criar Conta / Login

1. **Digite seu nome** (mínimo 3 caracteres)
2. **Digite sua senha** (mínimo 4 caracteres)
3. Clique em **"🚀 Entrar / Criar Conta"**

**Se for novo usuário:**
- Conta será criada automaticamente
- Senha é criptografada com SHA-256

**Se já tiver conta:**
- Sistema verifica a senha
- Se correta, entra no chat
- Se incorreta, mostra erro

---

### Passo 3: Usar o Chat

**Enviar Mensagem:**
1. Digite no campo de texto (máximo 500 caracteres)
2. Pressione Enter ou clique em "📤"
3. Mensagem é criptografada e enviada
4. Aparece para todos os usuários online

**Excluir Mensagem Individual:**
1. Encontre sua mensagem
2. Clique em "🗑️ Excluir" abaixo dela
3. Confirme a exclusão
4. Mensagem é marcada como deletada

**Excluir Todas as Suas Mensagens:**
1. Clique em "🗑️ Excluir Minhas"
2. Confirme a ação
3. Todas as suas mensagens são excluídas
4. Contador mostra quantas foram excluídas

**Limpar Todo o Chat:**
1. Clique em "🧹 Limpar Tudo"
2. Confirme duas vezes
3. Todas as mensagens de todos são apagadas
4. Chat recomeça do zero

---

## 💣 Mensagens Auto-Destrutivas

### Como Funciona

1. Selecione o tempo no dropdown "💣 Mensagens Auto-Destrutivas"
2. Opções disponíveis:
   - Desativado
   - 5 segundos
   - 10 segundos
   - 30 segundos
   - 1 minuto
   - 5 minutos
   - 15 minutos

3. Todas as novas mensagens terão esse tempo de vida
4. Timer aparece ao lado da mensagem (💣 Xs)
5. Após o tempo, mensagem é automaticamente excluída

### Exemplo

```
1. Selecione "30 segundos"
2. Envie mensagem "Segredo importante"
3. Timer aparece: 💣 30s
4. Contagem regressiva: 29s, 28s, 27s...
5. Após 30s, mensagem desaparece automaticamente
```

---

## 👥 Lista de Usuários Online

### O Que Mostra

- ✅ Nome de todos os usuários online
- ✅ Indicador verde (online)
- ✅ Badge "(você)" para seu próprio nome
- ✅ Contador de usuários online
- ✅ Atualização em tempo real (a cada 2 segundos)

### Como Funciona

- Usuário é considerado online se esteve ativo nos últimos 5 minutos
- Sistema atualiza `lastSeen` a cada minuto
- Lista é atualizada a cada 2 segundos
- Usuários inativos por 5+ minutos não aparecem

---

## 🕐 Reset Automático (12 Horas)

### Como Funciona

1. Chat mostra timer: "⏰ Reset em: HH:MM:SS"
2. Timer conta regressivamente de 12 horas
3. Quando chega a zero:
   - Todas as mensagens são apagadas
   - Chat recomeça do zero
   - Usuários permanecem cadastrados
   - Timer reinicia para 12 horas

### Por Que 12 Horas?

- Segurança: dados não ficam armazenados por muito tempo
- Privacidade: conversas são temporárias
- Limpeza automática: sem necessidade de intervenção manual

---

## 🧹 Limpeza Automática de Cache

### O Que É Limpo

- Mensagens auto-destrutivas expiradas
- Dados temporários antigos
- Cache de mensagens deletadas

### Quando Acontece

- Automaticamente a cada 5 minutos
- Durante o loop de atualização
- Sem intervenção do usuário
- Não afeta mensagens ativas

---

## 🔐 Segurança

### Criptografia

**Senha:**
- Hash SHA-256 com salt
- Nunca armazenada em texto puro
- Comparação segura

**Mensagens:**
- AES-256-GCM (nível militar)
- PBKDF2 com 1.000 iterações
- Salt aleatório de 16 bytes
- IV único de 12 bytes
- Autenticação integrada

### Privacidade

- ✅ Dados armazenados apenas no navegador local
- ✅ Nenhum servidor externo
- ✅ Nenhum rastreamento
- ✅ Funciona 100% offline
- ✅ Reset automático a cada 12h
- ✅ Mensagens auto-destrutivas
- ✅ Limpeza automática de cache

---

## 📊 Estatísticas

### Informações em Tempo Real

- 📝 Número de mensagens ativas
- 👥 Número de usuários online
- 💣 Status de auto-destruição
- ⏰ Tempo até próximo reset

### Onde Ver

- Rodapé do chat
- Atualizado a cada 2 segundos
- Mostra apenas dados não deletados

---

## 🎯 Casos de Uso

### 1. Conversa Rápida entre Amigos

**Cenário:** Dois amigos querem conversar sem deixar rastro

**Solução:**
1. Ambos criam contas com nomes e senhas
2. Selecionam auto-destruição: 30 segundos
3. Conversam normalmente
4. Mensagens desaparecem após 30s
5. Após 12h, chat é resetado automaticamente

### 2. Compartilhamento de Senhas Temporárias

**Cenário:** Enviar senha de Wi-Fi para visitante

**Solução:**
1. Host envia: "Senha Wi-Fi: ABC123"
2. Auto-destruição: 1 minuto
3. Visitante lê a senha
4. Após 1 minuto, mensagem desaparece
5. Ninguém mais pode ver

### 3. Chat de Equipe com Limpeza Automática

**Cenário:** Equipe precisa de chat seguro com reset diário

**Solução:**
1. Todos criam contas
2. Usam chat normalmente
3. A cada 12h, chat é resetado
4. Mensagens antigas são apagadas
5. Histórico limpo automaticamente

### 4. Comunicação com Privacidade Total

**Cenário:** Conversa sensível que não pode ficar registrada

**Solução:**
1. Criar contas com nomes fictícios
2. Auto-destruição: 5 segundos
3. Conversar
4. Mensagens desaparecem em 5s
5. Ao sair, clicar em "🗑️ Excluir Minhas"
6. Sair do chat
7. Nenhum rastro permanece

---

## ⚙️ Configurações Avançadas

### Tempo de Auto-Destruição

| Opção | Uso Recomendado |
|-------|----------------|
| Desativado | Conversas normais |
| 5 segundos | Informações ultra-sensíveis |
| 10 segundos | Senhas temporárias |
| 30 segundos | Conversas rápidas |
| 1 minuto | Informações confidenciais |
| 5 minutos | Discussões privadas |
| 15 minutos | Conversas longas |

### Limpeza de Cache

- Automática a cada 5 minutos
- Remove mensagens expiradas
- Não afeta mensagens ativas
- Sem configuração necessária

---

## 🐛 Solução de Problemas

### Não consigo entrar
- Verifique nome e senha
- Nome mínimo: 3 caracteres
- Senha mínima: 4 caracteres
- Se esqueceu a senha, crie nova conta com nome diferente

### Mensagens não aparecem para outros
- Todos devem estar na mesma página
- Atualize a página (F5)
- Verifique se está online (lista de usuários)

### Mensagens não se auto-destruem
- Verifique se selecionou tempo > 0
- Aguarde o tempo configurado
- Timer aparece ao lado da mensagem

### Chat não reseta após 12h
- Timer mostra tempo restante
- Reset acontece automaticamente
- Recarregue a página se necessário

### Lista de usuários não atualiza
- Aguarde 2 segundos (atualização automática)
- Usuários devem estar ativos nos últimos 5 minutos
- Recarregue a página se necessário

---

## 🔧 Detalhes Técnicos

### Armazenamento

**localStorage:**
- `datalink_chat`: Mensagens e timestamp de reset
- `datalink_users`: Contas de usuários (hash de senha)

**sessionStorage:**
- `datalink_session`: Sessão do usuário atual

### Estrutura de Dados

**Mensagem:**
```javascript
{
  id: "msg_1234567890_abc123",
  username: "usuario",
  encrypted: "base64...",
  timestamp: 1234567890,
  destructAt: 1234567920, // null se desativado
  deleted: false
}
```

**Usuário:**
```javascript
{
  passwordHash: "sha256hash...",
  createdAt: 1234567890,
  lastSeen: 1234567890
}
```

### Algoritmos

- **Hash de Senha:** SHA-256 com salt fixo
- **Criptografia:** AES-256-GCM
- **Derivação de Chave:** PBKDF2 (1.000 iterações)
- **Integridade:** GCM authentication

---

## 📱 Compatibilidade

### Navegadores Suportados

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

### Dispositivos

- ✅ Windows 10/11
- ✅ macOS
- ✅ Linux
- ✅ Android
- ✅ iOS

### Requisitos

- Navegador moderno com suporte a:
  - Web Crypto API
  - localStorage
  - sessionStorage
  - ES6+

---

## 💡 Dicas de Uso

### Para Máxima Segurança

1. Use nomes fictícios
2. Use senhas fortes e únicas
3. Ative auto-destruição (5-30 segundos)
4. Exclua suas mensagens ao sair
5. Limpe o chat regularmente
6. Não compartilhe sua senha

### Para Conversas Normais

1. Use seu nome real
2. Auto-destruição desativado
3. Chat reseta a cada 12h automaticamente
4. Exclua apenas mensagens sensíveis

### Para Grupos

1. Todos criam contas
2. Combinam tempo de auto-destruição
3. Respeitam privacidade alheia
4. Não excluem mensagens dos outros

---

## 🎉 Recursos Completos

✅ Login com nome e senha  
✅ Criptografia AES-256-GCM  
✅ Reset automático a cada 12h  
✅ Mensagens auto-destrutivas (5s a 15min)  
✅ Lista de usuários online em tempo real  
✅ Limpeza automática de cache  
✅ Excluir mensagens individuais  
✅ Excluir todas as suas mensagens  
✅ Limpar todo o chat  
✅ Contador de mensagens  
✅ Contador de usuários online  
✅ Timer de reset visível  
✅ Status de auto-destruição  
✅ 100% offline  
✅ Sem servidor externo  
✅ Sem rastreamento  
✅ Interface moderna e intuitiva  

---

## 📁 Arquivos

```
public/
├── DataLink-Chat.html    ← O chat completo
└── ABRIR-CHAT.bat        ← Atalho para Windows
```

---

## 🚀 Como Começar

1. Abra `DataLink-Chat.html` no navegador
2. Crie sua conta (nome + senha)
3. Entre no chat
4. Configure auto-destruição (opcional)
5. Comece a conversar!
6. Mensagens são criptografadas automaticamente
7. Chat reseta a cada 12h
8. Ao sair, exclua suas mensagens (opcional)

---

**DataLink Chat v1.0 - Comunicação Segura com Auto-Destruição**

Feito com ❤️ para privacidade e segurança!
