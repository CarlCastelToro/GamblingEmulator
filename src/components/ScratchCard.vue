<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

interface Cell {
  id: number
  emoji: string
  value: number
  scratched: boolean
  isWin: boolean
}

const GRID_SIZE = 9
const cells = ref<Cell[]>([])
const betAmount = ref(100)
const gameStarted = ref(false)
const gameOver = ref(false)
const scratchedCount = ref(0)
const totalWin = ref(0)
const lastResult = ref<{ type: string; message: string } | null>(null)

const prizeTable = [
  { emoji: '💎', value: 100, weight: 2 },
  { emoji: '👑', value: 50, weight: 5 },
  { emoji: '💰', value: 30, weight: 10 },
  { emoji: '🎰', value: 20, weight: 15 },
  { emoji: '⭐', value: 10, weight: 20 },
  { emoji: '🍀', value: 5, weight: 25 },
  { emoji: '🎲', value: 0, weight: 23 }
]

const getRandomPrize = () => {
  const totalWeight = prizeTable.reduce((a, b) => a + b.weight, 0)
  let rand = Math.random() * totalWeight
  for (const prize of prizeTable) {
    rand -= prize.weight
    if (rand <= 0) return prize
  }
  return prizeTable[prizeTable.length - 1]!
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)

  cells.value = Array.from({ length: GRID_SIZE }, (_, i) => {
    const prize = getRandomPrize()
    return {
      id: i,
      emoji: prize.emoji,
      value: prize.value,
      scratched: false,
      isWin: prize.value > 0
    }
  })

  gameStarted.value = true
  gameOver.value = false
  scratchedCount.value = 0
  totalWin.value = 0
  lastResult.value = null
}

const scratch = (cell: Cell) => {
  if (!gameStarted.value || gameOver.value || cell.scratched) return

  cell.scratched = true
  scratchedCount.value++
  totalWin.value += cell.value

  // Check if 3 or more same emojis
  const scratchedCells = cells.value.filter(c => c.scratched)
  if (scratchedCells.length >= 3) {
    const emojiCounts: Record<string, number> = {}
    scratchedCells.forEach(c => {
      emojiCounts[c.emoji] = (emojiCounts[c.emoji] || 0) + 1
    })

    for (const [emoji, count] of Object.entries(emojiCounts)) {
      if (count >= 3) {
        const bonus = emoji === '💎' ? 500 : emoji === '👑' ? 200 : emoji === '💰' ? 100 : 50
        totalWin.value += bonus
        lastResult.value = { type: 'success', message: `${emoji} 三连！额外奖励 ${bonus} 击分！` }
      }
    }
  }

  // All scratched
  if (scratchedCount.value === GRID_SIZE) {
    endGame()
  }
}

const scratchAll = () => {
  cells.value.forEach(cell => {
    if (!cell.scratched) {
      cell.scratched = true
      scratchedCount.value++
      totalWin.value += cell.value
    }
  })
  endGame()
}

const endGame = () => {
  gameOver.value = true
  if (totalWin.value > 0) {
    const reward = Math.floor(totalWin.value * (betAmount.value / 50))
    emit('score-gain', reward)
    lastResult.value = { type: 'success', message: `恭喜！获得 ${reward} 击分！` }
  } else {
    lastResult.value = { type: 'fail', message: '很遗憾，未中奖！' }
  }
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="scratch-game">
    <h1 class="game-title">🎫 刮刮乐</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div v-if="gameStarted && !gameOver" class="progress">
        已刮: {{ scratchedCount }}/{{ GRID_SIZE }}
      </div>
      <div v-if="totalWin > 0" class="win-display">
        中奖: {{ totalWin }}
      </div>
    </div>

    <div v-if="!gameStarted" class="start-panel">
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
      <button class="start-btn" @click="startGame" :disabled="gamblingScore < betAmount">🎮 开始游戏</button>
    </div>

    <div v-else class="game-area">
      <div class="scratch-grid">
        <div
          v-for="cell in cells"
          :key="cell.id"
          class="scratch-cell"
          :class="{ scratched: cell.scratched, win: cell.scratched && cell.isWin }"
          @click="scratch(cell)"
        >
          <div class="cell-content">
            <span v-if="cell.scratched" class="emoji">{{ cell.emoji }}</span>
            <span v-else class="cover">?</span>
          </div>
          <div v-if="cell.scratched && cell.value > 0" class="cell-value">+{{ cell.value }}</div>
        </div>
      </div>

      <div class="game-actions">
        <button v-if="!gameOver" class="scratch-all-btn" @click="scratchAll">🔓 全部揭开</button>
        <button class="restart-btn" @click="startGame">🔄 再来一局</button>
      </div>
    </div>

    <div v-if="lastResult" class="result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="prize-table">
      <h3>🎁 奖品表</h3>
      <div class="prizes">
        <span>💎 100</span>
        <span>👑 50</span>
        <span>💰 30</span>
        <span>🎰 20</span>
        <span>⭐ 10</span>
        <span>🍀 5</span>
        <span>🎲 0</span>
      </div>
      <p class="hint">相同图案3连可获得额外奖励！</p>
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 点击格子揭开涂层</li>
        <li>• 揭开的图案有对应分值</li>
        <li>• 相同图案3连获得额外奖励</li>
        <li>• 可点击"全部揭开"快速结算</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.scratch-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.progress { color: #ccc; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.win-display { color: #28a745; font-weight: bold; padding: 0.5rem 1rem; background: rgba(40,167,69,0.2); border-radius: 10px; }

.start-panel { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.bet-area { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.bet-area label { color: #ccc; }
.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; }
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }
.quick-bets { display: flex; gap: 0.5rem; }
.quick-btn { padding: 0.3rem 0.6rem; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.quick-btn:hover { background: #555; }

.start-btn {
  padding: 1rem; background: linear-gradient(135deg, #ffd700, #ffb300);
  color: #1a1a2e; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer;
}
.start-btn:hover:not(:disabled) { transform: scale(1.02); }
.start-btn:disabled { background: #444; color: #888; cursor: not-allowed; }

.game-area { width: 100%; }

.scratch-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 10px; max-width: 300px; margin: 0 auto 1rem;
}

.scratch-cell {
  aspect-ratio: 1; background: linear-gradient(145deg, #c0c0c0, #a0a0a0);
  border-radius: 12px; cursor: pointer; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  transition: all 0.3s; border: 2px solid #888;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.scratch-cell:not(.scratched):hover { transform: scale(1.05); border-color: #ffd700; }
.scratch-cell:not(.scratched):active { transform: scale(0.95); }
.scratch-cell.scratched {
  background: linear-gradient(145deg, #2d2d44, #1e1e2e);
  border-color: #444; cursor: default;
}
.scratch-cell.win { border-color: #ffd700; box-shadow: 0 0 15px rgba(255,215,0,0.5); }

.cell-content { font-size: 2.5rem; }
.cover { color: #666; font-size: 2rem; font-weight: bold; }
.emoji { animation: pop 0.3s; }
@keyframes pop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }

.cell-value {
  position: absolute; bottom: 4px; font-size: 0.8rem;
  color: #ffd700; font-weight: bold;
}

.game-actions { display: flex; gap: 1rem; }
.scratch-all-btn, .restart-btn {
  flex: 1; padding: 0.8rem; border: none; border-radius: 10px;
  font-size: 1rem; font-weight: bold; cursor: pointer;
}
.scratch-all-btn { background: linear-gradient(135deg, #ffd700, #ffb300); color: #1a1a2e; }
.scratch-all-btn:hover { transform: scale(1.02); }
.restart-btn { background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; }
.restart-btn:hover { transform: scale(1.02); }

.result {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.prize-table { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; text-align: center; }
.prize-table h3 { color: #ffd700; margin-bottom: 0.5rem; }
.prizes { display: flex; flex-wrap: wrap; gap: 0.8rem; justify-content: center; }
.prizes span { padding: 0.3rem 0.6rem; background: rgba(255,255,255,0.1); border-radius: 6px; }
.hint { color: #888; font-size: 0.8rem; margin-top: 0.5rem; }

.rules { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }
</style>
