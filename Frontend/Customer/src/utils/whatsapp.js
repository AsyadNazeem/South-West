const WHATSAPP_NUMBER = '94773029614'
const DEFAULT_MESSAGE = 'Hi South West! I would like to make an inquiry.'

export function getWhatsAppLink(message = DEFAULT_MESSAGE) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
