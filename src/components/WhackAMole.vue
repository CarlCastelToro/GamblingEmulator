<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

interface Mole {
  id: number
  active: boolean
  type: 'normal' | 'golden' | 'bomb'
  timer: number | null
}

const GRID_SIZE = 9
const GAME_DURATION = 30
const moles = ref<Mole[]>([])
const score = ref(0)
const timeLeft = ref(GAME_DURATION)
const gameStarted = ref(false)
const gameOver = ref(false)
const betAmount = ref(100)
const lastResult = ref<{ type: string; message: string } | null>(null)
const comboCount = ref(0)
const maxCombo = ref(0)
const totalHits = ref(0)
const totalMisses = ref(0)

let gameTimer: number | null = null
let moleSpawner: number | null = null

const initMoles = () => {
  moles.value = Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    active: false,
    type: 'normal',
    timer: null
  }))
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  gameStarted.value = true
  gameOver.value = false
  score.value = 0
  timeLeft.value = GAME_DURATION
  comboCount.value = 0
  maxCombo.value = 0
  totalHits.value = 0
  totalMisses.value = 0
  lastResult.value = null
  initMoles()

  // Start game timer
  gameTimer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      endGame()
    }
  }, 1000)

  // Start spawning moles
  spawnMole()
}

const spawnMole = () => {
  if (gameOver.value) return

  const inactiveMoles = moles.value.filter(m => !m.active)
  if (inactiveMoles.length === 0) return

  const randomMole = inactiveMoles[Math.floor(Math.random() * inactiveMoles.length)]
  if (!randomMole) return

  // Determine mole type
  const rand = Math.random()
  let type: Mole['type'] = 'normal'
  if (rand < 0.1) type = 'golden'
  else if (rand < 0.2) type = 'bomb'

  randomMole.active = true
  randomMole.type = type

  // Auto hide after random time
  const hideTime = 800 + Math.random() * 1200
  randomMole.timer = window.setTimeout(() => {
    randomMole.active = false
    randomMole.timer = null
    if (type !== 'bomb') {
      totalMisses.value++
      comboCount.value = 0
    }
  }, hideTime)

  // Schedule next spawn
  const nextSpawn = Math.max(300, 1000 - (GAME_DURATION - timeLeft.value) * 20)
  moleSpawner = window.setTimeout(spawnMole, nextSpawn + Math.random() * 400)
}

const whackMole = (mole: Mole) => {
  if (!mole.active || gameOver.value) return

  if (mole.timer) {
    clearTimeout(mole.timer)
    mole.timer = null
  }
  mole.active = false

  if (mole.type === 'bomb') {
    // Bomb: lose points
    score.value = Math.max(0, score.value - 50)
    comboCount.value = 0
    totalMisses.value++
  } else {
    // Normal or golden
    const basePoints = mole.type === 'golden' ? 30 : 10
    comboCount.value++
    if (comboCount.value > maxCombo.value) maxCombo.value = comboCount.value
    const comboBonus = Math.min(comboCount.value, 10) * 2
    const points = basePoints + comboBonus
    score.value += points
    totalHits.value++
  }
}

const endGame = () => {
  gameOver.value = true
  gameStarted.value = false
  if (gameTimer) { clearInterval(gameTimer); gameTimer = null }
  if (moleSpawner) { clearTimeout(moleSpawner); moleSpawner = null }

  // Deactivate all moles
  moles.value.forEach(m => {
    if (m.timer) clearTimeout(m.timer)
    m.active = false
  })

  // Calculate reward
  const baseReward = Math.floor(score.value * (betAmount.value / 100))
  const comboBonus = maxCombo.value * 20
  const accuracy = totalHits.value + totalMisses.value > 0
    ? Math.floor((totalHits.value / (totalHits.value + totalMisses.value)) * 100)
    : 0
  const accuracyBonus = accuracy > 80 ? betAmount.value : accuracy > 60 ? Math.floor(betAmount.value * 0.5) : 0
  const totalReward = baseReward + comboBonus + accuracyBonus

  if (totalReward > 0) {
    emit('score-gain', totalReward)
    lastResult.value = {
      type: 'success',
      message: `游戏结束！获得 ${totalReward} 击分！（得分${baseReward} + 连击${comboBonus} + 准确率${accuracyBonus}）`
    }
  } else {
    lastResult.value = { type: 'fail', message: `游戏结束！未获得奖励` }
  }
}

const getMoleEmoji = (type: Mole['type']): string => {
  switch (type) {
    case 'golden': return '👑'
    case 'bomb': return '💣'
    default: return '🐹'
  }
}

onMounted(() => {
  initMoles()
})

onUnmounted(() => {
  if (gameTimer) clearInterval(gameTimer)
  if (moleSpawner) clearTimeout(moleSpawner)
  moles.value.forEach(m => { if (m.timer) clearTimeout(m.timer) })
})
</script>

<template>
  <div class="whack-game">
    <h1 class="game-title">🔨 打地鼠</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">得分:</span>
        <span class="value">{{ score }}</span>
      </div>
      <div v-if="gameStarted" class="timer" :class="{ urgent: timeLeft <= 5 }">
        ⏱️ {{ timeLeft }}s
      </div>
      <div v-if="comboCount > 1" class="combo">🔥 {{ comboCount }}x</div>
    </div>

    <div v-if="!gameStarted" class="start-panel">
      <div class="bet-area">
        <label>下注:</label>
        <div class="bet-controls">
          <button @click="betAmount = Math.max(10, betAmount - 10)" class="adj-btn">-</button>
          <span class="bet-amount">{{ betAmount }}</span>
          <button @click="betAmount = Math.min(gamblingScore, betAmount + 10)" class="adj-btn">+</button>
        </div>
      </div>
      <button class="start-btn" @click="startGame" :disabled="gamblingScore < betAmount">🎮 开始游戏</button>
    </div>

    <div v-else class="game-area">
      <div class="mole-grid">
        <div
          v-for="mole in moles"
          :key="mole.id"
          class="mole-hole"
          :class="{ active: mole.active, [mole.type]: mole.active }"
          @click="whackMole(mole)"
        >
          <div class="mole" :class="{ pop: mole.active }">
            {{ mole.active ? getMoleEmoji(mole.type) : '' }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="lastResult" class="result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="legend">
      <span>🐹 普通 +10</span>
      <span>👑 金色 +30</span>
      <span>💣 炸弹 -50</span>
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 点击冒出的地鼠得分</li>
        <li>• 连击获得额外奖励</li>
        <li>• 金色地鼠分值更高</li>
        <li>• 炸弹会扣分，不要点！</li>
        <li>• 30秒内尽可能多得分</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.whack-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1.5rem; align-items: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.timer { font-size: 1.3rem; font-weight: bold; color: #4CAF50; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.timer.urgent { color: #ff6b6b; animation: pulse 0.5s infinite; }
.combo { color: #ff6b6b; font-weight: bold; font-size: 1.2rem; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

.start-panel { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.bet-area { display: flex; align-items: center; gap: 1rem; justify-content: center; }
.bet-area label { color: #ccc; }
.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; }
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }

.start-btn {
  padding: 1rem; background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer;
}
.start-btn:hover:not(:disabled) { transform: scale(1.02); }
.start-btn:disabled { background: #444; cursor: not-allowed; }

.game-area { width: 100%; }

.mole-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; max-width: 360px; margin: 0 auto;
}

.mole-hole {
  aspect-ratio: 1; background: linear-gradient(145deg, #3d2b1f, #2a1f15);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.1s; position: relative;
  box-shadow: inset 0 4px 8px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
  border: 3px solid #5d4037;
}
.mole-hole:active { transform: scale(0.95); }
.mole-hole.active.golden { box-shadow: inset 0 4px 8px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.5); }
.mole-hole.active.bomb { box-shadow: inset 0 4px 8px rgba(0,0,0,0.5), 0 0 20px rgba(255,0,0,0.5); }

.mole {
  font-size: 2.5rem; opacity: 0; transform: translateY(20px);
  transition: all 0.15s; user-select: none;
}
.mole.pop { opacity: 1; transform: translateY(0); }

.result {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.legend {
  display: flex; gap: 1rem; justify-content: center;
  padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px;
}
.legend span { font-size: 0.9rem; color: #ccc; }

.rules { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }
</style>
