# 🤖 AI Function Calling System - Complete Guide

**Status:** ✅ **ACTIVATED**  
**Feature:** AI can query database for user-specific information  
**Date:** October 20, 2025

---

## 🎯 What Is This?

Your AI can now **intelligently fetch user data from your database** before responding!

### **The Problem It Solves:**

**Before:**
```
User: "What courses am I enrolled in?"
AI: "I don't have access to your enrollment information. Please check your account."
❌ Generic, unhelpful response
```

**Now:**
```
User: "What courses am I enrolled in?"
AI: [Detects need for data] → [Queries database] → [Gets user's courses]
AI: "You're enrolled in 2 courses:
     1. Web Development Bootcamp (75% complete) ✅
     2. Python for Beginners (100% complete) ✅
     Keep up the great work!"
✅ Personalized, accurate response!
```

---

## 🔄 How It Works

### **3-Step Process:**

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: User asks question                                 │
│  "What courses am I enrolled in?"                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: AI analyzes & requests data                        │
│  AI Response: "[FUNCTION:get_user_courses]"                 │
│                                                              │
│  System detects function call                               │
│  Executes: getUserCourses(phone_number)                     │
│  Gets data from database                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: AI generates personalized response                 │
│  AI receives: {                                             │
│    "Web Development Bootcamp": 75% complete,                │
│    "Python for Beginners": 100% complete                    │
│  }                                                           │
│                                                              │
│  AI Response: "You're enrolled in 2 courses..."             │
│  ✅ Sent to user!                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Available Functions

### **1. Get User Courses**
```
Function: [FUNCTION:get_user_courses]
What it does: Fetches user's enrolled courses with progress
Returns: Course name, status, completion %, enrollment date
```

**Example:**
```
User: "What courses am I enrolled in?"
AI calls: [FUNCTION:get_user_courses]
Data returned:
[
  {
    "course_name": "Web Development Bootcamp",
    "status": "active",
    "completion_percentage": 75,
    "enrollment_date": "2025-01-15"
  },
  {
    "course_name": "Python for Beginners",
    "status": "completed",
    "completion_percentage": 100,
    "enrollment_date": "2024-12-01"
  }
]
```

---

### **2. Get User Orders**
```
Function: [FUNCTION:get_user_orders]
What it does: Fetches user's order history
Returns: Order number, products, amounts, status, dates
```

**Example:**
```
User: "Show me my recent orders"
AI calls: [FUNCTION:get_user_orders]
Data returned:
[
  {
    "order_number": "ORD-002",
    "product_name": "Wireless Mouse",
    "quantity": 2,
    "total_amount": 3000.00,
    "status": "shipped",
    "order_date": "2025-10-18"
  }
]
```

---

### **3. Get User Profile**
```
Function: [FUNCTION:get_user_profile]
What it does: Fetches user's profile information
Returns: Name, email, address, customer type, total purchases
```

**Example:**
```
User: "What's my account status?"
AI calls: [FUNCTION:get_user_profile]
Data returned:
{
  "full_name": "Kasun Perera",
  "email": "kasun@email.com",
  "customer_type": "premium",
  "total_purchases": 15000.00,
  "registration_date": "2024-06-01"
}
```

---

### **4. Get Specific Order**
```
Function: [FUNCTION:get_order_details:ORDER_NUMBER]
What it does: Fetches details of specific order
Returns: Complete order information
```

**Example:**
```
User: "Where is my order ORD-002?"
AI calls: [FUNCTION:get_order_details:ORD-002]
Data returned:
{
  "order_number": "ORD-002",
  "product_name": "Wireless Mouse",
  "quantity": 2,
  "total_amount": 3000.00,
  "status": "shipped",
  "customer_name": "Kasun Perera"
}
```

---

### **5. Get Course Progress**
```
Function: [FUNCTION:get_course_progress:COURSE_NAME]
What it does: Fetches progress for specific course
Returns: Detailed course progress information
```

**Example:**
```
User: "How's my progress in Web Development?"
AI calls: [FUNCTION:get_course_progress:Web Development]
Data returned:
{
  "course_name": "Web Development Bootcamp",
  "status": "active",
  "completion_percentage": 75,
  "enrollment_date": "2025-01-15"
}
```

---

## 📊 Database Structure

### **Table 1: user_courses**
```sql
CREATE TABLE user_courses (
  id INTEGER PRIMARY KEY,
  phone_number TEXT,
  course_name TEXT,
  enrollment_date DATE,
  status TEXT,              -- 'active', 'completed', 'suspended'
  completion_percentage INTEGER,
  created_at DATETIME
);
```

### **Table 2: user_orders**
```sql
CREATE TABLE user_orders (
  id INTEGER PRIMARY KEY,
  phone_number TEXT,
  order_number TEXT UNIQUE,
  product_name TEXT,
  quantity INTEGER,
  total_amount DECIMAL(10,2),
  order_date DATE,
  status TEXT,              -- 'pending', 'shipped', 'delivered'
  delivery_address TEXT,
  created_at DATETIME
);
```

### **Table 3: user_profiles**
```sql
CREATE TABLE user_profiles (
  phone_number TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  registration_date DATE,
  customer_type TEXT,       -- 'regular', 'premium', 'vip'
  total_purchases DECIMAL(10,2),
  created_at DATETIME
);
```

---

## 🧪 Testing With Sample Data

### **Sample User 1: 94771234567 (Kasun Perera)**
```
Courses:
- Web Development Bootcamp (75% complete, active)
- Python for Beginners (100% complete, completed)

Orders:
- ORD-001: Laptop Stand (delivered)
- ORD-002: Wireless Mouse x2 (shipped)

Profile:
- Premium customer
- Total purchases: Rs. 15,000
```

### **Sample User 2: 94777654321 (Nimal Silva)**
```
Courses:
- Digital Marketing (30% complete, active)

Orders:
- ORD-003: USB Cable x3 (pending)

Profile:
- Regular customer
- Total purchases: Rs. 5,000
```

---

## 🎯 Test Scenarios

### **Test 1: Ask About Courses**
```
Send from 94771234567:
"What courses am I enrolled in?"

Expected AI Response:
"You're currently enrolled in 2 courses:

1. 📚 Web Development Bootcamp
   Status: Active
   Progress: 75% complete
   Enrolled: January 15, 2025

2. 🎓 Python for Beginners  
   Status: Completed ✅
   Progress: 100%
   Enrolled: December 1, 2024

Great progress on the Web Development course! Keep it up!"
```

---

### **Test 2: Ask About Orders**
```
Send from 94771234567:
"Show my recent orders"

Expected AI Response:
"Here are your recent orders:

1. Order #ORD-002 📦
   Product: Wireless Mouse (Qty: 2)
   Amount: Rs. 3,000
   Status: Shipped 🚚
   Date: October 18, 2025

2. Order #ORD-001 ✅
   Product: Laptop Stand
   Amount: Rs. 4,500
   Status: Delivered
   Date: Earlier

Your ORD-002 is currently being shipped!"
```

---

### **Test 3: Track Specific Order**
```
Send from 94771234567:
"Where is my order ORD-002?"

Expected AI Response:
"Order #ORD-002 Status:

Product: Wireless Mouse (x2)
Amount: Rs. 3,000
Status: Shipped 🚚
Order Date: October 18, 2025

Your order has been shipped and is on its way! 
Expected delivery: 2-3 business days."
```

---

### **Test 4: Check Account Status**
```
Send from 94771234567:
"What's my account status?"

Expected AI Response:
"Hello Kasun Perera! 👋

Account Type: Premium ⭐
Email: kasun@email.com
Total Purchases: Rs. 15,000
Member Since: June 1, 2024

As a premium customer, you enjoy:
- Priority support
- Exclusive discounts
- Free shipping on orders over Rs. 2,000

Thank you for being a valued customer!"
```

---

## 🔧 How AI Detects What to Fetch

The AI is trained to recognize when it needs user data:

### **Trigger Phrases for Courses:**
- "my courses"
- "what am I learning"
- "my enrollments"
- "course progress"
- "enrolled courses"

### **Trigger Phrases for Orders:**
- "my orders"
- "order history"
- "recent purchases"
- "what did I buy"
- "show my orders"

### **Trigger Phrases for Profile:**
- "my account"
- "account status"
- "my profile"
- "account information"
- "who am I"

### **Trigger Phrases for Specific Order:**
- "order ORD-001"
- "track order"
- "where is my order"
- "order status ORD-002"

---

## 📱 API Endpoints (For Integration)

### **Get User Data:**
```bash
# Get courses
GET /api/user/94771234567/courses

# Get orders
GET /api/user/94771234567/orders

# Get profile
GET /api/user/94771234567/profile
```

### **Add New Data:**
```bash
# Add course enrollment
POST /api/user/course
{
  "phone_number": "94771234567",
  "course_name": "JavaScript Masterclass",
  "status": "active",
  "completion_percentage": 0
}

# Add order
POST /api/user/order
{
  "phone_number": "94771234567",
  "order_number": "ORD-004",
  "product_name": "Keyboard",
  "quantity": 1,
  "total_amount": 5500.00,
  "status": "pending"
}

# Add/Update profile
POST /api/user/profile
{
  "phone_number": "94771234567",
  "full_name": "Kasun Perera",
  "email": "kasun@email.com",
  "customer_type": "premium",
  "total_purchases": 20000.00
}
```

---

## 💡 Adding Your Own Data

### **Method 1: Via Database (SQLite)**
```bash
# Connect to database
sqlite3 /opt/wa-bot/wa-bot.db

# Add course
INSERT INTO user_courses (phone_number, course_name, status, completion_percentage)
VALUES ('94XXXXXXXXX', 'Course Name', 'active', 0);

# Add order
INSERT INTO user_orders (phone_number, order_number, product_name, quantity, total_amount, status)
VALUES ('94XXXXXXXXX', 'ORD-XXX', 'Product Name', 1, 1000.00, 'pending');

# Add profile
INSERT INTO user_profiles (phone_number, full_name, email, customer_type)
VALUES ('94XXXXXXXXX', 'Full Name', 'email@example.com', 'regular');
```

### **Method 2: Via API (cURL)**
```bash
# Add course
curl -X POST https://kcclanka.com/wa/api/user/course \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "94XXXXXXXXX",
    "course_name": "Course Name",
    "status": "active",
    "completion_percentage": 0
  }'

# Add order
curl -X POST https://kcclanka.com/wa/api/user/order \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "94XXXXXXXXX",
    "order_number": "ORD-XXX",
    "product_name": "Product Name",
    "quantity": 1,
    "total_amount": 1000.00,
    "status": "pending"
  }'
```

### **Method 3: Integrate with Your Existing System**
If you have an e-commerce system or LMS, integrate it to automatically add data when:
- User enrolls in course → Add to `user_courses`
- User places order → Add to `user_orders`
- User registers → Add to `user_profiles`

---

## 🎨 Customization

### **Add New Functions:**

Edit `/opt/wa-bot/utils/ai-functions.js`:

```javascript
// Example: Get user's payment history
function getUserPayments(phoneNumber) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM user_payments WHERE phone_number = ?`,
      [phoneNumber],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Add to executeAIFunction switch case:
case 'get_user_payments':
case 'payments':
  const payments = await getUserPayments(phoneNumber);
  return {
    success: true,
    data: payments,
    message: `Found ${payments.length} payment(s).`
  };
```

### **Update System Prompt:**

Add to the "Available Functions" section in `ai-functions.js`:

```
6. [FUNCTION:get_user_payments] - Get user's payment history
```

---

## 🔍 Debugging

### **Check if function was called:**
```bash
# View logs
journalctl -u wa-bot -f | grep "AI requested"

# Expected output when function is called:
"AI requested 1 function(s) for 94771234567"
"AI regenerated response with function data for 94771234567"
```

### **Check database data:**
```bash
sqlite3 /opt/wa-bot/wa-bot.db

# Check courses for specific user
SELECT * FROM user_courses WHERE phone_number = '94771234567';

# Check orders
SELECT * FROM user_orders WHERE phone_number = '94771234567';

# Check profile
SELECT * FROM user_profiles WHERE phone_number = '94771234567';
```

### **Test API directly:**
```bash
# Test course retrieval
curl https://kcclanka.com/wa/api/user/94771234567/courses

# Test order retrieval
curl https://kcclanka.com/wa/api/user/94771234567/orders

# Test profile retrieval
curl https://kcclanka.com/wa/api/user/94771234567/profile
```

---

## 📈 Real-World Use Cases

### **Use Case 1: E-Learning Platform**
```
Database: user_courses
AI can answer:
- "What courses am I taking?"
- "How far am I in Python course?"
- "Which courses have I completed?"
- "When did I enroll in Web Development?"
```

### **Use Case 2: E-Commerce Store**
```
Database: user_orders, user_profiles
AI can answer:
- "Where is my order?"
- "Show my purchase history"
- "What's my total spending?"
- "Am I a premium customer?"
- "Track order ORD-123"
```

### **Use Case 3: Service Business**
```
Database: user_appointments, user_services
AI can answer:
- "When is my next appointment?"
- "What services have I used?"
- "Show my service history"
- "Am I due for a service?"
```

### **Use Case 4: Banking/Finance**
```
Database: user_transactions, user_accounts
AI can answer:
- "What's my account balance?"
- "Show recent transactions"
- "List my loans"
- "When is my payment due?"
```

---

## ✅ Summary

### **What You Have:**

✅ **AI Function Calling System**
- AI can request user data
- Automatic database queries
- Personalized responses
- Real-time information

✅ **3 Database Tables**
- user_courses (enrollment data)
- user_orders (purchase history)
- user_profiles (customer info)

✅ **5 Built-in Functions**
- Get courses
- Get orders
- Get profile
- Get specific order
- Get course progress

✅ **API Endpoints**
- GET data
- POST new data
- Full CRUD support

✅ **Sample Data**
- 2 test users
- Multiple courses
- Multiple orders
- Complete profiles

---

## 🎯 Next Steps

### **1. Add Your Real Data**
Replace sample data with your actual customer information

### **2. Test with Real Numbers**
Send messages from actual customer phone numbers

### **3. Expand Functions**
Add more functions for your specific business needs

### **4. Integrate Systems**
Connect your existing CRM, LMS, or e-commerce platform

### **5. Monitor Usage**
Watch logs to see how AI uses functions

---

## 📚 Files Changed

```
✅ /opt/wa-bot/server.js
   - Added database tables
   - Integrated function calling
   - Added API endpoints

✅ /opt/wa-bot/utils/ai-functions.js (NEW)
   - Function implementations
   - AI response parsing
   - Database queries

✅ /opt/wa-bot/wa-bot.db
   - New tables: user_courses, user_orders, user_profiles
   - Sample data loaded
```

---

## 🎊 Congratulations!

**Your AI can now:**
- Query your database
- Fetch user-specific information
- Provide personalized responses
- Answer questions about orders, courses, profiles
- Track individual user history

**No more generic responses! Every answer is personalized!** 🎯

**Dashboard:** https://kcclanka.com/wa/  
**Feature:** AI Function Calling ✅  
**Status:** Fully Operational! 🚀  

**Test it NOW by sending: "What courses am I enrolled in?" from 94771234567!** 📱✨
