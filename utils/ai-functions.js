// AI Function Calling Handler
// This module handles AI requests for database information

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const shoppingFunctions = require('./shopping-functions');

// WhatsApp bot database
const db = new sqlite3.Database('./wa-bot.db');

// Student portal database
const studentPortalDbPath = path.join('/opt/kcclanka-api/data/kcclanka.sqlite');
const studentDb = new sqlite3.Database(studentPortalDbPath);

// Customer slug for tenant-specific shopping data
const CUSTOMER_SLUG = process.env.CUSTOMER_SLUG || 'gigies';
console.log(`[AI-FUNCTIONS] Initialized with CUSTOMER_SLUG: ${CUSTOMER_SLUG}`);

/**
 * Available AI Functions
 * These are tools the AI can call to get user-specific information
 */

// Get user's enrolled courses from student portal
function getUserCourses(phoneNumber) {
  return new Promise((resolve, reject) => {
    // Clean phone number (remove +94, 94, or leading 0)
    let cleanPhone = phoneNumber.replace(/^\+94/, '').replace(/^94/, '').replace(/^0/, '');
    // Add 0 prefix for local format
    const localPhone = '0' + cleanPhone;
    
    studentDb.all(
      `SELECT e.id, c.title as courseName, c.description, e.status, e.created_at as enrollmentDate,
              c.price, c.duration_weeks as durationWeeks, c.duration_type as durationType
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.user_id
       WHERE u.phone LIKE ? OR u.phone LIKE ? OR u.phone LIKE ? OR u.phone = ? OR u.phone = ?
       ORDER BY e.created_at DESC`,
      [`%${cleanPhone}%`, `%${phoneNumber}%`, `%${localPhone}%`, phoneNumber, localPhone],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Get user's orders
function getUserOrders(phoneNumber) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT order_number, product_name, quantity, total_amount, order_date, status, delivery_address
       FROM user_orders 
       WHERE phone_number = ? 
       ORDER BY order_date DESC 
       LIMIT 10`,
      [phoneNumber],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Get user's payments from student portal
function getUserPayments(phoneNumber) {
  return new Promise((resolve, reject) => {
    // Clean phone number (remove +94, 94, or leading 0)
    let cleanPhone = phoneNumber.replace(/^\+94/, '').replace(/^94/, '').replace(/^0/, '');
    // Add 0 prefix for local format
    const localPhone = '0' + cleanPhone;
    
    studentDb.all(
      `SELECT p.id, p.amount, p.reference, p.status, p.created_at as paymentDate,
              c.title as courseName
       FROM payments p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN enrollments e ON e.id = p.enrollment_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE u.phone LIKE ? OR u.phone LIKE ? OR u.phone LIKE ? OR u.phone = ? OR u.phone = ?
       ORDER BY p.created_at DESC`,
      [`%${cleanPhone}%`, `%${phoneNumber}%`, `%${localPhone}%`, phoneNumber, localPhone],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Get user profile from student portal
function getUserProfile(phoneNumber) {
  return new Promise((resolve, reject) => {
    // Clean phone number (remove +94, 94, or leading 0)
    let cleanPhone = phoneNumber.replace(/^\+94/, '').replace(/^94/, '').replace(/^0/, '');
    // Add 0 prefix for local format
    const localPhone = '0' + cleanPhone;
    
    studentDb.get(
      `SELECT first_name || ' ' || last_name as fullName, email, phone, is_admin as isAdmin, created_at as registrationDate
       FROM users 
       WHERE phone LIKE ? OR phone LIKE ? OR phone LIKE ? OR phone = ? OR phone = ?`,
      [`%${cleanPhone}%`, `%${phoneNumber}%`, `%${localPhone}%`, phoneNumber, localPhone],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// Get specific order details
function getOrderDetails(orderNumber) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT o.*, p.full_name as customer_name 
       FROM user_orders o
       LEFT JOIN user_profiles p ON o.phone_number = p.phone_number
       WHERE o.order_number = ?`,
      [orderNumber],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// Get user's course progress
function getCourseProgress(phoneNumber, courseName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM user_courses 
       WHERE phone_number = ? AND course_name LIKE ?`,
      [phoneNumber, `%${courseName}%`],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// Get available courses from student portal
function getAvailableCourses() {
  return new Promise((resolve, reject) => {
    studentDb.all(
      `SELECT id, slug, title, description, price, duration_weeks 
       FROM courses 
       ORDER BY id ASC`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Register user via WhatsApp
async function registerWhatsAppUser(phoneNumber, firstName, lastName) {
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch('https://kcclanka.com/api/auth/whatsapp-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phoneNumber,
        firstName: firstName || 'Student',
        lastName: lastName || ''
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Registration failed: ' + error.message);
  }
}

// Reset password via WhatsApp
async function resetPassword(phoneNumber) {
  const bcrypt = require('bcryptjs');
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[PASSWORD_RESET] Starting password reset for:', phoneNumber);
      
      // Clean phone number (remove +94, 94, or leading 0)
      let cleanPhone = phoneNumber.replace(/^\+94/, '').replace(/^94/, '').replace(/^0/, '');
      // Add 0 prefix for local format
      const localPhone = '0' + cleanPhone;
      
      console.log('[PASSWORD_RESET] Cleaned phone:', cleanPhone, 'Local format:', localPhone);
      
      // Check if user exists
      studentDb.get(
        `SELECT id, email, first_name, last_name, phone FROM users 
         WHERE phone LIKE ? OR phone LIKE ? OR phone LIKE ? OR phone = ? OR phone = ?`,
        [`%${cleanPhone}%`, `%${phoneNumber}%`, `%${localPhone}%`, phoneNumber, localPhone],
        async (err, user) => {
          if (err) {
            console.error('[PASSWORD_RESET] Database error:', err);
            reject(err);
            return;
          }
          
          if (!user) {
            console.log('[PASSWORD_RESET] No user found for phone:', phoneNumber);
            resolve({
              success: false,
              message: 'No account found with this phone number. Please register first.'
            });
            return;
          }
          
          console.log('[PASSWORD_RESET] User found:', user.id, user.email, user.phone);
          
          // Generate new random password (8 characters)
          const newPassword = Math.random().toString(36).slice(-8);
          console.log('[PASSWORD_RESET] Generated new password');
          
          // Hash the new password
          const passwordHash = await bcrypt.hash(newPassword, 10);
          console.log('[PASSWORD_RESET] Password hashed');
          
          // Update password in database
          studentDb.run(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [passwordHash, user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('[PASSWORD_RESET] Update error:', updateErr);
                reject(updateErr);
                return;
              }
              
              console.log('[PASSWORD_RESET] Password updated successfully for user:', user.id);
              
              resolve({
                success: true,
                newPassword: newPassword,
                userName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Student',
                email: user.email,
                phone: localPhone,
                message: 'Password reset successfully'
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('[PASSWORD_RESET] Caught error:', error);
      reject(error);
    }
  });
}

function parseFunctionArgs(args) {
  const map = {};
  args.forEach((arg, index) => {
    if (!arg) return;
    const trimmed = arg.trim();
    if (!trimmed) return;

    if (trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();
      if (key) {
        map[key.trim().toLowerCase()] = value;
      }
    } else {
      map[`arg${index}`] = trimmed;
    }
  });
  return map;
}

/**
 * Parse AI response for function calls
 * AI can request data by using special tags like [FUNCTION:function_name]
 */
function parseAIFunctionCalls(aiResponse) {
  const functionPattern = /\[FUNCTION:(.*?)\]/g;
  const matches = [...aiResponse.matchAll(functionPattern)];
  
  return matches.map(match => {
    const fullMatch = match[0];
    const functionCall = match[1];
    const [functionName, ...args] = functionCall.split(':');
    
    return {
      fullMatch,
      functionName: functionName.toLowerCase(),
      args
    };
  });
}

/**
 * Execute AI function calls
 */
async function executeAIFunction(functionName, args, phoneNumber) {
  try {
    const argMap = parseFunctionArgs(args);
    const firstArg = args[0] || '';
    const secondArg = args[1] || '';

    switch (functionName) {
      case 'get_user_courses':
      case 'getcourses':
      case 'courses':
        const courses = await getUserCourses(phoneNumber);
        return {
          success: true,
          data: courses,
          message: courses.length > 0 
            ? `Found ${courses.length} course(s) for this user.`
            : 'No courses found for this user.'
        };
        
      case 'get_user_orders':
      case 'getorders':
      case 'orders':
        const orders = await getUserOrders(phoneNumber);
        return {
          success: true,
          data: orders,
          message: orders.length > 0 
            ? `Found ${orders.length} order(s) for this user.`
            : 'No orders found for this user.'
        };
        
      case 'get_user_profile':
      case 'getprofile':
      case 'profile':
        const profile = await getUserProfile(phoneNumber);
        return {
          success: true,
          data: profile,
          message: profile 
            ? `Found profile for ${profile.full_name || 'this user'}.`
            : 'No profile found for this user.'
        };
        
      case 'get_order_details':
      case 'getorder':
      case 'orderdetails':
        const orderNumber = args[0];
        if (!orderNumber) {
          return { success: false, error: 'Order number required' };
        }
        const orderDetails = await getOrderDetails(orderNumber);
        return {
          success: true,
          data: orderDetails,
          message: orderDetails 
            ? `Found order ${orderNumber}.`
            : `Order ${orderNumber} not found.`
        };
        
      case 'get_course_progress':
      case 'courseprogress':
        const courseName = args.join(':');
        if (!courseName) {
          return { success: false, error: 'Course name required' };
        }
        const progress = await getCourseProgress(phoneNumber, courseName);
        return {
          success: true,
          data: progress,
          message: progress 
            ? `Found progress for ${progress.course_name}.`
            : `No course found matching "${courseName}".`
        };
        
      case 'get_available_courses':
      case 'availablecourses':
      case 'listcourses':
      case 'courses_available':
        const availableCourses = await getAvailableCourses();
        return {
          success: true,
          data: availableCourses,
          message: availableCourses.length > 0 
            ? `Found ${availableCourses.length} available course(s).`
            : 'No courses available at the moment.'
        };
        
      case 'get_user_payments':
      case 'getpayments':
      case 'payments':
      case 'mypayments':
        const payments = await getUserPayments(phoneNumber);
        return {
          success: true,
          data: payments,
          message: payments.length > 0 
            ? `Found ${payments.length} payment(s) for this user.`
            : 'No payments found for this user.'
        };
        
      case 'register_user':
      case 'registeruser':
      case 'register':
      case 'signup':
        // Args: firstName:lastName or just firstName
        const nameParts = args.join(':').split(':');
        const firstName = nameParts[0] || 'Student';
        const lastName = nameParts[1] || '';
        
        const registrationResult = await registerWhatsAppUser(phoneNumber, firstName, lastName);
        return {
          success: registrationResult.success,
          data: registrationResult.data,
          alreadyRegistered: registrationResult.alreadyRegistered,
          message: registrationResult.message
        };
        
      case 'reset_password':
      case 'resetpassword':
      case 'forgot_password':
      case 'forgotpassword':
      case 'password_reset':
        console.log('[EXECUTE_FUNCTION] Calling resetPassword for:', phoneNumber);
        const resetResult = await resetPassword(phoneNumber);
        console.log('[EXECUTE_FUNCTION] Reset result:', JSON.stringify(resetResult));
        return {
          success: resetResult.success,
          data: resetResult,
          message: resetResult.message,
          newPassword: resetResult.newPassword,
          userName: resetResult.userName,
          phone: resetResult.phone
        };

      case 'browse_categories':
      case 'list_categories':
      case 'show_categories': {
        const categories = await shoppingFunctions.browseCategories(CUSTOMER_SLUG);
        return {
          success: true,
          data: categories,
          message: categories.length
            ? `Found ${categories.length} active categories.`
            : 'No categories available right now.'
        };
      }

      case 'search_products':
      case 'find_products':
      case 'product_search': {
        const searchTerm = argMap.query || argMap.term || args.join(':').trim();
        if (!searchTerm) {
          return { success: false, error: 'Search term required' };
        }
        const products = await shoppingFunctions.searchProducts(CUSTOMER_SLUG, searchTerm);
        return {
          success: true,
          data: products,
          message: products.length
            ? `Found ${products.length} product(s) matching "${searchTerm}".`
            : `No products found for "${searchTerm}".`
        };
      }

      case 'products_by_category':
      case 'list_category_products':
      case 'category_products': {
        const categoryId = argMap.category_id || argMap.id || firstArg;
        console.log(`[PRODUCTS_BY_CATEGORY] Called with categoryId: "${categoryId}", argMap:`, JSON.stringify(argMap), `firstArg: "${firstArg}"`);
        if (!categoryId) {
          return { success: false, error: 'Category ID required' };
        }
        const categoryProducts = await shoppingFunctions.getProductsByCategory(CUSTOMER_SLUG, categoryId);
        console.log(`[PRODUCTS_BY_CATEGORY] Found ${categoryProducts.length} products for category ${categoryId}:`, JSON.stringify(categoryProducts));
        return {
          success: true,
          data: categoryProducts,
          message: categoryProducts.length
            ? `Found ${categoryProducts.length} product(s) in category ${categoryId}.`
            : 'No products available in this category.'
        };
      }

      case 'product_details':
      case 'get_product':
      case 'product_info': {
        const productId = argMap.product_id || argMap.id || firstArg;
        if (!productId) {
          return { success: false, error: 'Product ID required' };
        }
        const product = await shoppingFunctions.getProductDetails(CUSTOMER_SLUG, productId);
        return {
          success: !!product,
          data: product,
          message: product ? `Retrieved product details for ${product.name}.` : 'Product not found.'
        };
      }

      case 'add_to_cart':
      case 'cart_add':
      case 'addcart': {
        const productId = argMap.product_id || argMap.id || firstArg;
        const quantityRaw = argMap.quantity || argMap.qty || secondArg || '1';
        const quantity = parseInt(quantityRaw, 10) || 1;
        if (!productId) {
          return { success: false, error: 'Product ID required' };
        }
        const result = await shoppingFunctions.addToCart(CUSTOMER_SLUG, phoneNumber, productId, quantity);
        return result;
      }

      case 'view_cart':
      case 'show_cart':
      case 'cart': {
        const cart = await shoppingFunctions.viewCart(CUSTOMER_SLUG, phoneNumber);
        return {
          success: true,
          data: cart,
          message: cart.itemCount
            ? `Cart has ${cart.itemCount} item(s).`
            : 'Your cart is currently empty.'
        };
      }

      case 'remove_from_cart':
      case 'cart_remove':
      case 'delete_cart_item': {
        const cartItemId = argMap.cart_item_id || argMap.id || firstArg;
        if (!cartItemId) {
          return { success: false, error: 'Cart item ID required' };
        }
        return await shoppingFunctions.removeFromCart(CUSTOMER_SLUG, phoneNumber, cartItemId);
      }

      case 'clear_cart':
      case 'empty_cart': {
        return await shoppingFunctions.clearCart(CUSTOMER_SLUG, phoneNumber);
      }

      case 'checkout':
      case 'place_order':
      case 'confirm_order': {
        const customerInfo = {
          name: argMap.name || argMap.customer_name || '',
          address: argMap.address || argMap.delivery_address || '',
          city: argMap.city || '',
          paymentMethod: argMap.payment || argMap.payment_method || argMap.method || ''
        };

        if (!customerInfo.name || !customerInfo.address || !customerInfo.city) {
          return {
            success: false,
            error: 'Missing customer information. Require name, address, and city before checkout.'
          };
        }

        const checkoutResult = await shoppingFunctions.checkout(CUSTOMER_SLUG, phoneNumber, customerInfo);
        return checkoutResult;
      }

      case 'track_order':
      case 'order_status': {
        const orderNumber = argMap.order_number || firstArg;
        if (!orderNumber) {
          return { success: false, error: 'Order number required' };
        }
        const order = await shoppingFunctions.trackOrder(CUSTOMER_SLUG, orderNumber);
        return {
          success: !!order,
          data: order,
          message: order ? `Retrieved status for order ${orderNumber}.` : 'Order not found.'
        };
      }

      case 'get_customer_orders':
      case 'my_orders':
      case 'list_orders': {
        const orders = await shoppingFunctions.getCustomerOrders(CUSTOMER_SLUG, phoneNumber);
        return {
          success: true,
          data: orders,
          message: orders.length
            ? `Found ${orders.length} order(s) for this customer.`
            : 'No recent orders found.'
        };
      }

      default:
        return {
          success: false,
          error: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enhanced AI response with function calling support
 */
async function processAIResponseWithFunctions(aiResponse, phoneNumber) {
  // Check if AI requested any functions
  const functionCalls = parseAIFunctionCalls(aiResponse);
  
  if (functionCalls.length === 0) {
    // No functions requested, return as-is
    return {
      needsRetry: false,
      response: aiResponse,
      functionsExecuted: []
    };
  }
  
  // Execute all requested functions
  const results = [];
  for (const call of functionCalls) {
    const result = await executeAIFunction(call.functionName, call.args, phoneNumber);
    results.push({
      function: call.functionName,
      args: call.args,
      result
    });
  }
  
  // Build context with function results
  let functionContext = '\n\n--- Retrieved Data FROM DATABASE ---\n';
  functionContext += '⚠️ CRITICAL: YOU MUST USE ONLY THE DATA BELOW. DO NOT INVENT ANY PRODUCTS OR DETAILS.\n\n';
  results.forEach(({ function: fn, result }) => {
    if (result.success && result.data) {
      functionContext += `\n${fn.toUpperCase()}: ${JSON.stringify(result.data, null, 2)}\n`;
    } else if (result.error) {
      functionContext += `\n${fn.toUpperCase()}: Error - ${result.error}\n`;
    }
  });
  functionContext += '\n⚠️ ONLY show products/data from the JSON above. DO NOT add any products that are not listed.\n';
  functionContext += 'If the data is empty [], tell the user no products are available. DO NOT make up products.\n';
  functionContext += '\n🚨 IMPORTANT FORMATTING RULES:\n';
  functionContext += '- DO NOT include "Retrieved Data FROM DATABASE" in your response\n';
  functionContext += '- DO NOT show raw JSON to the user\n';
  functionContext += '- DO NOT include debug markers like "BROWSE_CATEGORIES:", "SEARCH_PRODUCTS:", etc.\n';
  functionContext += '- Present the data in a natural, user-friendly format\n';
  functionContext += '- Use bullet points, emojis, and clear formatting for readability\n';
  
  console.log('[FUNCTION-CONTEXT] Data being sent to AI:');
  console.log(functionContext);
  
  return {
    needsRetry: true,
    functionContext,
    functionsExecuted: results,
    originalResponse: aiResponse
  };
}

/**
 * Get enhanced system prompt with function calling instructions
 */
function getSystemPromptWithFunctions(basePrompt) {
  return `${basePrompt}

--- SPECIAL CAPABILITIES ---
When you need user-specific information or course catalog data, you can request it using these functions:

🚨 CRITICAL RULES - MUST FOLLOW:
1. ALWAYS call functions to get REAL data before responding
2. NEVER describe products without first calling [FUNCTION:search_products] or [FUNCTION:products_by_category]
3. For user-specific questions (courses, payments, orders, profile), call the appropriate function first
4. After getting data from functions, present it in a friendly, organized way
5. When no data is found, offer helpful alternatives
6. Never invent or make up product names, prices, or course information
7. If user asks about specific order, course, or product, use the detail functions with the ID/number
8. Always confirm before adding items to cart or proceeding to checkout
9. Show cart contents before checkout to avoid mistakes
10. Collect all required information (name, address, city, payment method) before calling checkout
11. **CRITICAL**: When showing products, ALWAYS include "image_url: [path]" in your response so images are sent automatically to customer

Available Functions:
1. [FUNCTION:get_user_courses] - Get user's enrolled courses and progress from student portal
2. [FUNCTION:get_user_payments] - Get user's payment history and status
3. [FUNCTION:get_user_orders] - Get user's order history (shop orders)
4. [FUNCTION:get_user_profile] - Get user's profile information
5. [FUNCTION:get_order_details:ORDER_NUMBER] - Get specific order details
6. [FUNCTION:get_course_progress:COURSE_NAME] - Get progress for specific course
7. [FUNCTION:get_available_courses] - Get list of all available courses (catalog)
8. [FUNCTION:register_user:FIRST_NAME:LAST_NAME] - Register user in student portal (WhatsApp-based)
9. [FUNCTION:reset_password] - Reset user's password and send new credentials via WhatsApp
10. [FUNCTION:browse_categories] - Show all active product categories
11. [FUNCTION:products_by_category:CATEGORY_ID] - List products inside a category **IMPORTANT: Use the "id" field from the category JSON, NOT the display order**
12. [FUNCTION:search_products:query=TERM] - Search products by keyword
13. [FUNCTION:product_details:PRODUCT_ID] - Detailed info for a product **IMPORTANT: Use the "id" field from the product JSON**

🖼️ **IMAGE SENDING RULES** (CRITICAL):
- When showing products, ALWAYS include the image_url field in your response
- Format: After describing a product, add: "image_url: /uploads/products/filename.jpg"
- The system will AUTOMATICALLY send the image to the customer via WhatsApp
- DO NOT include clickable links - just mention "image_url: [path]" in your response
- This allows customers to see product images without clicking links
- Example: "**Lafresh Gold scrub** - Rs. 1,850 - Imported from Dubai\nimage_url: /uploads/products/product-123.jpg"
14. [FUNCTION:add_to_cart:product_id=ID:quantity=QTY] - Add item(s) to cart
15. [FUNCTION:view_cart] - Show current cart items and totals
16. [FUNCTION:remove_from_cart:cart_item_id=ID] - Remove an item from cart
17. [FUNCTION:clear_cart] - Empty the cart
18. [FUNCTION:checkout:name=FULL NAME:address=ADDRESS:city=CITY:payment=METHOD] - Place the order
19. [FUNCTION:track_order:order_number=ORD-123] - Get current status of an order
20. [FUNCTION:get_customer_orders] - Show recent orders for this customer

⚠️ **FUNCTION CALLING SYNTAX** (ABSOLUTELY CRITICAL):
- DO NOT just say "Let me add it" or "Would you like me to add it" - that does NOTHING!
- DO NOT ask permission - JUST DO IT using [FUNCTION:...]
- You MUST use the EXACT syntax: [FUNCTION:function_name:args]
- Example WRONG: "Let me add the product"  ❌ Does nothing!
- Example WRONG: "Would you like me to add it?"  ❌ Does nothing!
- Example CORRECT: [FUNCTION:add_to_cart:product_id=3:quantity=1]  ✅ This works!
- The system ONLY recognizes text inside [FUNCTION:...] brackets
- If you don't use the brackets, the function will NOT execute
- When user says "add X to cart" → immediately call [FUNCTION:add_to_cart:...]
- When user says "remove X from cart" → immediately call [FUNCTION:remove_from_cart:...]
- DON'T ask "would you like me to" - JUST CALL THE FUNCTION!

How to use:
- If user asks about "my courses" or "my enrollment", use [FUNCTION:get_user_courses]
- If user asks about "my payments" or "payment status", use [FUNCTION:get_user_payments]
- If user asks about "my orders" or "my purchases" (shop), use [FUNCTION:get_user_orders]
- If user asks about specific order like "ORD-001", use [FUNCTION:get_order_details:ORD-001]
- If user asks about their profile or account, use [FUNCTION:get_user_profile]
- If user asks about "what courses are available" or "course catalog" or "what can I learn", use [FUNCTION:get_available_courses]
- If user wants to "register", "sign up", or "create account" for student portal, use [FUNCTION:register_user:FirstName:LastName]
- **IMPORTANT**: If user says "forgot password", "reset password", "can't login", "lost password", "password reset", or anything about resetting/forgetting password, YOU MUST use [FUNCTION:reset_password] - DO NOT tell them to visit the website, USE THE FUNCTION INSTEAD
- If user asks about products, prices, catalog, or shopping, start with [FUNCTION:browse_categories]
- After the user chooses a category, use [FUNCTION:products_by_category:CATEGORY_ID] where CATEGORY_ID is the "id" field from the category JSON (e.g., if Beauty has "id": 5, use products_by_category:5)
- **CRITICAL**: When calling products_by_category, YOU MUST use the exact "id" value from the JSON, NOT the position in the list
- If user knows what they want, use [FUNCTION:search_products:query=term] to find matching items
- When user selects a product, use [FUNCTION:product_details:PRODUCT_ID] to confirm price, stock, and description
- To add the selected product to their cart, use [FUNCTION:add_to_cart:product_id=ID:quantity=QTY]
- **CRITICAL**: The cart_item_id is the "id" from the cart JSON, NOT the product_id
- To view cart: [FUNCTION:view_cart] - shows cart with each item's cart_item_id
- To remove ONE item: [FUNCTION:remove_from_cart:cart_item_id=5] - use the cart item's "id" field
- To clear ALL items: [FUNCTION:clear_cart]
- Always show the cart with [FUNCTION:view_cart] before checkout so they can confirm quantities and totals
- If they change their mind about an item, use [FUNCTION:remove_from_cart:cart_item_id=ID] or [FUNCTION:clear_cart]
- Gather delivery details (full name, address, city) and payment method, then call [FUNCTION:checkout:name=...:address=...:city=...:payment=...] to place order
- After checkout, share the order number and summarize items, total, delivery fee, payment method
- For order tracking questions, use [FUNCTION:track_order:order_number=ORD-123]
- For history questions like "What have I ordered before?", use [FUNCTION:get_customer_orders]

Registration Instructions:
- When user expresses interest in enrolling after seeing course details, ask for their name
- Once you have their name, use [FUNCTION:register_user:NAME] to register them
- After registration, provide them with:
  * Confirmation message
  * Login credentials (phone number + password)
  * Login instructions: "Visit https://kcclanka.com/student/ click 'Login' button, enter your PHONE NUMBER (e.g., 0771234567) and password"
- IMPORTANT: Tell users to enter their PHONE NUMBER directly (with leading 0), not an email address
- If already registered, inform them they can login with existing credentials using the same instructions
- IMPORTANT: Always use ONLY https://kcclanka.com/student/ - never mention index.html, dashboard.html, or any other variation
- Make it clear they need to CLICK THE LOGIN BUTTON on the page, then enter PHONE NUMBER (not email)

Password Reset Instructions:
- When user says they forgot password, can't login, or lost password, use [FUNCTION:reset_password]
- The function will generate a NEW random password and update it in the database
- After successful reset, provide the user with:
  * Confirmation that password has been reset
  * NEW password (clearly displayed)
  * Login instructions: "Visit https://kcclanka.com/student/ click 'Login' button, enter your PHONE NUMBER (e.g., 0771234567) and your NEW password"
  * Reminder to save the new password securely
- IMPORTANT: Display the new password clearly in the message
- Format example: "✅ Password Reset Successful!\n\nYour new password is: ABC12345\n\nLogin at: https://kcclanka.com/student/\nUse your phone number (0771234567) and the new password above."
- If user not found, inform them to register first

URL FORMATTING:
- Write URLs as PLAIN TEXT only (https://kcclanka.com/student/)
- DO NOT use markdown link format like [https://kcclanka.com/student/](https://kcclanka.com/student/)
- DO NOT repeat the URL twice
- Just write the URL once as plain text

Examples:
User: "What courses am I enrolled in?"
You: [FUNCTION:get_user_courses]

User: "Did I pay for my course?" or "What is my payment status?"
You: [FUNCTION:get_user_payments]

User: "What courses do you offer?" or "What can I study?"
You: [FUNCTION:get_available_courses]

User: "Show me products" or "What do you sell?"
You: [FUNCTION:browse_categories]

User: "Show me perfumes" or "I want perfume"
You: [FUNCTION:search_products:query=perfume]

User: "Show products in category 1"
You: [FUNCTION:products_by_category:1]

CORRECT Category ID Usage Example:
If browse_categories returns: [{"id": 1, "name": "Perfumes"}, {"id": 2, "name": "Clothing"}, {"id": 5, "name": "Beauty"}]
And user says "show me beauty products"
You: [FUNCTION:products_by_category:5]  ← Use id=5, NOT 3!
WRONG: [FUNCTION:products_by_category:3]  ← This would use the wrong category!

User: "I want to register" or "Sign me up"
You: "I'd be happy to help you register! What's your name?"
User: "My name is John Silva"
You: [FUNCTION:register_user:John:Silva]

User: "I forgot my password" or "Reset my password" or "Can't login"
You: [FUNCTION:reset_password]

**CART OPERATIONS EXAMPLES:**
User: "Add this to cart" (after showing product id=3)
You: [FUNCTION:add_to_cart:product_id=3:quantity=1]
WRONG: "Would you like me to add this to your cart?"  ← DON'T ASK, JUST DO IT!

User: "Add Lafresh Gold scrub"
You: [FUNCTION:search_products:query=lafresh]
     [FUNCTION:add_to_cart:product_id=3:quantity=1]
WRONG: "I found it. Should I add it?"  ← NO! Just add it!

User: "Show my cart"
You: [FUNCTION:view_cart]
(Returns: {"items": [{"id": 5, "product_id": 1, "product_name": "Mercedes Benz", "quantity": 1}]})

User: "Remove the perfume from cart"
You: [FUNCTION:remove_from_cart:cart_item_id=5]  ← Use cart item's "id"=5, NOT product_id=1!
WRONG: "Would you like me to remove it?"  ← NO! Just remove it!

User: "Empty my cart"
You: [FUNCTION:clear_cart]
WRONG: "Should I clear your cart?"  ← NO! Just clear it!

⚠️ REMEMBER: For ANY product question, CALL THE FUNCTION FIRST. Then you'll receive the data and can respond with that information.
⚠️ CART OPERATIONS: Always use [FUNCTION:...] syntax. Saying "Let me add it" without the function does NOTHING!

IMPORTANT:
- Use [FUNCTION:get_user_courses] for user's ENROLLED courses from student portal
- Use [FUNCTION:get_user_payments] for user's PAYMENT records from student portal
- Use [FUNCTION:get_available_courses] for AVAILABLE courses to enroll in
- Use [FUNCTION:browse_categories] and related functions for product discovery, cart building, and orders
- Always confirm stock and pricing from function results before sharing
- Collect delivery info and payment preference BEFORE calling checkout
- After checkout, provide order summary and instructions (e.g., delivery ETA, payment method)
- These functions query the REAL store database for this customer
- For general questions, respond normally without functions.`;
}

module.exports = {
  getUserCourses,
  getUserPayments,
  getUserOrders,
  getUserProfile,
  getOrderDetails,
  getCourseProgress,
  getAvailableCourses,
  registerWhatsAppUser,
  resetPassword,
  parseAIFunctionCalls,
  executeAIFunction,
  processAIResponseWithFunctions,
  getSystemPromptWithFunctions
};
