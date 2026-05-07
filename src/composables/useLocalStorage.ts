import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, defaultValue: T, parser: (v: string) => T): Ref<T> {
  const stored = localStorage.getItem(key)
  const value = ref<T>(stored !== null ? parser(stored) : defaultValue) as Ref<T>
  
  watch(value, (newVal) => {
    localStorage.setItem(key, String(newVal))
  }, { deep: true })
  
  return value
}

export function useLocalStorageNumber(key: string, defaultValue: number): Ref<number> {
  return useLocalStorage(key, defaultValue, (v) => {
    const parsed = parseFloat(v)
    return isNaN(parsed) ? defaultValue : parsed
  })
}
