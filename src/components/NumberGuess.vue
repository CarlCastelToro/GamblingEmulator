<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type Difficulty = 'easy' | 'medium' | 'hard'

const secretNumber = ref(0)
const guess = ref(50)
const attempts = ref(0)
const maxAttempts = ref(7)
const gameStarted = ref(false)
const gameOver = ref(false)
const won = ref(false)
const history = ref<Array<{ guess: number; result: 'high' | 'low' | 'correct' }>>([])
const betAmount = ref(100)
const lastResult = ref<{ type: string; message: string } | null>(null)
const difficulty = ref<Difficulty>('medium')

const difficultyConfig = {
  easy: { range: 50, attempts: 10, multiplier: 1.5 },
  medium: { range: 100, attempts: 7, multiplier: 2 },
  hard: { range: 200, attempts: 5, multiplier: 4 }
}

const config = computed(() => difficultyConfig[difficulty.value])
const hint = ref('')

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)

  secretNumber.value = Math.floor(Math.random() * config.value.range) + 1
  attempts.value = 0
  maxAttempts.value = config.value.attempts
  guess.value = Math.floor(config.value.range / 2)
  gameStarted.value = true
  gameOver.value = false
  won.value = false
  history.value = []
  lastResult.value = null
  hint.value = `猜一个 1-${config.value.range} 之间的数字`
}

const makeGuess = () => {
  if (gameOver.value) return
  if (guess.value < 1 || guess.value > config.value.range) {
    lastResult.value = { type: 'error', message: `请输入 1-${config.value.range} 之间的数字！` }
    return
  }

  attempts.value++
  let result: 'high' | 'low' | 'correct'

  if (guess.value === secretNumber.value) {
    result = 'correct'
    won.value = true
    gameOver.value = true
    const reward = Math.floor(betAmount.value * config.value.multiplier * (1 + (maxAttempts.value - attempts.value) * 0.2))
    emit('score-gain', reward)
    lastResult.value = { type: 'success', message: `猜对了！数字就是 ${secretNumber.value}！获得 ${reward} 击分！` }
  } else if (guess.value > secretNumber.value) {
    result = 'high'
    hint.value = `${guess.value} 太大了！`
  } else {
    result = 'low'
    hint.value = `${guess.value} 太小了！`
  }

  history.value.unshift({ guess: guess.value, result })

  if (!won.value && attempts.value >= maxAttempts.value) {
    gameOver.value = true
    lastResult.value = { type: 'fail', message: `机会用完了！正确答案是 ${secretNumber.value}` }
  }
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="guess-game">
    <h1 class="game-title">🔢 猜数字</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div v-if="gameStarted" class="attempts">
        剩余: {{ maxAttempts - attempts }}/{{ maxAttempts }}
      </div>
    </div>

    <div v-if="!gameStarted" class="start-panel">
      <div class="difficulty-selector">
        <h3>选择难度</h3>
        <div class="diff-buttons">
          <button :class="{ active: difficulty === 'easy' }" @click="difficulty = 'easy'">
            🌱 简单 (1-50)
          </button>
          <button :class="{ active: difficulty === 'medium' }" @click="difficulty = 'medium'">
            🔥 普通 (1-100)
          </button>
          <button :class="{ active: difficulty === 'hard' }" @click="difficulty = 'hard'">
            💀 困难 (1-200)
          </button>
        </div>
        <p class="diff-info">
          范围: 1-{{ config.range }} | 机会: {{ config.attempts }}次 | 赔率: {{ config.multiplier }}x
        </p>
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
      <div class="hint-display" :class="{ success: won }">{{ hint }}</div>

      <div class="guess-area">
        <input
          v-model.number="guess"
          type="number"
          :min="1"
          :max="config.range"
          :disabled="gameOver"
          class="guess-input"
          @keyup.enter="makeGuess"
        />
        <button class="guess-btn" :disabled="gameOver" @click="makeGuess">
          {{ gameOver ? (won ? '🎉 猜对了！' : '😢 游戏结束') : '🎯 猜！' }}
        </button>
      </div>

      <div v-if="history.length > 0" class="history">
        <h3>📋 猜测记录</h3>
        <div class="history-list">
          <div v-for="(item, i) in history" :key="i" class="history-item" :class="item.result">
            <span class="guess-num">{{ item.guess }}</span>
            <span class="guess-result">
              {{ item.result === 'high' ? '↑ 大了' : item.result === 'low' ? '↓ 小了' : '✓ 正确！' }}
            </span>
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
        <li>• 猜一个范围内的数字</li>
        <li>• 系统会提示大了或小了</li>
        <li>• 猜中即可获得奖励</li>
        <li>• 剩余机会越多奖励越高</li>
        <li>• 难度越高赔率越高</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.guess-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; align-items: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.attempts { color: #ccc; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }

.start-panel { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }
.difficulty-selector { text-align: center; }
.difficulty-selector h3 { color: #ffd700; margin-bottom: 0.8rem; }
.diff-buttons { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.diff-buttons button {
  padding: 0.6rem 1rem; background: rgba(255,255,255,0.1);
  border: 2px solid transparent; border-radius: 8px; color: #fff; cursor: pointer;
  transition: all 0.2s;
}
.diff-buttons button:hover { border-color: rgba(255,215,0,0.3); }
.diff-buttons button.active { border-color: #ffd700; background: rgba(255,215,0,0.2); }
.diff-info { color: #888; font-size: 0.85rem; margin-top: 0.5rem; }

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
  padding: 1rem; background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer;
}
.start-btn:hover:not(:disabled) { transform: scale(1.02); }
.start-btn:disabled { background: #444; cursor: not-allowed; }

.game-area { width: 100%; display: flex; flex-direction: column; gap: 1rem; }

.hint-display {
  padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 12px;
  text-align: center; font-size: 1.2rem; color: #ffd700;
}
.hint-display.success { background: rgba(40,167,69,0.2); color: #28a745; }

.guess-area { display: flex; gap: 0.5rem; }
.guess-input {
  flex: 1; padding: 1rem; background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.2);
  border-radius: 12px; color: #fff; font-size: 1.5rem; text-align: center;
  outline: none; transition: border-color 0.3s;
}
.guess-input:focus { border-color: #ffd700; }
.guess-input:disabled { opacity: 0.5; }

.guess-btn {
  padding: 1rem 1.5rem; background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white; border: none; border-radius: 12px; font-size: 1rem;
  font-weight: bold; cursor: pointer; white-space: nowrap;
}
.guess-btn:hover:not(:disabled) { transform: scale(1.02); }
.guess-btn:disabled { background: #444; cursor: not-allowed; }

.history { padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 12px; }
.history h3 { color: #ffd700; margin-bottom: 0.5rem; font-size: 1rem; }
.history-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.history-item {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.9rem;
}
.history-item.high { background: rgba(220,53,69,0.2); color: #dc3545; }
.history-item.low { background: rgba(59,130,246,0.2); color: #3b82f6; }
.history-item.correct { background: rgba(40,167,69,0.2); color: #28a745; }

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
