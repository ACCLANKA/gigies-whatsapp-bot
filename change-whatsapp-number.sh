#!/bin/bash

# Script to logout from old WhatsApp number and prepare for new number
# This script will clear all session data and restart the bot

echo "🔄 WhatsApp Number Change Script"
echo "================================"
echo ""
echo "This script will:"
echo "1. Stop the WhatsApp bot service"
echo "2. Clear all session data (logout from old number)"
echo "3. Restart the bot for new QR code scan"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "📋 Step 1: Stopping WhatsApp bot service..."
sudo systemctl stop wa-bot

echo "✅ Service stopped"
echo ""

echo "🗑️  Step 2: Clearing old session data..."
cd /opt/wa-bot

# Backup old session (just in case)
if [ -d "wa-session" ] || [ -d ".wwebjs_cache" ]; then
    BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    if [ -d "wa-session" ]; then
        mv wa-session "$BACKUP_DIR/" 2>/dev/null || true
        echo "  ✓ Backed up wa-session to $BACKUP_DIR/"
    fi
    
    if [ -d ".wwebjs_cache" ]; then
        mv .wwebjs_cache "$BACKUP_DIR/" 2>/dev/null || true
        echo "  ✓ Backed up .wwebjs_cache to $BACKUP_DIR/"
    fi
    
    if [ -d ".wwebjs_auth" ]; then
        mv .wwebjs_auth "$BACKUP_DIR/" 2>/dev/null || true
        echo "  ✓ Backed up .wwebjs_auth to $BACKUP_DIR/"
    fi
    
    echo "✅ Old session data backed up to $BACKUP_DIR"
else
    echo "  ℹ️  No existing session data found"
fi

# Ensure directories are clean
rm -rf wa-session .wwebjs_cache .wwebjs_auth 2>/dev/null || true
mkdir -p wa-session

echo "✅ Session data cleared"
echo ""

echo "🔄 Step 3: Starting WhatsApp bot service..."
sudo systemctl start wa-bot

echo "✅ Service started"
echo ""

echo "⏳ Waiting 5 seconds for service to initialize..."
sleep 5
echo ""

echo "📱 Step 4: Checking for QR code..."
echo ""
echo "The bot should now be generating a QR code."
echo "To view the logs and see the QR code, run:"
echo ""
echo "  sudo journalctl -u wa-bot -f"
echo ""
echo "Or check the web interface at:"
echo "  http://localhost:3002"
echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Open WhatsApp on your NEW phone number"
echo "2. Go to Settings → Linked Devices"
echo "3. Tap 'Link a Device'"
echo "4. Scan the QR code from the logs or web interface"
echo "5. Wait for connection confirmation"
echo ""
echo "✅ Script completed!"
echo ""
echo "💡 To monitor the bot logs:"
echo "   sudo journalctl -u wa-bot -f"
echo ""
