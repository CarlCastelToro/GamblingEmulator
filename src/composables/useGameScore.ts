import type { Ref } from 'vue'

export interface GameScoreProps {
  gamblingScore: number
}

export interface GameScoreEmits {
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}

export function useGameScore(
  props: GameScoreProps,
  emit: GameScoreEmits
) {
  const addScore = (amount: number) => {
    emit('score-gain', amount)
  }

  const deductScore = (amount: number) => {
    emit('update:gamblingScore', props.gamblingScore - amount)
  }

  const setScore = (value: number) => {
    emit('update:gamblingScore', value)
  }

  const hasEnough = (amount: number): boolean => {
    return props.gamblingScore >= amount
  }

  return { addScore, deductScore, setScore, hasEnough }
}
