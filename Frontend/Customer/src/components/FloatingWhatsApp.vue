<template>
  <a
    :href="whatsappLink"
    class="floating-whatsapp"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp"
  >
    <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 32 32"
  width="32"
  height="32"
  fill="currentColor"
  aria-hidden="true"
>
  <path
    d="M16.02 3C8.86 3 3.04 8.81 3.04 15.97c0 2.29.6 4.52 1.75 6.5L3 29l6.7-1.76a13 13 0 0 0 6.31 1.61h.01C23.18 28.85 29 23.04 29 15.88 29 8.72 23.18 3 16.02 3zm0 23.67a10.8 10.8 0 0 1-5.51-1.51l-.4-.24-3.98 1.05 1.06-3.88-.26-.42a10.75 10.75 0 1 1 9.09 5zm5.91-8.06c-.32-.16-1.87-.92-2.16-1.02-.29-.11-.5-.16-.71.16-.21.32-.81 1.02-.99 1.23-.18.21-.36.24-.68.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.57-1.87-1.75-2.19-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.37 4.75.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.87-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.61-.37z"
  />
</svg>
  </a>
</template>

<script setup>
import { getWhatsAppLink } from '@/utils/whatsapp'

const whatsappLink = getWhatsAppLink()
</script>

<style scoped>
.floating-whatsapp {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  background-color: #25D366;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.floating-whatsapp:hover {
  color: #ffffff;
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

@media (max-width: 768px) {
  .floating-whatsapp {
    right: 16px;
    bottom: 20px;
    width: 52px;
    height: 52px;
    font-size: 29px;
  }
}
</style>
