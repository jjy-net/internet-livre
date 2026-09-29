# 🎯 COMO CRIAR O EXECUTÁVEL PORTABLE (.EXE)

## ⚡ MÉTODO SUPER FÁCIL (Recomendado)

### Passo 1: Instalar Node.js
1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (recomendada)
3. Instale normalmente (Next, Next, Next...)

### Passo 2: Executar o Instalador Automático
1. Na pasta do projeto, **clique duas vezes** em:
   ```
   instalar-e-criar-exe.bat
   ```

2. Aguarde o processo automático (2-5 minutos)

3. **Pronto!** O executável estará em:
   ```
   release\Gerador QR Code Offline-Portable.exe
   ```

---

## 📋 O QUE ACONTECE AUTOMATICAMENTE

O script vai:
1. ✅ Configurar o projeto para Electron
2. ✅ Instalar todas as dependências
3. ✅ Compilar a aplicação React
4. ✅ Gerar o executável portable (.exe)
5. ✅ Abrir a pasta com o executável

---

## 💻 COMO USAR O EXECUTÁVEL

### Executar
1. Vá até a pasta `release/`
2. Clique duas vezes em `Gerador QR Code Offline-Portable.exe`
3. O app abrirá em uma janela própria

### Usar como Portable
- Copie o `.exe` para um pendrive
- Execute em qualquer computador Windows
- Não precisa instalar nada!

### Criar Atalho
1. Clique com botão direito no `.exe`
2. "Enviar para" → "Área de trabalho (criar atalho)"

---

## 🎯 FUNCIONALIDADES DO APP

✓ Gerar QR Codes de qualquer conteúdo
✓ Ajustar correção de erro (L, M, Q, H)
✓ Personalizar cores, tamanho e margem
✓ Modelos prontos (Wi-Fi, E-mail, Telefone, etc.)
✓ Download em PNG ou SVG
✓ Copiar imagem para área de transferência
✓ Histórico dos últimos QR Codes
✓ 100% offline - sem internet necessária

---

## 📁 ARQUIVOS IMPORTANTES

```
📦 Projeto
├── 📄 instalar-e-criar-exe.bat    ← EXECUTE ESTE!
├── 📄 criar-executavel.bat        ← Para recriar o .exe
├── 📄 rodar-app.bat               ← Para testar em dev
├── 📄 GUIA_RAPIDO.txt             ← Guia simples
├── 📄 README_PORTABLE.md          ← Guia completo
├── 📁 release/                    ← Executável gerado
│   └── Gerador QR Code Offline-Portable.exe
└── 📁 dist/                       ← Build do React
```

---

## ⚠️ REQUISITOS

**Para criar o executável:**
- Node.js 16+ (https://nodejs.org/)
- Windows 10 ou 11
- ~500 MB de espaço temporário

**Para usar o executável:**
- Windows 10 ou 11
- Nenhum outro requisito!

---

## 🔧 SE DER ERRO

### "Node.js não encontrado"
→ Instale o Node.js: https://nodejs.org/

### "Erro ao gerar executável"
→ Execute o Prompt de Comando como Administrador

### "Antivírus bloqueou"
→ Adicione exceção no antivírus ou execute como Administrador

### "Executável muito grande (80-120 MB)"
→ Isso é normal! Apps Electron incluem o Chromium

---

## 📞 PRECISA DE AJUDA?

1. Leia o `GUIA_RAPIDO.txt`
2. Consulte o `README_PORTABLE.md`
3. Verifique a seção de solução de problemas

---

## ✅ APÓS CRIAR O EXECUTÁVEL

Você terá um aplicativo **100% portable** que:
- ✅ Funciona sem instalação
- ✅ Pode ser copiado para pendrive
- ✅ Roda em qualquer Windows
- ✅ Não precisa de internet
- ✅ Tem ícone na área de trabalho
- ✅ Abre em janela própria

**Pronto para usar!** 🚀
