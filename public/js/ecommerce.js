// E-Commerce Management Functions for Gigies Dashboard

// Get API base path from app.js without redefining the global constant
const ECOM_API_BASE = window.API_BASE || '';

// Pagination and filtering state
let allProducts = [];
let filteredProducts = [];
let currentProductPage = 1;
let productsPerPage = 10;
let productSearchTerm = '';
let productFilterCategory = '';
let productFilterStatus = '';

let allOrders = [];
let filteredOrders = [];
let currentOrderPage = 1;
let ordersPerPage = 10;

// ============================================
// PRODUCTS MANAGEMENT
// ============================================

// Load Products
async function loadProducts() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/products`);
    const data = await response.json();
    
    if (!data.success || data.products.length === 0) {
      document.getElementById('productsList').innerHTML = '<div class="empty-state">No products found. Add your first product!</div>';
      return;
    }
    
    // Store all products
    allProducts = data.products;
    
    // Load categories for filter dropdown
    await loadCategoriesForFilter();
    
    // Apply filters and display
    applyProductFilters();
    
  } catch (error) {
    console.error('Error loading products:', error);
    showToast('Error loading products', 'error');
  }
}

// Apply product filters and search
function applyProductFilters() {
  // Filter products based on search and filters
  filteredProducts = allProducts.filter(product => {
    // Search filter
    const searchMatch = !productSearchTerm || 
      product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(productSearchTerm.toLowerCase()));
    
    // Category filter
    const categoryMatch = !productFilterCategory || 
      product.category_id == productFilterCategory;
    
    // Status filter
    const statusMatch = !productFilterStatus || 
      product.status === productFilterStatus;
    
    return searchMatch && categoryMatch && statusMatch;
  });
  
  // Reset to first page when filters change
  currentProductPage = 1;
  
  // Display filtered products
  displayProducts();
}

// Display products with pagination
function displayProducts() {
  const productsList = document.getElementById('productsList');
  
  if (filteredProducts.length === 0) {
    productsList.innerHTML = '<div class="empty-state">No products match your search criteria.</div>';
    return;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentProductPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const productsToDisplay = filteredProducts.slice(startIndex, endIndex);
  
  // Generate table HTML
  productsList.innerHTML = `
    <!-- Search and Filter Bar -->
    <div class="search-filter-bar">
      <div class="search-box">
        <input 
          type="text" 
          id="productSearch" 
          placeholder="🔍 Search products..." 
          value="${productSearchTerm}"
          oninput="searchProducts(this.value)"
          class="form-input"
          style="width: 300px;"
        >
      </div>
      <div class="filter-controls">
        <select id="categoryFilter" onchange="filterByCategory(this.value)" class="form-select" style="width: 200px;">
          <option value="">All Categories</option>
        </select>
        <select id="statusFilter" onchange="filterByStatus(this.value)" class="form-select" style="width: 150px;">
          <option value="">All Status</option>
          <option value="active" ${productFilterStatus === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${productFilterStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
        <button onclick="resetProductFilters()" class="btn btn-secondary" style="padding: 8px 16px;">
          🔄 Reset
        </button>
      </div>
    </div>

    <!-- Results Info -->
    <div style="padding: 12px 0; color: var(--gray); font-size: 14px;">
      Showing ${startIndex + 1}-${Math.min(endIndex, filteredProducts.length)} of ${filteredProducts.length} products
    </div>

    <!-- Products Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 80px;">Image</th>
            <th>Product Name</th>
            <th>Category</th>
            <th>Description</th>
            <th>Price (Rs.)</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${productsToDisplay.map(product => {
            // Fix image URL to include base path if it's a local upload
            let imageUrl = product.image_url;
            if (imageUrl && imageUrl.startsWith('/uploads/') && !imageUrl.startsWith(ECOM_API_BASE)) {
              imageUrl = ECOM_API_BASE + imageUrl;
            }
            
            return `
            <tr>
              <td>
                ${imageUrl ? 
                  `<img src="${imageUrl}" alt="${product.name}" class="product-thumbnail" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2260%22 height=%2260%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2220%22%3E📦%3C/text%3E%3C/svg%3E'">` : 
                  `<div class="product-thumbnail-placeholder">📦</div>`
                }
              </td>
              <td><strong>${product.name}</strong></td>
              <td>${product.category_name || 'Uncategorized'}</td>
              <td style="max-width: 300px; white-space: normal;">${product.description || 'No description'}</td>
              <td><strong>${parseFloat(product.price).toLocaleString()}</strong></td>
              <td>
                <span class="badge ${product.stock_quantity > 10 ? 'badge-success' : product.stock_quantity > 0 ? 'badge-warning' : 'badge-cancelled'}">
                  ${product.stock_quantity}
                </span>
              </td>
              <td>
                <span class="badge badge-${product.status === 'active' ? 'success' : 'cancelled'}" style="text-transform: capitalize;">
                  ${product.status}
                </span>
              </td>
              <td>
                <button onclick="editProduct(${product.id})" class="btn-icon" title="Edit">✏️</button>
                <button onclick="deleteProduct(${product.id})" class="btn-icon" title="Delete" style="margin-left: 4px;">🗑️</button>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    ${totalPages > 1 ? `
    <div class="pagination">
      <button 
        onclick="changeProductPage(${currentProductPage - 1})" 
        ${currentProductPage === 1 ? 'disabled' : ''}
        class="btn btn-secondary"
      >
        ← Previous
      </button>
      <div class="pagination-info">
        Page ${currentProductPage} of ${totalPages}
      </div>
      <button 
        onclick="changeProductPage(${currentProductPage + 1})" 
        ${currentProductPage === totalPages ? 'disabled' : ''}
        class="btn btn-secondary"
      >
        Next →
      </button>
    </div>
    ` : ''}
  `;
  
  // Populate category filter dropdown
  populateCategoryFilter();
}

// Load categories for filter
async function loadCategoriesForFilter() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/categories`);
    const data = await response.json();
    window.productCategories = data.categories || [];
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Populate category filter dropdown
function populateCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  if (select && window.productCategories) {
    const currentValue = productFilterCategory;
    select.innerHTML = '<option value="">All Categories</option>' + 
      window.productCategories.map(cat => 
        `<option value="${cat.id}" ${cat.id == currentValue ? 'selected' : ''}>${cat.icon || ''} ${cat.name}</option>`
      ).join('');
  }
}

// Search products (real-time)
function searchProducts(term) {
  productSearchTerm = term;
  applyProductFilters();
}

// Filter by category
function filterByCategory(categoryId) {
  productFilterCategory = categoryId;
  applyProductFilters();
}

// Filter by status
function filterByStatus(status) {
  productFilterStatus = status;
  applyProductFilters();
}

// Reset filters
function resetProductFilters() {
  productSearchTerm = '';
  productFilterCategory = '';
  productFilterStatus = '';
  applyProductFilters();
}

// Change product page
function changeProductPage(page) {
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentProductPage = page;
    displayProducts();
    // Scroll to top of products section
    document.getElementById('productsList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Show Add Product Modal
function showAddProductModal() {
  console.log('showAddProductModal called');
  
  const modal = document.getElementById('productModal');
  if (!modal) {
    console.error('Product modal not found!');
    alert('Error: Product modal not found in page');
    return;
  }
  
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productDescription').value = '';
  document.getElementById('productPrice').value = '';
  document.getElementById('productStock').value = '';
  document.getElementById('productImage').value = '';
  document.getElementById('productStatus').value = 'active';
  document.getElementById('productCategory').value = '';
  document.getElementById('productModalTitle').textContent = 'Add Product';
  
  // Load categories for dropdown
  loadCategoriesDropdown();
  
  modal.classList.add('active');
  console.log('Modal activated');
}

// Load Categories for Dropdown
async function loadCategoriesDropdown() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/categories`);
    const data = await response.json();
    
    const select = document.getElementById('productCategory');
    select.innerHTML = '<option value="">Select Category</option>' + 
      data.categories.map(cat => `<option value="${cat.id}">${cat.icon || ''} ${cat.name}</option>`).join('');
      
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Edit Product
async function editProduct(id) {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/products/${id}`);
    const data = await response.json();
    
    if (!data.success) {
      showToast('Product not found', 'error');
      return;
    }
    
    const product = data.product;
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock_quantity;
    document.getElementById('productImage').value = product.image_url || '';
    document.getElementById('productStatus').value = product.status;
    document.getElementById('productCategory').value = product.category_id || '';
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    
    loadCategoriesDropdown();
    document.getElementById('productModal').classList.add('active');
    
  } catch (error) {
    console.error('Error loading product:', error);
    showToast('Error loading product', 'error');
  }
}

// Save Product
async function saveProduct() {
  const id = document.getElementById('productId').value;
  const productData = {
    name: document.getElementById('productName').value,
    description: document.getElementById('productDescription').value,
    price: parseFloat(document.getElementById('productPrice').value),
    stock_quantity: parseInt(document.getElementById('productStock').value),
    image_url: document.getElementById('productImage').value,
    status: document.getElementById('productStatus').value,
    category_id: document.getElementById('productCategory').value || null
  };
  
  if (!productData.name || !productData.price || productData.stock_quantity === undefined) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const url = id ? `${ECOM_API_BASE}/api/ecommerce/products/${id}` : `${ECOM_API_BASE}/api/ecommerce/products`;
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(id ? 'Product updated!' : 'Product added!', 'success');
      closeProductModal();
      loadProducts();
    } else {
      showToast(data.message || 'Error saving product', 'error');
    }
    
  } catch (error) {
    console.error('Error saving product:', error);
    showToast('Error saving product', 'error');
  }
}

// Delete Product
async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/products/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Product deleted', 'success');
      loadProducts();
    } else {
      showToast(data.message || 'Error deleting product', 'error');
    }
    
  } catch (error) {
    console.error('Error deleting product:', error);
    showToast('Error deleting product', 'error');
  }
}

// Close Product Modal
function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

// ============================================
// CATEGORIES MANAGEMENT
// ============================================

// Load Categories
async function loadCategories() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/categories`);
    const data = await response.json();
    
    const categoriesList = document.getElementById('categoriesList');
    
    if (!data.success || data.categories.length === 0) {
      categoriesList.innerHTML = '<div class="empty-state">No categories found. Add your first category!</div>';
      return;
    }
    
    // Table view for categories
    categoriesList.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Icon</th>
              <th>Category Name</th>
              <th>Description</th>
              <th>Products</th>
              <th>Sort Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.categories.map(category => `
              <tr>
                <td style="text-align: center; font-size: 24px;">${category.icon || '📂'}</td>
                <td><strong>${category.name}</strong></td>
                <td>${category.description || 'No description'}</td>
                <td>
                  <span class="badge badge-success">
                    ${category.product_count || 0}
                  </span>
                </td>
                <td>${category.sort_order || 0}</td>
                <td>
                  <button onclick="editCategory(${category.id})" class="btn-icon" title="Edit">✏️</button>
                  <button onclick="deleteCategory(${category.id})" class="btn-icon" title="Delete" style="margin-left: 4px;">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading categories:', error);
    showToast('Error loading categories', 'error');
  }
}

// Show Add Category Modal
function showAddCategoryModal() {
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryName').value = '';
  document.getElementById('categoryDescription').value = '';
  document.getElementById('categoryIcon').value = '';
  document.getElementById('categorySortOrder').value = '0';
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('categoryModal').classList.add('active');
}

// Edit Category
async function editCategory(id) {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/categories/${id}`);
    const data = await response.json();
    
    if (!data.success) {
      showToast('Category not found', 'error');
      return;
    }
    
    const category = data.category;
    document.getElementById('categoryId').value = category.id;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryIcon').value = category.icon || '';
    document.getElementById('categorySortOrder').value = category.sort_order || 0;
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryModal').classList.add('active');
    
  } catch (error) {
    console.error('Error loading category:', error);
    showToast('Error loading category', 'error');
  }
}

// Save Category
async function saveCategory() {
  const id = document.getElementById('categoryId').value;
  const categoryData = {
    name: document.getElementById('categoryName').value,
    description: document.getElementById('categoryDescription').value,
    icon: document.getElementById('categoryIcon').value,
    sort_order: parseInt(document.getElementById('categorySortOrder').value) || 0
  };
  
  if (!categoryData.name) {
    showToast('Please enter category name', 'error');
    return;
  }
  
  try {
    const url = id ? `${ECOM_API_BASE}/api/ecommerce/categories/${id}` : `${ECOM_API_BASE}/api/ecommerce/categories`;
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(id ? 'Category updated!' : 'Category added!', 'success');
      closeCategoryModal();
      loadCategories();
    } else {
      showToast(data.message || 'Error saving category', 'error');
    }
    
  } catch (error) {
    console.error('Error saving category:', error);
    showToast('Error saving category', 'error');
  }
}

// Delete Category
async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/categories/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Category deleted', 'success');
      loadCategories();
    } else {
      showToast(data.message || 'Error deleting category', 'error');
    }
    
  } catch (error) {
    console.error('Error deleting category:', error);
    showToast('Error deleting category', 'error');
  }
}

// Close Category Modal
function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

// ============================================
// ORDERS MANAGEMENT
// ============================================

// Load Orders
async function loadOrders() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/orders`);
    const data = await response.json();
    
    if (!data.success || data.orders.length === 0) {
      document.getElementById('ordersList').innerHTML = '<div class="empty-state">No orders yet. Orders will appear here when customers place them via WhatsApp.</div>';
      return;
    }
    
    // Store all orders (sorted by date, newest first)
    allOrders = data.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    filteredOrders = allOrders;
    
    // Reset to first page
    currentOrderPage = 1;
    
    // Display orders
    displayOrders();
    
  } catch (error) {
    console.error('Error loading orders:', error);
    showToast('Error loading orders', 'error');
  }
}

// Display orders with pagination
function displayOrders() {
  const ordersList = document.getElementById('ordersList');
  
  if (filteredOrders.length === 0) {
    ordersList.innerHTML = '<div class="empty-state">No orders found.</div>';
    return;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startIndex = (currentOrderPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const ordersToDisplay = filteredOrders.slice(startIndex, endIndex);
  
  // Generate table HTML
  ordersList.innerHTML = `
    <!-- Results Info -->
    <div style="padding: 12px 0; color: var(--gray); font-size: 14px;">
      Showing ${startIndex + 1}-${Math.min(endIndex, filteredOrders.length)} of ${filteredOrders.length} orders
    </div>

    <!-- Orders Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Total (Rs.)</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${ordersToDisplay.map(order => `
            <tr>
              <td><strong>${order.order_number}</strong></td>
              <td>${new Date(order.created_at).toLocaleDateString()}<br>
                  <small style="color: var(--gray);">${new Date(order.created_at).toLocaleTimeString()}</small>
              </td>
              <td>${order.customer_name || 'N/A'}</td>
              <td>${order.phone_number}</td>
              <td>
                ${order.delivery_address || 'N/A'}${order.city ? ', ' + order.city : ''}
                ${order.notes ? `<br><small style="color: var(--gray);">Note: ${order.notes}</small>` : ''}
              </td>
              <td><strong>${parseFloat(order.total_amount).toLocaleString()}</strong></td>
              <td>
                ${order.payment_method || 'N/A'}<br>
                <span class="badge badge-${order.payment_status === 'paid' ? 'success' : 'warning'}" style="font-size: 11px;">
                  ${order.payment_status}
                </span>
              </td>
              <td>
                <span class="badge badge-${order.status}" style="text-transform: capitalize;">
                  ${order.status}
                </span>
              </td>
              <td>
                <select onchange="updateOrderStatus(${order.id}, this.value)" class="form-select" style="padding: 6px 8px; font-size: 12px; width: auto; min-width: 120px;">
                  <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                  <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                  <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                  <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                  <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    ${totalPages > 1 ? `
    <div class="pagination">
      <button 
        onclick="changeOrderPage(${currentOrderPage - 1})" 
        ${currentOrderPage === 1 ? 'disabled' : ''}
        class="btn btn-secondary"
      >
        ← Previous
      </button>
      <div class="pagination-info">
        Page ${currentOrderPage} of ${totalPages}
      </div>
      <button 
        onclick="changeOrderPage(${currentOrderPage + 1})" 
        ${currentOrderPage === totalPages ? 'disabled' : ''}
        class="btn btn-secondary"
      >
        Next →
      </button>
    </div>
    ` : ''}
  `;
}

// Change order page
function changeOrderPage(page) {
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  if (page >= 1 && page <= totalPages) {
    currentOrderPage = page;
    displayOrders();
    // Scroll to top of orders section
    document.getElementById('ordersList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Order status updated', 'success');
    } else {
      showToast(data.message || 'Error updating order', 'error');
      loadOrders(); // Reload to reset dropdown
    }
    
  } catch (error) {
    console.error('Error updating order:', error);
    showToast('Error updating order', 'error');
  }
}

// ============================================
// STORE SETTINGS MANAGEMENT
// ============================================

// Load Store Settings
async function loadStoreSettings() {
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/settings`);
    const data = await response.json();
    
    if (data.success && data.settings) {
      const settings = data.settings;
      document.getElementById('storeName').value = settings.store_name || '';
      document.getElementById('welcomeMessage').value = settings.welcome_message || '';
      document.getElementById('businessHours').value = settings.business_hours || '';
      document.getElementById('deliveryFee').value = settings.delivery_fee || '';
      document.getElementById('freeDeliveryAbove').value = settings.free_delivery_above || '';
      document.getElementById('paymentMethods').value = settings.payment_methods || '';
      document.getElementById('deliveryAreas').value = settings.delivery_areas || '';
    }
    
  } catch (error) {
    console.error('Error loading store settings:', error);
    showToast('Error loading settings', 'error');
  }
}

// Save Store Settings
async function saveStoreSettings() {
  const settings = {
    store_name: document.getElementById('storeName').value,
    welcome_message: document.getElementById('welcomeMessage').value,
    business_hours: document.getElementById('businessHours').value,
    delivery_fee: document.getElementById('deliveryFee').value,
    free_delivery_above: document.getElementById('freeDeliveryAbove').value,
    payment_methods: document.getElementById('paymentMethods').value,
    delivery_areas: document.getElementById('deliveryAreas').value
  };
  
  try {
    const response = await fetch(`${ECOM_API_BASE}/api/ecommerce/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Store settings saved!', 'success');
    } else {
      showToast(data.message || 'Error saving settings', 'error');
    }
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings', 'error');
  }
}

// ============================================
// TAB INITIALIZATION
// ============================================

// This function is called by app.js when e-commerce tabs are activated
window.loadEcommerceTab = function(tabName) {
  if (tabName === 'products') {
    loadProducts();
  } else if (tabName === 'categories') {
    loadCategories();
  } else if (tabName === 'orders') {
    loadOrders();
  } else if (tabName === 'store-settings') {
    loadStoreSettings();
  }
};

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================
// These functions need to be accessible from HTML onclick handlers

// Product functions
window.showAddProductModal = showAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

// Category functions
window.showAddCategoryModal = showAddCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.saveCategory = saveCategory;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;

// Order functions
window.loadOrders = loadOrders;
window.updateOrderStatus = updateOrderStatus;

// Store settings functions
window.saveStoreSettings = saveStoreSettings;

// Product search and filter functions
window.searchProducts = searchProducts;
window.filterByCategory = filterByCategory;
window.filterByStatus = filterByStatus;
window.resetProductFilters = resetProductFilters;
window.changeProductPage = changeProductPage;

// Order pagination functions
window.changeOrderPage = changeOrderPage;

// ============================================
// MODAL CLOSE ON OUTSIDE CLICK
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Product modal
  const productModal = document.getElementById('productModal');
  if (productModal) {
    productModal.addEventListener('click', (e) => {
      if (e.target.id === 'productModal') {
        closeProductModal();
      }
    });
  }
  
  // Category modal
  const categoryModal = document.getElementById('categoryModal');
  if (categoryModal) {
    categoryModal.addEventListener('click', (e) => {
      if (e.target.id === 'categoryModal') {
        closeCategoryModal();
      }
    });
  }
});
