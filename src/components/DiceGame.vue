<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type BetType = 'big' | 'small' | 'triple' | 'odd' | 'even' | number

const dice = ref([1, 1, 1])
const isRolling = ref(false)
const betAmount = ref(100)
const selectedBet = ref<BetType | null>(null)
const lastResult = ref<{ type: string; message: string } | null>(null)
const rollHistory = ref<Array<{ result: number[]; win: boolean; amount: number; bet: string }>>([])

const diceDots: Record<number, string[][]> = {
  1: [['', '', ''], ['', '●', ''], ['', '', '']],
  2: [['●', '', ''], ['', '', ''], ['', '', '●']],
  3: [['●', '', ''], ['', '●', ''], ['', '', '●']],
  4: [['●', '', '●'], ['', '', ''], ['●', '', '●']],
  5: [['●', '', '●'], ['', '●', ''], ['●', '', '●']],
  6: [['●', '', '●'], ['●', '', '●'], ['●', '', '●']]
}

const total = computed(() => dice.value.reduce((a, b) => a + b, 0))
const isTriple = computed(() => dice.value[0] === dice.value[1] && dice.value[1] === dice.value[2])

const bets: Array<{ type: BetType; label: string; odds: string; desc: string }> = [
  { type: 'big', label: '大 (11-17)', odds: '1:1', desc: '总和11-17' },
  { type: 'small', label: '小 (4-10)', odds: '1:1', desc: '总和4-10' },
  { type: 'odd', label: '单', odds: '1:1', desc: '总和为奇数' },
  { type: 'even', label: '双', odds: '1:1', desc: '总和为偶数' },
  { type: 4, label: '4', odds: '1:50', desc: '总和为4' },
  { type: 5, label: '5', odds: '1:20', desc: '总和为5' },
  { type: 6, label: '6', odds: '1:15', desc: '总和为6' },
  { type: 7, label: '7', odds: '1:12', desc: '总和为7' },
  { type: 8, label: '8', odds: '1:8', desc: '总和为8' },
  { type: 9, label: '9', odds: '1:6', desc: '总和为9' },
  { type: 10, label: '10', odds: '1:6', desc: '总和为10' },
  { type: 11, label: '11', odds: '1:6', desc: '总和为11' },
  { type: 12, label: '12', odds: '1:6', desc: '总和为12' },
  { type: 13, label: '13', odds: '1:8', desc: '总和为13' },
  { type: 14, label: '14', odds: '1:12', desc: '总和为14' },
  { type: 15, label: '15', odds: '1:15', desc: '总和为15' },
  { type: 16, label: '16', odds: '1:20', desc: '总和为16' },
  { type: 17, label: '17', odds: '1:50', desc: '总和为17' }
]

const getMultiplier = (bet: BetType): number => {
  if (bet === 'big' || bet === 'small' || bet === 'odd' || bet === 'even') return 2
  if (typeof bet === 'number') {
    const multMap: Record<number, number> = { 4: 50, 5: 20, 6: 15, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 15, 16: 20, 17: 50 }
    return multMap[bet] || 6
  }
  return 2
}

const checkWin = (bet: BetType, diceTotal: number, triple: boolean): boolean => {
  if (triple) return bet === 'triple'
  if (bet === 'big') return diceTotal >= 11 && diceTotal <= 17
  if (bet === 'small') return diceTotal >= 4 && diceTotal <= 10
  if (bet === 'odd') return diceTotal % 2 === 1
  if (bet === 'even') return diceTotal % 2 === 0
  if (typeof bet === 'number') return diceTotal === bet
  return false
}

const roll = () => {
  if (!selectedBet.value || isRolling.value) return
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }

  const currentBet = selectedBet.value
  const currentBetAmount = betAmount.value
  isRolling.value = true
  emit('update:gamblingScore', props.gamblingScore - currentBetAmount)

  let rollCount = 0
  const maxRolls = 15
  const interval = setInterval(() => {
    dice.value = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
    rollCount++
    if (rollCount >= maxRolls) {
      clearInterval(interval)
      isRolling.value = false

      const finalDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
      dice.value = finalDice
      const diceTotal = finalDice.reduce((a, b) => a + b, 0)
      const triple = finalDice[0] === finalDice[1] && finalDice[1] === finalDice[2]

      const win = checkWin(currentBet, diceTotal, triple)
      const multiplier = getMultiplier(currentBet)
      const payout = win ? currentBetAmount * multiplier : 0

      if (win) {
        emit('score-gain', payout)
        lastResult.value = { type: 'success', message: `中奖！骰子 ${finalDice.join(' + ')} = ${diceTotal}，获得 ${payout} 击分！` }
      } else {
        lastResult.value = { type: 'fail', message: `未中奖，骰子 ${finalDice.join(' + ')} = ${diceTotal}` }
      }

      rollHistory.value.unshift({
        result: finalDice,
        win,
        amount: win ? payout - currentBetAmount : -currentBetAmount,
        bet: `${currentBet}`
      })
      if (rollHistory.value.length > 20) rollHistory.value.pop()
    }
  }, 80)
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="dice-game">
    <h1 class="game-title">🎲 掷骰子</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
    </div>

    <div class="dice-area">
      <div class="dice-container">
        <div v-for="(die, i) in dice" :key="i" class="die" :class="{ rolling: isRolling }">
          <div v-for="(row, ri) in diceDots[die]" :key="ri" class="die-row">
            <span v-for="(dot, di) in row" :key="di" class="die-dot" :class="{ filled: dot }">{{ dot }}</span>
          </div>
        </div>
      </div>
      <div class="total-display">总和: {{ total }}</div>
      <div v-if="isTriple" class="triple-badge">🎯 豹子！</div>
    </div>

    <div class="bet-section">
      <div class="bet-amount-area">
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
    </div>

    <div class="bets-grid">
      <div class="bet-category">
        <h3>大小单双</h3>
        <div class="bet-buttons">
          <button
            v-for="bet in bets.slice(0, 4)"
            :key="bet.type"
            class="bet-btn"
            :class="{ selected: selectedBet === bet.type }"
            @click="selectedBet = bet.type"
          >
            <span class="bet-label">{{ bet.label }}</span>
            <span class="bet-odds">{{ bet.odds }}</span>
          </button>
        </div>
      </div>
      <div class="bet-category">
        <h3>点数</h3>
        <div class="bet-buttons number-bets">
          <button
            v-for="bet in bets.slice(4)"
            :key="bet.type"
            class="bet-btn number"
            :class="{ selected: selectedBet === bet.type }"
            @click="selectedBet = bet.type"
          >
            <span class="bet-label">{{ bet.label }}</span>
            <span class="bet-odds">{{ bet.odds }}</span>
          </button>
        </div>
      </div>
    </div>

    <button
      class="roll-btn"
      :disabled="!selectedBet || isRolling || gamblingScore < betAmount"
      @click="roll"
    >
      {{ isRolling ? '🎲 掷骰中...' : '🎲 掷骰子' }}
    </button>

    <div v-if="lastResult" class="result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 三颗骰子，总和4-10为小，11-17为大</li>
        <li>• 大小单双赔率 1:1</li>
        <li>• 猜中具体点数可获更高赔率</li>
        <li>• 三颗相同为豹子，大小单双通杀</li>
      </ul>
    </div>

    <div v-if="rollHistory.length > 0" class="history">
      <h3>📋 记录</h3>
      <div class="history-list">
        <div v-for="(item, i) in rollHistory" :key="i" class="history-item" :class="{ win: item.win }">
          <span>{{ item.result.join('+') }}={{ item.result.reduce((a,b)=>a+b,0) }}</span>
          <span :class="item.win ? 'win-text' : 'lose-text'">{{ item.win ? '+' : '' }}{{ item.amount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dice-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  gap: 1rem;
}

.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; }

.score-display {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px;
}
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }

.dice-area { text-align: center; }

.dice-container { display: flex; gap: 1rem; justify-content: center; margin-bottom: 1rem; }

.die {
  width: 70px; height: 70px;
  background: linear-gradient(145deg, #fff, #e0e0e0);
  border-radius: 12px;
  display: flex; flex-direction: column; justify-content: space-evenly;
  padding: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5);
  transition: transform 0.1s;
}
.die.rolling { animation: shake 0.1s infinite; }

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.die-row { display: flex; justify-content: space-evenly; }

.die-dot { font-size: 10px; color: transparent; width: 14px; text-align: center; }
.die-dot.filled { color: #e53935; }

.total-display { font-size: 1.5rem; color: #ffd700; font-weight: bold; }
.triple-badge { color: #ff6b6b; font-size: 1.2rem; animation: pulse 0.5s infinite; }

@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

.bet-section { width: 100%; }

.bet-amount-area {
  display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap;
}
.bet-amount-area label { color: #ccc; }

.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn {
  width: 30px; height: 30px; border: none; border-radius: 6px;
  background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; font-size: 1rem;
}
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }

.quick-bets { display: flex; gap: 0.5rem; }
.quick-btn {
  padding: 0.3rem 0.6rem; background: #444; color: #fff;
  border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
}
.quick-btn:hover { background: #555; }

.bets-grid { width: 100%; }
.bet-category { margin-bottom: 1rem; }
.bet-category h3 { color: #ffd700; font-size: 1rem; margin-bottom: 0.5rem; text-align: center; }

.bet-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }

.bet-btn {
  padding: 0.6rem 1rem; background: linear-gradient(145deg, #3a3a5c, #2d2d44);
  border: 2px solid transparent; border-radius: 10px; color: #fff;
  cursor: pointer; transition: all 0.2s; text-align: center; min-width: 70px;
}
.bet-btn:hover { transform: translateY(-2px); border-color: rgba(255,215,0,0.3); }
.bet-btn.selected { border-color: #ffd700; box-shadow: 0 0 15px rgba(255,215,0,0.5); background: linear-gradient(145deg, #4a4a6c, #3d3d54); }

.bet-label { display: block; font-size: 0.9rem; font-weight: bold; }
.bet-odds { display: block; font-size: 0.7rem; color: #aaa; }

.number-bets .bet-btn { min-width: 50px; padding: 0.5rem 0.8rem; }

.roll-btn {
  width: 100%; padding: 1rem; background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer; transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(238,90,36,0.4);
}
.roll-btn:hover:not(:disabled) { transform: scale(1.02); }
.roll-btn:disabled { background: #444; cursor: not-allowed; }

.result {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.rules {
  width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px;
}
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }

.history { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.history h3 { color: #ffd700; margin-bottom: 0.5rem; }
.history-list { max-height: 200px; overflow-y: auto; }
.history-item {
  display: flex; justify-content: space-between; padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 0.85rem;
}
.win-text { color: #28a745; }
.lose-text { color: #dc3545; }
</style>
