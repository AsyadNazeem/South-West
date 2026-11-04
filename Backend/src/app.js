const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { UPLOAD_ROOT } = require('./utils/fileStorage');

const { getPublicBanners } = require('./controllers/homepageBannerController');


const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const customerAddressRoutes = require("./routes/customerAddressRoutes");
const deliveryDistrictRoutes = require("./routes/deliveryDistrictRoutes");
const deliveryAreaRoutes = require("./routes/deliveryAreaRoutes");
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
const customerAuthRoutes = require("./routes/customerAuthRoutes");
const customerCartRoutes = require('./routes/customerCartRoutes');
const customerCheckoutRoutes = require('./routes/customerCheckoutRoutes');
const guestCheckoutRoutes = require('./routes/guestCheckoutRoutes');
const customerOrderRoutes = require('./routes/customerOrderRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');

const customerSelfAddressRoutes = require('./routes/customerSelfAddressRoutes');
const myNotificationRoutes = require('./routes/myNotificationRoutes');
const myNotificationPreferenceRoutes = require('./routes/myNotificationPreferenceRoutes');
const storeCategoryRoutes = require('./routes/storeCategoryRoutes');
const storeProductRoutes = require('./routes/storeProductRoutes');
const socialPreviewRoutes = require('./routes/socialPreviewRoutes');
const customerWishlistRoutes = require('./routes/customerWishlistRoutes');
const homepageBannerRoutes = require('./routes/homepageBannerRoutes');
const publicHomepageBannerRoutes = require('./routes/publicHomepageBannerRoutes');
const customerProductReviewRoutes = require('./routes/customerProductReviewRoutes');

const discountCampaignRoutes = require('./routes/discountCampaignRoutes');
const campaignFrameRoutes = require('./routes/campaignFrameRoutes');
const websiteThemeRoutes = require('./routes/websiteThemeRoutes');
const websiteThemeAdminRoutes = require('./routes/websiteThemeAdminRoutes');
const storeBrandRoutes = require('./routes/storeBrandRoutes');
const itemPaymentPriceRoutes = require('./routes/itemPaymentPriceRoutes');

const reportRoutes = require('./routes/reportRoutes');

const app = express();


const defaultCorsOrigins = process.env.NODE_ENV === 'production'
  ? ['https://southwest.lk', 'https://admin.southwest.lk']
  : ['http://localhost:5173', 'http://localhost:5174'];

const allowedCorsOrigins = (
  process.env.CORS_ORIGINS || defaultCorsOrigins.join(',')
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include server-to-server and CLI requests.
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedCorsOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Guest-Checkout-Token'
  ]
}));


app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

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
app.use("/api/delivery-districts", deliveryDistrictRoutes);
app.use("/api/delivery-areas", deliveryAreaRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api', rolePermissionRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/item-prices', itemPriceRoutes);
app.use('/api/item-specifications', itemSpecificationRoutes);
app.use('/api/item-type-specifications', itemTypeSpecificationRoutes);
app.use('/api/item-specification-values', itemSpecificationValueRoutes);
app.use('/api/inventory-locations', inventoryLocationRoutes);
app.use('/api/inventory-stock', inventoryStockRoutes);
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
app.use("/api/customer-auth", customerAuthRoutes);
app.use('/api/customer-cart', customerCartRoutes);
app.use('/api/customer-checkout', customerCheckoutRoutes);
app.use('/api/guest-checkout', guestCheckoutRoutes);
app.use('/api/customer-orders', customerOrderRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/item-payment-prices', itemPaymentPriceRoutes);

app.use('/uploads', express.static(UPLOAD_ROOT));
app.use('/api/item-videos', require('./routes/itemVideoRoutes'));

app.use('/api/customer/addresses', customerSelfAddressRoutes);
app.use('/api/my/notifications', myNotificationRoutes);
app.use('/api/my/notification-preferences', myNotificationPreferenceRoutes);
app.use('/api/store/categories', storeCategoryRoutes);
app.use('/api/store/products', storeProductRoutes);
app.use('/api/social-preview', socialPreviewRoutes);
app.use('/api/customer-wishlist', customerWishlistRoutes);
app.use('/api/homepage-banners', homepageBannerRoutes);
app.get('/api/store/banners', getPublicBanners);
app.use('/api/store/homepage-banners', publicHomepageBannerRoutes);
app.use('/api/discount-campaigns', discountCampaignRoutes);
app.use('/api/campaign-frames', campaignFrameRoutes);
app.use('/api/store/website-theme', websiteThemeRoutes);
app.use('/api/website-themes', websiteThemeAdminRoutes);
app.use('/api/store/brands', storeBrandRoutes);
app.use('/api/customer-reviews', customerProductReviewRoutes);

app.use('/api/reports', reportRoutes);

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
