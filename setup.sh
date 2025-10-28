#!/bin/bash
# Gigies WhatsApp Bot - Digital Ocean Droplet Setup
# IP: 167.99.65.130

set -e

echo "🚀 Starting Gigies Bot Setup on Digital Ocean Droplet"
echo "=================================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install required dependencies
echo "📦 Installing system dependencies..."
apt install -y \
    git \
    wget \
    curl \
    build-essential \
    chromium-browser \
    chromium-chromedriver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/wa-bots/gigies
cd /opt/wa-bots/gigies

# Clone repository from GitHub
echo "📥 Cloning repository from GitHub..."
git clone https://github.com/ACCLANKA/gigies-whatsapp-bot.git .

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create .env file
echo "⚙️  Creating environment configuration..."
cat > .env << 'EOF'
# Application Configuration
PORT=3011
NODE_ENV=production

# Session Secret
SESSION_SECRET=gigies-droplet-secret-key-$(date +%s)

# Company/Bot Information
COMPANY_NAME=Gigies Store
COMPANY_SLUG=gigies
CUSTOMER_SLUG=gigies

# Ollama AI Configuration - Centralized Server
OLLAMA_HOST=http://37.60.242.244:11434
OLLAMA_CLOUD=false
OLLAMA_MODEL=qwen2.5-coder:32b
EOF

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data uploads/products

# Set permissions
echo "🔒 Setting permissions..."
chmod -R 755 /opt/wa-bots/gigies
chown -R root:root /opt/wa-bots/gigies

# Start with PM2
echo "🚀 Starting bot with PM2..."
pm2 start server.js --name gigies-bot
pm2 save
pm2 startup

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Configure Nginx
echo "⚙️  Configuring Nginx..."
cat > /etc/nginx/sites-available/gigies << 'EOF'
server {
    listen 80;
    server_name 167.99.65.130;

    location / {
        proxy_pass http://localhost:3011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/gigies /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "✅ Setup Complete!"
echo "=================================================="
echo "🌐 Bot URL: http://167.99.65.130"
echo "📊 Dashboard: http://167.99.65.130/gigies/dashboard.html"
echo "🔐 Login: gigies / 123456"
echo ""
echo "📝 Useful Commands:"
echo "  pm2 status          - Check bot status"
echo "  pm2 logs gigies-bot - View logs"
echo "  pm2 restart gigies-bot - Restart bot"
echo "  pm2 stop gigies-bot - Stop bot"
echo ""
echo "🔄 To update from GitHub:"
echo "  cd /opt/wa-bots/gigies"
echo "  git pull"
echo "  npm install"
echo "  pm2 restart gigies-bot"
echo ""
