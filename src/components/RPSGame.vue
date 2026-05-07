<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type Choice = 'rock' | 'paper' | 'scissors' | null

const playerChoice = ref<Choice>(null)
const cpuChoice = ref<Choice>(null)
const result = ref<'win' | 'lose' | 'draw' | null>(null)
const betAmount = ref(100)
const isAnimating = ref(false)
const lastResult = ref<{ type: string; message: string } | null>(null)
const stats = ref({ wins: 0, losses: 0, draws: 0, streak: 0, maxStreak: 0 })

const choices: { type: Choice; emoji: string; label: string }[] = [
  { type: 'rock', emoji: '✊', label: '石头' },
  { type: 'paper', emoji: '✋', label: '布' },
  { type: 'scissors', emoji: '✌️', label: '剪刀' }
]

const getEmoji = (choice: Choice): string => {
  if (choice === 'rock') return '✊'
  if (choice === 'paper') return '✋'
  if (choice === 'scissors') return '✌️'
  return '❓'
}

const getResult = (player: Choice, cpu: Choice): 'win' | 'lose' | 'draw' => {
  if (player === cpu) return 'draw'
  if (
    (player === 'rock' && cpu === 'scissors') ||
    (player === 'paper' && cpu === 'rock') ||
    (player === 'scissors' && cpu === 'paper')
  ) return 'win'
  return 'lose'
}

const streakMultiplier = computed(() => {
  if (stats.value.streak >= 5) return 2.0
  if (stats.value.streak >= 3) return 1.5
  if (stats.value.streak >= 2) return 1.2
  return 1
})

const play = (choice: Choice) => {
  if (isAnimating.value) return
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }

  playerChoice.value = choice
  cpuChoice.value = null
  result.value = null
  isAnimating.value = true

  // Deduct bet
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)

  // Animate CPU choice
  let animCount = 0
  const animInterval = setInterval(() => {
    const randomChoice = choices[Math.floor(Math.random() * 3)]
    cpuChoice.value = randomChoice?.type ?? null
    animCount++
    if (animCount >= 10) {
      clearInterval(animInterval)

      // Final CPU choice
      const finalChoice = choices[Math.floor(Math.random() * 3)]
      cpuChoice.value = finalChoice?.type ?? null
      result.value = getResult(choice, cpuChoice.value)
      isAnimating.value = false

      // Update stats
      if (result.value === 'win') {
        stats.value.wins++
        stats.value.streak++
        if (stats.value.streak > stats.value.maxStreak) stats.value.maxStreak = stats.value.streak
        const multiplier = streakMultiplier.value
        const reward = Math.floor(betAmount.value * multiplier)
        emit('score-gain', reward)
        lastResult.value = {
          type: 'success',
          message: `你赢了！${getEmoji(choice)} 胜 ${getEmoji(cpuChoice.value)}！获得 ${reward} 击分${multiplier > 1 ? ` (${multiplier}x连击加成)` : ''}`
        }
      } else if (result.value === 'lose') {
        stats.value.losses++
        stats.value.streak = 0
        lastResult.value = {
          type: 'fail',
          message: `你输了！${getEmoji(choice)} 败给 ${getEmoji(cpuChoice.value)}`
        }
      } else {
        stats.value.draws++
        // Draw: return bet
        emit('score-gain', betAmount.value)
        lastResult.value = {
          type: 'info',
          message: `平局！${getEmoji(choice)} = ${getEmoji(cpuChoice.value)}，返还投入`
        }
      }
    }
  }, 80)
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="rps-game">
    <h1 class="game-title">✊ 石头剪刀布</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div class="stats-display">
        <span class="win">胜: {{ stats.wins }}</span>
        <span class="lose">负: {{ stats.losses }}</span>
        <span class="draw">平: {{ stats.draws }}</span>
      </div>
      <div v-if="stats.streak > 0" class="streak">🔥 {{ stats.streak }}连胜</div>
    </div>

    <div class="battle-area">
      <div class="fighter">
        <span class="fighter-label">你</span>
        <div class="fighter-choice" :class="{ animate: isAnimating }">
          {{ playerChoice ? getEmoji(playerChoice) : '❓' }}
        </div>
      </div>
      <div class="vs">VS</div>
      <div class="fighter">
        <span class="fighter-label">电脑</span>
        <div class="fighter-choice" :class="{ animate: isAnimating }">
          {{ cpuChoice ? getEmoji(cpuChoice) : '❓' }}
        </div>
      </div>
    </div>

    <div v-if="result && !isAnimating" class="result-banner" :class="result">
      {{ result === 'win' ? '🎉 你赢了！' : result === 'lose' ? '😢 你输了！' : '🤝 平局！' }}
    </div>

    <div class="bet-section">
      <div class="bet-area">
        <label>下注:</label>
        <div class="bet-controls">
          <button @click="betAmount = Math.max(10, betAmount - 10)" class="adj-btn">-</button>
          <span class="bet-amount">{{ betAmount }}</span>
          <button @click="betAmount = Math.min(gamblingScore, betAmount + 10)" class="adj-btn">+</button>
        </div>
        <div class="quick-bets">
          <button @click="quickBet(50)" class="quick-btn">50</button>
          <button @click="quickBet(100)" class="quick-btn">100</button>
          <button @click="quickBet(500)" class="quick-btn">500</button>
        </div>
      </div>
      <div v-if="streakMultiplier > 1" class="multiplier-display">
        连击加成: {{ streakMultiplier }}x
      </div>
    </div>

    <div class="choice-buttons">
      <button
        v-for="(choice, index) in choices"
        :key="index"
        class="choice-btn"
        :disabled="isAnimating || gamblingScore < betAmount"
        @click="play(choice.type)"
      >
        <span class="choice-emoji">{{ choice.emoji }}</span>
        <span class="choice-label">{{ choice.label }}</span>
      </button>
    </div>

    <div v-if="lastResult" class="result-msg" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• ✊ 石头胜 ✌️ 剪刀</li>
        <li>• ✌️ 剪刀胜 ✋ 布</li>
        <li>• ✋ 布胜 ✊ 石头</li>
        <li>• 胜利获得1.5倍奖励</li>
        <li>• 连胜可获得更高加成</li>
        <li>• 平局返还投入</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.rps-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1.5rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.stats-display { display: flex; gap: 0.8rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.stats-display .win { color: #28a745; }
.stats-display .lose { color: #dc3545; }
.stats-display .draw { color: #ffc107; }
.streak { color: #ff6b6b; font-weight: bold; padding: 0.5rem 1rem; background: rgba(255,107,107,0.2); border-radius: 10px; }

.battle-area {
  display: flex; align-items: center; gap: 2rem;
  padding: 2rem; background: rgba(0,0,0,0.3); border-radius: 20px;
  width: 100%; justify-content: center;
}
.fighter { text-align: center; }
.fighter-label { display: block; color: #888; margin-bottom: 0.5rem; }
.fighter-choice {
  width: 100px; height: 100px; background: linear-gradient(145deg, #2d2d44, #1e1e2e);
  border-radius: 20px; display: flex; align-items: center; justify-content: center;
  font-size: 3.5rem; border: 3px solid rgba(255,215,0,0.3);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}
.fighter-choice.animate { animation: shake 0.1s infinite; }
@keyframes shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }

.vs { font-size: 2rem; font-weight: bold; color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.5); }

.result-banner {
  padding: 1rem 2rem; border-radius: 12px; font-size: 1.5rem;
  font-weight: bold; text-align: center;
}
.result-banner.win { background: linear-gradient(135deg, rgba(40,167,69,0.3), rgba(40,167,69,0.1)); color: #28a745; }
.result-banner.lose { background: linear-gradient(135deg, rgba(220,53,69,0.3), rgba(220,53,69,0.1)); color: #dc3545; }
.result-banner.draw { background: linear-gradient(135deg, rgba(255,193,7,0.3), rgba(255,193,7,0.1)); color: #ffc107; }

.bet-section { width: 100%; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
.bet-area { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.bet-area label { color: #ccc; }
.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; }
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }
.quick-bets { display: flex; gap: 0.5rem; }
.quick-btn { padding: 0.3rem 0.6rem; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.quick-btn:hover { background: #555; }
.multiplier-display { color: #ffd700; font-size: 1rem; font-weight: bold; }

.choice-buttons { display: flex; gap: 1rem; justify-content: center; }
.choice-btn {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 1.5rem; background: linear-gradient(145deg, #3a3a5c, #2d2d44);
  border: 3px solid transparent; border-radius: 16px; color: #fff;
  cursor: pointer; transition: all 0.2s; min-width: 100px;
}
.choice-btn:hover:not(:disabled) { border-color: #ffd700; transform: translateY(-5px); box-shadow: 0 8px 25px rgba(255,215,0,0.3); }
.choice-btn:active:not(:disabled) { transform: translateY(0); }
.choice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.choice-emoji { font-size: 3rem; }
.choice-label { font-size: 1rem; }

.result-msg {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result-msg.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result-msg.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result-msg.info { background: rgba(59,130,246,0.2); color: #3b82f6; border: 1px solid rgba(59,130,246,0.3); }
.result-msg.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.rules { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }
</style>
