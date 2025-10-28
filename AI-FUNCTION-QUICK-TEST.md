# 🚀 AI Function Calling - Quick Test Guide

**Test these NOW!** Send from WhatsApp to see AI fetch database info!

---

## 📱 Test User 1: **94771234567** (Kasun Perera)

### **Test 1: Ask About Courses**
```
Send: What courses am I enrolled in?
```
**Expected:** AI will fetch and show 2 courses:
- Web Development Bootcamp (75% complete)
- Python for Beginners (100% complete)

---

### **Test 2: Ask About Orders**
```
Send: Show me my recent orders
```
**Expected:** AI will fetch and show 2 orders:
- ORD-002: Wireless Mouse (shipped)
- ORD-001: Laptop Stand (delivered)

---

### **Test 3: Track Specific Order**
```
Send: Where is my order ORD-002?
```
**Expected:** AI will fetch order ORD-002 details:
- Product: Wireless Mouse x2
- Status: Shipped
- Amount: Rs. 3,000

---

### **Test 4: Check Account**
```
Send: What's my account status?
```
**Expected:** AI will fetch profile:
- Name: Kasun Perera
- Type: Premium customer
- Total purchases: Rs. 15,000

---

### **Test 5: Course Progress**
```
Send: How's my progress in Web Development?
```
**Expected:** AI will fetch course progress:
- Web Development Bootcamp
- 75% complete
- Status: Active

---

## 📱 Test User 2: **94777654321** (Nimal Silva)

### **Test 1: Ask About Courses**
```
Send: What am I learning?
```
**Expected:** AI will show:
- Digital Marketing (30% complete, active)

---

### **Test 2: Ask About Orders**
```
Send: My order history
```
**Expected:** AI will show:
- ORD-003: USB Cable x3 (pending)

---

### **Test 3: Account Info**
```
Send: Tell me about my account
```
**Expected:** AI will show:
- Name: Nimal Silva
- Type: Regular customer
- Total purchases: Rs. 5,000

---

## 🎯 What to Look For

### **✅ Success Indicators:**
1. AI mentions **specific** course names
2. AI shows **actual** progress percentages
3. AI displays **real** order numbers
4. AI uses customer's **actual name**
5. AI provides **accurate** amounts and dates

### **❌ Without Function Calling (Old Way):**
```
User: "What courses am I enrolled in?"
AI: "I don't have access to enrollment data. Please check your account."
```

### **✅ With Function Calling (New Way):**
```
User: "What courses am I enrolled in?"
AI: "You're enrolled in 2 courses:
     1. Web Development Bootcamp (75% complete)
     2. Python for Beginners (100% complete)"
```

**See the difference?** The AI now has REAL DATA! 🎉

---

## 🔍 Behind the Scenes

When you send "What courses am I enrolled in?":

```
1. User sends message ➡️ WhatsApp Bot receives it
2. AI analyzes: "User wants course info" 
3. AI generates: "[FUNCTION:get_user_courses]"
4. System detects function call
5. System queries database: SELECT * FROM user_courses WHERE phone_number = '94771234567'
6. System returns data to AI
7. AI generates personalized response with actual data
8. Response sent to user ✅
```

**All happens in 3-10 seconds!** ⚡

---

## 📊 Check Database Directly

```bash
# SSH into server
ssh root@your-server

# Check courses
sqlite3 /opt/wa-bot/wa-bot.db "SELECT * FROM user_courses;"

# Check orders
sqlite3 /opt/wa-bot/wa-bot.db "SELECT * FROM user_orders;"

# Check profiles
sqlite3 /opt/wa-bot/wa-bot.db "SELECT * FROM user_profiles;"
```

---

## 🧪 Add Your Own Test Data

```bash
# SSH into server
ssh root@your-server

# Access database
sqlite3 /opt/wa-bot/wa-bot.db

# Add course for YOUR phone number
INSERT INTO user_courses (phone_number, course_name, status, completion_percentage)
VALUES ('94XXXXXXXXX', 'Test Course', 'active', 50);

# Add order for YOUR phone number
INSERT INTO user_orders (phone_number, order_number, product_name, quantity, total_amount, status)
VALUES ('94XXXXXXXXX', 'ORD-TEST', 'Test Product', 1, 1000.00, 'pending');

# Add profile for YOUR phone number
INSERT INTO user_profiles (phone_number, full_name, email, customer_type)
VALUES ('94XXXXXXXXX', 'Your Name', 'your@email.com', 'regular');

# Exit
.exit
```

**Then send from your WhatsApp:**
```
"What courses am I enrolled in?"
```

AI will fetch YOUR data! 🎯

---

## 🎨 Try Different Questions

### **For Courses:**
- "What am I learning?"
- "Show my enrollments"
- "Course progress"
- "What courses do I have?"
- "Am I enrolled in anything?"

### **For Orders:**
- "My recent purchases"
- "Order history"
- "What did I buy?"
- "Show my orders"
- "List my purchases"

### **For Specific Order:**
- "Track order ORD-002"
- "Where is order ORD-002?"
- "Status of ORD-002"
- "Order ORD-002 location"

### **For Profile:**
- "My account info"
- "Account status"
- "Who am I?"
- "My profile"
- "Account details"

---

## 🚀 Quick Start (30 Seconds)

1. **Open WhatsApp** on your phone
2. **Message your bot** from **94771234567**
3. **Send:** "What courses am I enrolled in?"
4. **Watch** AI fetch and display real course data!
5. **Send:** "Show my orders"
6. **Watch** AI fetch and display real order data!

**That's it!** You're testing AI function calling! 🎉

---

## 📈 View Logs (See It Work)

```bash
# SSH into server
ssh root@your-server

# Watch logs in real-time
journalctl -u wa-bot -f | grep "AI requested"

# Send message from WhatsApp
# You'll see:
"AI requested 1 function(s) for 94771234567"
"AI regenerated response with function data for 94771234567"
```

**This confirms AI is fetching data!** ✅

---

## ✅ Checklist

- [ ] Send "What courses am I enrolled in?" from 94771234567
- [ ] Verify AI shows 2 courses with names and progress
- [ ] Send "Show my orders" from 94771234567
- [ ] Verify AI shows 2 orders with product names and status
- [ ] Send "Track order ORD-002"
- [ ] Verify AI shows specific order details
- [ ] Send "My account status"
- [ ] Verify AI shows customer name and type
- [ ] Add your own data to database
- [ ] Test with your phone number
- [ ] Check logs to see function calls

---

## 🎊 Success!

If AI is showing **real data** from your database:
- ✅ Function calling is working!
- ✅ Database queries are executing!
- ✅ Personalization is active!
- ✅ Your AI is SMART! 🧠

**You now have a database-connected AI assistant!** 🚀

**Read full guide:** `/opt/wa-bot/AI-FUNCTION-CALLING-GUIDE.md`

**Questions? Issues?** Check the logs:
```bash
journalctl -u wa-bot -f
```

**Happy testing!** 🎯✨
