<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

interface Card {
  id: number
  emoji: string
  flipped: boolean
  matched: boolean
}

const symbols = ['🎰', '🎲', '🃏', '💎', '👑', '💰', '🔥', '⭐', '🎯', '🍀']

const cards = ref<Card[]>([])
const flippedCards = ref<number[]>([])
const moves = ref(0)
const matches = ref(0)
const isLocked = ref(false)
const betAmount = ref(100)
const gameStarted = ref(false)
const lastResult = ref<{ type: string; message: string } | null>(null)
const comboCount = ref(0)
const gridSize = ref(16) // 4x4

const totalPairs = computed(() => gridSize.value / 2)
const isWin = computed(() => matches.value === totalPairs.value)

const initGame = () => {
  const pairCount = gridSize.value / 2
  const selectedSymbols = symbols.slice(0, pairCount)
  const deck = [...selectedSymbols, ...selectedSymbols].map((emoji, id) => ({
    id,
    emoji,
    flipped: false,
    matched: false
  }))
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  cards.value = deck
  flippedCards.value = []
  moves.value = 0
  matches.value = 0
  comboCount.value = 0
  lastResult.value = null
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  gameStarted.value = true
  initGame()
}

const flipCard = (index: number) => {
  if (isLocked.value) return
  const card = cards.value[index]
  if (!card || card.flipped || card.matched) return
  if (flippedCards.value.length >= 2) return

  card.flipped = true
  flippedCards.value.push(index)

  if (flippedCards.value.length === 2) {
    moves.value++
    isLocked.value = true
    const [first, second] = flippedCards.value
    const card1 = cards.value[first!]
    const card2 = cards.value[second!]

    if (card1 && card2 && card1.emoji === card2.emoji) {
      // Match!
      comboCount.value++
      setTimeout(() => {
        card1.matched = true
        card2.matched = true
        matches.value++
        flippedCards.value = []
        isLocked.value = false

        if (isWin.value) {
          // Calculate reward
          const baseReward = betAmount.value * 2
          const moveBonus = Math.max(0, (totalPairs.value * 2 - moves.value)) * 10
          const comboBonus = comboCount.value * 20
          const totalReward = baseReward + moveBonus + comboBonus
          emit('score-gain', totalReward)
          lastResult.value = { type: 'success', message: `恭喜通关！获得 ${totalReward} 击分！（基础${baseReward} + 步数奖励${moveBonus} + 连击${comboBonus}）` }
        }
      }, 300)
    } else {
      // No match
      comboCount.value = 0
      setTimeout(() => {
        if (card1) card1.flipped = false
        if (card2) card2.flipped = false
        flippedCards.value = []
        isLocked.value = false
      }, 800)
    }
  }
}

const setGridSize = (size: number) => {
  gridSize.value = size
  if (gameStarted.value) {
    initGame()
  }
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="memory-game">
    <h1 class="game-title">🃏 翻牌记忆</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div v-if="gameStarted" class="stats">
        <span>步数: {{ moves }}</span>
        <span>配对: {{ matches }}/{{ totalPairs }}</span>
        <span v-if="comboCount > 1" class="combo">🔥 {{ comboCount }}x</span>
      </div>
    </div>

    <div v-if="!gameStarted" class="start-panel">
      <div class="size-selector">
        <h3>选择难度</h3>
        <div class="size-buttons">
          <button :class="{ active: gridSize === 16 }" @click="setGridSize(16)">4x4 简单</button>
          <button :class="{ active: gridSize === 20 }" @click="setGridSize(20)">5x4 普通</button>
          <button :class="{ active: gridSize === 24 }" @click="setGridSize(24)">6x4 困难</button>
        </div>
      </div>
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
      <div class="card-grid" :class="`grid-${gridSize}`">
        <div
          v-for="(card, index) in cards"
          :key="card.id"
          class="card"
          :class="{ flipped: card.flipped, matched: card.matched }"
          @click="flipCard(index)"
        >
          <div class="card-inner">
            <div class="card-front">?</div>
            <div class="card-back">{{ card.emoji }}</div>
          </div>
        </div>
      </div>

      <button class="restart-btn" @click="startGame">🔄 再来一局</button>
    </div>

    <div v-if="lastResult" class="result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 翻开两张牌，如果相同则配对成功</li>
        <li>• 配对所有牌即可通关</li>
        <li>• 步数越少奖励越高</li>
        <li>• 连续配对获得连击奖励</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.memory-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 600px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; justify-content: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.stats { display: flex; gap: 1rem; color: #ccc; }
.combo { color: #ff6b6b; font-weight: bold; animation: pulse 0.5s infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

.start-panel { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.size-selector h3 { color: #ffd700; margin-bottom: 0.5rem; text-align: center; }
.size-buttons { display: flex; gap: 0.5rem; justify-content: center; }
.size-buttons button {
  padding: 0.6rem 1rem; background: rgba(255,255,255,0.1);
  border: 2px solid transparent; border-radius: 8px; color: #fff; cursor: pointer;
}
.size-buttons button.active { border-color: #ffd700; background: rgba(255,215,0,0.2); }

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
  padding: 1rem; background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer;
}
.start-btn:hover:not(:disabled) { transform: scale(1.02); }
.start-btn:disabled { background: #444; cursor: not-allowed; }

.game-area { width: 100%; }

.card-grid {
  display: grid; gap: 8px; justify-content: center; margin-bottom: 1rem;
}
.grid-16 { grid-template-columns: repeat(4, 70px); }
.grid-20 { grid-template-columns: repeat(5, 65px); }
.grid-24 { grid-template-columns: repeat(6, 60px); }

.card {
  width: 100%; aspect-ratio: 1; perspective: 1000px; cursor: pointer;
}
.card-inner {
  width: 100%; height: 100%; position: relative;
  transition: transform 0.5s; transform-style: preserve-3d;
}
.card.flipped .card-inner { transform: rotateY(180deg); }
.card.matched .card-inner { transform: rotateY(180deg); }

.card-front, .card-back {
  position: absolute; width: 100%; height: 100%;
  backface-visibility: hidden; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.card-front {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; font-size: 1.5rem; font-weight: bold;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.card-back {
  background: linear-gradient(135deg, #fff, #e0e0e0);
  transform: rotateY(180deg); font-size: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.card.matched .card-back {
  background: linear-gradient(135deg, #4CAF50, #81c784);
  animation: matchPop 0.3s;
}
@keyframes matchPop { 0% { transform: rotateY(180deg) scale(1); } 50% { transform: rotateY(180deg) scale(1.1); } 100% { transform: rotateY(180deg) scale(1); } }

.restart-btn {
  width: 100%; padding: 0.8rem; background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white; border: none; border-radius: 10px; font-size: 1rem;
  font-weight: bold; cursor: pointer;
}
.restart-btn:hover { transform: scale(1.02); }

.result {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.rules { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }
</style>
