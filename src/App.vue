<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SnakeGame from './components/SnakeGame.vue'
import RouletteGame from './components/RouletteGame.vue'
import BlackjackGame from './components/BlackjackGame.vue'

const currentPage = ref('home')

// 从 localStorage 读取击分，默认为 1000
const savedScore = localStorage.getItem('gambling_score')
const score = ref(savedScore ? parseInt(savedScore, 10) : 1000)

// 监听击分变化，自动保存到 localStorage
watch(score, (newScore) => {
  localStorage.setItem('gambling_score', newScore.toString())
})
const isRolling = ref(false)
const lastResult = ref<{ type: string; amount: number; message: string } | null>(null)
const rollHistory = ref<Array<{ type: string; amount: number; message: string; timestamp: Date }>>([])
const batchCount = ref(10)
const batchProgress = ref(0)
const isBatchRolling = ref(false)
const skipAnimation = ref(false)
const canSkip = ref(false)

// 概率加成：每老虎机一次+0.1%，每获取一次-1%
const savedBonus = localStorage.getItem('gambling_probability_bonus')
const probabilityBonus = ref(savedBonus ? parseFloat(savedBonus) : 0)

// 获取次数（用于轮盘赌最低投入计算）
const savedGetCount = localStorage.getItem('gambling_get_count')
const getCount = ref(savedGetCount ? parseInt(savedGetCount, 10) : 0)

// 监听概率加成变化，自动保存到 localStorage
watch(probabilityBonus, (newBonus) => {
  localStorage.setItem('gambling_probability_bonus', newBonus.toString())
})

// 监听获取次数变化，自动保存到 localStorage
watch(getCount, (newCount) => {
  localStorage.setItem('gambling_get_count', newCount.toString())
})

const symbols = ['🍒', '⭐', '💎', '7', '🔔', '💰', '🎰', '🎯']

const reel1 = ref({ current: 0, isSpinning: false })
const reel2 = ref({ current: 0, isSpinning: false })
const reel3 = ref({ current: 0, isSpinning: false })

const getScore = () => {
  score.value += 10000
  // 每获取一次，所有可中奖项目概率减少1%
  probabilityBonus.value = Math.max(-30, probabilityBonus.value - 1)
  // 增加获取次数（影响轮盘赌最低投入）
  getCount.value++
  lastResult.value = { type: 'success', amount: 10000, message: '获得10000击分！' }
}

const getRandomSymbol = () => {
  return Math.floor(Math.random() * symbols.length)
}

const rollOnce = () => {
  const rand = Math.random() * 100
  let amount = 0
  let message = ''

  // 基础概率：20%不中奖，80%中奖
  // 概率加成应用到所有中奖项目，减少不中奖概率
  const noWinProb = Math.max(5, Math.min(40, 20 - probabilityBonus.value))
  
  if (rand < noWinProb) {
    amount = 0
    message = '很遗憾，什么都没抽到'
  } else {
    // 在中奖区间内重新计算
    const winRand = (rand - noWinProb) / (100 - noWinProb) * 80
    
    if (winRand < 37.5) {
      amount = 5
      message = '恭喜！获得5击分'
    } else if (winRand < 62.5) {
      amount = 10
      message = '恭喜！获得10击分'
    } else if (winRand < 81.25) {
      amount = 15
      message = '恭喜！获得15击分'
    } else if (winRand < 93.75) {
      amount = 20
      message = '恭喜！获得20击分'
    } else if (winRand < 97.5) {
      amount = 30
      message = '太棒了！获得30击分'
    } else {
      amount = 50
      message = '超级大奖！获得50击分'
    }
  }

  return { amount, message }
}

const animateRoll = (callback: () => void) => {
  reel1.value.isSpinning = true
  reel2.value.isSpinning = true
  reel3.value.isSpinning = true

  const finalReel1 = getRandomSymbol()
  const finalReel2 = getRandomSymbol()
  const finalReel3 = getRandomSymbol()

  if (skipAnimation.value) {
    reel1.value.current = finalReel1
    reel2.value.current = finalReel2
    reel3.value.current = finalReel3
    reel1.value.isSpinning = false
    reel2.value.isSpinning = false
    reel3.value.isSpinning = false
    callback()
    return
  }

  setTimeout(() => {
    reel1.value.current = finalReel1
    reel1.value.isSpinning = false
  }, 400)

  setTimeout(() => {
    reel2.value.current = finalReel2
    reel2.value.isSpinning = false
  }, 600)

  setTimeout(() => {
    reel3.value.current = finalReel3
    reel3.value.isSpinning = false
    setTimeout(callback, 200)
  }, 800)
}

const roll = () => {
  if (score.value < 10) {
    lastResult.value = { type: 'error', amount: 0, message: '击分不足！需要10击分才能老虎机' }
    return
  }
  if (isRolling.value || isBatchRolling.value) return

  isRolling.value = true
  score.value -= 10

  animateRoll(() => {
    const result = rollOnce()
    // 每老虎机一次，所有可中奖项目概率增加0.1%
    probabilityBonus.value = Math.min(50, probabilityBonus.value + 0.1)
    score.value += result.amount
    lastResult.value = {
      type: result.amount > 0 ? 'success' : 'fail',
      amount: result.amount,
      message: result.message
    }

    rollHistory.value.unshift({
      type: result.amount > 0 ? 'success' : 'fail',
      amount: result.amount,
      message: result.message,
      timestamp: new Date()
    })

    if (rollHistory.value.length > 20) {
      rollHistory.value.pop()
    }

    isRolling.value = false
  })
}

const batchRoll = () => {
  const times = batchCount.value
  if (score.value < times * 10) {
    lastResult.value = { type: 'error', amount: 0, message: `击分不足！需要 ${times * 10} 击分才能老虎机` }
    return
  }
  if (isRolling.value || isBatchRolling.value) return

  isBatchRolling.value = true
  score.value -= times * 10
  batchProgress.value = 0
  let totalWin = 0

  const doBatchRoll = (index: number) => {
    if (index >= times) {
      // 批量老虎机完成后一次性结算概率，额外获得25%加成
      const bonus = times * 0.1 * 1.25
      probabilityBonus.value = Math.min(50, probabilityBonus.value + bonus)
      
      isBatchRolling.value = false
      lastResult.value = {
        type: totalWin > 0 ? 'success' : 'fail',
        amount: totalWin,
        message: `批量老虎机完成！共获得 ${totalWin} 击分，概率加成 +${bonus.toFixed(2)}%`
      }
      return
    }

    animateRoll(() => {
      const result = rollOnce()
      score.value += result.amount
      totalWin += result.amount

      rollHistory.value.unshift({
        type: result.amount > 0 ? 'success' : 'fail',
        amount: result.amount,
        message: result.message,
        timestamp: new Date()
      })

      if (rollHistory.value.length > 20) {
        rollHistory.value.pop()
      }

      batchProgress.value = ((index + 1) / times) * 100
      doBatchRoll(index + 1)
    })
  }

  doBatchRoll(0)
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const totalCost = computed(() => batchCount.value * 10)
</script>

<template>
  <div class="app">
    <header class="header">
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'home' }"
        @click="currentPage = 'home'"
      >
        🎰 老虎机
      </button>
      <div class="title">
        {{ currentPage === 'home' ? '击分博彩' : '博彩游戏' }}
      </div>
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'snake' }"
        @click="currentPage = 'snake'"
      >
        🐍 博彩蛇
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'roulette' }"
        @click="currentPage = 'roulette'"
      >
        🎲 轮盘赌
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: currentPage === 'blackjack' }"
        @click="currentPage = 'blackjack'"
      >
        🂡 21点
      </button>
      <button v-if="currentPage === 'home'" class="get-btn" @click="getScore">获取</button>
    </header>

    <main v-if="currentPage === 'home'" class="main">
      <div class="score-card">
        <div class="score-label">当前击分</div>
        <div class="score-value">{{ score }}</div>
        <div v-if="probabilityBonus !== 0" class="bonus-info">
          <span class="bonus-label">概率加成:</span>
          <span :class="['bonus-value', probabilityBonus > 0 ? 'positive' : 'negative']">
            {{ probabilityBonus > 0 ? '+' : '' }}{{ probabilityBonus.toFixed(1) }}%
          </span>
        </div>
      </div>

      <div class="slot-machine">
        <div class="machine-body">
          <div class="reels-container">
            <div class="reel" :class="{ spinning: reel1.isSpinning }">
              <div class="reel-content">
                <span v-for="(_, index) in symbols" :key="index" :class="{ active: index === reel1.current }">
                  {{ symbols[(reel1.current + index) % symbols.length] }}
                </span>
              </div>
            </div>
            <div class="reel" :class="{ spinning: reel2.isSpinning }">
              <div class="reel-content">
                <span v-for="(_, index) in symbols" :key="index" :class="{ active: index === reel2.current }">
                  {{ symbols[(reel2.current + index) % symbols.length] }}
                </span>
              </div>
            </div>
            <div class="reel" :class="{ spinning: reel3.isSpinning }">
              <div class="reel-content">
                <span v-for="(_, index) in symbols" :key="index" :class="{ active: index === reel3.current }">
                  {{ symbols[(reel3.current + index) % symbols.length] }}
                </span>
              </div>
            </div>
          </div>

          <div class="glass"></div>

          <div class="buttons-container">
            <button 
              class="roll-btn" 
              :class="{ rolling: isRolling }"
              @click="roll"
              :disabled="score < 10 || isRolling || isBatchRolling"
            >
              <span v-if="isRolling">🎰 读博中...</span>
              <span v-else>🎲 消耗10击分 玩老虎机</span>
            </button>
          </div>

          <div v-if="lastResult" class="result" :class="lastResult.type">
            {{ lastResult.message }}
          </div>
        </div>
      </div>

      <div class="batch-card">
        <div class="batch-header">
          <h3>批量老虎机</h3>
          <span class="batch-info">次数: {{ batchCount }} | 消耗: {{ totalCost }} 击分</span>
        </div>
        <div class="skip-toggle">
          <span class="skip-label">跳过动画</span>
          <label class="toggle-switch">
            <input type="checkbox" v-model="skipAnimation" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="slider-container">
          <input 
            type="range" 
            v-model.number="batchCount" 
            min="1" 
            max="100" 
            step="1"
            class="batch-slider"
          />
          <div class="slider-labels">
            <span>1次</span>
            <span>{{ batchCount }}次</span>
            <span>100次</span>
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
        <div v-if="isBatchRolling" class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: batchProgress + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(batchProgress) }}%</span>
        </div>
      </div>

      <div class="rules">
        <h3>老虎机规则</h3>
        <ul>
          <li>• 20% 概率：什么都得不到</li>
          <li>• 30% 概率：获得5击分</li>
          <li>• 20% 概率：获得10击分</li>
          <li>• 15% 概率：获得15击分</li>
          <li>• 10% 概率：获得20击分</li>
          <li>• 3% 概率：获得30击分</li>
          <li>• 2% 概率：获得50击分</li>
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
            <span :class="item.type">{{ item.message }}</span>
          </li>
        </ul>
      </div>
    </main>

    <main v-else-if="currentPage === 'snake'" class="snake-main">
      <SnakeGame :gambling-score="score" @update:gambling-score="score = $event" />
    </main>
    <main v-else-if="currentPage === 'roulette'" class="roulette-main">
      <RouletteGame :gambling-score="score" :get-count="getCount" @update:gambling-score="score = $event" />
    </main>
    <main v-else-if="currentPage === 'blackjack'" class="blackjack-main">
      <BlackjackGame :gambling-score="score" @update:gambling-score="score = $event" />
    </main>

    <footer class="footer">
      纯娱乐用途，请勿当真
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  gap: 0.8rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-btn {
  padding: 0.5rem 0.9rem;
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.nav-btn.active {
  background: linear-gradient(135deg, #ffd700, #ffb300);
  color: #1a1a2e;
  border-color: #ffd700;
  font-weight: bold;
}

.logo {
  font-size: 2rem;
}

.title {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.get-btn {
  padding: 0.5rem 1.5rem;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

.get-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6);
}

.main {
  flex: 1;
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

/* 平板布局 */
@media (min-width: 768px) {
  .header {
    padding: 1rem 2rem;
    gap: 1rem;
  }
  
  .nav-btn {
    padding: 0.6rem 1.1rem;
    font-size: 0.9rem;
  }
  
  .title {
    font-size: 1.3rem;
  }
  
  .get-btn {
    padding: 0.6rem 1.8rem;
    font-size: 0.95rem;
  }
  
  .main {
    padding: 1.5rem;
  }
}

/* 桌面布局 */
@media (min-width: 1024px) {
  .header {
    padding: 1rem 3rem;
    gap: 1.5rem;
  }
  
  .nav-btn {
    padding: 0.7rem 1.3rem;
    font-size: 1rem;
    border-radius: 10px;
  }
  
  .title {
    font-size: 1.5rem;
  }
  
  .get-btn {
    padding: 0.7rem 2rem;
    font-size: 1rem;
    border-radius: 25px;
  }
  
  .main {
    padding: 2rem;
    max-width: 650px;
  }
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

.slot-machine {
  margin-bottom: 1.5rem;
}

.machine-body {
  background: linear-gradient(145deg, #2a2a40, #1f1f30);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 215, 0, 0.3);
  position: relative;
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

/* 平板布局 */
@media (min-width: 768px) {
  .score-card {
    border-radius: 20px;
    padding: 1.8rem;
    margin-bottom: 1.8rem;
  }
  
  .score-label {
    font-size: 0.95rem;
  }
  
  .score-value {
    font-size: 3.8rem;
  }
  
  .machine-body {
    border-radius: 25px;
    padding: 1.8rem;
  }
  
  .reel {
    width: 75px;
    height: 90px;
  }
}

/* 桌面布局 */
@media (min-width: 1024px) {
  .score-card {
    border-radius: 20px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .score-label {
    font-size: 1rem;
    letter-spacing: 2px;
  }
  
  .score-value {
    font-size: 4.5rem;
  }
  
  .bonus-info {
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
  }
  
  .bonus-label {
    font-size: 0.9rem;
  }
  
  .bonus-value {
    font-size: 1.1rem;
  }
  
  .machine-body {
    border-radius: 25px;
    padding: 2rem;
  }
  
  .reels-container {
    gap: 10px;
    margin-bottom: 1.5rem;
  }
  
  .reel {
    width: 80px;
    height: 100px;
  }
}

.reel-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  transition: transform 0.1s ease-out;
}

.reel.spinning .reel-content {
  animation: spin 0.08s linear infinite;
}

@keyframes spin {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-25%);
  }
}

.reel-content span {
  font-size: 2rem;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
  filter: blur(2px);
  transition: all 0.3s;
}

.reel-content span.active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1.2);
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
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
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
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.batch-card {
  background: linear-gradient(145deg, #252538, #1a1a28);
  border-radius: 16px;
  padding: 1.2rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 215, 0, 0.2);
}

/* 平板布局 */
@media (min-width: 768px) {
  .reel-content span {
    font-size: 2.3rem;
    height: 40px;
  }
  
  .glass {
    top: 1.8rem;
    width: calc(3 * 75px + 2 * 8px);
    height: 90px;
    border-radius: 10px;
  }
  
  .roll-btn {
    padding: 1.3rem;
    font-size: 1.2rem;
    border-radius: 14px;
  }
  
  .result {
    margin-top: 1.4rem;
    padding: 0.9rem;
    font-size: 1.1rem;
  }
  
  .batch-card {
    border-radius: 18px;
    padding: 1.4rem;
    margin-bottom: 1.4rem;
  }
}

/* 桌面布局 */
@media (min-width: 1024px) {
  .reel-content {
    padding: 5px 0;
  }
  
  .reel-content span {
    font-size: 2.5rem;
    height: 45px;
  }
  
  .glass {
    top: 2rem;
    width: calc(3 * 80px + 2 * 10px);
    height: 100px;
    border-radius: 10px;
  }
  
  .buttons-container {
    gap: 1rem;
  }
  
  .roll-btn {
    padding: 1.5rem;
    font-size: 1.3rem;
    border-radius: 15px;
  }
  
  .result {
    margin-top: 1.5rem;
    padding: 1rem;
    font-size: 1.2rem;
  }
  
  .batch-card {
    border-radius: 20px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
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

.empty-history {
  color: #666;
  text-align: center;
  padding: 1rem;
}

.footer {
  text-align: center;
  padding: 1rem;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
}

.snake-main {
  flex: 1;
  width: 100%;
}

.roulette-main {
  flex: 1;
  width: 100%;
}

.blackjack-main {
  flex: 1;
  width: 100%;
}
</style>
