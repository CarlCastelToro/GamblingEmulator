<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
  getCount: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

const betAmount = ref(200)
const selectedBets = ref<string[]>([])
const isSpinning = ref(false)
const result = ref<{ color: string; number: number; win: boolean; payout: number } | null>(null)
const lastResult = ref<{ type: string; message: string } | null>(null)
const wheelRotation = ref(-90) // 初始旋转-90度让数字0在顶部
const transitionDuration = ref('2s')

// 计算最低投入：200 * 1.1^getCount
const minBet = computed(() => {
  return Math.floor(200 * Math.pow(1.1, props.getCount))
})

// 计算最大可用投入
const maxBet = computed(() => {
  return Math.min(props.gamblingScore, betAmount.value)
})

const colors = ['red', 'black', 'green']
// 标准美式轮盘数字排列（从0开始顺时针）
const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
// 标准轮盘赌颜色映射（对应numbers数组顺序）
const segmentColors = ['green', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black']

const getColor = (num: number): string => {
  if (num === 0) return 'green'
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
  return redNumbers.includes(num) ? 'red' : 'black'
}

const getSegmentColor = (index: number): string => {
  return segmentColors[index] || 'black'
}

const getSegmentPath = (index: number): string => {
  const total = numbers.length
  // SVG从0度(右侧)开始绘制，数字0在右侧位置
  const startAngle = (index * 360 / total) * (Math.PI / 180)
  const endAngle = ((index + 1) * 360 / total) * (Math.PI / 180)
  const cx = 100
  const cy = 100
  const outerRadius = 95
  const innerRadius = 35
  
  const x1 = cx + outerRadius * Math.cos(startAngle)
  const y1 = cy + outerRadius * Math.sin(startAngle)
  const x2 = cx + outerRadius * Math.cos(endAngle)
  const y2 = cy + outerRadius * Math.sin(endAngle)
  const x3 = cx + innerRadius * Math.cos(endAngle)
  const y3 = cy + innerRadius * Math.sin(endAngle)
  const x4 = cx + innerRadius * Math.cos(startAngle)
  const y4 = cy + innerRadius * Math.sin(startAngle)
  
  return `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`
}

const getTextX = (index: number): number => {
  const total = numbers.length
  const angle = (index * 360 / total + 360 / total / 2) * (Math.PI / 180)
  const cx = 100
  const innerRadius = 35
  const outerRadius = 95
  const textRadius = (innerRadius + outerRadius) / 2
  return cx + textRadius * Math.cos(angle)
}

const getTextY = (index: number): number => {
  const total = numbers.length
  const angle = (index * 360 / total + 360 / total / 2) * (Math.PI / 180)
  const cy = 100
  const innerRadius = 35
  const outerRadius = 95
  const textRadius = (innerRadius + outerRadius) / 2
  return cy + textRadius * Math.sin(angle)
}

const singleSelectBets = ['red', 'black', 'green', 'even', 'odd', 'low', 'high']

const toggleBet = (bet: string) => {
  if (singleSelectBets.includes(bet)) {
    selectedBets.value = [bet]
  } else {
    const index = selectedBets.value.indexOf(bet)
    if (index > -1) {
      selectedBets.value.splice(index, 1)
    } else {
      selectedBets.value = selectedBets.value.filter(b => !singleSelectBets.includes(b))
      selectedBets.value.push(bet)
    }
  }
}

const clearBets = () => {
  selectedBets.value = []
}

const spin = () => {
  if (selectedBets.value.length === 0) {
    lastResult.value = { type: 'error', message: '请选择投注类型！' }
    return
  }
  
  const hasSingleSelectBet = selectedBets.value.some(b => singleSelectBets.includes(b))
  
  // 每个选择都花费投入击分的量
  const totalCost = selectedBets.value.length * betAmount.value
  
  if (props.gamblingScore < totalCost) {
    lastResult.value = { type: 'error', message: `击分不足！选择 ${selectedBets.value.length} 个选项需要 ${totalCost} 击分` }
    return
  }

  // 立即开始旋转
  const degreesPerSegment = 360 / numbers.length
  const randomSpins = Math.floor(Math.random() * 11) + 15
  
  // 随机生成旋转角度（确保旋转至少15圈）
  const randomAngle = Math.random() * 360
  const spinRotation = wheelRotation.value + randomSpins * 360 + randomAngle
  
  transitionDuration.value = `${randomSpins * 0.25}s`
  wheelRotation.value = spinRotation
  
  isSpinning.value = true
  const currentBet = betAmount.value
  emit('update:gamblingScore', props.gamblingScore - totalCost)

  const spinDuration = randomSpins * 250 + 300
  setTimeout(() => {
    // 根据最终旋转角度计算指针指向的数字
    // 初始旋转-90度让数字0在顶部
    // 最终角度需要加上90度偏移来计算相对位置
    const degreesPerSegment = 360 / numbers.length
    let finalAngle = wheelRotation.value + 90 // 加上初始偏移
    // 将角度归一化到0-360度范围内
    finalAngle = ((finalAngle % 360) + 360) % 360
    // 计算指针指向的扇形索引（注意SVG Y轴向下，需要反向）
    // 顺时针旋转时，角度增加，数字数组是顺时针排列的
    // 所以索引 = (360 - finalAngle) / degreesPerSegment
    const winningIndex = Math.floor((360 - finalAngle) / degreesPerSegment) % numbers.length
    const winningNumber = numbers[winningIndex] ?? 0
    const winningColor = getColor(winningNumber)
    
    let win = false
    let payout = 0

    for (const bet of selectedBets.value) {
      if (bet === 'red' || bet === 'black') {
        if (bet === winningColor) {
          win = true
          payout += Math.floor(currentBet * 2)
        }
      } else if (bet === 'green') {
        if (winningColor === 'green') {
          win = true
          payout += Math.floor(currentBet * 14)
        }
      } else if (bet.startsWith('number-')) {
        const parts = bet.split('-')
        const betNumber = parseInt(parts[1] ?? '') ?? 0
        if (betNumber === winningNumber) {
          win = true
          payout += Math.floor(currentBet * 35)
        }
      } else if (bet === 'even') {
        if (winningNumber !== 0 && winningNumber % 2 === 0) {
          win = true
          payout += Math.floor(currentBet * 2)
        }
      } else if (bet === 'odd') {
        if (winningNumber % 2 === 1) {
          win = true
          payout += Math.floor(currentBet * 2)
        }
      } else if (bet === 'low') {
        if (winningNumber >= 1 && winningNumber <= 18) {
          win = true
          payout += Math.floor(currentBet * 2)
        }
      } else if (bet === 'high') {
        if (winningNumber >= 19 && winningNumber <= 36) {
          win = true
          payout += Math.floor(currentBet * 2)
        }
      }
    }

    if (win) {
      const netWin = payout - totalCost
      emit('update:gamblingScore', props.gamblingScore - totalCost + payout)
      lastResult.value = { type: 'success', message: `🎉 恭喜！获得 ${payout} 击分！(净赚 ${netWin})` }
    } else {
      lastResult.value = { type: 'fail', message: `😢 很遗憾，结果是 ${winningColor} ${winningNumber}` }
    }

    result.value = { color: winningColor, number: winningNumber, win, payout }
    isSpinning.value = false
  }, spinDuration)
}

const quickBet = (amount: number) => {
  const max = Math.min(props.gamblingScore, amount)
  betAmount.value = Math.max(minBet.value, max)
}
</script>

<template>
  <div class="roulette-game">
    <h1 class="game-title">🎰 轮盘赌</h1>
    
    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ gamblingScore }}</span>
      </div>
      <div class="min-bet">
        <span class="label">最低投入:</span>
        <span class="value">{{ minBet }}</span>
      </div>
    </div>

    <div class="bet-section">
      <div class="bet-input">
        <label>投入击分:</label>
        <input 
          type="number" 
          v-model.number="betAmount" 
          :min="minBet"
          :max="gamblingScore"
          class="bet-number"
        />
      </div>
      <div class="quick-bets">
        <button 
          v-for="amount in [minBet, 500, 1000]" 
          :key="amount"
          class="quick-btn"
          :disabled="gamblingScore < amount"
          @click="quickBet(amount)"
        >
          {{ amount }}
        </button>
      </div>
    </div>

    <div class="roulette-wheel">
      <div class="wheel" :class="{ spinning: isSpinning }" :style="{ transform: `rotate(${wheelRotation}deg)`, transitionDuration }">
        <svg viewBox="0 0 200 200" class="wheel-svg">
          <g v-for="(num, index) in numbers" :key="num">
            <path 
              :d="getSegmentPath(index)" 
              :class="['segment', getSegmentColor(index)]"
            />
            <text 
              :x="getTextX(index)" 
              :y="getTextY(index)" 
              :class="['segment-text', getSegmentColor(index)]"
              :transform="`rotate(${index * (360 / numbers.length) + (360 / numbers.length / 2)} ${getTextX(index)} ${getTextY(index)})`"
            >{{ num }}</text>
          </g>
        </svg>
      </div>
      <div class="pointer"></div>
    </div>

    <div v-if="lastResult" class="last-result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>
    
    <div class="bet-options">
      <button class="clear-btn" @click="clearBets" v-if="selectedBets.length > 0">
        清除选择
      </button>
      
      <div class="color-bets">
        <button 
          class="bet-btn red" 
          :class="{ selected: selectedBets.includes('red') }"
          @click="toggleBet('red')"
        >
          🔴 红 (1:1)
        </button>
        <button 
          class="bet-btn black" 
          :class="{ selected: selectedBets.includes('black') }"
          @click="toggleBet('black')"
        >
          ⚫ 黑 (1:1)
        </button>
        <button 
          class="bet-btn green" 
          :class="{ selected: selectedBets.includes('green') }"
          @click="toggleBet('green')"
        >
          🟢 绿 (1:14)
        </button>
      </div>
      
      <div class="other-bets">
        <button 
          class="bet-btn" 
          :class="{ selected: selectedBets.includes('even') }"
          @click="toggleBet('even')"
        >
          偶数 (1:1)
        </button>
        <button 
          class="bet-btn" 
          :class="{ selected: selectedBets.includes('odd') }"
          @click="toggleBet('odd')"
        >
          奇数 (1:1)
        </button>
        <button 
          class="bet-btn" 
          :class="{ selected: selectedBets.includes('low') }"
          @click="toggleBet('low')"
        >
          低 (1-18) (1:1)
        </button>
        <button 
          class="bet-btn" 
          :class="{ selected: selectedBets.includes('high') }"
          @click="toggleBet('high')"
        >
          高 (19-36) (1:1)
        </button>
      </div>

      <div class="number-bets">
        <button 
          v-for="num in 36" 
          :key="num"
          class="number-btn"
          :class="[getColor(num), { selected: selectedBets.includes(`number-${num}`) }]"
          @click="toggleBet(`number-${num}`)"
        >
          {{ num }}
        </button>
      </div>
    </div>

  <button 
      class="spin-btn" 
      :disabled="isSpinning || selectedBets.length === 0"
      @click="spin"
    >
      <span v-if="isSpinning">🔄 转动中...</span>
      <span v-else>🎰 开始轮盘</span>
    </button>


    <div class="rules">
      <h3>游戏规则</h3>
      <ul>
        <li>• 颜色/奇偶/高低：单选</li>
        <li>• 数字可多选</li>
        <li>· 每个选择收取一次投入击分</li>
        <li>• 红/黑/偶/奇/低/高：1:1 赔率</li>
        <li>• 绿色(0)：1:14 赔率</li>
        <li>• 单个数字：1:35 赔率</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.roulette-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.game-title {
  color: #ffd700;
  font-size: 2rem;
  margin-bottom: 1.5rem;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.game-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.score-display, .min-bet {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}

.score-display .label, .min-bet .label {
  color: #888;
  font-size: 0.9rem;
}

.score-display .value, .min-bet .value {
  color: #ffd700;
  font-size: 1.3rem;
  font-weight: bold;
}

.bet-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.bet-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bet-input label {
  color: #ccc;
  font-size: 0.95rem;
}

.bet-number {
  width: 120px;
  padding: 0.5rem;
  background: #333;
  color: #ffd700;
  border: 1px solid #444;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
  outline: none;
}

.bet-number:focus {
  border-color: #ffd700;
}

.quick-bets {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.4rem 0.8rem;
  background: #444;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover:not(:disabled) {
  background: #555;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.roulette-wheel {
  position: relative;
  width: 280px;
  height: 280px;
  margin-bottom: 1.5rem;
}

.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #1a1a2e;
  border: 4px solid #ffd700;
  position: relative;
  transition: transform 2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.wheel.spinning {
}

.wheel-svg {
  width: 100%;
  height: 100%;
}

.segment {
  stroke: #1a1a2e;
  stroke-width: 1;
}

.segment.red {
  fill: #dc3545;
}

.segment.black {
  fill: #2d2d2d;
}

.segment.green {
  fill: #28a745;
}

.segment-text {
  font-size: 8px;
  font-weight: bold;
  text-anchor: middle;
  alignment-baseline: middle;
}

.segment-text.red,
.segment-text.green {
  fill: white;
}

.segment-text.black {
  fill: white;
}

.pointer {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 25px solid #ffd700;
  z-index: 10;
}

.bet-options {
  width: 100%;
  margin-bottom: 1.5rem;
}

.clear-btn {
  padding: 0.4rem 1rem;
  background: linear-gradient(135deg, #666, #444);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.clear-btn:hover {
  background: linear-gradient(135deg, #888, #666);
}

.color-bets {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.bet-btn {
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #3a3a5c, #2d2d44);
  color: #fff;
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.bet-btn:hover {
  transform: scale(1.05);
}

.bet-btn.selected {
  border-color: #ffd700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.bet-btn.red.selected {
  background: linear-gradient(135deg, #dc3545, #c82333);
}

.bet-btn.black.selected {
  background: linear-gradient(135deg, #444, #222);
}

.bet-btn.green.selected {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.other-bets {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.number-bets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.number-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.number-btn.red {
  background: #dc3545;
  color: white;
}

.number-btn.black {
  background: #2d2d2d;
  color: white;
}

.number-btn.selected {
  transform: scale(1.2);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
}

.spin-btn {
  padding: 0.8rem 2rem;
  background: linear-gradient(135deg, #ffd700, #ffb300);
  color: #1a1a2e;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 1rem;
}

.spin-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.5);
}

.spin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.last-result {
  padding: 0.8rem 1.2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-align: center;
}

.last-result.success {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
  border: 1px solid rgba(40, 167, 69, 0.5);
}

.last-result.fail {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.5);
}

.last-result.error {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.5);
}

.rules {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  width: 100%;
  max-width: 400px;
}

.rules h3 {
  color: #ffd700;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.rules ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rules li {
  color: #aaa;
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}
</style>