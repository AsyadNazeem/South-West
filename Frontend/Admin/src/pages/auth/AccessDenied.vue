<script setup>
import { useRouter } from 'vue-router'
import { ShieldAlert } from 'lucide-vue-next'

const router = useRouter()

const goBack = () => {
  // Fall back to the dashboard if there is no previous page
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/admin/dashboard')
  }
}
</script>

<template>
  <div class="page-container">

    <div class="table-card">

      <div class="state-container">

        <div class="state-icon">
          <ShieldAlert :size="26" :stroke-width="1.75" />
        </div>

        <h1>Access denied</h1>

        <p>
          You do not have permission to view this page.
          Contact an administrator if you think this is a mistake.
        </p>

        <div class="state-actions">

          <button
              type="button"
              class="btn-secondary"
              @click="goBack"
          >
            Go back
          </button>

          <router-link
              to="/admin/dashboard"
              class="btn-primary"
          >
            Go to Dashboard
          </router-link>

        </div>

      </div>

    </div>

  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  font-family: var(--font-family);
}

/* =========================
   Card
   ========================= */

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 380px;
  padding: var(--spacing-2xl) var(--spacing-xl);
  text-align: center;
}

/* =========================
   Icon / Text
   ========================= */

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--spacing-lg);
  border-radius: 50%;
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.state-container h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.state-container p {
  max-width: 420px;
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-md);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* =========================
   Actions / Buttons
   ========================= */

.state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 480px) {
  .state-container {
    min-height: 320px;
    padding: var(--spacing-xl) var(--spacing-lg);
  }

  .state-actions {
    flex-direction: column-reverse;
    width: 100%;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
