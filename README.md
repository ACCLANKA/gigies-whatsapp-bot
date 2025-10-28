# WhatsApp Auto-Reply Bot - KCC Lanka

**Complete WhatsApp bot system with auto-reply functionality, web-based management, and real-time Socket.io integration.**

**URL:** https://kcclanka.com/wa/

---

## 🚀 Features

### ✅ WhatsApp Integration
- **WhatsApp Web.js** - Full WhatsApp client integration
- **QR Code Authentication** - Scan QR code to connect
- **Persistent Sessions** - Stay connected across restarts
- **Real-time Messaging** - Send and receive messages instantly

### 🤖 Auto-Reply System
- **Keyword-based Responses** - Trigger replies with keywords
- **Multiple Auto-Replies** - Configure unlimited responses
- **Enable/Disable** - Toggle auto-replies on/off
- **Active/Inactive** - Control each reply individually

### 💬 Message Management
- **Real-time Message History** - See all messages live
- **Message Logging** - SQLite database storage
- **Incoming/Outgoing** - Track all conversations
- **Auto-Reply Tracking** - See which messages were auto-replied

### 📤 Manual Messaging
- **Send Messages** - Manual message sending
- **Number Formatting** - Auto-format Sri Lankan numbers
- **Multi-line Support** - Send long messages

### 🎛️ Web Dashboard
- **Modern UI** - Beautiful, responsive interface
- **Real-time Updates** - Socket.io for instant updates
- **Statistics** - View message counts and stats
- **Management Panel** - Full CRUD for auto-replies

---

## 🏗️ Architecture

### Components:
1. **Backend Server** (`server.js`) - Express + Socket.io + WhatsApp Web.js
2. **Database** (`wa-bot.db`) - SQLite for data storage
3. **Web Interface** (`public/`) - HTML/CSS/JavaScript dashboard
4. **Nginx Proxy** - Handles routing and WebSocket

### Technology Stack:
- **Backend:** Node.js, Express.js
- **Real-time:** Socket.io
- **WhatsApp:** whatsapp-web.js
- **Database:** SQLite3
- **Frontend:** Vanilla JavaScript, CSS
- **Deployment:** Systemd service, Nginx reverse proxy

---

## 📁 Directory Structure

```
/opt/wa-bot/
├── server.js                 # Main bot server
├── package.json              # Dependencies
├── .env                      # Environment variables
├── wa-bot.db                 # SQLite database
├── wa-session/               # WhatsApp session data
├── public/                   # Web interface
│   ├── index.html            # Dashboard HTML
│   ├── css/
│   │   └── style.css         # Styles
│   └── js/
│       └── app.js            # Frontend logic
└── README.md                 # This file
```

---

## 🔧 Installation & Setup

### 1. Dependencies Installed:
- whatsapp-web.js
- qrcode
- express
- socket.io
- cors
- dotenv
- sqlite3

### 2. Service Configuration:
```bash
# Service location
/etc/systemd/system/wa-bot.service

# Service commands
sudo systemctl start wa-bot      # Start bot
sudo systemctl stop wa-bot       # Stop bot
sudo systemctl restart wa-bot    # Restart bot
sudo systemctl status wa-bot     # Check status
```

### 3. Nginx Configuration:
```nginx
# WebSocket proxy (Socket.io)
location /socket.io/ {
    proxy_pass http://127.0.0.1:3002;
    ...
}

# Static files & API
location ^~ /wa/ {
    alias /opt/wa-bot/public/;
    ...
}
```

---

## 🎯 How to Use

### Step 1: Access Dashboard
Visit: **https://kcclanka.com/wa/**

### Step 2: Scan QR Code
1. Open dashboard
2. QR code will appear automatically
3. Open WhatsApp on your phone
4. Go to **Settings** > **Linked Devices** > **Link a Device**
5. Scan the QR code
6. Wait for connection

### Step 3: Configure Auto-Replies
1. Go to **"Auto-Replies"** tab
2. Click **"➕ Add New"**
3. Enter:
   - **Keyword:** (e.g., "hello", "price", "hours")
   - **Response:** (your auto-reply message)
4. Click **"💾 Save"**

### Step 4: Manage Replies
- **Toggle Active:** Click ✓/○ button
- **Edit:** Click ✏️ button
- **Delete:** Click 🗑️ button

### Step 5: View Messages
- Go to **"Messages"** tab
- See all incoming/outgoing messages
- Green messages = from you
- White messages = from others
- Blue messages = auto-replies

### Step 6: Send Manual Messages
1. Go to **"Send Message"** tab
2. Enter phone number (with/without country code)
3. Type your message
4. Click **"📤 Send Message"**

### Step 7: Settings
- Toggle auto-reply on/off
- Set welcome message
- Configure bot behavior

---

## 📊 Database Schema

### Table: `auto_replies`
```sql
CREATE TABLE auto_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  response TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `messages`
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  sender_name TEXT,
  sender_number TEXT,
  message TEXT,
  is_from_me INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `settings`
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 API Endpoints

### Bot Status
```
GET /api/status
Response: { isReady, hasQR, clientInfo }
```

### Auto-Replies
```
GET /api/auto-replies           # Get all
POST /api/auto-replies          # Create new
PUT /api/auto-replies/:id       # Update
DELETE /api/auto-replies/:id    # Delete
```

### Messages
```
GET /api/messages?limit=50      # Get history
```

### Settings
```
GET /api/settings               # Get all settings
PUT /api/settings               # Update setting
```

---

## 🔐 Socket.io Events

### Client → Server:
- `disconnect_whatsapp` - Disconnect bot
- `reconnect_whatsapp` - Reconnect bot
- `send_message` - Send manual message

### Server → Client:
- `qr` - QR code data
- `authenticated` - Successfully authenticated
- `ready` - Bot ready
- `disconnected` - Bot disconnected
- `message` - New message received/sent
- `error` - Error occurred

---

## 💡 Default Auto-Replies

Pre-configured keywords:

| Keyword | Response |
|---------|----------|
| hello | Hello! Welcome to KCC Lanka... |
| hi | Hi there! Welcome to KCC Lanka... |
| price | For pricing information... |
| hours | Our business hours are... |
| location | KCC Lanka, Colombo... |
| help | I can help you with... |
| temco | TEMCO Development Bank offers... |

---

## 🔄 How Auto-Reply Works

1. **User sends message** → Bot receives message
2. **Check if auto-reply enabled** → Query settings
3. **Extract keyword** → Convert to lowercase, trim
4. **Match keyword** → Query database
5. **Send response** → Reply to user
6. **Log message** → Save to database
7. **Emit to dashboard** → Real-time update

---

## 🛠️ Maintenance

### View Logs:
```bash
# Real-time logs
journalctl -u wa-bot -f

# Last 100 lines
journalctl -u wa-bot -n 100

# Today's logs
journalctl -u wa-bot --since today
```

### Restart Service:
```bash
sudo systemctl restart wa-bot
```

### Check Status:
```bash
sudo systemctl status wa-bot
```

### View Database:
```bash
sqlite3 /opt/wa-bot/wa-bot.db

# View auto-replies
SELECT * FROM auto_replies;

# View messages
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;

# View settings
SELECT * FROM settings;
```

### Clear Session (Force Re-scan QR):
```bash
sudo systemctl stop wa-bot
rm -rf /opt/wa-bot/wa-session
sudo systemctl start wa-bot
```

---

## 🚨 Troubleshooting

### Bot Not Connecting?
1. Check service status: `systemctl status wa-bot`
2. Check logs: `journalctl -u wa-bot -n 50`
3. Clear session and restart
4. Ensure phone has internet connection

### QR Code Not Showing?
1. Refresh the dashboard page
2. Check if Socket.io is connected (top-right badge)
3. Check browser console for errors
4. Restart bot service

### Auto-Reply Not Working?
1. Check if auto-reply is enabled (Settings tab)
2. Verify keyword matches exactly (case-insensitive)
3. Check if reply is active (✓ button)
4. View logs to see if message was received

### Can't Send Messages?
1. Ensure bot is connected (status badge = green)
2. Check phone number format (should include country code)
3. Verify WhatsApp is linked on your phone
4. Check Socket.io connection

---

## 📱 Integration with Other Systems

### Link to TEMCO Leads:
You can integrate the bot with your TEMCO lead system:

```javascript
// In server.js, add custom handler
client.on('message', async (message) => {
  // Check if message contains TEMCO keywords
  if (message.body.toLowerCase().includes('temco') || 
      message.body.toLowerCase().includes('education loan')) {
    
    // Extract phone number
    const contact = await message.getContact();
    const whatsapp = contact.number;
    
    // Check if lead exists in TEMCO database
    // Send personalized response based on lead status
  }
});
```

### Link to Shop Orders:
```javascript
// Send order confirmations via WhatsApp
async function sendOrderConfirmation(orderNumber, whatsapp) {
  const chatId = `${whatsapp}@c.us`;
  await client.sendMessage(chatId, 
    `Your order #${orderNumber} has been confirmed! 🎉`
  );
}
```

---

## 🔒 Security

- **No credentials stored** - Uses WhatsApp Web authentication
- **Local session** - Session data stored locally
- **HTTPS** - All connections encrypted
- **No public API** - Bot server not exposed directly
- **Nginx proxy** - Additional security layer

---

## 📈 Performance

- **Memory:** ~400MB (includes Chromium for WhatsApp Web)
- **CPU:** Low (spikes during message processing)
- **Storage:** Minimal (SQLite database + session)
- **Latency:** <100ms for auto-replies

---

## 🎨 Customization

### Add Custom Auto-Replies:
Use the web dashboard or directly in database:
```sql
INSERT INTO auto_replies (keyword, response) 
VALUES ('custom', 'Your custom response here');
```

### Modify Response Logic:
Edit `server.js` message handler to add:
- Time-based responses
- User-specific responses
- Multi-keyword matching
- AI-powered responses

### Change Styling:
Edit `/opt/wa-bot/public/css/style.css` to customize colors, fonts, layout.

---

## 🚀 Future Enhancements

- [ ] Multi-keyword matching (OR logic)
- [ ] Scheduled messages
- [ ] Broadcast messaging
- [ ] Contact groups
- [ ] Media support (images, files)
- [ ] AI-powered responses (ChatGPT integration)
- [ ] Analytics dashboard
- [ ] Message templates
- [ ] CRM integration
- [ ] Webhook support

---

## 📞 Support

- **Dashboard:** https://kcclanka.com/wa/
- **Service Status:** `systemctl status wa-bot`
- **Logs:** `journalctl -u wa-bot -f`
- **Database:** `/opt/wa-bot/wa-bot.db`

---

## ✅ Quick Commands

```bash
# Service management
sudo systemctl start wa-bot
sudo systemctl stop wa-bot
sudo systemctl restart wa-bot
sudo systemctl status wa-bot

# Logs
journalctl -u wa-bot -f          # Follow logs
journalctl -u wa-bot -n 100      # Last 100 lines

# Database
sqlite3 /opt/wa-bot/wa-bot.db    # Open database
SELECT * FROM auto_replies;       # View replies
SELECT * FROM messages LIMIT 10;  # View messages

# Clear session
sudo systemctl stop wa-bot
rm -rf /opt/wa-bot/wa-session
sudo systemctl start wa-bot
```

---

**WhatsApp Auto-Reply Bot is ready! Visit https://kcclanka.com/wa/ to get started!** 🎉
