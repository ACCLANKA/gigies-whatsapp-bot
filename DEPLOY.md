# 🚀 Digital Ocean Deployment Guide

## Fixed Issues

### ✅ Database Connection
- **Fixed:** Database now uses proper path: `./data/wa-bot.db`
- **Fixed:** Data directory is auto-created on startup
- **Fixed:** Graceful error handling with exit code on failure

### ✅ Session Store
- **Fixed:** Environment-based session secret
- **Fixed:** Production-ready session configuration
- **Note:** MemoryStore is acceptable for single-instance deployments
- **Future:** Can upgrade to Redis for multi-instance scaling

## Required Environment Variables

Set these in Digital Ocean App Platform:

```env
# Required
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-random-secret-key-here

# Company Info
COMPANY_NAME=Your Store Name
COMPANY_SLUG=yourstore
CUSTOMER_SLUG=yourstore

# Ollama AI (Centralized Server)
OLLAMA_HOST=http://37.60.242.244:11434
OLLAMA_CLOUD=false
OLLAMA_MODEL=qwen2.5-coder:32b
```

## Deployment Steps

1. **Push to GitHub** (already done)
2. **Create App on Digital Ocean**
   - Source: GitHub → ACCLANKA/gigies-whatsapp-bot
   - Branch: main
   - Auto-deploy: Yes
3. **Set Environment Variables** (see above)
4. **Deploy!**

## Health Check

The app includes a health endpoint:
- **URL:** `/health`
- **Response:** `{"status":"OK","timestamp":"..."}`

Digital Ocean will use this to verify the app is running.

## Database

- **Type:** SQLite
- **Location:** `./data/wa-bot.db`
- **Auto-created:** Yes, on first run
- **Persistent:** Yes, using Digital Ocean's persistent storage

## Notes

- WhatsApp session will NOT work on Digital Ocean (headless browser limitation)
- For WhatsApp functionality, keep bot on VPS with display
- Use Digital Ocean for:
  - Dashboard/admin panel
  - E-commerce API
  - AI features (without WhatsApp)
- Or use this as a template for multi-user deployments

## Troubleshooting

If deployment fails:
1. Check logs in Digital Ocean console
2. Verify all environment variables are set
3. Ensure `data/` directory exists (it should auto-create)
4. Check database permissions

## Success!

Once deployed, your app will be available at:
`https://your-app-name.ondigitalocean.app`
