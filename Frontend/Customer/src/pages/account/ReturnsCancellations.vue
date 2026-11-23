
<script setup>
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
</script>

<template>
  <section class="returns-page">
    <AccountPageHeader
      title="Warranty & Order Support"
      description="Submit warranty claims, review warranty terms, and get assistance with your orders."
    />

    <div class="list">
      <!-- Warranty claim -->
      <article class="row">
        <div class="text">
          <h2>Submit a warranty claim</h2>
          <p>
            Have your invoice and video proof ready before
            submitting a warranty claim for an eligible product.
          </p>
        </div>

        <div class="actions">
          <RouterLink
            class="btn"
            to="/account/warranty-claims/new"
          >
            Submit claim
          </RouterLink>
        </div>
      </article>

      <!-- Warranty policy -->
      <article class="row">
        <div class="text">
          <h2>Return & Warranty Terms & Conditions</h2>
          <p>
            Review warranty coverage, exclusions, required
            documents, and the claim process.
          </p>
        </div>

        <div class="actions">
          <RouterLink class="link" to="/returns">
            Read Return & Warranty Policy →
          </RouterLink>
        </div>
      </article>

      <!-- Order assistance -->
      <article class="row">
        <div class="text">
          <h2>Order assistance</h2>
          <p>
            Find your order number and contact South West
            if you need assistance with an existing order.
          </p>
        </div>

        <div class="actions">
          <RouterLink class="btn" to="/account/orders">
            My orders
          </RouterLink>

          <RouterLink class="link" to="/contact">
            Contact support →
          </RouterLink>
        </div>
      </article>

      <!-- Stock unavailability -->
      <article class="row">
        <div class="text">
          <h2>Stock unavailability</h2>
          <p>
            If a product becomes unavailable after you place an
            order, South West will contact you to discuss the
            available options, including a refund where applicable.
            Standard returns and refunds are not offered, subject
            to applicable consumer protection laws.
          </p>
        </div>

        <div class="actions">
          <RouterLink class="link" to="/contact">
            Contact support →
          </RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.returns-page {
  min-width: 0;
  color: var(--color-text);
}

.list {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 20px;
}

.row + .row {
  border-top: 1px solid var(--color-border-soft);
}

.text {
  min-width: 0;
}

h2 {
  margin: 0;
  font-family: var(--font-family-display);
  font-size: 15px;
  font-weight: 700;
}

p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 18px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 16px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-md);
  font: 600 13px/1 var(--font-family-base);
  text-decoration: none;
  white-space: nowrap;
  transition: background .15s ease;
}

.btn:hover {
  background: var(--color-primary-hover);
}

.link {
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.link:hover {
  text-decoration: underline;
}

.btn:focus-visible,
.link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 14px;
  }

  .actions {
    flex-wrap: wrap;
    gap: 12px 18px;
  }
}
</style>
