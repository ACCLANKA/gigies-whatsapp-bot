const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created data directory:', dataDir);
}

// Import Ollama AI
const OllamaAI = require('./utils/ollama');
const ollamaAI = new OllamaAI();

// Import AI Function Calling
const AIFunctions = require('./utils/ai-functions');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3002;

// Admin credentials (from master database)
const ADMIN_USERNAME = 'gigies';
const ADMIN_PASSWORD = '123456';

// Middleware
app.use(cors());
app.use(express.json());
// Session configuration - use environment-based secret
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'gigies-secret-key-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
};

// Use MemoryStore only in development (with warning)
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Using MemoryStore for sessions (development only)');
}

app.use(session(sessionConfig));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Serve login page for root
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  res.json({ loggedIn: req.session && req.session.loggedIn });
});

// Serve dashboard only if authenticated
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Protect all other static files
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') && !path.endsWith('login.html')) {
      // Will be handled by requireAuth middleware
    }
  }
}));

// Serve uploads folder for product images
app.use('/uploads', express.static('uploads'));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Database setup with proper path and error handling
// Try persistent DB first, fallback to in-memory if filesystem is read-only
let db;
let usingInMemory = false;

// Ensure data directory exists
const dbDir = path.join(__dirname, 'data');
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ Created database directory');
  }
  
  // Try to create persistent database
  const dbPath = path.join(dbDir, 'wa-bot.db');
  console.log('📁 Database path:', dbPath);
  
  // Test if we can write to the directory
  const testFile = path.join(dbDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  
  // Directory is writable, use persistent DB
  db = new sqlite3.Database(dbPath);
  console.log('✅ Using persistent SQLite database');
} catch (error) {
  // Filesystem is read-only or error occurred, use in-memory database
  console.error('⚠️  Cannot use persistent storage:', error.message);
  console.log('📝 Using in-memory database (data will not persist between restarts)');
  db = new sqlite3.Database(':memory:');
  usingInMemory = true;
}

// Initialize database tables
db.serialize(() => {
  // Auto-reply messages table
  db.run(`CREATE TABLE IF NOT EXISTS auto_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    response TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages log table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    sender_name TEXT,
    sender_number TEXT,
    message TEXT,
    is_from_me INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Bot settings table
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default auto-replies
  const defaultReplies = [
    ['hello', 'Hello! Welcome to KCC Lanka. How can I help you today? 👋'],
    ['hi', 'Hi there! Welcome to KCC Lanka. How can I assist you? 😊'],
    ['price', 'For pricing information, please visit https://kcclanka.com/shop/ or contact our sales team.'],
    ['hours', 'Our business hours are:\nMonday - Friday: 8:00 AM - 5:00 PM\nSaturday: 9:00 AM - 2:00 PM\nSunday: Closed'],
    ['location', 'KCC Lanka\nColombo, Sri Lanka\nWebsite: https://kcclanka.com'],
    ['help', 'I can help you with:\n• Product information\n• Pricing\n• Business hours\n• Contact details\n\nJust type your question!'],
    ['temco', 'TEMCO Development Bank offers education financing up to 10 years! Visit https://kcclanka.com/temco/ to apply.']
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO auto_replies (keyword, response) VALUES (?, ?)');
  defaultReplies.forEach(([keyword, response]) => {
    stmt.run(keyword, response);
  });
  stmt.finalize();

  // Insert default settings
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['auto_reply_enabled', 'true']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['welcome_message', 'Welcome to KCC Lanka! 🎉']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['ai_mode_enabled', 'false']);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['ai_fallback_enabled', 'true']);
  
  // Insert default AI system prompt (business information)
  const defaultSystemPrompt = `You are a helpful customer service assistant for KCC Lanka. 
Be friendly, professional, and provide detailed helpful responses.
Respond in the same language the user writes in (Sinhala, English, Tamil, etc.).

Provide information about:
- KCC Lanka services and products
- Business hours: Mon-Fri 8AM-5PM, Sat 9AM-2PM, Sunday Closed
- Location: Colombo, Sri Lanka
- Website: https://kcclanka.com
- TEMCO Development Bank: Education financing up to 10 years at https://kcclanka.com/temco/
- Online Shop: https://kcclanka.com/shop/
- Student Portal (for courses & enrollment): https://kcclanka.com/student/

IMPORTANT URL FORMATTING:
- When mentioning URLs, use PLAIN TEXT only (https://kcclanka.com/student/)
- DO NOT use markdown link format like [text](url)
- DO NOT repeat the URL twice
- Just write the URL as plain text
- For student portal, ALWAYS use ONLY https://kcclanka.com/student/ - never use index.html or any other variation

For simple greetings, keep it brief. For questions about services or products, provide detailed, helpful information.
Always be helpful and guide users to relevant pages.`;
  
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['ai_system_prompt', defaultSystemPrompt]);
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['ai_conversation_history', '10']);
  
  // Create user data tables for AI function calling
  
  // User courses/enrollments table
  db.run(`CREATE TABLE IF NOT EXISTS user_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    course_name TEXT NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active',
    completion_percentage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // User orders table
  db.run(`CREATE TABLE IF NOT EXISTS user_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_amount DECIMAL(10,2),
    order_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending',
    delivery_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // User profile data table
  db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
    phone_number TEXT PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    registration_date DATE DEFAULT CURRENT_DATE,
    customer_type TEXT DEFAULT 'regular',
    total_purchases DECIMAL(10,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // E-commerce categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // E-commerce products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  // Store settings table
  db.run(`CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Shopping cart table
  db.run(`CREATE TABLE IF NOT EXISTS shopping_cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    customer_name TEXT,
    delivery_address TEXT,
    city TEXT,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  // Registered members table for order history enrichment
  db.run(`CREATE TABLE IF NOT EXISTS registered_members (
    phone_number TEXT PRIMARY KEY,
    name TEXT,
    address TEXT,
    city TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_order_at DATETIME
  )`);
  
  // Insert sample data for testing
  db.run(`INSERT OR IGNORE INTO user_courses (phone_number, course_name, status, completion_percentage) VALUES 
    ('94771234567', 'Web Development Bootcamp', 'active', 75),
    ('94771234567', 'Python for Beginners', 'completed', 100),
    ('94777654321', 'Digital Marketing', 'active', 30)`);
  
  db.run(`INSERT OR IGNORE INTO user_orders (phone_number, order_number, product_name, quantity, total_amount, status) VALUES 
    ('94771234567', 'ORD-001', 'Laptop Stand', 1, 4500.00, 'delivered'),
    ('94771234567', 'ORD-002', 'Wireless Mouse', 2, 3000.00, 'shipped'),
    ('94777654321', 'ORD-003', 'USB Cable', 3, 1500.00, 'pending')`);
  
  db.run(`INSERT OR IGNORE INTO user_profiles (phone_number, full_name, email, customer_type, total_purchases) VALUES 
    ('94771234567', 'Kasun Perera', 'kasun@email.com', 'premium', 15000.00),
    ('94777654321', 'Nimal Silva', 'nimal@email.com', 'regular', 5000.00)`);
});

// WhatsApp Client
let client;
let qrCodeData = null;
let isReady = false;
let clientInfo = null;

// Initialize WhatsApp Client
function initializeClient() {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './wa-session'
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // QR Code event
  client.on('qr', (qr) => {
    console.log('QR Code received');
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        console.error('QR Code generation error:', err);
        return;
      }
      qrCodeData = url;
      io.emit('qr', url);
    });
  });

  // Ready event
  client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    isReady = true;
    qrCodeData = null;
    
    try {
      clientInfo = {
        user: client.info.wid.user,
        pushname: client.info.pushname,
        platform: client.info.platform
      };
      io.emit('ready', clientInfo);
    } catch (error) {
      console.error('Error getting client info:', error);
    }
  });

  // Authenticated event
  client.on('authenticated', () => {
    console.log('WhatsApp Client authenticated');
    io.emit('authenticated');
  });

  // Authentication failure event
  client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
    io.emit('auth_failure', msg);
  });

  // Disconnected event
  client.on('disconnected', (reason) => {
    console.log('WhatsApp Client disconnected:', reason);
    isReady = false;
    clientInfo = null;
    io.emit('disconnected', reason);
  });

  // Message event
  client.on('message', async (message) => {
    try {
      const chat = await message.getChat();
      const contact = await message.getContact();
      
      // Log message to database
      db.run(
        'INSERT INTO messages (chat_id, sender_name, sender_number, message, is_from_me) VALUES (?, ?, ?, ?, ?)',
        [chat.id._serialized, contact.name || contact.pushname, contact.number, message.body, message.fromMe ? 1 : 0]
      );

      // Emit message to web interface
      io.emit('message', {
        chatId: chat.id._serialized,
        senderName: contact.name || contact.pushname,
        senderNumber: contact.number,
        message: message.body,
        fromMe: message.fromMe,
        timestamp: new Date()
      });

      // Don't auto-reply to own messages
      if (message.fromMe) return;

      // Check if auto-reply is enabled
      db.get('SELECT value FROM settings WHERE key = ?', ['auto_reply_enabled'], async (err, row) => {
        if (err || !row || row.value !== 'true') return;

        const messageText = message.body.trim();
        const messageTextLower = messageText.toLowerCase();

        // Check AI mode setting
        db.get('SELECT value FROM settings WHERE key = ?', ['ai_mode_enabled'], async (err, aiModeRow) => {
          const aiModeEnabled = aiModeRow && aiModeRow.value === 'true';

          if (aiModeEnabled) {
            // AI Mode: Use Ollama for intelligent responses
            try {
              // Get AI settings (system prompt and history length)
              db.get('SELECT value FROM settings WHERE key = ?', ['ai_system_prompt'], async (err, promptRow) => {
                db.get('SELECT value FROM settings WHERE key = ?', ['ai_conversation_history'], async (err, historyLengthRow) => {
                  
                  // Enhance system prompt with function calling capabilities
                  let systemPrompt = promptRow && promptRow.value ? promptRow.value : ollamaAI.getDefaultSystemPrompt();
                  systemPrompt = AIFunctions.getSystemPromptWithFunctions(systemPrompt);
                  ollamaAI.setSystemPrompt(systemPrompt);
                  
                  // Get conversation history length (default 10)
                  const historyLength = historyLengthRow && historyLengthRow.value ? parseInt(historyLengthRow.value) : 10;
                  
                  // Get conversation history for context
                  db.all(
                    `SELECT message, is_from_me FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ${historyLength}`,
                    [chat.id._serialized],
                    async (err, history) => {
                      const conversationHistory = history ? history.reverse() : [];
                      
                      // STEP 1: Generate initial AI response
                      let aiResponse = await ollamaAI.generateResponse(messageText, conversationHistory);
                      
                      // STEP 2: Check if AI requested any functions
                      if (aiResponse.success) {
                        const functionResult = await AIFunctions.processAIResponseWithFunctions(
                          aiResponse.message, 
                          contact.number
                        );
                        
                        if (functionResult.needsRetry) {
                          // AI requested functions - execute them and regenerate response
                          console.log(`AI requested ${functionResult.functionsExecuted.length} function(s) for ${contact.number}`);
                          
                          // Add function results to conversation and regenerate
                          const enhancedHistory = [...conversationHistory, {
                            is_from_me: false,
                            message: messageText
                          }];
                          
                          // Create context message with function results
                          const contextMessage = `${functionResult.functionContext}\n\n⚠️ IMPORTANT: The function has ALREADY been executed. DO NOT repeat the [FUNCTION:...] tag in your response.\nInstead, use the data above to answer the user's question naturally.\n\nUser's question: "${messageText}"\n\nProvide a helpful response using ONLY the data shown above:`;
                          
                          // STEP 3: Regenerate with function data
                          aiResponse = await ollamaAI.generateResponse(contextMessage, enhancedHistory);
                          
                          console.log(`AI regenerated response with function data for ${contact.number}`);
                        }
                      }
                  
                  if (aiResponse.success) {
                    // Remove any remaining function call tags and debug text from response
                    let cleanMessage = aiResponse.message;
                    cleanMessage = cleanMessage.replace(/\[FUNCTION:[^\]]+\]/g, '').trim();
                    
                    // Remove any debug/context markers that might leak
                    cleanMessage = cleanMessage.replace(/---\s*Retrieved Data FROM DATABASE\s*---/gi, '');
                    cleanMessage = cleanMessage.replace(/⚠️\s*CRITICAL:.*?DO NOT INVENT ANY PRODUCTS OR DETAILS\./gi, '');
                    cleanMessage = cleanMessage.replace(/⚠️\s*ONLY show products.*?DO NOT make up products\./gi, '');
                    cleanMessage = cleanMessage.replace(/If the data is empty.*?DO NOT make up products\./gi, '');
                    cleanMessage = cleanMessage.replace(/BROWSE_CATEGORIES:|SEARCH_PRODUCTS:|VIEW_CART:|ADD_TO_CART:|PRODUCTS_BY_CATEGORY:/gi, '');
                    cleanMessage = cleanMessage.trim();
                    
                    // If message is empty after removing tags, provide fallback
                    if (!cleanMessage) {
                      cleanMessage = 'I\'m processing your request. Please try rephrasing your question.';
                    }
                    
                    // Send AI-generated reply
                    await message.reply(cleanMessage);
                    console.log(`AI reply sent to ${contact.number}: ${cleanMessage}`);

                    // Send product images if products were shown
                    try {
                      // Look for image_url in the AI response - matches both JSON format and mention format
                      const productImageRegex = /image_url["']?\s*:\s*["']([^"'\s]+)["']|image_url:\s*([^\s,\]]+)/gi;
                      const matches = [...aiResponse.message.matchAll(productImageRegex)];
                      
                      const imageUrls = new Set(); // Use Set to avoid duplicates
                      
                      for (const match of matches) {
                        const imageUrl = match[1] || match[2];
                        if (imageUrl && !imageUrl.startsWith('http://example') && imageUrl.length > 5) {
                          imageUrls.add(imageUrl.trim());
                        }
                      }
                      
                      if (imageUrls.size > 0) {
                        console.log(`[PRODUCT-IMAGES] Found ${imageUrls.size} unique product image(s) to send`);
                        
                        let sentCount = 0;
                        for (const imageUrl of Array.from(imageUrls).slice(0, 5)) { // Limit to 5 images
                          try {
                            let mediaUrl = imageUrl;
                            
                            // Convert local path to full URL if needed
                            if (imageUrl.startsWith('/uploads/')) {
                              const baseUrl = `http://localhost:${PORT}`;
                              mediaUrl = `${baseUrl}${imageUrl}`;
                            }
                            
                            console.log(`[PRODUCT-IMAGES] Attempting to send image from: ${mediaUrl}`);
                            const { MessageMedia } = require('whatsapp-web.js');
                            const media = await MessageMedia.fromUrl(mediaUrl);
                            await client.sendMessage(chat.id._serialized, media);
                            sentCount++;
                            console.log(`[PRODUCT-IMAGES] ✅ Successfully sent image ${sentCount}: ${imageUrl}`);
                            
                            // Small delay between images to avoid rate limiting
                            if (sentCount < imageUrls.size) {
                              await new Promise(resolve => setTimeout(resolve, 500));
                            }
                          } catch (imgErr) {
                            console.error(`[PRODUCT-IMAGES] ❌ Failed to send image ${imageUrl}:`, imgErr.message);
                          }
                        }
                        
                        if (sentCount > 0) {
                          console.log(`[PRODUCT-IMAGES] Total images sent: ${sentCount}/${imageUrls.size}`);
                        }
                      } else {
                        console.log('[PRODUCT-IMAGES] No product images found in AI response');
                      }
                    } catch (imageErr) {
                      console.error('[PRODUCT-IMAGES] Error processing images:', imageErr.message);
                    }

                    // Log AI reply
                    db.run(
                      'INSERT INTO messages (chat_id, sender_name, sender_number, message, is_from_me) VALUES (?, ?, ?, ?, ?)',
                      [chat.id._serialized, 'AI Bot', 'ai', cleanMessage, 1]
                    );

                    // Emit to web interface
                    io.emit('message', {
                      chatId: chat.id._serialized,
                      senderName: 'AI Bot',
                      senderNumber: 'ai',
                      message: cleanMessage,
                      fromMe: true,
                      timestamp: new Date(),
                      isAutoReply: true,
                      isAI: true
                    });
                  } else {
                    // AI failed, try keyword fallback if enabled
                    db.get('SELECT value FROM settings WHERE key = ?', ['ai_fallback_enabled'], async (err, fallbackRow) => {
                      if (fallbackRow && fallbackRow.value === 'true') {
                        await tryKeywordMatch(messageTextLower, message, chat, contact);
                      }
                    });
                  }
                    }
                  );
                });
              });
            } catch (error) {
              console.error('AI response error:', error);
              // Try keyword fallback
              db.get('SELECT value FROM settings WHERE key = ?', ['ai_fallback_enabled'], async (err, fallbackRow) => {
                if (fallbackRow && fallbackRow.value === 'true') {
                  await tryKeywordMatch(messageTextLower, message, chat, contact);
                }
              });
            }
          } else {
            // Keyword Mode: Traditional keyword-based responses
            await tryKeywordMatch(messageTextLower, message, chat, contact);
          }
        });
      });

      // Helper function for keyword matching
      async function tryKeywordMatch(messageTextLower, message, chat, contact) {
        db.get(
          'SELECT response FROM auto_replies WHERE keyword = ? AND is_active = 1',
          [messageTextLower],
          async (err, reply) => {
            if (err || !reply) return;

            // Send keyword-based auto-reply
            await message.reply(reply.response);
            console.log(`Auto-reply sent to ${contact.number}: ${reply.response}`);

            // Log auto-reply
            db.run(
              'INSERT INTO messages (chat_id, sender_name, sender_number, message, is_from_me) VALUES (?, ?, ?, ?, ?)',
              [chat.id._serialized, 'Bot', 'auto', reply.response, 1]
            );

            // Emit auto-reply to web interface
            io.emit('message', {
              chatId: chat.id._serialized,
              senderName: 'Bot',
              senderNumber: 'auto',
              message: reply.response,
              fromMe: true,
              timestamp: new Date(),
              isAutoReply: true
            });
          }
        );
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });

  // Initialize client
  client.initialize();
}

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current status
  socket.emit('status', {
    isReady,
    qrCode: qrCodeData,
    clientInfo
  });

  // Disconnect client
  socket.on('disconnect_whatsapp', async () => {
    if (client) {
      await client.destroy();
      isReady = false;
      clientInfo = null;
      qrCodeData = null;
      io.emit('disconnected', 'Manual disconnect');
    }
  });

  // Reconnect client
  socket.on('reconnect_whatsapp', () => {
    if (!client || !isReady) {
      initializeClient();
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      if (!isReady) {
        socket.emit('error', 'WhatsApp client not ready');
        return;
      }

      const { number, message } = data;
      const chatId = number.includes('@') ? number : `${number}@c.us`;
      
      await client.sendMessage(chatId, message);
      socket.emit('message_sent', { success: true });
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Routes

// Get bot status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isReady,
      hasQR: !!qrCodeData,
      clientInfo
    }
  });
});

// Get auto-replies
app.get('/api/auto-replies', (req, res) => {
  db.all('SELECT * FROM auto_replies ORDER BY keyword', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, data: rows });
  });
});

// Add auto-reply
app.post('/api/auto-replies', (req, res) => {
  const { keyword, response } = req.body;
  
  if (!keyword || !response) {
    return res.status(400).json({ success: false, message: 'Keyword and response required' });
  }

  db.run(
    'INSERT INTO auto_replies (keyword, response) VALUES (?, ?)',
    [keyword.toLowerCase().trim(), response],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'Keyword already exists' });
        }
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, data: { id: this.lastID } });
    }
  );
});

// Update auto-reply
app.put('/api/auto-replies/:id', (req, res) => {
  const { id } = req.params;
  const { keyword, response, is_active } = req.body;

  const updates = [];
  const values = [];

  if (keyword !== undefined) {
    updates.push('keyword = ?');
    values.push(keyword.toLowerCase().trim());
  }
  if (response !== undefined) {
    updates.push('response = ?');
    values.push(response);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.run(
    `UPDATE auto_replies SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// Delete auto-reply
app.delete('/api/auto-replies/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM auto_replies WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true });
  });
});

// Get messages history
app.get('/api/messages', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  db.all(
    'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [parseInt(limit), parseInt(offset)],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, data: rows });
    }
  );
});

// Get settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  });
});

// Update settings
app.put('/api/settings', (req, res) => {
  const { key, value } = req.body;

  db.run(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [key, value],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// Test AI connection
app.get('/api/ai/test', async (req, res) => {
  try {
    const result = await ollamaAI.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to test AI connection',
      error: error.message
    });
  }
});

// List available models
app.get('/api/ai/models', async (req, res) => {
  try {
    const result = await ollamaAI.listAvailableModels();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list models',
      error: error.message
    });
  }
});

// Change AI model
app.post('/api/ai/model', (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ success: false, message: 'Model name required' });
    }
    
    // Update environment variable
    process.env.OLLAMA_MODEL = model;
    
    // Reinitialize OllamaAI with new model
    const OllamaAI = require('./utils/ollama');
    global.ollamaAI = new OllamaAI();
    
    res.json({ 
      success: true, 
      message: `Model changed to ${model}`,
      model: model
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to change model',
      error: error.message
    });
  }
});

// Get user data (courses, orders, profile)
app.get('/api/user/:phoneNumber/courses', (req, res) => {
  AIFunctions.getUserCourses(req.params.phoneNumber)
    .then(data => res.json({ success: true, data }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

app.get('/api/user/:phoneNumber/orders', (req, res) => {
  AIFunctions.getUserOrders(req.params.phoneNumber)
    .then(data => res.json({ success: true, data }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

app.get('/api/user/:phoneNumber/profile', (req, res) => {
  AIFunctions.getUserProfile(req.params.phoneNumber)
    .then(data => res.json({ success: true, data }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

// Add user course
app.post('/api/user/course', (req, res) => {
  const { phone_number, course_name, status, completion_percentage } = req.body;
  
  db.run(
    'INSERT INTO user_courses (phone_number, course_name, status, completion_percentage) VALUES (?, ?, ?, ?)',
    [phone_number, course_name, status || 'active', completion_percentage || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Add user order
app.post('/api/user/order', (req, res) => {
  const { phone_number, order_number, product_name, quantity, total_amount, status } = req.body;
  
  db.run(
    'INSERT INTO user_orders (phone_number, order_number, product_name, quantity, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
    [phone_number, order_number, product_name, quantity || 1, total_amount, status || 'pending'],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Add/Update user profile
app.post('/api/user/profile', (req, res) => {
  const { phone_number, full_name, email, address, city, customer_type, total_purchases } = req.body;
  
  db.run(
    `INSERT INTO user_profiles (phone_number, full_name, email, address, city, customer_type, total_purchases) 
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(phone_number) DO UPDATE SET
       full_name = excluded.full_name,
       email = excluded.email,
       address = excluded.address,
       city = excluded.city,
       customer_type = excluded.customer_type,
       total_purchases = excluded.total_purchases`,
    [phone_number, full_name, email, address, city, customer_type || 'regular', total_purchases || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// =============================================
// E-COMMERCE API ENDPOINTS
// =============================================

// Get all products
app.get('/api/ecommerce/products', requireAuth, (req, res) => {
  db.all(`
    SELECT p.*, c.name as category_name 
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, products: rows || [] });
  });
});

// Get single product
app.get('/api/ecommerce/products/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, product: row });
  });
});

// Upload product image
app.post('/api/ecommerce/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'No file uploaded' });
  }
  const imageUrl = `/uploads/products/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});

// Add product
app.post('/api/ecommerce/products', requireAuth, (req, res) => {
  const { name, description, price, stock_quantity, image_url, status, category_id } = req.body;
  db.run(`
    INSERT INTO products (name, description, price, stock_quantity, image_url, status, category_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [name, description, price, stock_quantity, image_url, status, category_id], (err) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true });
  });
});

// Update product
app.put('/api/ecommerce/products/:id', requireAuth, (req, res) => {
  const { name, description, price, stock_quantity, image_url, status, category_id } = req.body;
  db.run(`
    UPDATE products 
    SET name = ?, description = ?, price = ?, stock_quantity = ?, image_url = ?, status = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, description, price, stock_quantity, image_url, status, category_id, req.params.id], (err) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true });
  });
});

// Delete product
app.delete('/api/ecommerce/products/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true });
  });
});

// Get all categories
app.get('/api/ecommerce/categories', requireAuth, (req, res) => {
  db.all(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
    WHERE c.active = 1
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `, [], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, categories: rows || [] });
  });
});

// Get single category
app.get('/api/ecommerce/categories/:id', requireAuth, (req, res) => {
  db.get('SELECT * FROM categories WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, category: row });
  });
});

// Add category
app.post('/api/ecommerce/categories', requireAuth, (req, res) => {
  const { name, description, icon, sort_order } = req.body;
  db.run(`
    INSERT INTO categories (name, description, icon, sort_order)
    VALUES (?, ?, ?, ?)
  `, [name, description, icon, sort_order || 0], function(err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Update category
app.put('/api/ecommerce/categories/:id', requireAuth, (req, res) => {
  const { name, description, icon, sort_order } = req.body;
  db.run(`
    UPDATE categories 
    SET name = ?, description = ?, icon = ?, sort_order = ?
    WHERE id = ?
  `, [name, description, icon, sort_order, req.params.id], (err) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true });
  });
});

// Delete category
app.delete('/api/ecommerce/categories/:id', requireAuth, (req, res) => {
  // Check if category has products
  db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    if (row.count > 0) {
      return res.json({ success: false, message: 'Cannot delete category with products' });
    }
    db.run('DELETE FROM categories WHERE id = ?', [req.params.id], (err) => {
      if (err) {
        return res.json({ success: false, message: err.message });
      }
      res.json({ success: true });
    });
  });
});

// Get all orders
app.get('/api/ecommerce/orders', requireAuth, (req, res) => {
  db.all(`
    SELECT * FROM orders 
    ORDER BY created_at DESC
  `, [], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, orders: rows || [] });
  });
});

// Update order status
app.put('/api/ecommerce/orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;
  
  // First, get the order details before updating
  db.get(`
    SELECT order_number, phone_number, customer_name, total_amount, status as old_status
    FROM orders 
    WHERE id = ?
  `, [orderId], async (err, order) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    // Update the order status
    db.run(`
      UPDATE orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, orderId], async (updateErr) => {
      if (updateErr) {
        return res.json({ success: false, message: updateErr.message });
      }
      
      // Send WhatsApp notification to customer
      try {
        if (client && client.info && order.phone_number) {
          const phoneNumber = order.phone_number.replace(/^0/, '94'); // Convert to international format
          const chatId = phoneNumber + '@c.us';
          
          // Create status message based on status
          let statusMessage = '';
          const storeName = 'Gigies';
          const orderNum = order.order_number;
          const customerName = order.customer_name || 'Customer';
          
          switch(status) {
            case 'confirmed':
              statusMessage = `✅ *Order Confirmed!*\n\nHello ${customerName},\n\nYour order ${orderNum} has been confirmed and is being prepared.\n\n*Order Total:* Rs. ${order.total_amount}\n\nWe'll notify you once it's ready for delivery.\n\nThank you for shopping with ${storeName}! 🛍️`;
              break;
              
            case 'processing':
              statusMessage = `📦 *Order Processing*\n\nHello ${customerName},\n\nYour order ${orderNum} is now being processed.\n\nWe're carefully preparing your items for delivery.\n\nTrack your order anytime by asking about order ${orderNum}.\n\n${storeName}`;
              break;
              
            case 'shipped':
            case 'out_for_delivery':
              statusMessage = `🚚 *Order Shipped!*\n\nHello ${customerName},\n\nGreat news! Your order ${orderNum} is on its way!\n\n*Order Total:* Rs. ${order.total_amount}\n\nExpected delivery: 1-2 business days\n\nFor delivery inquiries, please contact us.\n\n${storeName}`;
              break;
              
            case 'delivered':
              statusMessage = `✅ *Order Delivered!*\n\nHello ${customerName},\n\nYour order ${orderNum} has been delivered successfully!\n\n*Order Total:* Rs. ${order.total_amount}\n\nWe hope you enjoy your purchase! 😊\n\nIf you have any issues, please let us know.\n\nThank you for choosing ${storeName}! 🎉`;
              break;
              
            case 'cancelled':
              statusMessage = `❌ *Order Cancelled*\n\nHello ${customerName},\n\nYour order ${orderNum} has been cancelled.\n\n*Order Total:* Rs. ${order.total_amount}\n\nIf this was a mistake or you have questions, please contact us.\n\nWe hope to serve you again soon.\n\n${storeName}`;
              break;
              
            case 'refunded':
              statusMessage = `💰 *Refund Processed*\n\nHello ${customerName},\n\nYour refund for order ${orderNum} has been processed.\n\n*Refund Amount:* Rs. ${order.total_amount}\n\nPlease allow 3-5 business days for the refund to reflect in your account.\n\n${storeName}`;
              break;
              
            default:
              statusMessage = `📋 *Order Status Update*\n\nHello ${customerName},\n\nYour order ${orderNum} status has been updated to: *${status}*\n\n*Order Total:* Rs. ${order.total_amount}\n\nFor more details, please ask about your order.\n\n${storeName}`;
          }
          
          // Send the message
          await client.sendMessage(chatId, statusMessage);
          console.log(`[ORDER-NOTIFICATION] Status update sent to ${order.phone_number} for order ${orderNum}: ${status}`);
        }
      } catch (notifyErr) {
        console.error(`[ORDER-NOTIFICATION] Failed to send notification: ${notifyErr.message}`);
        // Don't fail the request if notification fails
      }
      
      res.json({ success: true, message: 'Order status updated and customer notified' });
    });
  });
});

// Get store settings
app.get('/api/ecommerce/settings', requireAuth, (req, res) => {
  db.all('SELECT key, value FROM store_settings', [], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, settings });
  });
});

// Save store settings
app.post('/api/ecommerce/settings', requireAuth, (req, res) => {
  const settings = req.body;
  const updates = Object.keys(settings).map(key => {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO store_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [key, settings[key]], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  Promise.all(updates)
    .then(() => res.json({ success: true }))
    .catch(err => res.json({ success: false, message: err.message }));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
server.listen(PORT, () => {
  console.log(`WhatsApp Bot Server running on port ${PORT}`);
  initializeClient();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (client) {
    await client.destroy();
  }
  db.close();
  process.exit(0);
});
