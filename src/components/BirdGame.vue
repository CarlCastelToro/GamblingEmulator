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

interface ChaosEvent {
  type: 'wind' | 'gravity' | 'speed' | 'reverse' | 'teleport' | 'shield' | 'size'
  x: number
  duration: number
  strength: number
  startTime: number
}

interface MovingObstacle {
  id: number
  x: number
  y: number
  width: number
  height: number
  speedY: number
  type: 'crusher' | 'floater'
}

interface PowerUp {
  id: number
  x: number
  y: number
  type: 'shield' | 'shrink' | 'magnify' | 'scoreBoost' | 'ghost'
  collected: boolean
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

const chaosEvents = ref<ChaosEvent[]>([])
const movingObstacles = ref<MovingObstacle[]>([])
const powerUps = ref<PowerUp[]>([])
const activeBuffs = ref<{ type: string; endTime: number }[]>([])
const windForce = ref(0)
const gravityMultiplier = ref(1)
const screenShake = ref(0)
const currentEvent = ref<{ text: string; color: string; time: number } | null>(null)
const birdSize = ref(BIRD_SIZE)
const birdX = ref(50)

let obstacleId = 0
let powerUpId = 0
let chaosEventLoop: number | null = null
let obstacleLoop: number | null = null
let powerUpLoop: number | null = null

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
  left: `${birdX.value}px`,
  width: `${birdSize.value}px`,
  height: `${birdSize.value}px`,
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
    
    const currentBirdSize = birdSize.value
    const birdLeft = birdX.value
    const birdRight = birdLeft + currentBirdSize
    const birdTop = birdY.value
    const birdBottom = birdY.value + currentBirdSize
    
    const hasShield = activeBuffs.value.some(b => b.type === 'shield')
    const isGhost = activeBuffs.value.some(b => b.type === 'ghost')
    
    const pipeLeft = pipe.x
    const pipeRight = pipe.x + PIPE_WIDTH
    
    const birdOverlapsPipe = birdRight > pipeLeft && birdLeft < pipeRight
    if (birdOverlapsPipe && !hasShield && !isGhost) {
      if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + pipe.gap) {
        gameOver.value = true
      }
    }
    
    if (pipeRight < birdLeft && !pipe['scored']) {
      let reward = config.rewardPerPipe
      if (isGamblingMode.value) {
        reward = Math.floor(reward * scoreVariance / 2)
        passedPipes.value++
      } else {
        passedPipes.value++
      }
      if (activeBuffs.value.some(b => b.type === 'scoreBoost')) {
        reward *= 2
      }
      score.value += reward
      pipe['scored'] = true
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
  gravity *= gravityMultiplier.value
  
  let currentWind = windForce.value
  if (isGamblingMode.value) {
    currentWind += (Math.random() - 0.5) * 0.3
  }
  
  birdVelocity.value += gravity
  birdVelocity.value += currentWind
  birdY.value += birdVelocity.value
  
  if (screenShake.value > 0) {
    screenShake.value *= 0.9
  }
  
  checkBuffs()
  
  const currentBirdSize = birdSize.value
  const birdLeft = birdX.value
  const birdRight = birdLeft + currentBirdSize
  const birdTop = birdY.value
  const birdBottom = birdY.value + currentBirdSize
  
  const hasShield = activeBuffs.value.some(b => b.type === 'shield')
  const isGhost = activeBuffs.value.some(b => b.type === 'ghost')
  
  if (!hasShield && !isGhost) {
    if (birdY.value < 0 || birdY.value > CANVAS_HEIGHT - currentBirdSize) {
      gameOver.value = true
    }
  } else {
    if (birdY.value < 0) birdY.value = 0
    if (birdY.value > CANVAS_HEIGHT - currentBirdSize) birdY.value = CANVAS_HEIGHT - currentBirdSize
  }
  
  checkObstacleCollision(birdLeft, birdRight, birdTop, birdBottom, hasShield, isGhost)
  checkPowerUpCollection(birdLeft, birdRight, birdTop, birdBottom)
  checkChaosEvents(birdLeft, birdRight, birdTop, birdBottom)
}

const checkBuffs = () => {
  const now = Date.now()
  activeBuffs.value = activeBuffs.value.filter(buff => {
    if (now > buff.endTime) {
      if (buff.type === 'shrink') {
        birdSize.value = BIRD_SIZE
      } else if (buff.type === 'magnify') {
        birdSize.value = BIRD_SIZE
      }
      return false
    }
    return true
  })
}

const checkObstacleCollision = (birdLeft: number, birdRight: number, birdTop: number, birdBottom: number, hasShield: boolean, isGhost: boolean) => {
  movingObstacles.value.forEach(obs => {
    const obsLeft = obs.x
    const obsRight = obs.x + obs.width
    const obsTop = obs.y
    const obsBottom = obs.y + obs.height
    
    if (birdRight > obsLeft && birdLeft < obsRight && birdBottom > obsTop && birdTop < obsBottom) {
      if (hasShield) {
        activeBuffs.value = activeBuffs.value.filter(b => b.type !== 'shield')
        showChaosEvent('🛡️ 护盾碎了!', '#ff6b6b')
        screenShake.value = 10
      } else if (!isGhost) {
        gameOver.value = true
      }
    }
  })
}

const checkPowerUpCollection = (birdLeft: number, birdRight: number, birdTop: number, birdBottom: number) => {
  powerUps.value.forEach(pu => {
    if (pu.collected) return
    const puCenterX = pu.x + 15
    const puCenterY = pu.y + 15
    const birdCenterX = birdLeft + birdSize.value / 2
    const birdCenterY = birdTop + birdSize.value / 2
    const dist = Math.sqrt((puCenterX - birdCenterX) ** 2 + (puCenterY - birdCenterY) ** 2)
    
    if (dist < 30) {
      pu.collected = true
      applyPowerUp(pu.type)
    }
  })
}

const applyPowerUp = (type: string) => {
  const duration = 8000 + Math.random() * 7000
  switch (type) {
    case 'shield':
      activeBuffs.value.push({ type: 'shield', endTime: Date.now() + duration })
      showChaosEvent('🛡️ 护盾激活!', '#4CAF50')
      break
    case 'shrink':
      activeBuffs.value.push({ type: 'shrink', endTime: Date.now() + duration })
      birdSize.value = BIRD_SIZE * 0.6
      showChaosEvent('🌀 缩小!', '#2196F3')
      break
    case 'magnify':
      activeBuffs.value.push({ type: 'magnify', endTime: Date.now() + duration })
      birdSize.value = BIRD_SIZE * 1.5
      showChaosEvent('⚠️ 变大!', '#ff9800')
      break
    case 'scoreBoost':
      activeBuffs.value.push({ type: 'scoreBoost', endTime: Date.now() + duration })
      showChaosEvent('💰 得分翻倍!', '#FFD700')
      break
    case 'ghost':
      activeBuffs.value.push({ type: 'ghost', endTime: Date.now() + duration })
      showChaosEvent('👻 幽灵模式!', '#9C27B0')
      break
  }
}

const checkChaosEvents = (birdLeft: number, birdRight: number, birdTop: number, birdBottom: number) => {
  chaosEvents.value = chaosEvents.value.filter(event => {
    const elapsed = Date.now() - event.startTime
    if (elapsed > event.duration) {
      windForce.value = 0
      gravityMultiplier.value = 1
      return false
    }
    
    const eventCenterX = event.x + 25
    if (birdRight > event.x && birdLeft < event.x + 50) {
      switch (event.type) {
        case 'wind':
          windForce.value = event.strength
          break
        case 'gravity':
          gravityMultiplier.value = event.strength
          break
        case 'reverse':
          birdVelocity.value = -birdVelocity.value * 0.5
          showChaosEvent('🔄 反向!', '#E91E63')
          break
        case 'teleport':
          birdY.value = Math.random() * (CANVAS_HEIGHT - birdSize.value)
          showChaosEvent('🌀 传送!', '#00BCD4')
          break
      }
    }
    return true
  })
}

const showChaosEvent = (text: string, color: string) => {
  currentEvent.value = { text, color, time: Date.now() }
  setTimeout(() => {
    if (currentEvent.value && Date.now() - currentEvent.value.time > 1500) {
      currentEvent.value = null
    }
  }, 2000)
}

const spawnChaosEvent = () => {
  if (gameOver.value || isPaused.value || !isGamblingMode.value) return
  
  const eventTypes: ChaosEvent['type'][] = ['wind', 'gravity', 'reverse', 'teleport']
  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]!
  const x = CANVAS_WIDTH + 50
  let strength = 0
  let duration = 3000
  
  switch (type) {
    case 'wind':
      strength = (Math.random() - 0.5) * 2
      break
    case 'gravity':
      strength = 0.5 + Math.random() * 1.5
      if (Math.random() > 0.5) strength = -strength
      duration = 2000 + Math.random() * 3000
      break
  }
  
  chaosEvents.value.push({
    type,
    x,
    duration,
    strength,
    startTime: Date.now()
  })
}

const spawnMovingObstacle = () => {
  if (gameOver.value || isPaused.value || !isGamblingMode.value) return
  
  const type = Math.random() > 0.5 ? 'crusher' : 'floater'
  const y = type === 'crusher' 
    ? Math.random() > 0.5 ? -50 : CANVAS_HEIGHT + 50
    : Math.random() * (CANVAS_HEIGHT - 100)
  
  movingObstacles.value.push({
    id: obstacleId++,
    x: CANVAS_WIDTH + 50,
    y,
    width: 40,
    height: 40,
    speedY: (Math.random() - 0.5) * 4,
    type
  })
}

const updateMovingObstacles = () => {
  if (gameOver.value || isPaused.value) return
  
  let speed = PIPE_SPEED
  if (isGamblingMode.value) speed *= birdSpeedVariance
  
  movingObstacles.value = movingObstacles.value.filter(obs => {
    obs.x -= speed
    obs.y += obs.speedY
    
    if (obs.type === 'floater') {
      if (obs.y < 0 || obs.y > CANVAS_HEIGHT - obs.height) {
        obs.speedY = -obs.speedY
      }
    }
    
    return obs.x > -obs.width
  })
}

const spawnPowerUp = () => {
  if (gameOver.value || isPaused.value || !isGamblingMode.value) return
  
  const types: PowerUp['type'][] = ['shield', 'shrink', 'magnify', 'scoreBoost', 'ghost']
  const type = types[Math.floor(Math.random() * types.length)]!
  
  powerUps.value.push({
    id: powerUpId++,
    x: CANVAS_WIDTH + 50,
    y: 50 + Math.random() * (CANVAS_HEIGHT - 150),
    type,
    collected: false
  })
}

const updatePowerUps = () => {
  if (gameOver.value || isPaused.value) return
  
  let speed = PIPE_SPEED
  if (isGamblingMode.value) speed *= birdSpeedVariance
  
  powerUps.value = powerUps.value.filter(pu => {
    pu.x -= speed
    return pu.x > -30 && !pu.collected
  })
}

const gameUpdate = () => {
  if (gameOver.value || isPaused.value) return
  
  updateBird()
  updatePipes()
  if (isGamblingMode.value) {
    updateMovingObstacles()
    updatePowerUps()
  }
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
  
  chaosEvents.value = []
  movingObstacles.value = []
  powerUps.value = []
  activeBuffs.value = []
  windForce.value = 0
  gravityMultiplier.value = 1
  screenShake.value = 0
  birdSize.value = BIRD_SIZE
  birdX.value = 50
  currentEvent.value = null
  
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
  if (chaosEventLoop) clearInterval(chaosEventLoop)
  if (obstacleLoop) clearInterval(obstacleLoop)
  if (powerUpLoop) clearInterval(powerUpLoop)
  
  gameLoop = window.setInterval(gameUpdate, 16)
  spawnLoop = window.setInterval(spawnPipe, SPAWN_INTERVAL)
  
  if (isGamblingMode.value) {
    chaosEventLoop = window.setInterval(spawnChaosEvent, 3000 + Math.random() * 4000)
    obstacleLoop = window.setInterval(spawnMovingObstacle, 2500 + Math.random() * 3000)
    powerUpLoop = window.setInterval(spawnPowerUp, 5000 + Math.random() * 5000)
  }
  
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
  if (chaosEventLoop) clearInterval(chaosEventLoop)
  if (obstacleLoop) clearInterval(obstacleLoop)
  if (powerUpLoop) clearInterval(powerUpLoop)
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
        <span class="value">{{ Math.floor(score) }}</span>
      </div>
      <div class="high-score">
        <span class="label">最高分:</span>
        <span class="value">{{ Math.floor(highScore) }}</span>
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
      :class="{ 'screen-shake': screenShake > 1 }"
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
          :class="{ 
            'flapping': !isPaused && gameStarted,
            'has-shield': activeBuffs.some(b => b.type === 'shield'),
            'is-ghost': activeBuffs.some(b => b.type === 'ghost'),
            'is-shrunk': activeBuffs.some(b => b.type === 'shrink'),
            'is-magnified': activeBuffs.some(b => b.type === 'magnify')
          }"
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
        
        <!-- 混沌事件 -->
        <div 
          v-for="event in chaosEvents" 
          :key="'event-' + event.x + event.type"
          class="chaos-event"
          :class="event.type"
          :style="{ left: event.x + 'px' }"
        >
          <span v-if="event.type === 'wind'">💨</span>
          <span v-else-if="event.type === 'gravity'">🌀</span>
          <span v-else-if="event.type === 'reverse'">🔄</span>
          <span v-else-if="event.type === 'teleport'">🌀</span>
        </div>
        
        <!-- 移动障碍物 -->
        <div 
          v-for="obs in movingObstacles" 
          :key="'obs-' + obs.id"
          class="moving-obstacle"
          :class="obs.type"
          :style="{ 
            left: obs.x + 'px', 
            top: obs.y + 'px',
            width: obs.width + 'px',
            height: obs.height + 'px'
          }"
        >
          <span v-if="obs.type === 'crusher'">⚡</span>
          <span v-else-if="obs.type === 'floater'">👾</span>
        </div>
        
        <!-- 能量道具 -->
        <div 
          v-for="pu in powerUps" 
          :key="'pu-' + pu.id"
          class="power-up"
          :class="[pu.type, { collected: pu.collected }]"
          :style="{ left: pu.x + 'px', top: pu.y + 'px' }"
        >
          <span v-if="pu.type === 'shield'">🛡️</span>
          <span v-else-if="pu.type === 'shrink'">🌀</span>
          <span v-else-if="pu.type === 'magnify'">⚠️</span>
          <span v-else-if="pu.type === 'scoreBoost'">💰</span>
          <span v-else-if="pu.type === 'ghost'">👻</span>
        </div>
        
        <!-- 活跃BUFF指示 -->
        <div v-if="activeBuffs.length > 0" class="buff-indicator">
          <span 
            v-for="(buff, idx) in activeBuffs" 
            :key="idx"
            class="buff-icon"
            :class="buff.type"
          >
            <span v-if="buff.type === 'shield'">🛡️</span>
            <span v-else-if="buff.type === 'shrink'">🌀</span>
            <span v-else-if="buff.type === 'magnify'">⚠️</span>
            <span v-else-if="buff.type === 'scoreBoost'">💰</span>
            <span v-else-if="buff.type === 'ghost'">👻</span>
          </span>
        </div>
        
        <!-- 当前事件提示 -->
        <div v-if="currentEvent" class="chaos-event-popup" :style="{ color: currentEvent.color }">
          {{ currentEvent.text }}
        </div>
        
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
          <li>⚡ 混沌事件: 风力、重力突变、反向、随机传送</li>
          <li>💀 移动障碍物: 粉碎者和漂浮者</li>
          <li>🎁 能量道具: 护盾、缩小、放大、得分翻倍、幽灵模式</li>
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

.bird.has-shield {
  filter: drop-shadow(0 0 10px #4CAF50);
}

.bird.is-ghost {
  opacity: 0.5;
  filter: blur(1px);
}

.bird.is-shrunk {
  filter: hue-rotate(180deg);
}

.bird.is-magnified {
  filter: hue-rotate(90deg);
}

.screen-shake {
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px) rotate(-1deg); }
  75% { transform: translateX(5px) rotate(1deg); }
}

.chaos-event {
  position: absolute;
  width: 50px;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  pointer-events: none;
  animation: chaosFade 3s ease-out forwards;
}

.chaos-event.wind {
  background: linear-gradient(180deg, transparent, rgba(135, 206, 235, 0.3), transparent);
}

.chaos-event.gravity {
  background: linear-gradient(180deg, transparent, rgba(255, 105, 180, 0.3), transparent);
}

@keyframes chaosFade {
  0% { opacity: 0.3; }
  50% { opacity: 0.8; }
  100% { opacity: 0; }
}

.moving-obstacle {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border-radius: 8px;
  transition: top 0.1s linear;
}

.moving-obstacle.crusher {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  box-shadow: 0 0 15px rgba(255, 107, 107, 0.5);
  animation: crusherPulse 0.5s infinite;
}

.moving-obstacle.floater {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
  box-shadow: 0 0 10px rgba(155, 89, 182, 0.5);
}

@keyframes crusherPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.power-up {
  position: absolute;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 50%;
  animation: powerUpGlow 1s ease-in-out infinite, powerUpFloat 2s ease-in-out infinite;
}

.power-up.collected {
  opacity: 0;
  transform: scale(0);
  transition: all 0.3s;
}

.power-up.shield {
  background: radial-gradient(circle, rgba(76, 175, 80, 0.8), transparent);
}

.power-up.shrink {
  background: radial-gradient(circle, rgba(33, 150, 243, 0.8), transparent);
}

.power-up.magnify {
  background: radial-gradient(circle, rgba(255, 152, 0, 0.8), transparent);
}

.power-up.scoreBoost {
  background: radial-gradient(circle, rgba(255, 215, 0, 0.8), transparent);
}

.power-up.ghost {
  background: radial-gradient(circle, rgba(156, 39, 176, 0.8), transparent);
}

@keyframes powerUpGlow {
  0%, 100% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
}

@keyframes powerUpFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.buff-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 5px;
  z-index: 100;
}

.buff-icon {
  font-size: 20px;
  animation: buffPulse 1s ease-in-out infinite;
}

@keyframes buffPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

.chaos-event-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: bold;
  text-shadow: 0 0 20px currentColor;
  animation: chaosPopup 2s ease-out forwards;
  pointer-events: none;
  z-index: 200;
}

@keyframes chaosPopup {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
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