<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

// 计算最终奖励（用于显示）
const finalReward = computed(() => {
  let reward = score.value
  
  if (isGamblingMode.value) {
    reward += score.value
    const penalty = Math.max(0, Math.floor(300 - (passedPipes.value / 15) * 300))
    reward -= penalty
  }
  
  return reward
})

interface Pipe {
  id: number
  x: number
  topHeight: number
  gap: number
  scored: boolean
}

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 400
const BIRD_SIZE = 30
const BASE_GRAVITY = 0.5
const BASE_JUMP_FORCE = -10
const PIPE_SPEED = 3
const BASE_PIPE_GAP = 120
const PIPE_WIDTH = 50
const SPAWN_INTERVAL = 1500

const birdY = ref(CANVAS_HEIGHT / 2)
const birdVelocity = ref(0)
const pipes = ref<Pipe[]>([])
const score = ref(0)
const gameOver = ref(false)
const isPaused = ref(false)
const gameStarted = ref(false)
const highScore = ref(parseInt(localStorage.getItem('bird_high_score') || '0'))
const difficulty = ref<'easy' | 'hard'>('hard')
const isGamblingMode = ref(false)
const passedPipes = ref(0)

// 赌模式随机因子（每次游戏开始时生成）
let pipeGapVariance = 1
let birdSpeedVariance = 1
let jumpHeightVariance = 1
let scoreVariance = 1

// 难度配置
const difficultyConfig = {
  easy: {
    name: '简单',
    pipeGap: BASE_PIPE_GAP + 50,
    gravity: BASE_GRAVITY * 0.8,
    jumpForce: BASE_JUMP_FORCE * 0.8,
    rewardPerPipe: 5,
    reviveCost: 30
  },
  hard: {
    name: '困难',
    pipeGap: BASE_PIPE_GAP,
    gravity: BASE_GRAVITY,
    jumpForce: BASE_JUMP_FORCE,
    rewardPerPipe: 50,
    reviveCost: 50
  }
}

let gameLoop: number | null = null
let spawnLoop: number | null = null
let pipeId = 0

const birdStyle = computed(() => ({
  top: `${birdY.value}px`,
  transition: gameStarted.value ? 'none' : 'top 0.3s ease'
}))

const pipeStyle = (pipe: Pipe) => ({
  left: `${pipe.x}px`,
  height: `${pipe.topHeight}px`
})

const bottomPipeStyle = (pipe: Pipe) => ({
  left: `${pipe.x}px`,
  top: `${pipe.topHeight + pipe.gap}px`,
  height: `${CANVAS_HEIGHT - pipe.topHeight - pipe.gap}px`
})

const jump = () => {
  if (gameOver.value || isPaused.value) return
  if (!gameStarted.value) {
    startGame()
    return
  }
  let jumpForce = difficultyConfig[difficulty.value].jumpForce
  if (isGamblingMode.value) {
    jumpForce *= jumpHeightVariance
  }
  birdVelocity.value = jumpForce
}

const spawnPipe = () => {
  if (gameOver.value || isPaused.value) return
  
  const config = difficultyConfig[difficulty.value]
  let pipeGap = config.pipeGap
  if (isGamblingMode.value) {
    pipeGap *= pipeGapVariance
  }
  const minHeight = 60
  const maxHeight = CANVAS_HEIGHT - pipeGap - minHeight
  const topHeight = Math.random() * maxHeight + minHeight
  
  pipes.value.push({
    id: pipeId++,
    x: CANVAS_WIDTH,
    topHeight,
    gap: pipeGap,
    scored: false
  })
}

const updatePipes = () => {
  const config = difficultyConfig[difficulty.value]
  
  pipes.value = pipes.value.filter(pipe => {
    let speed = PIPE_SPEED
    if (isGamblingMode.value) {
      speed *= birdSpeedVariance
    }
    pipe.x -= speed
    
    // 检查得分
    if (pipe.x + PIPE_WIDTH < BIRD_SIZE && !pipe['scored']) {
      let reward = config.rewardPerPipe
      if (isGamblingMode.value) {
        reward = Math.floor(reward * scoreVariance / 2)
        passedPipes.value++
      } else {
        passedPipes.value++
      }
      score.value += reward
      pipe['scored'] = true
    }
    
    // 碰撞检测
    const birdLeft = 50
    const birdRight = birdLeft + BIRD_SIZE
    const birdTop = birdY.value
    const birdBottom = birdY.value + BIRD_SIZE
    
    const pipeLeft = pipe.x
    const pipeRight = pipe.x + PIPE_WIDTH
    
    if (
      birdRight > pipeLeft &&
      birdLeft < pipeRight
    ) {
      if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + pipe.gap) {
        gameOver.value = true
        return false
      }
    }
    
    return pipe.x > -PIPE_WIDTH
  })
}

const updateBird = () => {
  const config = difficultyConfig[difficulty.value]
  let gravity = config.gravity
  if (isGamblingMode.value) {
    gravity *= birdSpeedVariance
  }
  birdVelocity.value += gravity
  birdY.value += birdVelocity.value
  
  // 边界检测
  if (birdY.value < 0) {
    birdY.value = 0
    birdVelocity.value = 0
    gameOver.value = true
  }
  if (birdY.value > CANVAS_HEIGHT - BIRD_SIZE) {
    birdY.value = CANVAS_HEIGHT - BIRD_SIZE
    birdVelocity.value = 0
    gameOver.value = true
  }
}

const gameUpdate = () => {
  if (gameOver.value || isPaused.value) return
  
  updateBird()
  updatePipes()
}

const startGame = () => {
  birdY.value = CANVAS_HEIGHT / 2
  birdVelocity.value = 0
  pipes.value = []
  score.value = 0
  passedPipes.value = 0
  gameOver.value = false
  isPaused.value = false
  gameStarted.value = true
  
  // 初始化赌模式随机因子
  if (isGamblingMode.value) {
    // 柱子间隙随机浮动 -20% ~ 20%
    pipeGapVariance = 0.8 + Math.random() * 0.4
    // 鸟的飞行速度随机浮动 -30% ~ 30%
    birdSpeedVariance = 0.7 + Math.random() * 0.6
    // 鸟的跳跃高度随机浮动 -30% ~ 30%
    jumpHeightVariance = 0.7 + Math.random() * 0.6
    // 柱子获得的积分随机浮动 -75% ~ 150%
    scoreVariance = 0.25 + Math.random() * 2.5
  } else {
    pipeGapVariance = 1
    birdSpeedVariance = 1
    jumpHeightVariance = 1
    scoreVariance = 1
  }
  
  if (gameLoop) clearInterval(gameLoop)
  if (spawnLoop) clearInterval(spawnLoop)
  
  gameLoop = window.setInterval(gameUpdate, 16)
  spawnLoop = window.setInterval(spawnPipe, SPAWN_INTERVAL)
  
  // 立即生成第一个管道
  setTimeout(spawnPipe, 500)
}

const togglePause = () => {
  if (!gameOver.value && gameStarted.value) {
    isPaused.value = !isPaused.value
  }
}

const handleClick = () => {
  if (!gameOver.value) {
    jump()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    if (!gameOver.value) {
      jump()
    }
  } else if (e.code === 'KeyP') {
    togglePause()
  } else if (e.code === 'Enter' && gameOver.value) {
    startGame()
  }
}

const reviveBird = () => {
  const config = difficultyConfig[difficulty.value]
  if (props.gamblingScore < config.reviveCost) return
  
  emit('update:gamblingScore', props.gamblingScore - config.reviveCost)
  startGame()
}

const claimReward = () => {
  let reward = score.value
  
  if (isGamblingMode.value) {
    // 结束游戏后额外获得等同于得分的积分
    reward += score.value
    
    // 死亡惩罚：立即扣除300击分，随通过柱子数线性减少，第15个柱子时为0
    const penalty = Math.max(0, Math.floor(300 - (passedPipes.value / 15) * 300))
    reward -= penalty
  }
  
  emit('update:gamblingScore', props.gamblingScore + reward)
  startGame()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (gameLoop) clearInterval(gameLoop)
  if (spawnLoop) clearInterval(spawnLoop)
})

// 更新最高分
watch(score, (newScore) => {
  if (newScore > highScore.value) {
    highScore.value = newScore
    localStorage.setItem('bird_high_score', newScore.toString())
  }
})
</script>

<template>
  <div class="bird-game">
    <h1 class="game-title">🐦 读博鸟</h1>
    
    <div class="game-info">
      <div class="score-display">
        <span class="label">得分:</span>
        <span class="value">{{ score }}</span>
      </div>
      <div class="high-score">
        <span class="label">最高分:</span>
        <span class="value">{{ highScore }}</span>
      </div>
      <div class="difficulty-selector">
        <span class="difficulty-label">难度:</span>
        <div class="difficulty-buttons">
          <button 
            class="diff-btn" 
            :class="{ active: difficulty === 'easy' }"
            @click="difficulty = 'easy'"
          >
            🌱 简单
          </button>
          <button 
            class="diff-btn" 
            :class="{ active: difficulty === 'hard' }"
            @click="difficulty = 'hard'"
          >
            🔥 困难
          </button>
        </div>
      </div>
      <div class="gambling-toggle">
        <span class="gambling-label">赌:</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="isGamblingMode" />
          <span class="toggle-slider" :class="{ gambling: isGamblingMode }"></span>
        </label>
      </div>
      <button v-if="gameStarted && !gameOver" class="pause-btn" @click="togglePause">
        {{ isPaused ? '▶️' : '⏸️' }}
      </button>
    </div>
    
    <div 
      class="game-container"
      @click="handleClick"
      @touchstart.prevent="handleClick"
    >
      <div class="game-area">
        <!-- 背景装饰 -->
        <div class="background">
          <div class="cloud cloud-1"></div>
          <div class="cloud cloud-2"></div>
          <div class="cloud cloud-3"></div>
        </div>
        
        <!-- 鸟 -->
        <div 
          class="bird" 
          :class="{ 'flapping': !isPaused && gameStarted }"
          :style="birdStyle"
        >
          <div class="bird-body">🐦</div>
        </div>
        
        <!-- 管道 -->
        <div 
          v-for="pipe in pipes" 
          :key="pipe.id"
          class="pipe top-pipe"
          :style="pipeStyle(pipe)"
        ></div>
        <div 
          v-for="pipe in pipes" 
          :key="'bottom-' + pipe.id"
          class="pipe bottom-pipe"
          :style="bottomPipeStyle(pipe)"
        ></div>
        
        <!-- 开始提示 -->
        <div v-if="!gameStarted" class="start-overlay">
          <div class="start-content">
            <p>点击屏幕或按空格键开始</p>
            <p class="hint">点击游戏区域控制小鸟飞行</p>
          </div>
        </div>
        
        <!-- 暂停提示 -->
        <div v-if="isPaused && !gameOver" class="pause-overlay">
          <div class="pause-content">
            <h2>游戏暂停</h2>
            <p>按 P 键继续</p>
          </div>
        </div>
        
        <!-- 游戏结束 -->
        <div v-if="gameOver" class="game-over-overlay">
          <div class="game-over-content">
            <h2>💥 游戏结束</h2>
            <p>最终得分: {{ score }}</p>
            <p v-if="isGamblingMode" class="gambling-bonus">
              🎰 赌模式: 双倍奖励 +{{ score }}，惩罚 -{{ Math.max(0, Math.floor(300 - (passedPipes / 15) * 300)) }}
            </p>
            <p v-if="score >= highScore && score > 0" class="new-record">🎉 新纪录！</p>
            <div class="end-buttons">
              <button 
                v-if="props.gamblingScore >= difficultyConfig[difficulty].reviveCost" 
                class="revive-btn" 
                @click.stop="reviveBird"
              >
                💀 花费{{ difficultyConfig[difficulty].reviveCost }}击分复活
              </button>
              <button class="restart-btn" @click.stop="claimReward">
                💰 领取奖励 ({{ finalReward > 0 ? '+' : '' }}{{ finalReward }}击分)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="instructions">
      <h3>游戏说明</h3>
      <ul>
        <li>🖱️ 点击游戏区域让小鸟跳跃</li>
        <li>⌨️ 空格键或↑键控制跳跃</li>
        <li>P 键暂停/继续游戏</li>
        <li>🎯 穿过管道获得分数（根据难度）</li>
        <li>💰 游戏结束时分数直接兑换击分</li>
        <li>💀 可花费击分复活继续游戏</li>
        <li>🎰 开启「赌」模式获得更高风险与回报</li>
      </ul>
      <div class="difficulty-info">
        <h4>🌱 简单难度</h4>
        <ul>
          <li>• 管道间隙: 170px（较宽）</li>
          <li>• 下落速度: 减缓20%</li>
          <li>• 跳跃高度: 减少20%</li>
          <li>• 每根管道: +5击分</li>
          <li>• 复活费用: 30击分</li>
        </ul>
        <h4>🔥 困难难度</h4>
        <ul>
          <li>• 管道间隙: 120px（较窄）</li>
          <li>• 下落速度: 正常</li>
          <li>• 跳跃高度: 正常</li>
          <li>• 每根管道: +50击分</li>
          <li>• 复活费用: 50击分</li>
        </ul>
        <h4>🎰 赌模式</h4>
        <ul>
          <li>• 得分减半，但结束时额外获得同等得分</li>
          <li>• 柱子间隙随机浮动 -20% ~ +20%</li>
          <li>• 鸟飞行速度随机浮动 -30% ~ +30%</li>
          <li>• 鸟跳跃高度随机浮动 -30% ~ +30%</li>
          <li>• 每根管道积分随机浮动 -75% ~ +150%</li>
          <li>• 死亡惩罚: 300击分，随通过柱子数线性减少至0（第15根）</li>
        </ul>
      </div>
    </div>
    
    <div class="gambling-info">
      <span class="gambling-label">💰 击分:</span>
      <span class="gambling-value">{{ props.gamblingScore }}</span>
    </div>
  </div>
</template>

<style scoped>
.bird-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
}

.game-title {
  font-size: 1.8rem;
  color: #FFD700;
  margin-bottom: 1rem;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.game-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 400px;
  margin-bottom: 1rem;
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  box-sizing: border-box;
}

.score-display,
.high-score {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.score-display .label,
.high-score .label {
  color: #888;
  font-size: 0.9rem;
}

.score-display .value {
  color: #4CAF50;
  font-size: 1.4rem;
  font-weight: bold;
}

.high-score .value {
  color: #FFD700;
  font-size: 1.4rem;
  font-weight: bold;
}

.pause-btn {
  padding: 0.5rem 1rem;
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.pause-btn:hover {
  background: #444;
}

.difficulty-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.difficulty-label {
  color: #888;
  font-size: 0.8rem;
}

.difficulty-buttons {
  display: flex;
  gap: 0.4rem;
}

.diff-btn {
  padding: 0.3rem 0.6rem;
  background: #333;
  color: #888;
  border: 1px solid #444;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.diff-btn:hover {
  background: #444;
  color: #fff;
}

.diff-btn.active {
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  border-color: #4CAF50;
}

.diff-btn.active:last-child {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  border-color: #ff6b6b;
}

.gambling-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.gambling-label {
  color: #888;
  font-size: 0.8rem;
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
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.toggle-slider.gambling {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  box-shadow: 0 0 15px rgba(240, 147, 251, 0.5);
}

.game-container {
  position: relative;
  width: 100%;
  max-width: 400px;
  cursor: pointer;
}

.game-area {
  position: relative;
  width: 400px;
  height: 400px;
  background: linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  border: 3px solid #2d5a7b;
}

.background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
}

.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  background: inherit;
  border-radius: inherit;
}

.cloud-1 {
  width: 60px;
  height: 30px;
  top: 60px;
  animation: cloudMove 20s linear infinite;
}

.cloud-1::before {
  width: 35px;
  height: 35px;
  top: -18px;
  left: 10px;
}

.cloud-1::after {
  width: 25px;
  height: 25px;
  top: -10px;
  left: 35px;
}

.cloud-2 {
  width: 80px;
  height: 40px;
  top: 120px;
  animation: cloudMove 25s linear infinite;
  animation-delay: -8s;
}

.cloud-2::before {
  width: 45px;
  height: 45px;
  top: -22px;
  left: 15px;
}

.cloud-2::after {
  width: 35px;
  height: 35px;
  top: -15px;
  left: 50px;
}

.cloud-3 {
  width: 50px;
  height: 25px;
  top: 200px;
  animation: cloudMove 18s linear infinite;
  animation-delay: -15s;
}

.cloud-3::before {
  width: 30px;
  height: 30px;
  top: -15px;
  left: 8px;
}

.cloud-3::after {
  width: 20px;
  height: 20px;
  top: -8px;
  left: 28px;
}

@keyframes cloudMove {
  0% {
    left: -100px;
  }
  100% {
    left: 500px;
  }
}

.bird {
  position: absolute;
  left: 50px;
  width: 30px;
  height: 30px;
  transition: transform 0.1s;
}

.bird.flapping {
  animation: flap 0.3s ease-in-out infinite;
}

.bird-body {
  font-size: 28px;
  line-height: 30px;
  text-align: center;
  transform: scaleX(-1);
}

@keyframes flap {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.pipe {
  position: absolute;
  width: 50px;
  background: linear-gradient(90deg, #2d5a27, #3d7a37, #2d5a27);
  border-radius: 5px;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
}

.top-pipe {
  top: 0;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.bottom-pipe {
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.start-overlay,
.pause-overlay,
.game-over-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.start-content,
.pause-content,
.game-over-content {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(145deg, #2a2a40, #1f1f30);
  border-radius: 12px;
  border: 2px solid #FFD700;
}

.pause-content {
  border-color: #4CAF50;
}

.game-over-content {
  border-color: #ff6b6b;
}

.start-content p {
  color: #ccc;
  margin: 0.5rem 0;
  font-size: 1rem;
}

.start-content .hint {
  font-size: 0.85rem;
  color: #888;
}

.pause-content h2,
.game-over-content h2 {
  color: #FFD700;
  margin-bottom: 0.8rem;
  font-size: 1.4rem;
}

.game-over-content h2 {
  color: #ff6b6b;
}

.pause-content p,
.game-over-content p {
  color: #ccc;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.new-record {
  color: #FFD700 !important;
  font-weight: bold;
  animation: pulse 0.5s infinite;
}

.gambling-bonus {
  color: #f093fb !important;
  font-size: 0.85rem !important;
  background: rgba(240, 147, 251, 0.1);
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(240, 147, 251, 0.3);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.end-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1rem;
}

.revive-btn {
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.revive-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.5);
}

.revive-btn:disabled {
  background: #444;
  cursor: not-allowed;
}

.restart-btn {
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.restart-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.5);
}

.instructions {
  margin-top: 1.2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
}

.instructions h3 {
  color: #FFD700;
  margin-bottom: 0.6rem;
  font-size: 0.95rem;
}

.instructions ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.instructions li {
  color: #ccc;
  padding: 0.3rem 0;
  font-size: 0.85rem;
}

.difficulty-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.difficulty-info h4 {
  color: #4CAF50;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
}

.difficulty-info h4:nth-child(3) {
  color: #ff6b6b;
  margin-top: 0.8rem;
}

.difficulty-info h4:last-of-type {
  color: #f093fb;
  margin-top: 0.8rem;
}

.difficulty-info ul {
  margin-bottom: 0.4rem;
}

.difficulty-info li {
  font-size: 0.75rem;
  color: #aaa;
}

.gambling-info {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.15), rgba(255, 173, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.gambling-label {
  color: #ccc;
  font-size: 1rem;
}

.gambling-value {
  color: #FFD700;
  font-size: 1.5rem;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

@media (max-width: 440px) {
  .game-area {
    width: 100%;
    max-width: 400px;
    height: auto;
    aspect-ratio: 1;
  }
  
  .game-title {
    font-size: 1.4rem;
  }
  
  .game-info {
    flex-wrap: wrap;
    gap: 0.6rem;
    justify-content: center;
  }
}
</style>