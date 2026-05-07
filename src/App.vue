<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import SlotMachine from './components/SlotMachine.vue'
import SnakeGame from './components/SnakeGame.vue'
import RouletteGame from './components/RouletteGame.vue'
import BlackjackGame from './components/BlackjackGame.vue'
import BirdGame from './components/BirdGame.vue'
import TetrisGame from './components/TetrisGame.vue'
import BankPage from './components/BankPage.vue'
import DiceGame from './components/DiceGame.vue'
import MemoryCard from './components/MemoryCard.vue'
import WhackAMole from './components/WhackAMole.vue'
import RPSGame from './components/RPSGame.vue'
import ScratchCard from './components/ScratchCard.vue'
import NumberGuess from './components/NumberGuess.vue'
import PlinkoGame from './components/PlinkoGame.vue'
import DiceBattle from './components/DiceBattle.vue'
import MinecraftPreClassic from './components/MinecraftPreClassic.vue'
import Minesweeper from './components/Minesweeper.vue'
import DinoGame from './components/DinoGame.vue'

const currentPage = ref('home')

// 从 localStorage 读取击分，默认为 1000
const savedScore = localStorage.getItem('gambling_score')
const score = ref(savedScore ? parseInt(savedScore, 10) : 1000)

// 监听击分变化，自动保存到 localStorage
watch(score, (newScore) => {
  localStorage.setItem('gambling_score', newScore.toString())
})

// 获取次数（用于轮盘赌最低投入计算）
const savedGetCount = localStorage.getItem('gambling_get_count')
const getCount = ref(savedGetCount ? parseInt(savedGetCount, 10) : 0)

watch(getCount, (newCount) => {
  localStorage.setItem('gambling_get_count', newCount.toString())
})

// 银行状态 - 统一管理
const loanAmount = ref(0)
const depositAmount = ref(0)
const maxLoan = 1000000
const loanInterestRate = 0.0001 // 0.01% per second
const depositInterestRate = 0.00001 // 0.001% per second

// 从 localStorage 读取银行数据
const savedLoan = localStorage.getItem('bank_loan')
const savedDeposit = localStorage.getItem('bank_deposit')
if (savedLoan) loanAmount.value = parseFloat(savedLoan)
if (savedDeposit) depositAmount.value = parseFloat(savedDeposit)

// 保存银行数据
const saveBankData = () => {
  localStorage.setItem('bank_loan', loanAmount.value.toString())
  localStorage.setItem('bank_deposit', depositAmount.value.toString())
}

// 定时更新利息
let bankIntervalId: number

const updateInterest = () => {
  // 贷款利息
  if (loanAmount.value > 0) {
    const interest = loanAmount.value * loanInterestRate
    loanAmount.value = Math.round((loanAmount.value + interest) * 100) / 100
  }
  
  // 存款利息
  if (depositAmount.value > 0) {
    const interest = depositAmount.value * depositInterestRate
    depositAmount.value = Math.round((depositAmount.value + interest) * 100) / 100
  }
  
  saveBankData()
}

// 处理获得击分（扣除10%用于偿还贷款）
const handleScoreGain = (gain: number): number => {
  if (loanAmount.value > 0) {
    const repayment = gain * 0.1
    const actualGain = gain - repayment
    loanAmount.value = Math.max(0, loanAmount.value - repayment)
    score.value += actualGain
    saveBankData()
    return actualGain
  }
  score.value += gain
  return gain
}

// 贷款
const takeLoan = (amount: number) => {
  const availableLoan = maxLoan - loanAmount.value
  if (amount <= availableLoan && amount > 0) {
    loanAmount.value += amount
    score.value += amount
    saveBankData()
    return true
  }
  return false
}

// 存款
const makeDeposit = (amount: number) => {
  if (amount <= score.value && amount > 0) {
    depositAmount.value += amount
    score.value -= amount
    saveBankData()
    return true
  }
  return false
}

// 取款
const withdrawDeposit = (amount: number) => {
  if (amount <= depositAmount.value && amount > 0) {
    depositAmount.value -= amount
    // 取款时扣除10%用于偿还贷款
    let remainingAmount = amount
    if (loanAmount.value > 0) {
      const repayment = Math.min(loanAmount.value, remainingAmount * 0.1)
      loanAmount.value -= repayment
      remainingAmount -= repayment
    }
    score.value += remainingAmount
    saveBankData()
    return true
  }
  return false
}

// 还款
const repayLoan = (amount: number) => {
  if (amount <= score.value && amount > 0 && amount <= loanAmount.value) {
    score.value -= amount
    loanAmount.value -= amount
    saveBankData()
    return true
  }
  return false
}

onMounted(() => {
  bankIntervalId = window.setInterval(updateInterest, 1000)
})

onUnmounted(() => {
  if (bankIntervalId) {
    clearInterval(bankIntervalId)
  }
})

const games = [
  { id: 'slot', name: '老虎机', icon: '🎰', description: '经典三滚轮，暴击连连！', color: 'from-orange-500 to-red-500' },
  { id: 'snake', name: '博彩蛇', icon: '🐍', description: '贪吃蛇升级版，赌上一切！', color: 'from-green-500 to-emerald-500' },
  { id: 'roulette', name: '轮盘赌', icon: '🎲', description: '红与黑的对决，命运的选择！', color: 'from-blue-500 to-indigo-500' },
  { id: 'blackjack', name: '21点', icon: '🂡', description: '策略与运气的较量！', color: 'from-purple-500 to-pink-500' },
  { id: 'bird', name: '读博鸟', icon: '🐦', description: '小鸟也疯狂，赌命飞行！', color: 'from-yellow-500 to-orange-500' },
  { id: 'tetris', name: '俄罗斯彩礼', icon: '🟦', description: '雷霆般的攻势！', color: 'from-cyan-500 to-blue-500' },
  { id: 'dice', name: '掷骰子', icon: '🎲', description: '猜大小点数，刺激翻倍！', color: 'from-red-500 to-rose-500' },
  { id: 'memory', name: '翻牌记忆', icon: '🃏', description: '考验记忆力，连击奖励！', color: 'from-violet-500 to-purple-500' },
  { id: 'whack', name: '打地鼠', icon: '🔨', description: '眼疾手快，金币滚滚来！', color: 'from-lime-500 to-green-500' },
  { id: 'rps', name: '石头剪刀布', icon: '✊', description: '经典猜拳，连胜翻倍！', color: 'from-teal-500 to-cyan-500' },
  { id: 'scratch', name: '刮刮乐', icon: '🎫', description: '刮开涂层，惊喜连连！', color: 'from-amber-500 to-yellow-500' },
  { id: 'guess', name: '猜数字', icon: '🔢', description: '考验判断，步步为营！', color: 'from-indigo-500 to-blue-500' },
  { id: 'plinko', name: '弹球', icon: '🎯', description: '弹跳落点，倍率奖励！', color: 'from-pink-500 to-rose-500' },
  { id: 'battle', name: '骰子大战', icon: '⚔️', description: '你和庄家，谁是赢家！', color: 'from-emerald-500 to-teal-500' },
  { id: 'minecraft', name: 'Minecraft', icon: '⛏️', description: '致敬2009年Cave Game原型！', color: 'from-green-600 to-emerald-600' },
  { id: 'minesweeper', name: '扫雷', icon: '💣', description: '经典扫雷，步步惊心！', color: 'from-gray-500 to-slate-500' },
  { id: 'dino', name: '恐龙跑酷', icon: '🦕', description: '经典恐龙跑酷，挑战极限！', color: 'from-green-600 to-teal-600' },
  { id: 'bank', name: '博彩银行', icon: '🏦', description: '贷款存款，财富增值！', color: 'from-amber-500 to-yellow-500' }
]

const features = [
  { icon: '🎁', title: '丰厚奖励', desc: '最高500击分大奖等你拿！' },
  { icon: '⚡', title: '暴击系统', desc: '10%几率获得1.5倍奖励！' },
  { icon: '🔥', title: '连胜奖励', desc: '连续中奖额外加成！' },
  { icon: '👑', title: '特殊符号', desc: '皇家同花顺等你来触发！' }
]
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="title">
        <span class="logo">🎰</span>
        <span class="title-text">{{ currentPage === 'home' ? '博彩乐园' : '游戏中心' }}</span>
      </div>
      <button 
        v-if="currentPage !== 'home'" 
        class="home-btn"
        @click="currentPage = 'home'"
      >
        🏠 返回首页
      </button>
      <div v-else class="score-badge">
        <span class="score-icon">💎</span>
        <span class="score-num">{{ Math.floor(score) }}</span>
      </div>
    </header>

    <!-- 首页 -->
    <main v-if="currentPage === 'home'" class="home-main">
      <!-- Hero区域 -->
      <section class="hero">
        <div class="hero-content">
          <h1 class="hero-title">
            <span class="title-icon">🎰</span>
            博彩乐园
            <span class="title-icon">🎲</span>
          </h1>
          <p class="hero-subtitle">挑战运气极限，赢取丰厚奖励！</p>
          <div class="hero-stats">
            <div class="stat-item">
              <span class="stat-value">{{ Math.floor(score) }}</span>
              <span class="stat-label">当前击分</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">5</span>
              <span class="stat-label">趣味游戏</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value">500+</span>
              <span class="stat-label">最高奖励</span>
            </div>
          </div>
        </div>
        <div class="hero-decoration">
          <span class="float-icon float-1">⭐</span>
          <span class="float-icon float-2">💎</span>
          <span class="float-icon float-3">🔥</span>
          <span class="float-icon float-4">⚡</span>
          <span class="float-icon float-5">👑</span>
        </div>
      </section>

      <!-- 特色功能 -->
      <section class="features">
        <h2 class="section-title">🎁 游戏特色</h2>
        <div class="features-grid">
          <div v-for="feature in features" :key="feature.icon" class="feature-card">
            <span class="feature-icon">{{ feature.icon }}</span>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-desc">{{ feature.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 游戏列表 -->
      <section class="games-section">
        <h2 class="section-title">🎮 选择游戏</h2>
        <div class="games-grid">
          <div 
            v-for="game in games" 
            :key="game.id" 
            class="game-card"
            @click="currentPage = game.id"
          >
            <div class="game-icon-wrap" :class="game.color">
              <span class="game-icon">{{ game.icon }}</span>
            </div>
            <h3 class="game-name">{{ game.name }}</h3>
            <p class="game-desc">{{ game.description }}</p>
            <button class="play-btn">开始游戏</button>
          </div>
        </div>
      </section>

      <!-- 游戏规则简介 -->
      <section class="rules-intro">
        <h2 class="section-title">📖 游戏规则</h2>
        <div class="rules-content">
          <ul>
            <li>• 每次游戏消耗一定击分作为赌注</li>
            <li>• 不同游戏有不同的赔率和玩法</li>
            <li>• 连续获胜可获得连胜奖励</li>
            <li>• 纯娱乐用途，请勿当真</li>
          </ul>
        </div>
      </section>
    </main>

    <!-- 老虎机页面 -->
    <main v-else-if="currentPage === 'slot'" class="slot-main">
      <SlotMachine :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>

    <!-- 其他游戏页面 -->
    <main v-else-if="currentPage === 'snake'" class="snake-main">
      <SnakeGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'roulette'" class="roulette-main">
      <RouletteGame :gambling-score="score" :get-count="getCount" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'blackjack'" class="blackjack-main">
      <BlackjackGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'bird'" class="bird-main">
      <BirdGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'tetris'" class="tetris-main">
      <TetrisGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'dice'" class="dice-main">
      <DiceGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'memory'" class="memory-main">
      <MemoryCard :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'whack'" class="whack-main">
      <WhackAMole :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'rps'" class="rps-main">
      <RPSGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'scratch'" class="scratch-main">
      <ScratchCard :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'guess'" class="guess-main">
      <NumberGuess :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'plinko'" class="plinko-main">
      <PlinkoGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'battle'" class="battle-main">
      <DiceBattle :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'minecraft'" class="minecraft-main">
      <MinecraftPreClassic />
    </main>
    <main v-else-if="currentPage === 'minesweeper'" class="minesweeper-main">
      <Minesweeper :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'dino'" class="dino-main">
      <DinoGame :gambling-score="score" @update:gambling-score="score = $event" @score-gain="handleScoreGain" />
    </main>
    <main v-else-if="currentPage === 'bank'" class="bank-main">
      <BankPage 
        :gambling-score="score" 
        :loan-amount="loanAmount"
        :deposit-amount="depositAmount"
        :max-loan="maxLoan"
        @loan="takeLoan"
        @deposit="makeDeposit"
        @withdraw="withdrawDeposit"
        @repay="repayLoan"
      />
    </main>

    <footer class="footer">
      <p>🎰 博彩乐园 - 纯娱乐用途，请勿当真</p>
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
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo {
  font-size: 1.5rem;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.title-text {
  font-size: 1.3rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.home-btn {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
}

.home-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.score-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 107, 107, 0.2));
  border-radius: 20px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.score-icon {
  font-size: 1rem;
}

.score-num {
  font-size: 1rem;
  font-weight: bold;
  color: #ffd700;
}

/* 首页样式 */
.home-main {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.hero {
  position: relative;
  background: linear-gradient(145deg, rgba(45, 45, 68, 0.8), rgba(30, 30, 46, 0.8));
  border-radius: 24px;
  padding: 3rem 2rem;
  text-align: center;
  margin-bottom: 2rem;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 215, 0, 0.2);
  overflow: hidden;
}

.hero-content {
  position: relative;
  z-index: 2;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.title-icon {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hero-subtitle {
  font-size: 1.2rem;
  color: #aaa;
  margin-bottom: 2rem;
}

.hero-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.stat-label {
  font-size: 0.85rem;
  color: #888;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
}

.hero-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.float-icon {
  position: absolute;
  font-size: 2rem;
  opacity: 0.3;
  animation: float 3s ease-in-out infinite;
}

.float-1 { top: 20%; left: 10%; animation-delay: 0s; }
.float-2 { top: 30%; right: 15%; animation-delay: 0.5s; }
.float-3 { bottom: 30%; left: 20%; animation-delay: 1s; }
.float-4 { bottom: 20%; right: 20%; animation-delay: 1.5s; }
.float-5 { top: 50%; left: 50%; transform: translate(-50%, -50%); animation-delay: 2s; }

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(10deg); }
}

.section-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 1.5rem;
  text-align: center;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

/* 特色功能 */
.features {
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.feature-card {
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.8), rgba(26, 26, 40, 0.8));
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
  border-color: rgba(255, 215, 0, 0.3);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 0.8rem;
}

.feature-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.5rem;
}

.feature-desc {
  font-size: 0.9rem;
  color: #888;
}

/* 游戏列表 */
.games-section {
  margin-bottom: 2rem;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2rem;
}

.game-card {
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.9), rgba(26, 26, 40, 0.9));
  border-radius: 20px;
  padding: 1.5rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.game-card:hover {
  transform: translateY(-8px);
  border-color: rgba(255, 215, 0, 0.4);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.game-icon-wrap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to));
}

.game-icon {
  font-size: 1.8rem;
}

.game-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.5rem;
}

.game-desc {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 1rem;
}

.play-btn {
  padding: 0.6rem 1.2rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
}

.play-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  color: #ffd700;
}

/* 规则简介 */
.rules-intro {
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.8), rgba(26, 26, 40, 0.8));
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rules-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rules-content li {
  padding: 0.8rem 0;
  color: #ccc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.95rem;
}

.rules-content li:last-child {
  border-bottom: none;
}

.footer {
  text-align: center;
  padding: 1.5rem;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
}

/* 游戏页面容器 */
.slot-main, .snake-main, .roulette-main, .blackjack-main, .bird-main, .bank-main,
.tetris-main, .dice-main, .memory-main, .whack-main, .rps-main,
.scratch-main, .guess-main, .plinko-main, .battle-main, .minecraft-main, .minesweeper-main, .dino-main {
  flex: 1;
  width: 100%;
}

/* 响应式 */
@media (min-width: 768px) {
  .header {
    padding: 1rem 2rem;
  }
  
  .title-text {
    font-size: 1.5rem;
  }
  
  .home-main {
    padding: 3rem 2rem;
    max-width: 900px;
  }
  
  .hero {
    padding: 4rem 3rem;
  }
  
  .hero-title {
    font-size: 3rem;
  }
  
  .hero-subtitle {
    font-size: 1.4rem;
  }
  
  .features-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .games-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .section-title {
    font-size: 1.8rem;
  }
}

@media (min-width: 1024px) {
  .home-main {
    max-width: 1100px;
  }
  
  .hero {
    padding: 5rem 4rem;
  }
  
  .hero-title {
    font-size: 3.5rem;
  }
  
  .games-grid {
    grid-template-columns: repeat(7, 1fr);
  }
}
</style>