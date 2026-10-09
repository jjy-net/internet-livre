# 🚀 Como Publicar um Nó do Jyy para o Domínio `jyy.com.br`

Este guia ensina o passo a passo completo para hospedar e colocar no ar o seu próprio nó **Jyy** no domínio **`jyy.com.br`**, servindo tanto a interface Web quanto o servidor de retransmissão WebSocket P2P seguro com SSL gratuito (HTTPS + WSS).

---

## 📌 Visão Geral da Arquitetura

O sistema Jyy possui uma arquitetura autônoma integrada:
- **Frontend Web:** Os arquivos estáticos compilados na pasta `dist/`.
- **Servidor Nó Jyy (`server/start.js`):** Executa em Node.js na porta **4870**, servindo:
  - As páginas web (`/` e `/Jyy.html`);
  - O servidor WebSocket de alta velocidade para comunicação P2P e chat;
  - Os endpoints de telemetria e mensageria NGL.

---

## 🌐 PASSO 1: Apontar o Domínio no Registro.br / Cloudflare

No painel onde você comprou o domínio **`jyy.com.br`** (Registro.br, Cloudflare, Hostinger, etc.):

1. Acesse a **Zona de DNS**.
2. Adicione os seguintes registros do tipo **A**:

| Tipo | Nome / Host | Conteúdo / Destino | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (ou em branco / `jyy.com.br`) | `SEU_IP_DO_SERVIDOR` | Automático / 300 |
| **A** | `www` | `SEU_IP_DO_SERVIDOR` | Automático / 300 |

*(Substitua `SEU_IP_DO_SERVIDOR` pelo IP público IPv4 do seu servidor VPS).*

---

## 💻 MÉTODO 1: Servidor VPS Linux (Ubuntu / Debian) com PM2 & Nginx (Recomendado)

Este é o método mais estável, profissional e veloz.

### 1. Conecte no seu servidor via SSH:
```bash
ssh root@SEU_IP_DO_SERVIDOR
```

### 2. Atualize o sistema e instale o Node.js 20+, Nginx e Certbot:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm install -g pm2
```

### 3. Envie os arquivos do Jyy para o servidor:
Você pode clonar do seu GitHub ou copiar direto do seu computador com `scp` ou `rsync`:
```bash
# Opção A: Clonar do Git
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git /var/www/jyy

# Opção B: Copiar direto da sua máquina Windows (no terminal PowerShell local):
# scp -r "c:\Users\marco\Downloads\Nova pasta\workspace (28)\*" root@SEU_IP_DO_SERVIDOR:/var/www/jyy/
```

### 4. Instale as dependências e faça o build no servidor:
```bash
cd /var/www/jyy
npm install
npm run build
```

### 5. Inicie o Nó Jyy em segundo plano com PM2:
```bash
pm2 start server/start.js --name "jyy-node" -- --porta=4870
pm2 save
pm2 startup
```

*(O comando `pm2 startup` exibirá uma linha para colar no terminal, garantindo que o nó suba sozinho se o servidor reiniciar).*

### 6. Configure o Nginx como Proxy Reverso com WebSocket:
Copie o arquivo de configuração fornecido:
```bash
sudo cp /var/www/jyy/nginx-jyy.conf /etc/nginx/sites-available/jyy.com.br
sudo ln -s /etc/nginx/sites-available/jyy.com.br /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Emita o Certificado SSL Gratuito (HTTPS + WSS) com Certbot:
```bash
sudo certbot --nginx -d jyy.com.br -d www.jyy.com.br
```
*Siga as instruções rápidas na tela (informe seu e-mail e aceite os termos). O Certbot configurará a renovação automática a cada 90 dias.*

🎉 **Pronto!** Acesse agora no navegador:
- **`https://jyy.com.br`** (Globo 3D, chat P2P e rede soberana com HTTPS verde)
- **`https://jyy.com.br/Jyy.html`** (Painel de mensagens secretas NGL)

---

## 🐳 MÉTODO 2: Publicar Usando Docker (Docker Compose)

Se o seu servidor já roda Docker:

1. No servidor, dentro da pasta do projeto:
```bash
docker compose up -d --build
```
2. O container `jyy-node` subirá automaticamente na porta `4870`.
3. Configure o Nginx ou Caddy no host apontando para `http://127.0.0.1:4870` conforme o Passo 6 acima.

---

## ⚡ MÉTODO 3: Publicação Descentralizada Nostr / Nsite (Web3)

Se você quiser publicar também na rede descentralizada Blossom / Nostr:

1. Na sua máquina local, basta dar duplo clique no script:
   `PUBLICAR-NOSTR-NSITE.bat`
2. O script executará o `nsyte.exe` que publicará o conteúdo da pasta `dist/` diretamente na rede descentralizada com um link `https://[seu-npub].nsite.lol`.
3. Depois, no Cloudflare ou Registro.br, você pode apontar o CNAME de `jyy.com.br` para o gateway do nsite.

---

## 🔍 Como Testar e Monitorar Seu Nó

- **Ver logs em tempo real:**
  ```bash
  pm2 logs jyy-node
  ```
- **Ver status de memória e conexões:**
  ```bash
  pm2 status
  ```
- **Reiniciar o nó após atualizar código:**
  ```bash
  git pull
  npm run build
  pm2 restart jyy-node
  ```
