// Temporary customer payment availability.
// Set a method to true only when it is ready for use.
// Keep this configuration aligned with the backend.

export const PAYMENT_AVAILABILITY = Object.freeze({
  cash: true,
  card: true,
  koko: false,
  mintpay: false
})

export function isPaymentMethodEnabled(method) {
  const normalized = method === 'cod' ? 'cash' : method

  return Object.prototype.hasOwnProperty.call(
    PAYMENT_AVAILABILITY,
    normalized
  ) && PAYMENT_AVAILABILITY[normalized] === true
}
