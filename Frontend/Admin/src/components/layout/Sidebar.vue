<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  hasAllPermissions,
  hasPermission,
  logout as logoutSession
} from '../../auth/authorization'

import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Banknote,
  Megaphone,
  Settings,
  ChevronRight,
  LogOut,
  X
} from 'lucide-vue-next'

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  },

  mobileOpen: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const router = useRouter()

const menuDefinitions = [
  {
    key: 'customers',
    label: 'Customers',
    icon: Users,
    children: [
      { label: 'All Customers', to: '/admin/customers/all-customers', permissions: ['customers.view'] },
      { label: 'Addresses', to: '/admin/customers/addresses', permissions: ['customers.view'] },
      { label: 'Reviews', to: '/admin/customers/reviews', permissions: ['product_reviews.view'] }
    ]
  },
  {
    key: 'products',
    label: 'Products',
    icon: Package,
    children: [
      { label: 'Items', to: '/admin/products/items', permissions: ['products.view'] },
      { label: 'Categories', to: '/admin/products/categories', permissions: ['products.view'] },
      { label: 'Brands', to: '/admin/products/brands', permissions: ['products.view'] },
      { label: 'Units', to: '/admin/products/units', permissions: ['products.view'] },
      { label: 'Item Prices', to: '/admin/products/item-prices', permissions: ['products.view'] },
      { label: 'Specifications', to: '/admin/products/item-specifications', permissions: ['products.view'] },
      { label: 'Images', to: '/admin/products/item-images', permissions: ['item_images.view'] },
      { label: 'Warranty', to: '/admin/products/warranty', permissions: ['products.view'] },
      { label: 'Item Type', to: '/admin/products/item-types', permissions: ['products.view'] }
    ]
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: Warehouse,
    children: [
      { label: 'Locations', to: '/inventory/locations', permissions: ['inventory.view'] },
      { label: 'Stock', to: '/inventory/stock', permissions: ['inventory.view'] },
      { label: 'Stock Movements', to: '/inventory/movements', permissions: ['inventory.view'] }
    ]
  },
  {
    key: 'purchasing',
    label: 'Purchasing',
    icon: ShoppingCart,
    children: [
      { label: 'Suppliers', to: '/purchasing/suppliers', permissions: ['products.view'] },
      { label: 'Purchase Orders', to: '/purchasing/purchase-orders', permissions: ['products.view'] },
      { label: 'Goods Receipts', to: '/purchasing/goods-receipts', permissions: ['products.view'] }
    ]
  },
  {
    key: 'sales',
    label: 'Sales',
    icon: Banknote,
    children: [
      { label: 'Orders', to: '/sales/orders', permissions: ['orders.view'] },
      { label: 'Payments', to: '/sales/payments', permissions: ['payments.view'] },
      { label: 'Invoices', to: '/sales/invoices', permissions: ['invoices.view'] },
      { label: 'Deliveries', to: '/sales/deliveries', permissions: ['deliveries.view'] }
    ]
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    children: [
      { label: 'Promotions', to: '/marketing/promotions', permissions: ['promotions.view'] },
      { label: 'Categories', to: '/marketing/promotion-categories', permissions: ['promotion_categories.view'] },
      { label: 'Products', to: '/marketing/promotion-items', permissions: ['promotion_items.view'] }
    ]
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: Settings,
    children: [
      { label: 'Users', to: '/admin/administration/users', permissions: ['users.view'] },
      { label: 'Roles', to: '/admin/administration/roles', permissions: ['roles.view'] },
      { label: 'Permissions', to: '/admin/administration/assign-permissions', permissions: ['roles.view', 'roles.manage', 'permissions.view', 'permissions.manage'] },
      { label: 'User Sessions', to: '/admin/administration/user-sessions', permissions: ['user_sessions.view'] }
    ]
  }
]

const menus = computed(() =>
  menuDefinitions
    .map((menu) => ({
      ...menu,
      children: menu.children.filter((child) => hasAllPermissions(child.permissions))
    }))
    .filter((menu) => menu.children.length)
)

const openMenu = ref(null)

watch(
  [() => route.path, menus],
  ([path, visibleMenus]) => {
    const currentMenu = visibleMenus.find((menu) =>
      menu.children.some((child) => path.startsWith(child.to))
    )

    if (currentMenu) {
      openMenu.value = currentMenu.key
    } else if (!visibleMenus.some((menu) => menu.key === openMenu.value)) {
      openMenu.value = null
    }
  },
  { immediate: true }
)

const toggleMenu = (menu) => {
  openMenu.value = openMenu.value === menu ? null : menu
}

const isGroupActive = (menu) =>
    menu.children.some(c => route.path.startsWith(c.to))

const logout = async () => {
  await logoutSession().catch(() => undefined)
  router.replace('/login')
}

const emit = defineEmits([
  "close-mobile"
])
</script>

<template>
  <aside
      class="sidebar"
      :class="{
    collapsed,
    'mobile-open': mobileOpen
  }"
  >

    <!-- Header -->
    <div class="sidebar-header">

      <div class="logo">
        SW
      </div>

      <div class="brand">
        <h2>South West</h2>
        <span>Admin Panel</span>
      </div>

      <!-- Mobile Close -->
      <button
          class="mobile-close-button"
          type="button"
          aria-label="Close navigation"
          @click="emit('close-mobile')"
      >
        <X :size="20" :stroke-width="1.8" />
      </button>

    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">

      <router-link
          to="/admin/dashboard"
          v-if="hasPermission('dashboard.view')"
          class="nav-item"
          active-class="active"
          title="Dashboard"
          @click="emit('close-mobile')"
      >
        <span class="icon"><LayoutDashboard :size="18" :stroke-width="1.75" /></span>
        <span class="label">Dashboard</span>
      </router-link>

      <div v-for="menu in menus" :key="menu.key" class="nav-section">

        <button
            class="nav-item nav-parent"
            :class="{ 'group-active': isGroupActive(menu) }"
            :title="menu.label"
            @click="toggleMenu(menu.key)"
        >
          <span class="nav-left">
            <span class="icon"><component :is="menu.icon" :size="18" :stroke-width="1.75" /></span>
            <span class="label">{{ menu.label }}</span>
          </span>

          <span class="arrow" :class="{ rotated: openMenu === menu.key }">
            <ChevronRight :size="16" :stroke-width="2" />
          </span>
        </button>

        <Transition name="submenu">
          <div
              v-if="openMenu === menu.key && !collapsed"
              class="submenu"
          >
            <router-link
                v-for="child in menu.children"
                :key="child.to"
                :to="child.to"
                class="submenu-item"
                @click="emit('close-mobile')"
            >
              <span class="submenu-dot"></span>
              <span>{{ child.label }}</span>
            </router-link>
          </div>
        </Transition>

      </div>

    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="logout-button" title="Logout" @click="logout">
        <span class="icon"><LogOut :size="18" :stroke-width="1.75" /></span>
        <span class="label">Logout</span>
      </button>
    </div>

  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;

  background: var(--color-sidebar);
  color: var(--color-text-light);

  display: flex;
  flex-direction: column;

  position: fixed;
  top: 0;
  left: 0;

  z-index: 1000;

  transition:
      width var(--transition-normal),
      transform var(--transition-normal);
}

/* =========================================================
   COLLAPSED DESKTOP
   ========================================================= */

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}


/* =========================================================
   SIDEBAR HEADER
   ========================================================= */

.sidebar-header {
  height: var(--topbar-height);
  flex-shrink: 0;

  display: flex;
  align-items: center;

  padding: 0 var(--spacing-xl);

  border-bottom: 1px solid var(--color-sidebar-border);
}

.logo {
  width: 36px;
  height: 36px;

  flex-shrink: 0;

  border-radius: var(--radius-lg);

  background: var(--color-primary);

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);

  letter-spacing: 0.5px;

  margin-right: var(--spacing-md);
}

.brand {
  min-width: 0;
}

.brand h2 {
  margin: 0;

  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);

  line-height: 1.2;

  white-space: nowrap;
}

.brand span {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);

  text-transform: uppercase;
  letter-spacing: 0.8px;

  white-space: nowrap;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

.sidebar-nav {
  flex: 1;
  min-height: 0;

  padding: var(--spacing-lg) var(--spacing-md);

  overflow-y: auto;
  overflow-x: hidden;

  scrollbar-width: thin;
}

.nav-item {
  width: 100%;
  min-height: 40px;

  border: none;
  background: transparent;

  color: var(--color-text-muted);

  display: flex;
  align-items: center;

  padding: 0 var(--spacing-md);

  border-radius: var(--radius-lg);

  cursor: pointer;

  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);

  margin-bottom: 2px;

  text-decoration: none;

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-light);
}

.nav-item.active {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.nav-parent {
  justify-content: space-between;
  font-family: inherit;
}

.nav-parent.group-active {
  color: var(--color-text-light);
}

.nav-left {
  display: flex;
  align-items: center;

  min-width: 0;
}

.icon {
  width: 20px;
  height: 20px;

  margin-right: var(--spacing-md);

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;
}

.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow {
  display: flex;
  align-items: center;

  color: var(--color-text-muted);

  flex-shrink: 0;

  transition: transform var(--transition-normal);
}

.arrow.rotated {
  transform: rotate(90deg);
}


/* =========================================================
   SUBMENU
   ========================================================= */

.submenu {
  margin: 2px 0 var(--spacing-sm) 29px;

  padding-left: var(--spacing-sm);

  border-left: 1px solid var(--color-sidebar-border);
}

.submenu-item {
  display: flex;
  align-items: center;

  gap: 10px;

  min-height: 34px;

  padding: 6px var(--spacing-md);

  color: var(--color-text-muted);

  text-decoration: none;

  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);

  border-radius: var(--radius-md);

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.submenu-item:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-light);
}

.submenu-item.router-link-exact-active {
  background: var(--color-sidebar-hover);
  color: var(--color-text-light);

  font-weight: var(--font-weight-semibold);
}

.submenu-dot {
  width: 5px;
  height: 5px;

  border-radius: var(--radius-full);

  background: var(--color-sidebar-border);

  flex-shrink: 0;
}

.submenu-item.router-link-exact-active .submenu-dot {
  background: var(--color-primary);
}


/* =========================================================
   SUBMENU ANIMATION
   ========================================================= */

.submenu-enter-active,
.submenu-leave-active {
  transition:
      opacity var(--transition-fast),
      transform var(--transition-fast);
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}


/* =========================================================
   FOOTER
   ========================================================= */

.sidebar-footer {
  flex-shrink: 0;

  padding: var(--spacing-md);

  border-top: 1px solid var(--color-sidebar-border);
}

.logout-button {
  width: 100%;
  height: 40px;

  border: none;
  background: transparent;

  color: var(--color-text-muted);

  display: flex;
  align-items: center;

  padding: 0 var(--spacing-md);

  border-radius: var(--radius-lg);

  cursor: pointer;

  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.logout-button:hover {
  background: var(--color-danger);
  color: var(--color-text-light);
}


/* =========================================================
   COLLAPSED DESKTOP
   ========================================================= */

.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}

.sidebar.collapsed .logo {
  margin-right: 0;
}

.sidebar.collapsed .brand,
.sidebar.collapsed .label,
.sidebar.collapsed .arrow {
  display: none;
}

.sidebar.collapsed .nav-item,
.sidebar.collapsed .logout-button {
  justify-content: center;
  padding: 0;
}

.sidebar.collapsed .icon {
  margin-right: 0;
}

.mobile-close-button {
  display: none;

  width: 36px;
  height: 36px;

  align-items: center;
  justify-content: center;

  margin-left: auto;

  border: none;
  border-radius: var(--radius-lg);

  background: transparent;
  color: var(--color-text-muted);

  cursor: pointer;

  transition:
      background var(--transition-normal),
      color var(--transition-normal);
}

.mobile-close-button:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-light);
}

/* =========================================================
   LARGE DESKTOP
   ========================================================= */

@media (min-width: 1440px) {

  .sidebar {
    width: var(--sidebar-width);
  }

  .sidebar-nav {
    padding-left: var(--spacing-lg);
    padding-right: var(--spacing-lg);
  }
}


/* =========================================================
   TABLET
   769px - 1199px
   ========================================================= */

@media (min-width: 769px) and (max-width: 1199px) {

  .sidebar {
    width: 220px;
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    padding: 0 var(--spacing-lg);
  }

  .brand h2 {
    font-size: var(--font-size-md);
  }

  .nav-item {
    font-size: var(--font-size-sm);
  }

  .submenu-item {
    font-size: var(--font-size-xs);
  }
}


/* =========================================================
   MOBILE
   481px - 768px
   ========================================================= */

@media (max-width: 768px) {

  .sidebar {
    width: var(--sidebar-width);

    transform: translateX(-100%);

    transition:
        transform var(--transition-normal),
        width var(--transition-normal);

    z-index: 1000;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  /*
   * Mobile sidebar should always
   * display in full width.
   */

  .sidebar.collapsed {
    width: var(--sidebar-width);
  }

  .sidebar.collapsed .sidebar-header {
    justify-content: flex-start;
    padding: 0 var(--spacing-xl);
  }

  .sidebar.collapsed .brand,
  .sidebar.collapsed .label,
  .sidebar.collapsed .arrow {
    display: block;
  }

  .sidebar.collapsed .nav-item,
  .sidebar.collapsed .logout-button {
    justify-content: flex-start;
    padding: 0 var(--spacing-md);
  }

  .sidebar.collapsed .icon {
    margin-right: var(--spacing-md);
  }

  .sidebar.collapsed .logo {
    margin-right: var(--spacing-md);
  }

  .mobile-close-button {
    display: flex;
  }

  .sidebar-nav {
    overflow-y: auto;
  }
}


/* =========================================================
   SMALL MOBILE
   <= 480px
   ========================================================= */

@media (max-width: 480px) {

  .sidebar {
    width: 86vw;
    max-width: 300px;
  }

  .sidebar-header {
    padding: 0 var(--spacing-lg);
  }

  .brand h2 {
    font-size: var(--font-size-md);
  }

  .brand span {
    font-size: 10px;
  }

  .nav-item {
    min-height: 44px;

    font-size: var(--font-size-sm);
  }

  .submenu-item {
    min-height: 40px;

    font-size: var(--font-size-sm);
  }

  .sidebar-nav {
    padding: var(--spacing-md) var(--spacing-sm);
  }
}


/* =========================================================
   VERY SMALL DEVICES
   <= 360px
   ========================================================= */

@media (max-width: 360px) {

  .sidebar {
    width: 90vw;
  }

  .sidebar-header {
    padding: 0 var(--spacing-md);
  }

  .logo {
    width: 34px;
    height: 34px;
  }

  .nav-item {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }

  .logout-button {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
}


/* =========================================================
   REDUCED MOTION
   ========================================================= */

@media (prefers-reduced-motion: reduce) {

  .sidebar,
  .nav-item,
  .submenu-item,
  .logout-button,
  .arrow,
  .submenu {
    transition: none;
  }
}
</style>
