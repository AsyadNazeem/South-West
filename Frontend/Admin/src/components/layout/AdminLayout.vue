<script setup>
import { ref } from "vue"
import Sidebar from "./Sidebar.vue"
import Topbar from "./Header.vue"

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleMobileSidebar = () => {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

const closeMobileSidebar = () => {
  mobileSidebarOpen.value = false
}
</script>

<template>
  <div
      class="admin-layout"
      :class="{
      'sidebar-collapsed': sidebarCollapsed,
      'mobile-sidebar-open': mobileSidebarOpen
    }"
  >

    <!-- Mobile Overlay -->
    <div
        v-if="mobileSidebarOpen"
        class="sidebar-overlay"
        @click="closeMobileSidebar"
    ></div>

    <Sidebar
        :collapsed="sidebarCollapsed"
        :mobile-open="mobileSidebarOpen"
        @close-mobile="closeMobileSidebar"
    />

    <div class="main-section">

      <Topbar
          :sidebar-collapsed="sidebarCollapsed"
          @toggle-sidebar="toggleSidebar"
          @toggle-mobile-sidebar="toggleMobileSidebar"
      />

      <main class="page-content">
        <router-view />
      </main>

    </div>

  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  background: var(--color-background);
}

.main-section {
  flex: 1;
  min-width: 0;
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-normal);
}

.sidebar-collapsed .main-section {
  margin-left: var(--sidebar-collapsed-width);
}

/* Mobile overlay */

.sidebar-overlay {
  display: none;
}

/* Page content */

.page-content {
  padding: var(--content-padding);
  min-height: calc(100vh - var(--topbar-height));
}

/* Tablet */

@media (max-width: 1024px) {
  .page-content {
    padding: var(--spacing-lg);
  }
}

/* Mobile */

@media (max-width: 768px) {

  .main-section,
  .sidebar-collapsed .main-section {
    margin-left: 0;
  }

  .page-content {
    padding: var(--spacing-md);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: 999;
  }
}
</style>
