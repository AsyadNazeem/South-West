const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const customerAddressRoutes = require("./routes/customerAddressRoutes");
const permissionRoutes = require('./routes/permissionRoutes');
const rolePermissionRoutes = require('./routes/rolePermissionRoutes');
const itemRoutes = require('./routes/itemRoutes');
const itemPriceRoutes = require('./routes/itemPriceRoutes');
const itemSpecificationRoutes = require('./routes/itemSpecificationRoutes');
const itemTypeSpecificationRoutes = require('./routes/itemTypeSpecificationRoutes');
const itemSpecificationValueRoutes = require('./routes/itemSpecificationValueRoutes');
const inventoryLocationRoutes = require('./routes/inventoryLocationRoutes');
const inventoryStockRoutes = require('./routes/inventoryStockRoutes');
const inventoryStockMovementRoutes = require('./routes/inventoryStockMovementRoutes');
const goodsReceiptRoutes = require('./routes/goodsReceiptRoutes');
const goodsReceiptItemRoutes = require('./routes/goodsReceiptItemRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseOrderItemRoutes = require('./routes/purchaseOrderItemRoutes');
const brandRoutes = require('./routes/brandRoutes');
const unitRoutes = require('./routes/unitRoutes');
const cartRoutes = require('./routes/cartRoutes');
const cartItemRoutes = require('./routes/cartItemRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const deliveryStatusHistoryRoutes = require('./routes/deliveryStatusHistoryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const itemImageRoutes = require('./routes/itemImageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const notificationPreferenceRoutes = require('./routes/notificationPreferenceRoutes');
const oauthAccountRoutes = require('./routes/oauthAccountRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderAddressRoutes = require('./routes/orderAddressRoutes')
const orderItemRoutes = require('./routes/orderItemRoutes');
const orderPromotionRoutes = require('./routes/orderPromotionRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const promotionCategoryRoutes = require('./routes/promotionCategoryRoutes');
const promotionItemRoutes = require('./routes/promotionItemRoutes');
const productReviewRoutes = require('./routes/productReviewRoutes');
const userRoleRoutes = require('./routes/userRoleRoutes');
const userSessionRoutes = require('./routes/userSessionRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const customerAddressListRoutes = require('./routes/customerAddressListRoutes');
const itemTypeRoutes = require('./routes/itemTypeRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');

const app = express();

app.use(
    cors({
        origin: 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
)
app.use(express.json());

// Routes
app.get("/", (req, res) => {
    res.json({
        message: "South West Backend is running",
    });
});

const path = require('path');

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use("/api/customers", customerAddressRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api', rolePermissionRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/item-prices', itemPriceRoutes);
app.use('/api/item-specifications', itemSpecificationRoutes);
app.use('/api/item-type-specifications', itemTypeSpecificationRoutes);
app.use('/api/item-specification-values', itemSpecificationValueRoutes);
app.use('/api/inventory-locations', inventoryLocationRoutes);
app.use('/api/inventory-stocks', inventoryStockRoutes);
app.use('/api/inventory-stock-movements', inventoryStockMovementRoutes);
app.use('/api/goods-receipts', goodsReceiptRoutes);
app.use('/api/goods-receipt-items', goodsReceiptItemRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-order-items', purchaseOrderItemRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/cart-items', cartItemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery-status-history', deliveryStatusHistoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/item-images', itemImageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-preferences', notificationPreferenceRoutes);
app.use('/api/oauth-accounts', oauthAccountRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/order-addresses', orderAddressRoutes);
app.use('/api/order-items', orderItemRoutes);
app.use('/api/order-promotions', orderPromotionRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/promotion-categories', promotionCategoryRoutes);
app.use('/api/promotion-items', promotionItemRoutes);
app.use('/api/product-reviews', productReviewRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api', userSessionRoutes);
app.use('/api', wishlistRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customer-addresses', customerAddressListRoutes);
app.use('/api/item-types', itemTypeRoutes);
app.use('/api/warranties', warrantyRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/item-videos', require('./routes/itemVideoRoutes'));

const PORT = process.env.PORT || 5001;

async function startServer() {
    try {
        await sequelize.authenticate();

        console.log("✅ MySQL database connected successfully");

        app.listen(PORT, () => {
            console.log(`🚀 South West Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Unable to connect to MySQL:");
        console.error(error.message);
    }
}

startServer();

// curl -X POST http://localhost:5001/api/auth/login \
//     -H "Content-Type: application/json" \
//   -d '{
// "email": "admin@southwest.lk",
//     "password": "SouthWest@2026!"
// }'
//
// For the Staff user:
//
//     curl -X POST http://localhost:5001/api/auth/login \
//     -H "Content-Type: application/json" \
//   -d '{
// "email": "staff@southwest.lk",
//     "password": "Staff@2026!"
// }'
//
// For the Manager user:
//
//     curl -X POST http://localhost:5001/api/auth/login \
//     -H "Content-Type: application/json" \
//   -d '{
// "email": "manager@southwest.lk",
//     "password": "Manager@2026!"
// }'

// curl -X POST http://localhost:5001/api/users \
//     -H "Content-Type: application/json" \
//   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
//   -d '{
// "email": "sales@southwest.lk",
//     "password": "Sales@2026!",
//     "role_id": 4
// }'
