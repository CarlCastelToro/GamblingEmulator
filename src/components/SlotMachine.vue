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

// 获得击分（通过事件通知父组件处理贷款还款）
const addScore = (amount: number) => {
  emit('score-gain', amount)
}

const isRolling = ref(false)
const lastResult = ref<{ type: string; amount: number; message: string; special?: string } | null>(null)
const rollHistory = ref<Array<{ type: string; amount: number; message: string; timestamp: Date; special?: string }>>([])
const batchCount = ref(24)
const batchProgress = ref(0)
const isBatchRolling = ref(false)
const skipAnimation = ref(false)

// 概率加成
const savedBonus = localStorage.getItem('gambling_probability_bonus')
const probabilityBonus = ref(savedBonus ? parseFloat(savedBonus) : 0)

// 获取次数
const savedGetCount = localStorage.getItem('gambling_get_count')
const getCount = ref(savedGetCount ? parseInt(savedGetCount, 10) : 0)

// 连胜计数器
const winStreak = ref(0)
const maxWinStreak = ref(0)

watch(probabilityBonus, (newBonus) => {
  localStorage.setItem('gambling_probability_bonus', newBonus.toString())
})

watch(getCount, (newCount) => {
  localStorage.setItem('gambling_get_count', newCount.toString())
})

const symbols = ['🍒', '⭐', '💎', '7', '🔔', '💰', '🎰', '🎯', '🔥', '💀', '👑', '⚡']

const reel1 = ref({ current: 0, isSpinning: false, display: 0 })
let animationFrameId: number | null = null // 用于取消动画
const reel2 = ref({ current: 0, isSpinning: false, display: 0 })
const reel3 = ref({ current: 0, isSpinning: false, display: 0 })

// 特效状态
const showFireworks = ref(false)
const showLightning = ref(false)
const isCelebrating = ref(false)
const spinReelsFast = ref(false)

// 预计算烟花属性
const fireworks = ref(Array.from({ length: 20 }, () => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.5,
  duration: 1 + Math.random()
})))

const getScore = () => {
  addScore(10000)
  probabilityBonus.value = Math.max(-30, probabilityBonus.value - 1)
  getCount.value++
  lastResult.value = { type: 'success', amount: 10000, message: '获得10000击分！' }
}

const getRandomSymbol = () => {
  return Math.floor(Math.random() * symbols.length)
}

const checkSymbolCombination = (r1: number, r2: number, r3: number) => {
  if (r1 === r2 && r2 === r3) {
    const symbol = symbols[r1]
    switch (symbol) {
      case '👑': return { bonus: 500, message: '👑 皇家同花顺！' }
      case '💎': return { bonus: 200, message: '💎 钻石三连！' }
      case '⭐': return { bonus: 150, message: '⭐ 星光闪耀！' }
      case '7': return { bonus: 100, message: '777 幸运七！' }
      case '🔥': return { bonus: 80, message: '🔥 火焰连击！' }
      case '⚡': return { bonus: 120, message: '⚡ 闪电三连！' }
      case '💰': return { bonus: 60, message: '💰 金钱满贯！' }
      case '💀': return { bonus: 300, message: '💀 死神降临！' }
      default: return { bonus: 40, message: '🎰 三连中奖！' }
    }
  }
  if (r1 === r2 || r1 === r3 || r2 === r3) {
    return { bonus: 20, message: '✨ 配对成功！' }
  }
  return null
}

const rollOnceWithSymbols = (r1: number, r2: number, r3: number) => {
  const rand = Math.random() * 100
  let amount = 0
  let message = ''
  let special = ''

  const comboBonus = checkSymbolCombination(r1, r2, r3)
  const noWinProb = Math.max(3, Math.min(35, 18 - probabilityBonus.value))
  
  if (rand < noWinProb) {
    amount = 0
    message = '很遗憾，什么都没抽到'
    winStreak.value = 0
  } else {
    const winRand = (rand - noWinProb) / (100 - noWinProb) * 82
    const criticalHit = Math.random() < 0.1
    const critMultiplier = criticalHit ? 1.5 : 1
    
    if (winRand < 30) {
      amount = Math.floor(5 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '恭喜！获得' + amount + '击分'
    } else if (winRand < 52) {
      amount = Math.floor(10 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '恭喜！获得' + amount + '击分'
    } else if (winRand < 68) {
      amount = Math.floor(15 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '恭喜！获得' + amount + '击分'
    } else if (winRand < 80) {
      amount = Math.floor(25 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '恭喜！获得' + amount + '击分'
    } else if (winRand < 88) {
      amount = Math.floor(40 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '太棒了！获得' + amount + '击分'
    } else if (winRand < 94) {
      amount = Math.floor(70 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '超级大奖！获得' + amount + '击分'
    } else if (winRand < 98) {
      amount = Math.floor(150 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '🎉 巨奖！获得' + amount + '击分'
    } else {
      amount = Math.floor(500 * critMultiplier)
      message = criticalHit ? '💥 暴击！获得' + amount + '击分' : '🏆 传说大奖！获得' + amount + '击分'
    }

    if (comboBonus) {
      amount += comboBonus.bonus
      message = comboBonus.message + ' ' + message
      special = 'combo'
    }

    winStreak.value++
    if (winStreak.value > maxWinStreak.value) {
      maxWinStreak.value = winStreak.value
    }

    if (winStreak.value >= 3 && winStreak.value % 3 === 0) {
      const streakBonus = winStreak.value * 5
      amount += streakBonus
      message += ` 🔥 连胜${winStreak.value}次！额外+${streakBonus}击分`
      special = 'streak'
    }
  }

  if (amount >= 100) {
    triggerCelebration()
  } else if (amount >= 50) {
    showLightning.value = true
    setTimeout(() => showLightning.value = false, 500)
  }

  return { amount, message, special }
}

const triggerCelebration = () => {
  isCelebrating.value = true
  showFireworks.value = true
  setTimeout(() => {
    showFireworks.value = false
    isCelebrating.value = false
  }, 2000)
}

const animateRoll = (callback: (r1: number, r2: number, r3: number) => void) => {
  reel1.value.isSpinning = true
  reel2.value.isSpinning = true
  reel3.value.isSpinning = true

  const finalReel1 = getRandomSymbol()
  const finalReel2 = getRandomSymbol()
  const finalReel3 = getRandomSymbol()

  if (skipAnimation.value) {
    reel1.value.current = finalReel1
    reel1.value.display = finalReel1
    reel2.value.current = finalReel2
    reel2.value.display = finalReel2
    reel3.value.current = finalReel3
    reel3.value.display = finalReel3
    reel1.value.isSpinning = false
    reel2.value.isSpinning = false
    reel3.value.isSpinning = false
    callback(finalReel1, finalReel2, finalReel3)
    return
  }

  const duration1 = (1000 + Math.random() * 500) / 2 // 速度翻倍
  const duration2 = duration1 + (400 + Math.random() * 400) / 2
  const duration3 = duration2 + (400 + Math.random() * 400) / 2

  const spinReel = (reel: typeof reel1.value, finalValue: number, duration: number, onComplete: () => void) => {
    const startTime = Date.now()
    const startValue = reel.display
    const totalSymbols = symbols.length
    const extraSpins = 3 + Math.floor(Math.random() * 3)
    const totalDistance = (extraSpins * totalSymbols) + ((finalValue - startValue + totalSymbols) % totalSymbols)

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // 使用缓动函数
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentDistance = totalDistance * easeOutQuart
      
      reel.display = (startValue + Math.floor(currentDistance)) % totalSymbols

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        reel.display = finalValue
        reel.current = finalValue
        reel.isSpinning = false
        onComplete()
      }
    }

    requestAnimationFrame(animate)
  }

  let completed = 0
  const onReelComplete = () => {
    completed++
    if (completed === 3) {
      setTimeout(() => callback(finalReel1, finalReel2, finalReel3), 100)
    }
  }

  setTimeout(() => spinReel(reel1.value, finalReel1, duration1, onReelComplete), 50)
  setTimeout(() => spinReel(reel2.value, finalReel2, duration2, onReelComplete), 200)
  setTimeout(() => spinReel(reel3.value, finalReel3, duration3, onReelComplete), 350)
}

const roll = () => {
  if (score.value < 24) {
    lastResult.value = { type: 'error', amount: 0, message: '击分不足！需要24击分才能老虎机' }
    return
  }
  if (isRolling.value || isBatchRolling.value) return

  isRolling.value = true
  score.value -= 24

  animateRoll((r1, r2, r3) => {
    const result = rollOnceWithSymbols(r1, r2, r3)
    probabilityBonus.value = Math.min(50, probabilityBonus.value + 0.1)
    if (result.amount > 0) {
      addScore(result.amount)
    } else {
      score.value += result.amount
    }
    lastResult.value = {
      type: result.amount > 0 ? 'success' : 'fail',
      amount: result.amount,
      message: result.message,
      special: result.special
    }

    rollHistory.value.unshift({
      type: result.amount > 0 ? 'success' : 'fail',
      amount: result.amount,
      message: result.message,
      timestamp: new Date(),
      special: result.special
    })

    if (rollHistory.value.length > 20) {
      rollHistory.value.pop()
    }

    isRolling.value = false
  })
}

const animateRollPromise = (): Promise<{ r1: number; r2: number; r3: number }> => {
  return new Promise((resolve) => {
    animateRoll((r1, r2, r3) => {
      resolve({ r1, r2, r3 })
    })
  })
}

// 单次批量最大次数限制，防止内存溢出
const MAX_BATCH_TIMES = 1000000

const batchRoll = () => {
  let remainingTimes = batchCount.value
  
  // 限制单次最大批量次数
  if (remainingTimes > MAX_BATCH_TIMES) {
    lastResult.value = { type: 'error', amount: 0, message: `单次批量老虎机不能超过 ${MAX_BATCH_TIMES} 次！` }
    return
  }
  
  if (score.value < remainingTimes * 24) {
    lastResult.value = { type: 'error', amount: 0, message: `击分不足！需要 ${remainingTimes * 24} 击分才能老虎机` }
    return
  }
  if (isRolling.value || isBatchRolling.value) return

  isBatchRolling.value = true
  const cost = remainingTimes * 24
  score.value -= cost
  batchProgress.value = 0
  const baseScore = score.value
  let totalWin = 0

  // 按需计算结果，不存储所有结果
  let finalR1 = 0, finalR2 = 0, finalR3 = 0
  let cumulativeWin = 0
  const batchSize = Math.min(1000, remainingTimes) // 每批处理1000次
  let processedCount = 0
  
  // 预计算累积获胜值（使用更高效的方式）
  const calculateWin = (count: number): { win: number; r1: number; r2: number; r3: number } => {
    let win = 0
    let r1 = 0, r2 = 0, r3 = 0
    for (let i = 0; i < count; i++) {
      r1 = getRandomSymbol()
      r2 = getRandomSymbol()
      r3 = getRandomSymbol()
      win += rollOnceWithSymbols(r1, r2, r3).amount
    }
    return { win, r1, r2, r3 }
  }

  // 分块计算累积值
  const cumulativeWins: number[] = []
  let currentWin = 0
  const chunks = Math.ceil(remainingTimes / batchSize)
  
  for (let i = 0; i < chunks; i++) {
    const chunkSize = Math.min(batchSize, remainingTimes - i * batchSize)
    const result = calculateWin(chunkSize)
    currentWin += result.win
    cumulativeWins.push(currentWin)
    if (i === chunks - 1) {
      finalR1 = result.r1
      finalR2 = result.r2
      finalR3 = result.r3
    }
  }

  const duration = Math.min((10000 + remainingTimes * 2) / 2, 15000) // 持续时间限制在15秒内，速度翻倍
  const startTime = Date.now()
  let lastProgressUpdate = 0

  reel1.value.isSpinning = true
  reel2.value.isSpinning = true
  reel3.value.isSpinning = true

  const spinAnimation = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    const currentCount = Math.floor(progress * remainingTimes)
    
    // 限制更新频率，每处理1%更新一次
    const progressPercent = Math.floor((currentCount / remainingTimes) * 100)
    if (progressPercent !== lastProgressUpdate) {
      lastProgressUpdate = progressPercent
      batchProgress.value = progressPercent
      
      // 根据当前进度计算累积获胜值
      const chunkIndex = Math.min(Math.floor(currentCount / batchSize), cumulativeWins.length - 1)
      totalWin = cumulativeWins[chunkIndex] || 0
      score.value = baseScore + totalWin
    }

    // 更新滚轮显示（随机显示，不存储历史）
    if (progress < 0.95) {
      reel1.value.display = getRandomSymbol()
      reel2.value.display = getRandomSymbol()
      reel3.value.display = getRandomSymbol()
    } else {
      // 最后阶段显示最终结果
      reel1.value.display = finalR1
      reel2.value.display = finalR2
      reel3.value.display = finalR3
    }

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(spinAnimation)
    } else {
      animationFrameId = null
      reel1.value.isSpinning = false
      reel2.value.isSpinning = false
      reel3.value.isSpinning = false
      reel1.value.display = finalR1
      reel2.value.display = finalR2
      reel3.value.display = finalR3
      reel1.value.current = finalR1
      reel2.value.current = finalR2
      reel3.value.current = finalR3

      totalWin = cumulativeWins[cumulativeWins.length - 1] || 0
      score.value = baseScore + totalWin

      probabilityBonus.value = Math.min(50, probabilityBonus.value + remainingTimes * 0.1 * 1.25)

      batchProgress.value = 100
      isBatchRolling.value = false

      lastResult.value = {
        type: totalWin > 0 ? 'success' : 'fail',
        amount: totalWin,
        message: `批量老虎机完成！共获得 ${totalWin} 击分`
      }
    }
  }

  requestAnimationFrame(spinAnimation)
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const totalCost = computed(() => batchCount.value * 24)

// 取消批量滚动
const cancelBatchRoll = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  reel1.value.isSpinning = false
  reel2.value.isSpinning = false
  reel3.value.isSpinning = false
  isBatchRolling.value = false
  batchProgress.value = 0
  lastResult.value = { type: 'info', amount: 0, message: '批量老虎机已取消' }
}

// 组件卸载时清理
onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
})
</script>

<template>
  <div class="slot-machine-page">
    <!-- 特效层 -->
    <div v-if="showFireworks" class="fireworks-overlay">
      <div v-for="(fw, i) in fireworks" :key="i" class="firework" :style="{
        left: fw.left + '%',
        animationDelay: fw.delay + 's',
        animationDuration: fw.duration + 's'
      }"></div>
    </div>
    <div v-if="showLightning" class="lightning-overlay"></div>

    <div class="score-card">
      <div class="score-label">当前击分</div>
      <div class="score-value">{{ Math.floor(score) }}</div>
      <div v-if="probabilityBonus !== 0" class="bonus-info">
        <span class="bonus-label">概率加成:</span>
        <span :class="['bonus-value', probabilityBonus > 0 ? 'positive' : 'negative']">
          {{ probabilityBonus > 0 ? '+' : '' }}{{ probabilityBonus.toFixed(1) }}%
        </span>
      </div>
      <div v-if="winStreak > 0" class="streak-info">
        <span class="streak-label">🔥 连胜:</span>
        <span class="streak-value">{{ winStreak }}次</span>
        <span v-if="maxWinStreak > 0" class="max-streak">最高: {{ maxWinStreak }}次</span>
      </div>
    </div>

    <div class="machine-body" :class="{ celebrating: isCelebrating }">
      <div class="reels-container">
        <div class="reel" :class="{ spinning: reel1.isSpinning }">
          <div class="reel-window">
            <span class="reel-symbol">{{ symbols[reel1.display] }}</span>
          </div>
        </div>
        <div class="reel" :class="{ spinning: reel2.isSpinning }">
          <div class="reel-window">
            <span class="reel-symbol">{{ symbols[reel2.display] }}</span>
          </div>
        </div>
        <div class="reel" :class="{ spinning: reel3.isSpinning }">
          <div class="reel-window">
            <span class="reel-symbol">{{ symbols[reel3.display] }}</span>
          </div>
        </div>
      </div>

      <div class="glass"></div>

      <div class="buttons-container">
        <button 
          class="roll-btn" 
          :class="{ rolling: isRolling }"
          @click="roll"
          :disabled="score < 24 || isRolling || isBatchRolling"
        >
          <span v-if="isRolling">🎰 读博中...</span>
          <span v-else>🎲 24击分 玩老虎机</span>
        </button>
      </div>

      <div v-if="lastResult" class="result" :class="[lastResult.type, { special: lastResult.special }]">
        {{ lastResult.message }}
      </div>
    </div>

    <div class="batch-card">
      <div class="batch-header">
        <h3>批量老虎机</h3>
        <span class="batch-info">次数: {{ batchCount }} | 消耗: {{ totalCost }} 击分</span>
      </div>
      <!--div class="skip-toggle">
        <span class="skip-label">跳过动画</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="skipAnimation" />
          <span class="toggle-slider"></span>
        </label>
      </div-->
      <div class="slider-container">
        <input 
          type="range" 
          v-model.number="batchCount" 
          min="1" 
          :max="Math.floor(score / 24)" 
          step="1"
          class="batch-slider"
        />
        <div class="slider-labels">
          <span>1次</span>
          <span>{{ batchCount }}次</span>
          <span>{{ Math.floor(score / 24) }}次</span>
        </div>
      </div>
      <button 
        class="batch-btn"
        @click="batchRoll"
        :disabled="score < totalCost || isRolling || isBatchRolling"
      >
        <span v-if="isBatchRolling">🎰 批量老虎机中...</span>
        <span v-else>🚀 批量老虎机</span>
      </button>
      <div v-if="isBatchRolling" class="batch-controls">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: batchProgress + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(batchProgress) }}%</span>
        </div>
        <button 
          class="cancel-btn"
          @click="cancelBatchRoll"
        >
          ❌ 取消
        </button>
      </div>
    </div>

    <div class="rules">
      <h3>🎰 老虎机规则</h3>
      <ul>
        <li>• 基础奖励等级：5/10/15/25/40/70/150/500击分</li>
        <li>• 💥 暴击系统：10%几率获得1.5倍奖励</li>
        <li>• 🔥 连胜奖励：每3次连胜额外+15/30/45...击分</li>
        <li>• 👑 三连奖励：三个相同符号触发额外奖励</li>
        <li>• ⚡ 配对奖励：两个相同符号+20击分</li>
        <li>• 💀 特殊符号：死神三连可获得300击分</li>
        <li>• 每抽一次概率+0.1%，获取一次-1%</li>
      </ul>
    </div>

    <div class="history">
      <h3>老虎机记录</h3>
      <div v-if="rollHistory.length === 0" class="empty-history">
        暂无老虎机记录
      </div>
      <ul v-else class="history-list">
        <li v-for="(item, index) in rollHistory" :key="index" class="history-item">
          <span class="time">{{ formatTime(item.timestamp) }}</span>
          <span :class="[item.type, { special: item.special }]">{{ item.message }}</span>
        </li>
      </ul>
    </div>

    <button class="get-btn" @click="getScore">获取击分</button>
  </div>
</template>

<style scoped>
.slot-machine-page {
  flex: 1;
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.score-card {
  background: linear-gradient(145deg, #2d2d44, #1e1e2e);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  margin-bottom: 1.5rem;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.score-label {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.score-value {
  font-size: 3rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
}

.bonus-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.8rem;
  padding: 0.4rem 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
}

.bonus-label {
  font-size: 0.8rem;
  color: #888;
}

.bonus-value {
  font-size: 1rem;
  font-weight: bold;
}

.bonus-value.positive {
  color: #4CAF50;
}

.bonus-value.negative {
  color: #ff6b6b;
}

.streak-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding: 0.4rem 0.8rem;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 193, 7, 0.2));
  border-radius: 16px;
  animation: streakPulse 1s ease-in-out infinite;
}

@keyframes streakPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.streak-label {
  font-size: 0.9rem;
  color: #ff6b6b;
}

.streak-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.max-streak {
  font-size: 0.8rem;
  color: #888;
}

.machine-body {
  background: linear-gradient(145deg, #2a2a40, #1f1f30);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 215, 0, 0.3);
  position: relative;
  margin-bottom: 1.5rem;
}

.machine-body.celebrating {
  animation: machineShake 0.5s ease-in-out;
}

@keyframes machineShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.reels-container {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 1.2rem;
}

.reel {
  width: 65px;
  height: 80px;
  background: linear-gradient(180deg, #1a1a2e, #0f0f1a);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.5);
  border: 2px solid #333;
}

.reel-window {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.reel-symbol {
  font-size: 2.5rem;
  transition: all 0.3s ease;
}

.reel.spinning .reel-symbol {
  animation: reelSpin 0.1s linear infinite;
}

@keyframes reelSpin {
  0% { transform: translateY(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
}

.glass {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(3 * 65px + 2 * 8px);
  height: 80px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
  border-radius: 8px;
}

.buttons-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.roll-btn {
  width: 100%;
  padding: 1.2rem;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(238, 90, 36, 0.4);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.roll-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(238, 90, 36, 0.6);
}

.roll-btn:disabled {
  background: #444;
  cursor: not-allowed;
  box-shadow: none;
}

.roll-btn.rolling {
  animation: pulse 0.3s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.result {
  margin-top: 1.2rem;
  padding: 0.8rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  text-align: center;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.result.success {
  background: linear-gradient(135deg, rgba(46, 125, 50, 0.2), rgba(46, 125, 50, 0.1));
  color: #81c784;
  border: 1px solid rgba(46, 125, 50, 0.3);
}

.result.fail {
  background: linear-gradient(135deg, rgba(198, 40, 40, 0.2), rgba(198, 40, 40, 0.1));
  color: #ef9a9a;
  border: 1px solid rgba(198, 40, 40, 0.3);
}

.result.error {
  background: linear-gradient(135deg, rgba(239, 108, 0, 0.2), rgba(239, 108, 0, 0.1));
  color: #ffab91;
  border: 1px solid rgba(239, 108, 0, 0.3);
}

.result.special {
  animation: specialResult 0.5s ease-out;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 107, 107, 0.3));
  border-color: #ffd700;
}

@keyframes specialResult {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.batch-card {
  background: linear-gradient(145deg, #252538, #1a1a28);
  border-radius: 16px;
  padding: 1.2rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.batch-header h3 {
  margin: 0;
  color: #ffd700;
  font-size: 1.2rem;
}

.batch-info {
  color: #888;
  font-size: 0.9rem;
}

.skip-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

.skip-label {
  color: #ccc;
  font-size: 0.95rem;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #444;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.slider-container {
  margin-bottom: 1rem;
}

.batch-slider {
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 4px;
  outline: none;
}

.batch-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(238, 90, 36, 0.5);
}

.batch-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 10px rgba(238, 90, 36, 0.5);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  color: #888;
  font-size: 0.85rem;
}

.batch-btn {
  width: 100%;
  padding: 1.2rem;
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

.batch-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6);
}

.batch-controls {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.cancel-btn {
  padding: 0.6rem 1rem;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  transform: scale(1.02);
}

.batch-btn:disabled {
  background: #444;
  cursor: not-allowed;
  box-shadow: none;
}

.progress-container {
  margin-top: 1rem;
}

.progress-bar {
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #81c784);
  border-radius: 4px;
  transition: width 0.3s ease-out;
}

.progress-text {
  display: block;
  text-align: center;
  margin-top: 0.5rem;
  color: #81c784;
  font-size: 0.9rem;
}

.rules, .history {
  background: linear-gradient(145deg, #252538, #1a1a28);
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 215, 0, 0.1);
}

.rules h3, .history h3 {
  margin-top: 0;
  color: #ffd700;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.rules ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rules li {
  padding: 0.6rem 0;
  color: #ccc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.95rem;
}

.rules li:last-child {
  border-bottom: none;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 0.8rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-item:last-child {
  border-bottom: none;
}

.time {
  font-size: 0.85rem;
  color: #666;
}

.history-item .success {
  color: #81c784;
}

.history-item .fail {
  color: #ef9a9a;
}

.history-item .special {
  color: #ffd700;
}

.empty-history {
  color: #666;
  text-align: center;
  padding: 1rem;
}

.get-btn {
  width: 100%;
  padding: 1.2rem;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
  margin-bottom: 1.5rem;
}

.get-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6);
}

/* 特效样式 */
.fireworks-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.firework {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle, #ffd700 0%, #ff6b6b 50%, #4CAF50 100%);
  border-radius: 50%;
  animation: fireworks 1.5s ease-out forwards;
}

@keyframes fireworks {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translateY(-300px) scale(0); opacity: 0; }
}

.firework::before,
.firework::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: inherit;
  border-radius: 50%;
}

.firework::before {
  transform: translate(-50%, -50%) rotate(45deg);
  animation: fireworkParticle 1.5s ease-out forwards;
}

.firework::after {
  transform: translate(-50%, -50%) rotate(-45deg);
  animation: fireworkParticleAlt 1.5s ease-out forwards;
}

@keyframes fireworkParticle {
  0% { transform: translate(-50%, -50%) rotate(45deg) translateY(0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(45deg) translateY(-200px) scale(0); opacity: 0; }
}

@keyframes fireworkParticleAlt {
  0% { transform: translate(-50%, -50%) rotate(-45deg) translateY(0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(-45deg) translateY(-250px) scale(0); opacity: 0; }
}

.lightning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  pointer-events: none;
  z-index: 999;
  animation: lightning 0.5s ease-out forwards;
}

@keyframes lightning {
  0% { opacity: 0; }
  10% { opacity: 1; }
  20% { opacity: 0; }
  30% { opacity: 1; }
  40% { opacity: 0; }
  100% { opacity: 0; }
}

/* 响应式 */
@media (min-width: 768px) {
  .slot-machine-page {
    padding: 1.5rem;
    max-width: 650px;
  }
  
  .score-card {
    padding: 1.8rem;
  }
  
  .score-value {
    font-size: 3.8rem;
  }
  
  .machine-body {
    padding: 1.8rem;
  }
  
  .reel {
    width: 75px;
    height: 90px;
  }
  
  .reel-content span {
    font-size: 2.3rem;
    height: 40px;
  }
  
  .glass {
    top: 1.8rem;
    width: calc(3 * 75px + 2 * 8px);
    height: 90px;
  }
  
  .roll-btn, .batch-btn, .get-btn {
    padding: 1.3rem;
    font-size: 1.2rem;
  }
}

@media (min-width: 1024px) {
  .slot-machine-page {
    padding: 2rem;
    max-width: 700px;
  }
  
  .score-card {
    padding: 2rem;
  }
  
  .score-value {
    font-size: 4.5rem;
  }
  
  .machine-body {
    padding: 2rem;
  }
  
  .reel {
    width: 80px;
    height: 100px;
  }
  
  .reel-content span {
    font-size: 2.5rem;
    height: 45px;
  }
  
  .glass {
    top: 2rem;
    width: calc(3 * 80px + 2 * 10px);
    height: 100px;
  }
  
  .roll-btn, .batch-btn, .get-btn {
    padding: 1.5rem;
    font-size: 1.3rem;
  }
}
</style>