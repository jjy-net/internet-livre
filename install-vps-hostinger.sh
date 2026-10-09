#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE INSTALACAO AUTOMATIZADA DO NO JYY NA VPS HOSTINGER (UBUNTU/DEBIAN)
# Dominio: jyy.com.br
# ==============================================================================

set -e

DOMAIN="jyy.com.br"
APP_DIR="/var/www/jyy"
PORT=4870

echo "======================================================================"
echo "   🚀 INSTALADOR AUTOMATIZADO DO NÓ JYY NA VPS HOSTINGER"
echo "   Domínio Alvo: https://$DOMAIN"
echo "======================================================================"

# 1. Verificar permissões de root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute este script como root: sudo bash install-vps-hostinger.sh"
  exit 1
fi

echo ""
echo "[1/6] Atualizando pacotes do sistema..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw nginx certbot python3-certbot-nginx build-essential

# 2. Instalar Node.js 20 LTS se não existir
echo ""
echo "[2/6] Verificando instalacao do Node.js..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo "Instalando Node.js 20 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Instalar PM2 globalmente
npm install -g pm2

# 3. Configurar Firewall (UFW)
echo ""
echo "[3/6] Ajustando firewall UFW..."
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow $PORT/tcp || true
ufw --force enable || true

# 4. Preparar pasta e dependencias do Jyy
echo ""
echo "[4/6] Configurando diretorio da aplicacao em $APP_DIR..."
mkdir -p "$APP_DIR"

if [ -f "package.json" ]; then
  echo "Copiando arquivos locais para $APP_DIR..."
  cp -r ./* "$APP_DIR/"
fi

cd "$APP_DIR"
echo "Instalando dependencias npm e compilando front-end..."
npm install
npm run build

# 5. Iniciar Nó com PM2
echo ""
echo "[5/6] Iniciando servidor do No Jyy no PM2 (porta $PORT)...
pm2 stop jyy-node 2>/dev/null || true
pm2 delete jyy-node 2>/dev/null || true
pm2 start server/start.js --name "jyy-node" -- --porta=$PORT
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true

# 6. Configurar Nginx como Proxy Reverso com suporte a WebSocket
echo ""
echo "[6/6] Configurando Nginx para $DOMAIN..."

cat > "/etc/nginx/sites-available/$DOMAIN" <<NGINX_CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;

        # Cabecalhos obrigatorios para WebSocket WSS
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts longos para conexoes P2P continuas
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        client_max_body_size 100M;
    }
}
NGINX_CONF

ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "======================================================================"
echo "  ✅ NÓ JYY INSTALADO COM SUCESSO!"
echo "======================================================================"
echo ""
echo "Passo final: Emitir certificado SSL Grátis (HTTPS + WSS):"
echo "Basta rodar o comando abaixo no terminal:"
echo ""
echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "Depois disso, acesse: https://$DOMAIN"
echo "======================================================================"
