import { onMounted, onUnmounted } from 'vue'

export interface KeyboardHandlers {
  [key: string]: (e: KeyboardEvent) => void
}

export function useKeyboard(handlers: KeyboardHandlers) {
  const handleKeydown = (e: KeyboardEvent) => {
    const handler = handlers[e.key] || handlers[e.code]
    if (handler) {
      e.preventDefault()
      handler(e)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
