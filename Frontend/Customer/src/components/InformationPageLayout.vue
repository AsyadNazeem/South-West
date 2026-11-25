<script setup>
defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, required: true },
  intro: { type: String, required: true },
  breadcrumb: String,
  sections: Array,
  notice: String,
  faqItems: Array,
})
</script>

<template>
  <main class="information-page">
    <div class="information-container">
      <nav class="information-breadcrumb" aria-label="Breadcrumb">
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>{{ breadcrumb || title }}</span>
      </nav>

      <header class="information-heading">
        <p class="information-eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p>{{ intro }}</p>
      </header>

      <slot />
      <section v-if="faqItems" class="faq-list">
        <details v-for="(item, index) in faqItems" :key="item.q" class="faq-item">
          <summary>
            <span class="faq-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ item.q }}</span>
            <span class="faq-plus" aria-hidden="true">+</span>
          </summary>
          <div class="faq-answer">
            <p>{{ item.a }}</p>
            <RouterLink v-if="item.link" :to="item.link">{{ item.linkText }} →</RouterLink>
          </div>
        </details>
      </section>

      <template v-else>
        <div class="information-sections">
          <article v-for="(section, index) in sections" :key="section.title" class="information-card">
            <span class="section-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h2>{{ section.title }}</h2>
              <p>{{ section.text }}</p>
              <p v-if="section.note" class="section-note">{{ section.note }}</p>
              <RouterLink v-if="section.link" :to="section.link" class="section-link">
                {{ section.linkText }} →
              </RouterLink>
            </div>
          </article>
        </div>

        <aside v-if="notice" class="information-notice">
          <strong>Important information</strong>
          <p>{{ notice }}</p>
        </aside>
      </template>

      <section class="information-footer">
        <div>
          <h2>Need more help?</h2>
          <p>Explore our products or review the frequently asked questions.</p>
        </div>
        <div class="information-actions">
          <RouterLink to="/shop" class="information-button primary">Shop products</RouterLink>
          <RouterLink to="/faq" class="information-button secondary">Visit FAQs</RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.information-page {
  min-height: 55vh;
  padding: 28px 0 72px;
  background: var(--color-background, #f8f9fb);
}
.information-container {
  width: min(100% - 40px, 1040px);
  margin: 0 auto;
}
.information-breadcrumb {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  color: var(--color-text-muted, #777);
  font-size: 13px;
}
.information-breadcrumb a { color: inherit; text-decoration: none; }
.information-heading { max-width: 760px; margin-bottom: 34px; }
.information-eyebrow {
  margin: 0 0 9px;
  color: var(--color-primary, #263b63);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .15em;
}
.information-heading h1 {
  margin: 0;
  color: var(--color-text, #20242b);
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.15;
}
.information-heading > p:last-child {
  margin: 13px 0 0;
  color: var(--color-text-muted, #737985);
  font-size: 15px;
  line-height: 1.75;
}
.information-sections { display: grid; gap: 14px; }
.information-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 16px;
  padding: 23px 25px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: var(--color-surface, #fff);
}
.section-number, .faq-number {
  color: var(--color-primary, #263b63);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .06em;
}
.information-card h2 {
  margin: 0 0 8px;
  color: var(--color-text, #20242b);
  font-size: 18px;
}
.information-card p {
  margin: 0;
  color: var(--color-text-muted, #737985);
  font-size: 14px;
  line-height: 1.75;
}
.information-card .section-note { margin-top: 10px; font-weight: 650; }
.section-link {
  display: inline-block;
  margin-top: 12px;
  color: var(--color-primary, #263b63);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-notice {
  margin-top: 20px;
  padding: 18px 20px;
  border: 1px solid #e7d6ad;
  border-radius: 10px;
  background: #fffaf0;
  color: #634b1d;
}
.information-notice strong { font-size: 14px; }
.information-notice p { margin: 6px 0 0; font-size: 13px; line-height: 1.7; }
.faq-list { display: grid; gap: 10px; }
.faq-item {
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: var(--color-surface, #fff);
}
.faq-item summary {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  padding: 19px 21px;
  color: var(--color-text, #20242b);
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
  list-style: none;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-plus {
  color: var(--color-primary, #263b63);
  font-size: 22px;
  text-align: center;
  transition: transform .2s;
}
.faq-item[open] .faq-plus { transform: rotate(45deg); }
.faq-answer { padding: 0 21px 20px 67px; }
.faq-answer p {
  margin: 0;
  color: var(--color-text-muted, #737985);
  font-size: 14px;
  line-height: 1.75;
}
.faq-answer a {
  display: inline-block;
  margin-top: 9px;
  color: var(--color-primary, #263b63);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-top: 32px;
  padding: 25px;
  border-radius: 12px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
}
.information-footer h2 { margin: 0; font-size: 18px; }
.information-footer p {
  margin: 7px 0 0;
  color: var(--color-text-muted, #737985);
  font-size: 13px;
}
.information-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.information-button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid var(--color-primary, #263b63);
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-button.primary { background: var(--color-primary, #263b63); color: #fff; }
.information-button.secondary { background: transparent; color: var(--color-primary, #263b63); }
@media (max-width: 650px) {
  .information-container { width: min(100% - 28px, 1040px); }
  .information-card { grid-template-columns: 30px minmax(0, 1fr); padding: 19px 16px; gap: 10px; }
  .faq-item summary { grid-template-columns: 27px minmax(0, 1fr) 18px; padding: 16px; gap: 8px; }
  .faq-answer { padding: 0 16px 18px 51px; }
  .information-footer { align-items: flex-start; flex-direction: column; padding: 20px; }
}
</style>
