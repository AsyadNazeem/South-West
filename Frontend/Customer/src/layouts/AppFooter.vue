<script setup>
const currentYear = new Date().getFullYear()

const shopLinks = [
  { label: "All Products", to: "/shop" },
  { label: "Categories", to: "/categories" },
  { label: "Brands", to: "/brands" },
  { label: "Special Offers", to: "/offers" },
]

const supportLinks = [
  { label: "Contact Us", to: "/contact" },
  { label: "FAQs", to: "/faq" },
  { label: "Shipping Information", to: "/shipping" },
  { label: "Returns & Refunds", to: "/returns" },
]

const companyLinks = [
  { label: "About Us", to: "/about" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
]
</script>

<template>
  <footer class="app-footer">
    <!-- Main footer -->
    <div class="footer-main">
      <div class="footer-container">
        <div class="footer-grid">
          <!-- Brand section -->
          <div class="footer-brand">
            <RouterLink to="/" class="brand-link" aria-label="South-West home">
              <img
                src="/SWLogoBlack.png"
                alt="South West"
                class="brand-logo"
              />
            </RouterLink>

            <p class="brand-description">
              Your trusted destination for quality products, everyday
              essentials and great value. Shop with confidence at South-West.
            </p>

            <div class="trust-note">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 3 4.5 6v5.5c0 4.5 3.2 7.8 7.5 9.5 4.3-1.7 7.5-5 7.5-9.5V6L12 3Z"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <path
                  d="m9 12 2 2 4-4"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Shopping made simple</span>
            </div>
          </div>

          <!-- Shopping links -->
          <div class="footer-column">
            <h3>Shop</h3>
            <ul>
              <li v-for="link in shopLinks" :key="link.label">
                <RouterLink :to="link.to">
                  {{ link.label }}
                </RouterLink>
              </li>
            </ul>
          </div>

          <!-- Support links -->
          <div class="footer-column">
            <h3>Customer Care</h3>
            <ul>
              <li v-for="link in supportLinks" :key="link.label">
                <RouterLink :to="link.to">
                  {{ link.label }}
                </RouterLink>
              </li>
            </ul>
          </div>

          <!-- Company links -->
          <div class="footer-column">
            <h3>Information</h3>
            <ul>
              <li v-for="link in companyLinks" :key="link.label">
                <RouterLink :to="link.to">
                  {{ link.label }}
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- Shopping benefits -->
        <div class="footer-benefits">
          <div class="benefit">
            <span class="benefit-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
                <circle cx="7.5" cy="18" r="1.8" stroke="currentColor" stroke-width="1.6" />
                <circle cx="17.5" cy="18" r="1.8" stroke="currentColor" stroke-width="1.6" />
              </svg>
            </span>
            <div>
              <strong>Convenient Shopping</strong>
              <p>Browse products with ease</p>
            </div>
          </div>

          <div class="benefit">
            <span class="benefit-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
                <path
                  d="M3 10h18M7 15h4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            <div>
              <strong>Easy Checkout</strong>
              <p>A straightforward order process</p>
            </div>
          </div>

          <div class="benefit">
            <span class="benefit-icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <div>
              <strong>Customer Support</strong>
              <p>We're here to help</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="footer-bottom">
      <div class="footer-container footer-bottom-inner">
        <p>
          © {{ currentYear }} South-West. All rights reserved.
        </p>

        <div class="footer-bottom-links">
          <RouterLink to="/privacy-policy">Privacy</RouterLink>
          <span class="bottom-divider"></span>
          <RouterLink to="/terms">Terms</RouterLink>
        </div>

        <p class="footer-made">
          Made for a better shopping experience.
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  --footer-bg: var(--color-surface, #fff);
  --footer-text: var(--color-text-primary, #20242b);
  --footer-muted: var(--color-text-secondary, #6b7280);
  --footer-border: var(--color-border-light, #e5e7eb);
  --footer-accent: var(--color-primary, #263b63);

  width: 100%;
  margin-top: auto;
  background: var(--footer-bg);
  color: var(--footer-text);
  border-top: 1px solid var(--footer-border);
}

.footer-container {
  width: min(100% - 40px, 1440px);
  margin: 0 auto;
}

.footer-main {
  padding: 28px 0 12px;
}

.footer-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1.6fr) repeat(3, minmax(110px, 1fr));
  gap: 28px;
}

/* ---------- Brand ---------- */
.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  color: var(--footer-text);
}

.brand-logo {
  display: block;
  width: 190px;
  max-width: 100%;
  height: 48px;
  object-fit: contain;
  object-position: left center;
}

.brand-description {
  max-width: 300px;
  margin: 10px 0 0;
  color: var(--footer-muted);
  font-size: 12.5px;
  line-height: 1.65;
}

.trust-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  color: var(--footer-accent);
  font-size: 12px;
  font-weight: 600;
}

.trust-note svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

/* ---------- Link columns ---------- */
.footer-column h3 {
  margin: 2px 0 10px;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.2px;
}

.footer-column ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.footer-column a,
.footer-bottom-links a {
  color: var(--footer-muted);
  text-decoration: none;
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  transition: color 160ms ease;
}

.footer-column a:hover,
.footer-bottom-links a:hover {
  color: var(--footer-accent);
}

.footer-column a:focus-visible,
.footer-bottom-links a:focus-visible,
.brand-link:focus-visible {
  outline: 2px solid var(--footer-accent);
  outline-offset: 2px;
}

/* ---------- Benefits (slim single row) ---------- */
.footer-benefits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
  padding: 12px 0;
  border-top: 1px solid var(--footer-border);
}

.benefit {
  display: flex;
  align-items: center;
  gap: 10px;
}

.benefit-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--footer-border);
  border-radius: 8px;
  color: var(--footer-accent);
  background: var(--color-surface, #fff);
}

.benefit-icon svg {
  width: 17px;
  height: 17px;
}

.benefit strong {
  display: block;
  font-size: 12px;
  font-weight: 700;
}

.benefit p {
  margin: 1px 0 0;
  color: var(--footer-muted);
  font-size: 11px;
  line-height: 1.4;
}

/* ---------- Bottom bar ---------- */
.footer-bottom {
  background: var(--footer-bg);
  border-top: 1px solid var(--footer-border);
}

.footer-bottom-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 44px;
}

.footer-bottom-inner > p,
.footer-bottom-links a {
  margin: 0;
  color: var(--footer-muted);
  font-size: 11.5px;
}

.footer-bottom-links {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bottom-divider {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--footer-muted);
}

/* Touch devices: a little more room to tap, still compact */
@media (pointer: coarse) {
  .footer-column a,
  .footer-bottom-links a {
    display: inline-block;
    padding: 5px 0;
  }
}

@media (min-width: 1600px) {
  .footer-container {
    width: min(100% - 80px, 1500px);
  }
}

@media (max-width: 1000px) {
  .footer-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 22px 20px;
  }

  .footer-brand {
    grid-column: 1 / -1;
  }

  .brand-description {
    max-width: 440px;
  }

  .footer-made {
    display: none;
  }
}

@media (max-width: 650px) {
  .footer-container {
    width: calc(100% - 32px);
  }

  .footer-main {
    padding: 22px 0 8px;
  }

  .footer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 16px;
  }

  /* Benefits become three compact icon + title tiles */
  .footer-benefits {
    gap: 8px;
    margin-top: 18px;
  }

  .benefit {
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }

  .benefit p {
    display: none;
  }

  .benefit strong {
    font-size: 11px;
    line-height: 1.3;
  }

  .footer-bottom-inner {
    flex-wrap: wrap;
    gap: 4px 14px;
    min-height: 0;
    padding: 10px 0;
  }
}

@media (max-width: 380px) {
  .footer-container {
    width: calc(100% - 24px);
  }

  .footer-grid {
    gap: 18px 12px;
  }

  .brand-name {
    font-size: 15px;
  }
}
</style>