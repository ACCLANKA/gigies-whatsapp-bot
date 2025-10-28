// AI Shopping Functions for E-Commerce
// Natural language shopping via WhatsApp

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Get database for specific customer
function getCustomerDb(customerSlug) {
  const dbPath = path.join('/opt/wa-bots', customerSlug, 'wa-bot.db');
  console.log(`[SHOPPING-DB] Using database: ${dbPath} for customer: ${customerSlug}`);
  return new sqlite3.Database(dbPath);
}

/**
 * Browse Categories
 * Shows all available product categories
 */
function browseCategories(customerSlug) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.all(
      `SELECT c.id, c.name, c.description, c.icon, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
       WHERE c.active = 1
       GROUP BY c.id
       ORDER BY c.sort_order`,
      [],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Search Products
 * Search products by name, category, or description
 */
function searchProducts(customerSlug, searchTerm) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.all(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock_quantity,
              c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'active' 
       AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
       ORDER BY p.name
       LIMIT 10`,
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Get Products by Category
 * List all products in a specific category
 */
function getProductsByCategory(customerSlug, categoryId) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.all(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock_quantity
       FROM products p
       WHERE p.category_id = ? AND p.status = 'active'
       ORDER BY p.name`,
      [categoryId],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * Get Product Details
 * Get detailed information about a specific product
 */
function getProductDetails(customerSlug, productId) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.get(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [productId],
      (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

/**
 * Add to Cart
 * Add a product to customer's shopping cart
 */
function addToCart(customerSlug, phoneNumber, productId, quantity = 1) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    // First check if product exists and has stock
    db.get(
      'SELECT id, name, price, stock_quantity FROM products WHERE id = ? AND status = "active"',
      [productId],
      (err, product) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        if (!product) {
          db.close();
          resolve({ success: false, message: 'Product not found' });
          return;
        }
        
        if (product.stock_quantity < quantity) {
          db.close();
          resolve({ success: false, message: 'Insufficient stock' });
          return;
        }
        
        // Check if already in cart
        db.get(
          'SELECT id, quantity FROM shopping_cart WHERE phone_number = ? AND product_id = ?',
          [phoneNumber, productId],
          (err, cartItem) => {
            if (err) {
              db.close();
              reject(err);
              return;
            }
            
            if (cartItem) {
              // Update quantity
              db.run(
                'UPDATE shopping_cart SET quantity = quantity + ? WHERE id = ?',
                [quantity, cartItem.id],
                (err) => {
                  db.close();
                  if (err) reject(err);
                  else resolve({
                    success: true,
                    message: `Updated ${product.name} quantity in cart`,
                    product: product
                  });
                }
              );
            } else {
              // Add new item
              db.run(
                'INSERT INTO shopping_cart (phone_number, product_id, quantity) VALUES (?, ?, ?)',
                [phoneNumber, productId, quantity],
                (err) => {
                  db.close();
                  if (err) reject(err);
                  else resolve({
                    success: true,
                    message: `Added ${product.name} to cart`,
                    product: product
                  });
                }
              );
            }
          }
        );
      }
    );
  });
}

/**
 * View Cart
 * Get all items in customer's shopping cart
 */
function viewCart(customerSlug, phoneNumber) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.all(
      `SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url,
              (c.quantity * p.price) as subtotal
       FROM shopping_cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.phone_number = ?
       ORDER BY c.created_at DESC`,
      [phoneNumber],
      (err, items) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        
        // Get delivery fee from settings
        db.get(
          'SELECT value FROM store_settings WHERE key = "delivery_fee"',
          [],
          (err, setting) => {
            const deliveryFee = setting ? parseFloat(setting.value) : 500;
            
            // Check free delivery threshold
            db.get(
              'SELECT value FROM store_settings WHERE key = "free_delivery_above"',
              [],
              (err, freeDeliverySetting) => {
                db.close();
                
                const freeDeliveryAbove = freeDeliverySetting ? parseFloat(freeDeliverySetting.value) : 10000;
                const finalDeliveryFee = subtotal >= freeDeliveryAbove ? 0 : deliveryFee;
                const total = subtotal + finalDeliveryFee;
                
                resolve({
                  items: items,
                  subtotal: subtotal,
                  deliveryFee: finalDeliveryFee,
                  total: total,
                  itemCount: items.length
                });
              }
            );
          }
        );
      }
    );
  });
}

/**
 * Remove from Cart
 * Remove an item from shopping cart
 */
function removeFromCart(customerSlug, phoneNumber, cartItemId) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.run(
      'DELETE FROM shopping_cart WHERE id = ? AND phone_number = ?',
      [cartItemId, phoneNumber],
      (err) => {
        db.close();
        if (err) reject(err);
        else resolve({ success: true, message: 'Item removed from cart' });
      }
    );
  });
}

/**
 * Clear Cart
 * Remove all items from shopping cart
 */
function clearCart(customerSlug, phoneNumber) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.run(
      'DELETE FROM shopping_cart WHERE phone_number = ?',
      [phoneNumber],
      (err) => {
        db.close();
        if (err) reject(err);
        else resolve({ success: true, message: 'Cart cleared' });
      }
    );
  });
}

/**
 * Checkout
 * Create order from cart items
 */
function checkout(customerSlug, phoneNumber, customerInfo) {
  return new Promise(async (resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    try {
      // Get cart items
      const cart = await viewCart(customerSlug, phoneNumber);
      
      if (cart.items.length === 0) {
        db.close();
        resolve({ success: false, message: 'Cart is empty' });
        return;
      }
      
      // Generate order number
      const orderNumber = 'ORD-' + Date.now();
      
      // Create order
      db.run(
        `INSERT INTO orders (order_number, phone_number, customer_name, delivery_address, 
         city, total_amount, delivery_fee, status, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderNumber,
          phoneNumber,
          customerInfo.name || '',
          customerInfo.address || '',
          customerInfo.city || '',
          cart.total,
          cart.deliveryFee,
          customerInfo.paymentMethod || 'Cash on Delivery'
        ],
        function(err) {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          
          const orderId = this.lastID;
          
          // Add order items
          const stmt = db.prepare(
            'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
          );
          
          cart.items.forEach(item => {
            stmt.run(orderId, item.product_id, item.name, item.quantity, item.price, item.subtotal);
          });
          
          stmt.finalize();
          
          // Update product stock
          cart.items.forEach(item => {
            db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
          });
          
          // Clear cart
          db.run('DELETE FROM shopping_cart WHERE phone_number = ?', [phoneNumber]);
          
          // Update or create member record
          db.run(
            `INSERT INTO registered_members (phone_number, name, address, city, total_orders, total_spent, last_order_at)
             VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
             ON CONFLICT(phone_number) DO UPDATE SET
             name = COALESCE(?, name),
             address = COALESCE(?, address),
             city = COALESCE(?, city),
             total_orders = total_orders + 1,
             total_spent = total_spent + ?,
             last_order_at = datetime('now')`,
            [
              phoneNumber, customerInfo.name, customerInfo.address, customerInfo.city, cart.total,
              customerInfo.name, customerInfo.address, customerInfo.city, cart.total
            ],
            () => {
              db.close();
              resolve({
                success: true,
                orderNumber: orderNumber,
                orderId: orderId,
                total: cart.total,
                items: cart.items
              });
            }
          );
        }
      );
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Track Order
 * Get order status and details
 */
function trackOrder(customerSlug, orderNumber) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.get(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o
       WHERE o.order_number = ?`,
      [orderNumber],
      (err, order) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        if (!order) {
          db.close();
          resolve(null);
          return;
        }
        
        // Get order items
        db.all(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id],
          (err, items) => {
            db.close();
            if (err) reject(err);
            else resolve({ ...order, items: items });
          }
        );
      }
    );
  });
}

/**
 * Get Customer Orders
 * Get all orders for a customer
 */
function getCustomerOrders(customerSlug, phoneNumber) {
  return new Promise((resolve, reject) => {
    const db = getCustomerDb(customerSlug);
    
    db.all(
      `SELECT order_number, total_amount, status, created_at,
              (SELECT COUNT(*) FROM order_items WHERE order_id = orders.id) as item_count
       FROM orders
       WHERE phone_number = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [phoneNumber],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

module.exports = {
  browseCategories,
  searchProducts,
  getProductsByCategory,
  getProductDetails,
  addToCart,
  viewCart,
  removeFromCart,
  clearCart,
  checkout,
  trackOrder,
  getCustomerOrders
};
