<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

const score = ref(props.gamblingScore)

watch(() => props.gamblingScore, (newScore) => {
  score.value = newScore
})

watch(score, (newScore) => {
  emit('update:gamblingScore', newScore)
  localStorage.setItem('gambling_score', newScore.toString())
})

const addScore = (amount: number) => {
  emit('score-gain', amount)
}

// 转盘配置
const segments = [
  { label: 'x0', multiplier: 0, color: '#e74c3c', probability: 0.15 },
  { label: 'x0.5', multiplier: 0.5, color: '#e67e22', probability: 0.2 },
  { label: 'x1', multiplier: 1, color: '#f1c40f', probability: 0.25 },
  { label: 'x2', multiplier: 2, color: '#2ecc71', probability: 0.2 },
  { label: 'x3', multiplier: 3, color: '#3498db', probability: 0.1 },
  { label: 'x5', multiplier: 5, color: '#9b59b6', probability: 0.07 },
  { label: 'x10', multiplier: 10, color: '#1abc9c', probability: 0.025 },
  { label: 'x50', multiplier: 50, color: '#e91e63', probability: 0.005 }
]

const betAmount = ref(100)
const isSpinning = ref(false)
const currentAngle = ref(0)
const lastResult = ref<{ multiplier: number; amount: number; message: string } | null>(null)
const spinHistory = ref<Array<{ multiplier: number; amount: number; timestamp: Date }>>([])
const showFireworks = ref(false)
const autoSpin = ref(false)
const autoSpinCount = ref(0)
const autoSpinInterval = ref(1000)
let autoSpinTimer: number | null = null

const canSpin = computed(() => {
  return !isSpinning.value && score.value >= betAmount.value
})

const setBetAmount = (amount: number) => {
  betAmount.value = Math.max(10, Math.min(amount, score.value))
}

// 生成 SVG 扇形路径
const getSegmentPath = (index: number, total: number, radius: number) => {
  const angle = (2 * Math.PI) / total
  const startAngle = index * angle - Math.PI / 2
  const endAngle = startAngle + angle
  
  const x1 = radius + radius * Math.cos(startAngle)
  const y1 = radius + radius * Math.sin(startAngle)
  const x2 = radius + radius * Math.cos(endAngle)
  const y2 = radius + radius * Math.sin(endAngle)
  
  const largeArc = angle > Math.PI ? 1 : 0
  
  return `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

// 获取文字位置
const getTextPosition = (index: number, total: number, radius: number) => {
  const angle = (2 * Math.PI) / total
  const midAngle = index * angle - Math.PI / 2 + angle / 2
  const textRadius = radius * 0.65
  
  return {
    x: radius + textRadius * Math.cos(midAngle),
    y: radius + textRadius * Math.sin(midAngle),
    rotate: (midAngle * 180 / Math.PI) + 90
  }
}

const spin = () => {
  if (!canSpin.value) return
  
  isSpinning.value = true
  score.value -= betAmount.value
  lastResult.value = null
  showFireworks.value = false
  
  // 根据概率选择结果
  const rand = Math.random()
  let cumulative = 0
  let selectedIndex = 0
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment) {
      cumulative += segment.probability
      if (rand <= cumulative) {
        selectedIndex = i
        break
      }
    }
  }
  
  const selectedSegment = segments[selectedIndex] ?? segments[0]
  if (!selectedSegment) return
  
  // 计算目标角度（让选中的segment停在指针位置 - 顶部）
  const segmentAngle = 360 / segments.length
  const targetAngle = 360 - (selectedIndex * segmentAngle + segmentAngle / 2)
  
  // 添加随机偏移
  const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.6
  
  // 旋转动画
  const totalRotation = currentAngle.value + 360 * 6 + targetAngle + randomOffset
  const duration = 4000
  const startTime = Date.now()
  const startAngle = currentAngle.value
  
  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // 缓动函数 - 先快后慢
    const eased = 1 - Math.pow(1 - progress, 4)
    
    currentAngle.value = startAngle + (totalRotation - startAngle) * eased
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 动画结束
      currentAngle.value = totalRotation % 360
      isSpinning.value = false
      
      // 计算奖励
      const winAmount = Math.floor(betAmount.value * selectedSegment.multiplier)
      
      if (winAmount > 0) {
        addScore(winAmount)
        showFireworks.value = true
        setTimeout(() => {
          showFireworks.value = false
        }, 2000)
      }
      
      lastResult.value = {
        multiplier: selectedSegment.multiplier,
        amount: winAmount,
        message: selectedSegment.multiplier === 0 
          ? '💀 血本无归！' 
          : selectedSegment.multiplier >= 10 
            ? `🎉 大奖！${selectedSegment.label}倍！+${winAmount}击分`
            : `${selectedSegment.label}倍！+${winAmount}击分`
      }
      
      // 记录历史
      spinHistory.value.unshift({
        multiplier: selectedSegment.multiplier,
        amount: winAmount,
        timestamp: new Date()
      })
      
      if (spinHistory.value.length > 20) {
        spinHistory.value.pop()
      }
      
      // 自动旋转
      if (autoSpin.value && autoSpinCount.value > 0) {
        autoSpinCount.value--
        if (autoSpinCount.value > 0 && score.value >= betAmount.value) {
          autoSpinTimer = window.setTimeout(spin, autoSpinInterval.value)
        } else {
          autoSpin.value = false
        }
      }
    }
  }
  
  requestAnimationFrame(animate)
}

const startAutoSpin = () => {
  if (!canSpin.value) return
  autoSpin.value = true
  autoSpinCount.value = 10
  spin()
}

const stopAutoSpin = () => {
  autoSpin.value = false
  if (autoSpinTimer) {
    clearTimeout(autoSpinTimer)
    autoSpinTimer = null
  }
}

onUnmounted(() => {
  stopAutoSpin()
})

// 倍数颜色映射
const multiplierColors: Record<number, string> = {
  0: '#e74c3c',
  0.5: '#e67e22',
  1: '#f1c40f',
  2: '#2ecc71',
  3: '#3498db',
  5: '#9b59b6',
  10: '#1abc9c',
  50: '#e91e63'
}

// 统计数据
const stats = computed(() => {
  if (spinHistory.value.length === 0) return null
  
  const totalSpins = spinHistory.value.length
  const totalBet = totalSpins * betAmount.value
  const totalWin = spinHistory.value.reduce((sum, s) => sum + s.amount, 0)
  const winRate = spinHistory.value.filter(s => s.multiplier > 1).length / totalSpins
  const maxWin = Math.max(...spinHistory.value.map(s => s.amount))
  const avgMultiplier = spinHistory.value.reduce((sum, s) => sum + s.multiplier, 0) / totalSpins
  
  return {
    totalSpins,
    totalBet,
    totalWin,
    profit: totalWin - totalBet,
    winRate: (winRate * 100).toFixed(1),
    maxWin,
    avgMultiplier: avgMultiplier.toFixed(2)
  }
})

const wheelSize = 300
const wheelRadius = wheelSize / 2
</script>

<template>
  <div class="lucky-wheel">
    <h1>🎡 幸运转盘</h1>
    <p class="subtitle">投入击分，转动命运之轮！</p>
    
    <div class="wheel-container">
      <div class="wheel-pointer">▼</div>
      <div class="wheel-wrapper" :style="{ transform: `rotate(${currentAngle}deg)` }">
        <svg :width="wheelSize" :height="wheelSize" :viewBox="`0 0 ${wheelSize} ${wheelSize}`">
          <!-- 扇形 -->
          <path
            v-for="(segment, index) in segments"
            :key="index"
            :d="getSegmentPath(index, segments.length, wheelRadius)"
            :fill="segment.color"
            stroke="#fff"
            stroke-width="2"
          />
          <!-- 文字 -->
          <text
            v-for="(segment, index) in segments"
            :key="'text-' + index"
            :x="getTextPosition(index, segments.length, wheelRadius).x"
            :y="getTextPosition(index, segments.length, wheelRadius).y"
            :transform="`rotate(${getTextPosition(index, segments.length, wheelRadius).rotate}, ${getTextPosition(index, segments.length, wheelRadius).x}, ${getTextPosition(index, segments.length, wheelRadius).y})`"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="white"
            font-size="14"
            font-weight="bold"
          >
            {{ segment.label }}
          </text>
        </svg>
      </div>
      <div class="wheel-center">🎯</div>
    </div>
    
    <div class="bet-controls">
      <h3>当前赌注: {{ betAmount }} 击分</h3>
      <div class="bet-buttons">
        <button @click="setBetAmount(50)" :class="{ active: betAmount === 50 }">50</button>
        <button @click="setBetAmount(100)" :class="{ active: betAmount === 100 }">100</button>
        <button @click="setBetAmount(500)" :class="{ active: betAmount === 500 }">500</button>
        <button @click="setBetAmount(1000)" :class="{ active: betAmount === 1000 }">1000</button>
        <button @click="setBetAmount(Math.floor(score / 2))">一半</button>
        <button @click="setBetAmount(score)">全押</button>
      </div>
    </div>
    
    <div class="action-buttons">
      <button 
        class="spin-btn" 
        @click="spin" 
        :disabled="!canSpin"
      >
        {{ isSpinning ? '旋转中...' : '旋转' }}
      </button>
      <button 
        class="auto-btn" 
        @click="autoSpin ? stopAutoSpin() : startAutoSpin()"
        :disabled="!canSpin && !autoSpin"
      >
        {{ autoSpin ? `停止 (${autoSpinCount})` : '自动x10' }}
      </button>
    </div>
    
    <div v-if="lastResult" class="result" :class="{ win: lastResult.amount > 0, lose: lastResult.amount === 0 }">
      {{ lastResult.message }}
    </div>
    
    <div class="info-panel">
      <div class="info-item">
        <span class="label">当前击分</span>
        <span class="value">{{ score.toLocaleString() }}</span>
      </div>
      <div class="info-item">
        <span class="label">倍数表</span>
        <div class="multiplier-table">
          <span v-for="segment in segments" :key="segment.label" class="multiplier-item" :style="{ color: segment.color }">
            {{ segment.label }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-if="stats" class="stats">
      <h3>📊 统计数据</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总旋转</span>
          <span class="stat-value">{{ stats.totalSpins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总投入</span>
          <span class="stat-value">{{ stats.totalBet.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总赢得</span>
          <span class="stat-value">{{ stats.totalWin.toLocaleString() }}</span>
        </div>
        <div class="stat-item" :class="{ profit: stats.profit >= 0, loss: stats.profit < 0 }">
          <span class="stat-label">盈亏</span>
          <span class="stat-value">{{ stats.profit >= 0 ? '+' : '' }}{{ stats.profit.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">胜率</span>
          <span class="stat-value">{{ stats.winRate }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最大单次</span>
          <span class="stat-value">{{ stats.maxWin.toLocaleString() }}</span>
        </div>
      </div>
    </div>
    
    <div v-if="spinHistory.length > 0" class="history">
      <h3>📜 历史记录</h3>
      <div class="history-list">
        <div 
          v-for="(item, index) in spinHistory.slice(0, 10)" 
          :key="index"
          class="history-item"
          :class="{ win: item.amount > 0, lose: item.amount === 0 }"
        >
          <span class="multiplier" :style="{ color: multiplierColors[item.multiplier] }">
            {{ item.multiplier }}x
          </span>
          <span class="amount">{{ item.amount > 0 ? '+' : '' }}{{ item.amount }}</span>
        </div>
      </div>
    </div>
    
    <div v-if="showFireworks" class="fireworks">
      <div v-for="i in 20" :key="i" class="firework" :style="{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 0.5}s`
      }"></div>
    </div>
  </div>
</template>

<style scoped>
.lucky-wheel {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

h1 {
  color: #f1c40f;
  margin-bottom: 10px;
}

.subtitle {
  color: #bdc3c7;
  margin-bottom: 30px;
}

.wheel-container {
  position: relative;
  width: 300px;
  height: 300px;
  margin: 0 auto 30px;
}

.wheel-pointer {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 40px;
  color: #e74c3c;
  z-index: 10;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
  text-shadow: 0 0 10px rgba(231, 76, 60, 0.8);
}

.wheel-wrapper {
  width: 100%;
  height: 100%;
  transition: transform 0.1s linear;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.4));
}

.wheel-wrapper svg {
  display: block;
}

.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #f1c40f, #e67e22);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  border: 3px solid white;
  z-index: 5;
}

.bet-controls {
  margin-bottom: 20px;
}

.bet-controls h3 {
  color: #ecf0f1;
  margin-bottom: 10px;
}

.bet-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.bet-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  background: #34495e;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.bet-buttons button:hover {
  background: #2c3e50;
}

.bet-buttons button.active {
  background: #3498db;
}

.action-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;
}

.spin-btn {
  padding: 15px 40px;
  font-size: 20px;
  font-weight: bold;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.spin-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
}

.spin-btn:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}

.auto-btn {
  padding: 15px 30px;
  font-size: 16px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.auto-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.auto-btn:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}

.result {
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
}

.result.win {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 2px solid #2ecc71;
}

.result.lose {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 2px solid #e74c3c;
}

.info-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.info-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 10px;
}

.info-item .label {
  display: block;
  color: #bdc3c7;
  font-size: 14px;
  margin-bottom: 5px;
}

.info-item .value {
  display: block;
  color: #ecf0f1;
  font-size: 24px;
  font-weight: bold;
}

.multiplier-table {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.multiplier-item {
  font-weight: bold;
  font-size: 16px;
}

.stats {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
}

.stats h3 {
  color: #f1c40f;
  margin-bottom: 15px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
}

.stat-item {
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
}

.stat-label {
  display: block;
  color: #bdc3c7;
  font-size: 12px;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  color: #ecf0f1;
  font-size: 18px;
  font-weight: bold;
}

.stat-item.profit .stat-value {
  color: #2ecc71;
}

.stat-item.loss .stat-value {
  color: #e74c3c;
}

.history {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
}

.history h3 {
  color: #f1c40f;
  margin-bottom: 15px;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.3);
}

.history-item.win {
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.history-item.lose {
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.multiplier {
  font-weight: bold;
  font-size: 16px;
}

.amount {
  color: #ecf0f1;
  font-size: 14px;
}

.fireworks {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.firework {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f1c40f;
  animation: firework 1s ease-out forwards;
}

@keyframes firework {
  0% {
    transform: translateY(100vh) scale(0);
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(-20vh) scale(1);
    opacity: 0;
  }
}

@media (max-width: 768px) {
  .wheel-container {
    width: 250px;
    height: 250px;
  }
  
  .bet-buttons {
    gap: 5px;
  }
  
  .bet-buttons button {
    padding: 6px 12px;
    font-size: 14px;
  }
  
  .spin-btn {
    padding: 12px 30px;
    font-size: 18px;
  }
}
</style>
