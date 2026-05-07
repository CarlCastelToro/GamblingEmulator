<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

const playerDice = ref([1, 1])
const dealerDice = ref([1, 1])
const isRolling = ref(false)
const betAmount = ref(100)
const lastResult = ref<{ type: string; message: string } | null>(null)
const stats = ref({ wins: 0, losses: 0, draws: 0 })
const result = ref<'win' | 'lose' | 'draw' | null>(null)

const playerTotal = computed(() => playerDice.value.reduce((a, b) => a + b, 0))
const dealerTotal = computed(() => dealerDice.value.reduce((a, b) => a + b, 0))

const diceDots: Record<number, string[][]> = {
  1: [['', '', ''], ['', '●', ''], ['', '', '']],
  2: [['●', '', ''], ['', '', ''], ['', '', '●']],
  3: [['●', '', ''], ['', '●', ''], ['', '', '●']],
  4: [['●', '', '●'], ['', '', ''], ['●', '', '●']],
  5: [['●', '', '●'], ['', '●', ''], ['●', '', '●']],
  6: [['●', '', '●'], ['●', '', '●'], ['●', '', '●']]
}

const roll = () => {
  if (isRolling.value) return
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }

  const currentBet = betAmount.value
  isRolling.value = true
  result.value = null
  lastResult.value = null

  emit('update:gamblingScore', props.gamblingScore - currentBet)

  // Animate
  let count = 0
  const interval = setInterval(() => {
    playerDice.value = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
    dealerDice.value = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
    count++
    if (count >= 15) {
      clearInterval(interval)

      // Final result
      const pDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
      const dDice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]
      playerDice.value = pDice
      dealerDice.value = dDice

      const pTotal = (pDice[0] || 1) + (pDice[1] || 1)
      const dTotal = (dDice[0] || 1) + (dDice[1] || 1)

      if (pTotal > dTotal) {
        result.value = 'win'
        stats.value.wins++
        const reward = currentBet * 2
        emit('score-gain', reward)
        lastResult.value = { type: 'success', message: `你赢了！${pTotal} vs ${dTotal}，获得 ${reward} 击分！` }
      } else if (pTotal < dTotal) {
        result.value = 'lose'
        stats.value.losses++
        lastResult.value = { type: 'fail', message: `你输了！${pTotal} vs ${dTotal}` }
      } else {
        // Same total - compare individual dice
        const pMax = Math.max(pDice[0] || 1, pDice[1] || 1)
        const dMax = Math.max(dDice[0] || 1, dDice[1] || 1)
        if (pMax > dMax) {
          result.value = 'win'
          stats.value.wins++
          const reward = currentBet * 2
          emit('score-gain', reward)
          lastResult.value = { type: 'success', message: `平局后比大！你赢了！获得 ${reward} 击分！` }
        } else if (pMax < dMax) {
          result.value = 'lose'
          stats.value.losses++
          lastResult.value = { type: 'fail', message: `平局后比大！你输了！` }
        } else {
          result.value = 'draw'
          stats.value.draws++
          emit('score-gain', currentBet) // Return bet
          lastResult.value = { type: 'info', message: `完全平局！返还投入` }
        }
      }

      isRolling.value = false
    }
  }, 80)
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="dice-battle">
    <h1 class="game-title">⚔️ 骰子大战</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div class="stats">
        <span class="win">胜: {{ stats.wins }}</span>
        <span class="lose">负: {{ stats.losses }}</span>
        <span class="draw">平: {{ stats.draws }}</span>
      </div>
    </div>

    <div class="battle-area">
      <div class="fighter">
        <span class="fighter-label">👤 你</span>
        <div class="dice-pair">
          <div v-for="(die, i) in playerDice" :key="i" class="die" :class="{ rolling: isRolling, win: result === 'win', lose: result === 'lose' }">
            <div v-for="(row, ri) in diceDots[die]" :key="ri" class="die-row">
              <span v-for="(dot, di) in row" :key="di" class="die-dot" :class="{ filled: dot }">{{ dot }}</span>
            </div>
          </div>
        </div>
        <div class="total" :class="{ win: result === 'win', lose: result === 'lose' }">{{ playerTotal }}</div>
      </div>

      <div class="vs" :class="{ win: result === 'win', lose: result === 'lose' }">
        {{ result === 'win' ? '🎉' : result === 'lose' ? '😢' : '⚔️' }}
      </div>

      <div class="fighter">
        <span class="fighter-label">🎰 庄家</span>
        <div class="dice-pair">
          <div v-for="(die, i) in dealerDice" :key="i" class="die" :class="{ rolling: isRolling, win: result === 'lose', lose: result === 'win' }">
            <div v-for="(row, ri) in diceDots[die]" :key="ri" class="die-row">
              <span v-for="(dot, di) in row" :key="di" class="die-dot" :class="{ filled: dot }">{{ dot }}</span>
            </div>
          </div>
        </div>
        <div class="total" :class="{ win: result === 'lose', lose: result === 'win' }">{{ dealerTotal }}</div>
      </div>
    </div>

    <div v-if="result && !isRolling" class="result-banner" :class="result">
      {{ result === 'win' ? '🎉 你赢了！' : result === 'lose' ? '😢 你输了！' : '🤝 平局！' }}
    </div>

    <div class="controls">
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

      <button
        class="roll-btn"
        :disabled="isRolling || gamblingScore < betAmount"
        @click="roll"
      >
        {{ isRolling ? '🎲 掷骰中...' : '🎲 开始对决' }}
      </button>
    </div>

    <div v-if="lastResult" class="result-msg" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 你和庄家各掷2个骰子</li>
        <li>• 点数大的一方获胜</li>
        <li>• 点数相同比最大单骰</li>
        <li>• 完全平局返还投入</li>
        <li>• 胜利获得2倍奖励</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dice-battle {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.stats { display: flex; gap: 0.8rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.stats .win { color: #28a745; }
.stats .lose { color: #dc3545; }
.stats .draw { color: #ffc107; }

.battle-area {
  display: flex; align-items: center; gap: 2rem;
  padding: 2rem; background: rgba(0,0,0,0.3); border-radius: 20px;
  width: 100%; justify-content: center;
}
.fighter { text-align: center; }
.fighter-label { display: block; color: #888; margin-bottom: 0.8rem; font-size: 1.1rem; }
.dice-pair { display: flex; gap: 0.8rem; justify-content: center; }

.die {
  width: 60px; height: 60px;
  background: linear-gradient(145deg, #fff, #e0e0e0);
  border-radius: 10px;
  display: flex; flex-direction: column; justify-content: space-evenly;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5);
  transition: all 0.3s;
  border: 3px solid transparent;
}
.die.rolling { animation: shake 0.08s infinite; }
.die.win { border-color: #28a745; box-shadow: 0 0 15px rgba(40,167,69,0.5); }
.die.lose { border-color: #dc3545; box-shadow: 0 0 15px rgba(220,53,69,0.5); }

@keyframes shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }

.die-row { display: flex; justify-content: space-evenly; }
.die-dot { font-size: 9px; color: transparent; width: 12px; text-align: center; }
.die-dot.filled { color: #e53935; }

.total {
  margin-top: 0.5rem; font-size: 1.5rem; font-weight: bold; color: #ffd700;
}
.total.win { color: #28a745; }
.total.lose { color: #dc3545; }

.vs { font-size: 2.5rem; }
.vs.win { animation: bounce 0.5s; }
.vs.lose { animation: shake 0.3s; }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

.result-banner {
  padding: 1rem 2rem; border-radius: 12px; font-size: 1.5rem;
  font-weight: bold; text-align: center;
}
.result-banner.win { background: linear-gradient(135deg, rgba(40,167,69,0.3), rgba(40,167,69,0.1)); color: #28a745; }
.result-banner.lose { background: linear-gradient(135deg, rgba(220,53,69,0.3), rgba(220,53,69,0.1)); color: #dc3545; }
.result-banner.draw { background: linear-gradient(135deg, rgba(255,193,7,0.3), rgba(255,193,7,0.1)); color: #ffc107; }

.controls { width: 100%; display: flex; flex-direction: column; gap: 1rem; }
.bet-area { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.bet-area label { color: #ccc; }
.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; }
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }
.quick-bets { display: flex; gap: 0.5rem; }
.quick-btn { padding: 0.3rem 0.6rem; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.quick-btn:hover { background: #555; }

.roll-btn {
  width: 100%; padding: 1rem; background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer; transition: all 0.3s;
}
.roll-btn:hover:not(:disabled) { transform: scale(1.02); }
.roll-btn:disabled { background: #444; cursor: not-allowed; }

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
