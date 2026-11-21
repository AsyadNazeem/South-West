// Preserve public validation messages. Network and server failures use page-specific recovery text.
export function accountFeedback(error, fallback) {
  const {status,data} = error?.response || {}
  const message = data?.message
  if (status >= 400 && status < 500 && typeof message === 'string' &&
      message.length <= 240 && !/[<>\n\r]/.test(message)) return message
  return fallback
}
