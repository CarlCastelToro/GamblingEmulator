<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 250
const GROUND_Y = 200
const DINO_WIDTH = 44
const DINO_HEIGHT = 48
const GRAVITY = 0.6
const JUMP_FORCE = -12
const INITIAL_SPEED = 6
const MAX_SPEED = 15
const SPEED_INCREMENT = 0.001
const OBSTACLE_INTERVAL_MIN = 800
const OBSTACLE_INTERVAL_MAX = 2000

interface Obstacle {
  x: number
  width: number
  height: number
  type: 'cactus' | 'bird' | 'fireball' | 'laser' | 'portal'
  birdY?: number
  speed?: number
  active?: boolean
  color?: string
}

interface PowerUp {
  x: number
  y: number
  type: 'shield' | 'magnet' | 'slowmo' | 'doublejump' | 'shrink' | 'nuke'
  collected: boolean
  duration: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface ChaosEvent {
  type: string
  duration: number
  startTime: number
  intensity: number
}

const canvas = ref<HTMLCanvasElement | null>(null)
const dinoY = ref(GROUND_Y - DINO_HEIGHT)
const dinoVelocity = ref(0)
const isJumping = ref(false)
const isDucking = ref(false)
const obstacles = ref<Obstacle[]>([])
const powerUps = ref<PowerUp[]>([])
const particles = ref<Particle[]>([])
const score = ref(0)
const highScore = ref(parseInt(localStorage.getItem('dino_high_score') || '0'))
const chaosHighScore = ref(parseInt(localStorage.getItem('dino_chaos_high_score') || '0'))
const gameSpeed = ref(INITIAL_SPEED)
const gameOver = ref(false)
const gameStarted = ref(false)
const isPaused = ref(false)
const isGamblingMode = ref(false)
const isChaosMode = ref(false)
const gamblingBet = ref(100)
const distanceTraveled = ref(0)
const combo = ref(0)
const comboTimer = ref(0)
const screenShake = ref(0)
const screenFlash = ref(0)
const gravityDir = ref(1)
const activePowerUps = ref<{ type: string; endTime: number }[]>([])
const chaosEvents = ref<ChaosEvent[]>([])
const chaosMeter = ref(0)
const lives = ref(3)
const maxLives = 3
const invincibilityFrames = ref(0)
const damageFlash = ref(0)
const doubleJumpAvailable = ref(false)
const hasDoubleJumped = ref(false)
const dinoScale = ref(1)
const dinoTrail = ref<{ x: number; y: number; alpha: number }[]>([])
const bgHue = ref(0)
const warningFlash = ref(0)

let animationId: number | null = null
let lastObstacleTime = 0
let nextObstacleTime = 0
let frameCount = 0
let lastChaosEventTime = 0
let lastPowerUpTime = 0

const displayScore = computed(() => Math.floor(score.value))

const hasShield = computed(() => activePowerUps.value.some(p => p.type === 'shield' && Date.now() < p.endTime))
const hasMagnet = computed(() => activePowerUps.value.some(p => p.type === 'magnet' && Date.now() < p.endTime))
const hasSlowMo = computed(() => activePowerUps.value.some(p => p.type === 'slowmo' && Date.now() < p.endTime))
const isShrunk = computed(() => activePowerUps.value.some(p => p.type === 'shrink' && Date.now() < p.endTime))
const isInvincible = computed(() => invincibilityFrames.value > 0)

const startGame = () => {
  if (gameStarted.value && !gameOver.value) return
  
  dinoY.value = GROUND_Y - DINO_HEIGHT
  dinoVelocity.value = 0
  isJumping.value = false
  isDucking.value = false
  obstacles.value = []
  powerUps.value = []
  particles.value = []
  score.value = 0
  gameSpeed.value = INITIAL_SPEED
  gameOver.value = false
  gameStarted.value = true
  isPaused.value = false
  distanceTraveled.value = 0
  lastObstacleTime = 0
  nextObstacleTime = 500
  frameCount = 0
  combo.value = 0
  comboTimer.value = 0
  screenShake.value = 0
  screenFlash.value = 0
  gravityDir.value = 1
  activePowerUps.value = []
  chaosEvents.value = []
  chaosMeter.value = 0
  doubleJumpAvailable.value = false
  hasDoubleJumped.value = false
  dinoScale.value = 1
  dinoTrail.value = []
  bgHue.value = 0
  warningFlash.value = 0
  lastChaosEventTime = 0
  lastPowerUpTime = 0
  lives.value = isChaosMode.value ? maxLives : 1
  invincibilityFrames.value = 0
  damageFlash.value = 0
  chaosEvents.value = []
  chaosMeter.value = 0
  doubleJumpAvailable.value = false
  hasDoubleJumped.value = false
  dinoScale.value = 1
  dinoTrail.value = []
  bgHue.value = 0
  warningFlash.value = 0
  lastChaosEventTime = 0
  lastPowerUpTime = 0
  
  if (animationId) cancelAnimationFrame(animationId)
  gameLoop()
}

const togglePause = () => {
  if (!gameStarted.value || gameOver.value) return
  isPaused.value = !isPaused.value
  if (!isPaused.value) gameLoop()
}

const jump = () => {
  if (gameOver.value) {
    startGame()
    return
  }
  if (!gameStarted.value) {
    startGame()
    return
  }
  if (isPaused.value) return
  
  if (!isJumping.value) {
    dinoVelocity.value = JUMP_FORCE * gravityDir.value
    isJumping.value = true
    isDucking.value = false
    hasDoubleJumped.value = false
    spawnParticles(50, GROUND_Y - 10, '#ffd700', 5)
  } else if (doubleJumpAvailable.value && !hasDoubleJumped.value) {
    dinoVelocity.value = JUMP_FORCE * gravityDir.value * 0.8
    hasDoubleJumped.value = true
    spawnParticles(50, dinoY.value + DINO_HEIGHT / 2, '#00ffff', 8)
  }
}

const duck = (active: boolean) => {
  if (gameOver.value || isPaused.value) return
  isDucking.value = active && !isJumping.value
}

const spawnParticles = (x: number, y: number, color: string, count: number) => {
  for (let i = 0; i < count; i++) {
    particles.value.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 2 + Math.random() * 4
    })
  }
}

const spawnPowerUp = () => {
  const types: PowerUp['type'][] = ['shield', 'magnet', 'slowmo', 'doublejump', 'shrink', 'nuke']
  const typeIndex = Math.floor(Math.random() * types.length)
  const type = types[typeIndex]!
  
  powerUps.value.push({
    x: CANVAS_WIDTH,
    y: GROUND_Y - 40 - Math.random() * 80,
    type,
    collected: false,
    duration: type === 'nuke' ? 0 : 5000 + Math.random() * 3000
  })
}

const activatePowerUp = (pu: PowerUp) => {
  pu.collected = true
  spawnParticles(pu.x, pu.y, '#00ff00', 15)
  screenFlash.value = 10
  
  if (pu.type === 'nuke') {
    obstacles.value.forEach(obs => {
      const obsY = obs.type === 'bird' || obs.type === 'fireball' ? obs.birdY! : GROUND_Y - obs.height
      spawnParticles(obs.x, obsY, '#ff0000', 10)
    })
    obstacles.value = []
    score.value += 100
    screenShake.value = 20
    return
  }
  
  if (pu.type === 'doublejump') {
    doubleJumpAvailable.value = true
    setTimeout(() => { doubleJumpAvailable.value = false }, pu.duration)
    return
  }
  
  activePowerUps.value.push({
    type: pu.type,
    endTime: Date.now() + pu.duration
  })
  
  if (pu.type === 'shrink') {
    dinoScale.value = 0.6
    setTimeout(() => { dinoScale.value = 1 }, pu.duration)
  }
}

const triggerChaosEvent = () => {
  if (!isChaosMode.value) return
  
  const events = [
    { type: 'gravity_flip', duration: 5000, intensity: 1 },
    { type: 'speed_burst', duration: 3000, intensity: 2 },
    { type: 'fog', duration: 4000, intensity: 1 },
    { type: 'earthquake', duration: 3000, intensity: 3 },
    { type: 'mirror', duration: 4000, intensity: 1 },
    { type: 'darkness', duration: 3000, intensity: 2 },
    { type: 'portal_storm', duration: 5000, intensity: 2 },
    { type: 'giant_mode', duration: 4000, intensity: 1 }
  ]
  
  const eventIndex = Math.floor(Math.random() * events.length)
  const selectedEvent = events[eventIndex]!
  
  const chaosEvent: ChaosEvent = {
    type: selectedEvent.type,
    duration: selectedEvent.duration,
    intensity: selectedEvent.intensity,
    startTime: Date.now()
  }
  chaosEvents.value.push(chaosEvent)
  
  warningFlash.value = 20
  screenShake.value = 15
  
  if (chaosEvent.type === 'gravity_flip') {
    gravityDir.value = -1
    setTimeout(() => { gravityDir.value = 1 }, chaosEvent.duration)
  } else if (chaosEvent.type === 'speed_burst') {
    gameSpeed.value = Math.min(MAX_SPEED * 1.5, gameSpeed.value * 1.5)
  } else if (chaosEvent.type === 'giant_mode') {
    dinoScale.value = 1.8
    setTimeout(() => { dinoScale.value = 1 }, chaosEvent.duration)
  }
}

const spawnObstacle = () => {
  const chaosTypes: Obstacle['type'][] = isChaosMode.value 
    ? ['cactus', 'bird', 'fireball', 'laser', 'portal']
    : ['cactus', 'bird']
  
  const type = chaosTypes[Math.floor(Math.random() * chaosTypes.length)]
  
  if (type === 'bird') {
    const birdHeights = [GROUND_Y - 80, GROUND_Y - 50, GROUND_Y - 30]
    const birdYPos = birdHeights[Math.floor(Math.random() * birdHeights.length)]
    obstacles.value.push({
      x: CANVAS_WIDTH,
      width: 40,
      height: 30,
      type: 'bird',
      birdY: birdYPos,
      color: '#535353'
    })
  } else if (type === 'fireball' && isChaosMode.value) {
    obstacles.value.push({
      x: CANVAS_WIDTH,
      width: 25,
      height: 25,
      type: 'fireball',
      birdY: GROUND_Y - 30 - Math.random() * 100,
      speed: gameSpeed.value * 1.3,
      color: '#ff4400'
    })
  } else if (type === 'laser' && isChaosMode.value) {
    // 激光位置：0=底部, 1=中部, 2=顶部
    const laserPos = Math.floor(Math.random() * 3)
    const laserY = laserPos === 0 ? GROUND_Y - 60 : laserPos === 1 ? GROUND_Y - 120 : 20
    const laserHeight = 60
    
    obstacles.value.push({
      x: CANVAS_WIDTH,
      width: 12,
      height: laserHeight,
      type: 'laser',
      birdY: laserY,
      active: false, // 开始时不激活，给玩家反应时间
      color: '#ff0000',
      speed: gameSpeed.value * 0.8 // 激光移动稍慢
    })
  } else if (type === 'portal' && isChaosMode.value) {
    obstacles.value.push({
      x: CANVAS_WIDTH,
      width: 40,
      height: 60,
      type: 'portal',
      birdY: GROUND_Y - 60,
      color: '#8800ff'
    })
  } else {
    const cactusTypes = [
      { width: 17, height: 35 },
      { width: 25, height: 50 },
      { width: 34, height: 35 },
      { width: 50, height: 35 }
    ]
    const cactusIndex = Math.floor(Math.random() * cactusTypes.length)
    const cactus = cactusTypes[cactusIndex]!
    obstacles.value.push({
      x: CANVAS_WIDTH,
      width: cactus.width,
      height: cactus.height,
      type: 'cactus',
      color: isChaosMode.value ? `hsl(${Math.random() * 360}, 70%, 40%)` : '#535353'
    })
  }
}

const checkCollision = (obs: Obstacle): boolean => {
  if (hasShield.value) return false
  
  const dinoX = 50
  const scale = dinoScale.value
  const baseHeight = isDucking.value ? DINO_HEIGHT / 2 : DINO_HEIGHT
  const dinoHeight = baseHeight * scale
  const dinoYPos = isDucking.value ? GROUND_Y - DINO_HEIGHT / 2 : dinoY.value
  const dinoWidth = DINO_WIDTH * scale * (isDucking.value ? 1.2 : 1)
  
  const hitboxShrink = 5 * scale
  
  if (obs.type === 'laser' && obs.active) {
    const laserY = obs.birdY || 0
    const laserBottom = laserY + obs.height
    return dinoX + dinoWidth > obs.x && dinoX < obs.x + obs.width && 
           dinoYPos + dinoHeight > laserY && dinoYPos < laserBottom
  }
  
  if (obs.type === 'portal') {
    const portalCenterX = obs.x + obs.width / 2
    const portalCenterY = obs.birdY! + obs.height / 2
    const dinoCenterX = dinoX + dinoWidth / 2
    const dinoCenterY = dinoYPos + dinoHeight / 2
    const dist = Math.sqrt((portalCenterX - dinoCenterX) ** 2 + (portalCenterY - dinoCenterY) ** 2)
    return dist < 40
  }
  
  const obsY = obs.type === 'bird' || obs.type === 'fireball' ? obs.birdY! : GROUND_Y - obs.height
  const obsBottom = obs.type === 'bird' || obs.type === 'fireball' ? obs.birdY! + obs.height : GROUND_Y
  
  return (
    dinoX + hitboxShrink < obs.x + obs.width - hitboxShrink &&
    dinoX + dinoWidth - hitboxShrink > obs.x + hitboxShrink &&
    dinoYPos + hitboxShrink < obsBottom - hitboxShrink &&
    dinoYPos + dinoHeight - hitboxShrink > obsY + hitboxShrink
  )
}

const endGame = () => {
  gameOver.value = true
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  
  screenShake.value = 30
  spawnParticles(50, dinoY.value + DINO_HEIGHT / 2, '#ff0000', 30)
  
  const currentHighScore = isChaosMode.value ? chaosHighScore : highScore
  if (score.value > currentHighScore.value) {
    if (isChaosMode.value) {
      chaosHighScore.value = Math.floor(score.value)
      localStorage.setItem('dino_chaos_high_score', chaosHighScore.value.toString())
    } else {
      highScore.value = Math.floor(score.value)
      localStorage.setItem('dino_high_score', highScore.value.toString())
    }
  }
  
  if (isGamblingMode.value) {
    const finalScore = Math.floor(score.value)
    const bet = gamblingBet.value
    const multiplier = isChaosMode.value ? 2 : 1
    const threshold = bet * 2
    let reward = 0
    
    if (finalScore >= threshold) {
      reward = Math.floor(bet * (finalScore / threshold) * multiplier)
      reward = Math.min(reward, bet * 15 * multiplier)
    } else if (finalScore >= bet) {
      reward = Math.floor(bet * 0.5 * multiplier)
    }
    
    if (reward > 0) {
      emit('score-gain', reward)
    }
  }
}

const gameLoop = () => {
  if (isPaused.value || gameOver.value) return
  
  frameCount++
  const speedMult = hasSlowMo.value ? 0.5 : 1
  
  if (isJumping.value) {
    dinoVelocity.value += GRAVITY * gravityDir.value
    dinoY.value += dinoVelocity.value * speedMult
    
    if (gravityDir.value === 1 && dinoY.value >= GROUND_Y - DINO_HEIGHT) {
      dinoY.value = GROUND_Y - DINO_HEIGHT
      dinoVelocity.value = 0
      isJumping.value = false
    } else if (gravityDir.value === -1 && dinoY.value <= 0) {
      dinoY.value = 0
      dinoVelocity.value = 0
      isJumping.value = false
    }
  }
  
  gameSpeed.value = Math.min(MAX_SPEED, INITIAL_SPEED + score.value * SPEED_INCREMENT)
  distanceTraveled.value += gameSpeed.value * speedMult
  score.value += gameSpeed.value * 0.1 * (isChaosMode.value ? 1.5 : 1)
  
  if (comboTimer.value > 0) {
    comboTimer.value--
    if (comboTimer.value === 0) combo.value = 0
  }
  
  if (isChaosMode.value) {
    chaosMeter.value = Math.min(100, chaosMeter.value + 0.05)
    
    const now = performance.now()
    if (now - lastChaosEventTime > 8000 + Math.random() * 5000 && chaosMeter.value > 30) {
      triggerChaosEvent()
      lastChaosEventTime = now
    }
    
    if (now - lastPowerUpTime > 10000 + Math.random() * 8000) {
      spawnPowerUp()
      lastPowerUpTime = now
    }
    
    bgHue.value = (bgHue.value + 0.5) % 360
  }
  
  chaosEvents.value = chaosEvents.value.filter(e => Date.now() - e.startTime < e.duration)
  activePowerUps.value = activePowerUps.value.filter(p => Date.now() < p.endTime)
  
  // 更新无敌帧
  if (invincibilityFrames.value > 0) {
    invincibilityFrames.value--
  }
  if (damageFlash.value > 0) {
    damageFlash.value--
  }
  
  const now = performance.now()
  if (now - lastObstacleTime > nextObstacleTime) {
    spawnObstacle()
    lastObstacleTime = now
    nextObstacleTime = OBSTACLE_INTERVAL_MIN + Math.random() * (OBSTACLE_INTERVAL_MAX - OBSTACLE_INTERVAL_MIN)
    nextObstacleTime *= INITIAL_SPEED / gameSpeed.value
    if (isChaosMode.value) nextObstacleTime *= 0.8
  }
  
  for (let i = obstacles.value.length - 1; i >= 0; i--) {
    const obs = obstacles.value[i]
    if (!obs) continue
    
    const obsSpeed = (obs.speed || gameSpeed.value) * speedMult
    obs.x -= obsSpeed
    
    if (obs.type === 'laser') {
      // 激光闪烁逻辑：每90帧一个周期，前60帧警告，后30帧激活
      const cycle = frameCount % 90
      if (cycle < 60) {
        obs.active = false // 警告阶段
      } else {
        obs.active = true // 激活阶段
      }
    }
    
    if (obs.x + obs.width < 0) {
      obstacles.value.splice(i, 1)
      if (!obs.active || obs.type !== 'laser') {
        combo.value++
        comboTimer.value = 60
        score.value += combo.value * 2
      }
      continue
    }
    
    if (checkCollision(obs)) {
      if (hasShield.value) {
        obstacles.value.splice(i, 1)
        const obsY = obs.type === 'bird' || obs.type === 'fireball' ? obs.birdY! : GROUND_Y - obs.height
        spawnParticles(obs.x, obsY, '#00ffff', 10)
        continue
      }
      
      // 如果处于无敌帧，跳过碰撞
      if (isInvincible.value) {
        continue
      }
      
      // 混沌模式：扣除生命而不是直接结束游戏
      if (isChaosMode.value && lives.value > 1) {
        lives.value--
        invincibilityFrames.value = 90 // 无敌3秒 (30fps * 3)
        damageFlash.value = 20
        screenShake.value = 20
        spawnParticles(50, dinoY.value + DINO_HEIGHT / 2, '#ff0000', 15)
        
        // 移除障碍物
        obstacles.value.splice(i, 1)
        
        if (lives.value <= 1) {
          // 最后一条命时结束游戏
          endGame()
          draw()
          return
        }
        continue
      }
      
      endGame()
      draw()
      return
    }
  }
  
  for (let i = powerUps.value.length - 1; i >= 0; i--) {
    const pu = powerUps.value[i]
    if (!pu) continue
    
    pu.x -= gameSpeed.value * speedMult * 0.8
    
    if (pu.x < -30) {
      powerUps.value.splice(i, 1)
      continue
    }
    
    if (!pu.collected) {
      const dinoX = 50
      const scale = dinoScale.value
      const dinoWidth = DINO_WIDTH * scale
      const dinoHeight = DINO_HEIGHT * scale
      const dinoYPos = isDucking.value ? GROUND_Y - DINO_HEIGHT / 2 : dinoY.value
      
      if (
        dinoX < pu.x + 20 &&
        dinoX + dinoWidth > pu.x &&
        dinoYPos < pu.y + 20 &&
        dinoYPos + dinoHeight > pu.y
      ) {
        activatePowerUp(pu)
      }
    }
  }
  
  for (let i = particles.value.length - 1; i >= 0; i--) {
    const p = particles.value[i]
    if (!p) continue
    
    p.x += p.vx
    p.y += p.vy
    p.life--
    
    if (p.life <= 0) {
      particles.value.splice(i, 1)
    }
  }
  
  dinoTrail.value.unshift({ x: 50, y: dinoY.value + DINO_HEIGHT / 2, alpha: 1 })
  if (dinoTrail.value.length > 10) dinoTrail.value.pop()
  dinoTrail.value.forEach(t => t.alpha *= 0.8)
  
  if (screenShake.value > 0) screenShake.value--
  if (screenFlash.value > 0) screenFlash.value--
  if (warningFlash.value > 0) warningFlash.value--
  
  draw()
  animationId = requestAnimationFrame(gameLoop)
}

const draw = () => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  
  const shakeX = screenShake.value > 0 ? (Math.random() - 0.5) * screenShake.value : 0
  const shakeY = screenShake.value > 0 ? (Math.random() - 0.5) * screenShake.value : 0
  
  ctx.save()
  ctx.translate(shakeX, shakeY)
  
  if (isChaosMode.value) {
    const hasDarkness = chaosEvents.value.some(e => e.type === 'darkness')
    const hasFog = chaosEvents.value.some(e => e.type === 'fog')
    
    if (hasDarkness) {
      ctx.fillStyle = '#111'
    } else if (hasFog) {
      ctx.fillStyle = `hsl(${bgHue.value}, 20%, 85%)`
    } else {
      ctx.fillStyle = `hsl(${bgHue.value}, 10%, 95%)`
    }
  } else {
    ctx.fillStyle = '#f7f7f7'
  }
  ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20)
  
  // 闪电特效（仅混沌模式）
  if (isChaosMode.value) {
    const lightningChance = Math.random()
    if (lightningChance < 0.02 || (warningFlash.value > 0 && Math.random() < 0.3)) {
      // 闪电主干
      const startX = Math.random() * CANVAS_WIDTH
      const startY = 0
      const endY = GROUND_Y * 0.6
      
      ctx.strokeStyle = `rgba(200, 220, 255, ${0.8 + Math.random() * 0.2})`
      ctx.lineWidth = 2 + Math.random() * 3
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      
      let currentX = startX
      let currentY = startY
      const segments = 5 + Math.floor(Math.random() * 5)
      const segmentHeight = (endY - startY) / segments
      
      for (let i = 0; i < segments; i++) {
        currentX += (Math.random() - 0.5) * 60
        currentY += segmentHeight
        ctx.lineTo(currentX, currentY)
      }
      ctx.stroke()
      
      // 闪电分支
      const branches = 2 + Math.floor(Math.random() * 3)
      for (let b = 0; b < branches; b++) {
        const branchStart = Math.floor(Math.random() * segments)
        const branchX = startX + (Math.random() - 0.5) * 60 * branchStart
        const branchY = startY + segmentHeight * branchStart
        
        ctx.strokeStyle = `rgba(180, 200, 255, ${0.5 + Math.random() * 0.3})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(branchX, branchY)
        ctx.lineTo(branchX + (Math.random() - 0.5) * 80, branchY + 20 + Math.random() * 30)
        ctx.stroke()
      }
      
      // 闪电光晕
      ctx.fillStyle = `rgba(200, 220, 255, ${0.1 + Math.random() * 0.1})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y * 0.3)
    }
    
    // 持续的环境闪电效果（微弱）
    if (frameCount % 120 < 5) {
      ctx.fillStyle = `rgba(150, 180, 255, ${0.02 + Math.random() * 0.03})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y)
    }
  }
  
  ctx.fillStyle = isChaosMode.value ? `hsl(${bgHue.value}, 30%, 50%)` : '#535353'
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 2)
  
  dinoTrail.value.forEach(t => {
    ctx.fillStyle = `rgba(255, 215, 0, ${t.alpha * 0.3})`
    ctx.beginPath()
    ctx.arc(t.x, t.y, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  
  const dinoX = 50
  const scale = dinoScale.value
  const dinoH = (isDucking.value ? DINO_HEIGHT / 2 : DINO_HEIGHT) * scale
  const dinoYPos = isDucking.value ? GROUND_Y - DINO_HEIGHT / 2 : dinoY.value
  
  ctx.save()
  ctx.translate(dinoX + DINO_WIDTH / 2, dinoYPos + dinoH / 2)
  ctx.scale(scale, scale)
  ctx.translate(-(dinoX + DINO_WIDTH / 2), -(dinoYPos + dinoH / 2))
  
  if (hasShield.value) {
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(dinoX + DINO_WIDTH / 2, dinoYPos + dinoH / 2, 30, 0, Math.PI * 2)
    ctx.stroke()
  }
  
  ctx.fillStyle = isChaosMode.value ? `hsl(${(frameCount * 5) % 360}, 70%, 40%)` : '#535353'
  
  ctx.fillRect(dinoX + 15, dinoYPos, 20, 8)
  ctx.fillRect(dinoX + 10, dinoYPos + 8, 30, 12)
  ctx.fillRect(dinoX + 5, dinoYPos + 12, 15, 8)
  
  ctx.fillRect(dinoX + 20, dinoYPos + 20, 8, 15)
  
  if (!isDucking.value) {
    ctx.fillRect(dinoX + 15, dinoYPos + 35, 6, 13)
    ctx.fillRect(dinoX + 25, dinoYPos + 35, 6, 13)
  } else {
    ctx.fillRect(dinoX + 15, dinoYPos + 20, 6, 8)
    ctx.fillRect(dinoX + 25, dinoYPos + 20, 6, 8)
  }
  
  ctx.fillStyle = '#fff'
  ctx.fillRect(dinoX + 25, dinoYPos + 2, 5, 5)
  ctx.fillStyle = '#000'
  ctx.fillRect(dinoX + 26, dinoYPos + 3, 3, 3)
  
  ctx.restore()
  
  obstacles.value.forEach(obs => {
    if (obs.type === 'cactus') {
      ctx.fillStyle = obs.color || '#535353'
      const obsY = GROUND_Y - obs.height
      ctx.fillRect(obs.x, obsY, obs.width * 0.3, obs.height)
      ctx.fillRect(obs.x + obs.width * 0.7, obsY, obs.width * 0.3, obs.height)
      
      if (obs.height > 40) {
        ctx.fillRect(obs.x - obs.width * 0.2, obsY + obs.height * 0.3, obs.width * 0.2, obs.height * 0.15)
        ctx.fillRect(obs.x + obs.width, obsY + obs.height * 0.5, obs.width * 0.2, obs.height * 0.15)
      }
    } else if (obs.type === 'bird') {
      ctx.fillStyle = obs.color || '#535353'
      const birdFrame = Math.floor(frameCount / 10) % 2
      ctx.fillRect(obs.x, obs.birdY!, obs.width, obs.height * 0.4)
      
      if (birdFrame === 0) {
        ctx.fillRect(obs.x + 5, obs.birdY! - obs.height * 0.3, obs.width * 0.6, obs.height * 0.3)
      } else {
        ctx.fillRect(obs.x + 5, obs.birdY! + obs.height * 0.4, obs.width * 0.6, obs.height * 0.3)
      }
      
      ctx.fillStyle = '#fff'
      ctx.fillRect(obs.x + obs.width - 10, obs.birdY! + 5, 5, 5)
    } else if (obs.type === 'fireball') {
      const fireballFrame = frameCount % 4
      ctx.fillStyle = `hsl(${20 + fireballFrame * 10}, 100%, ${50 + fireballFrame * 5}%)`
      ctx.beginPath()
      ctx.arc(obs.x + obs.width / 2, obs.birdY! + obs.height / 2, obs.width / 2, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = `rgba(255, 100, 0, ${0.5 + Math.sin(frameCount * 0.2) * 0.3})`
      ctx.beginPath()
      ctx.arc(obs.x + obs.width / 2 + 5, obs.birdY! + obs.height / 2, obs.width / 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (obs.type === 'laser') {
      const laserY = obs.birdY || 0
      const laserBottom = laserY + obs.height
      
      if (obs.active) {
        // 激活状态 - 高亮激光
        const glowIntensity = 0.5 + Math.sin(frameCount * 0.3) * 0.3
        ctx.fillStyle = `rgba(255, 50, 0, ${glowIntensity})`
        ctx.fillRect(obs.x - 4, laserY, obs.width + 8, obs.height)
        
        ctx.fillStyle = '#ff0000'
        ctx.fillRect(obs.x, laserY, obs.width, obs.height)
        
        // 激光核心白光
        ctx.fillStyle = `rgba(255, 200, 200, ${0.6 + Math.sin(frameCount * 0.5) * 0.3})`
        ctx.fillRect(obs.x + 2, laserY + 2, obs.width - 4, obs.height - 4)
      } else {
        // 警告状态 - 闪烁虚线
        const warningAlpha = 0.3 + Math.sin(frameCount * 0.2) * 0.2
        ctx.strokeStyle = `rgba(255, 0, 0, ${warningAlpha})`
        ctx.lineWidth = 2
        ctx.setLineDash([8, 4])
        ctx.beginPath()
        ctx.moveTo(obs.x + obs.width / 2, laserY)
        ctx.lineTo(obs.x + obs.width / 2, laserBottom)
        ctx.stroke()
        ctx.setLineDash([])
        
        // 警告标记
        ctx.fillStyle = `rgba(255, 100, 0, ${warningAlpha})`
        ctx.font = '14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('⚠', obs.x + obs.width / 2, laserY - 5)
      }
    } else if (obs.type === 'portal') {
      const portalFrame = frameCount % 30
      ctx.strokeStyle = `hsl(${270 + portalFrame * 3}, 100%, 50%)`
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(obs.x + obs.width / 2, obs.birdY! + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      
      ctx.fillStyle = `rgba(136, 0, 255, ${0.3 + Math.sin(frameCount * 0.1) * 0.2})`
      ctx.beginPath()
      ctx.ellipse(obs.x + obs.width / 2, obs.birdY! + obs.height / 2, obs.width / 3, obs.height / 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  
  powerUps.value.forEach(pu => {
    if (pu.collected) return
    
    const colors: Record<string, string> = {
      shield: '#00ffff',
      magnet: '#ff00ff',
      slowmo: '#ffff00',
      doublejump: '#00ff00',
      shrink: '#ff8800',
      nuke: '#ff0000'
    }
    
    const icons: Record<string, string> = {
      shield: '🛡',
      magnet: '🧲',
      slowmo: '⏱',
      doublejump: '⬆',
      shrink: '🔽',
      nuke: '💥'
    }
    
    const bobY = Math.sin(frameCount * 0.1) * 5
    
    ctx.fillStyle = colors[pu.type] || '#fff'
    ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.15) * 0.2
    ctx.beginPath()
    ctx.arc(pu.x + 10, pu.y + 10 + bobY, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    
    ctx.fillStyle = '#fff'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(icons[pu.type] || '?', pu.x + 10, pu.y + 15 + bobY)
  })
  
  particles.value.forEach(p => {
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.life / p.maxLife
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  })
  ctx.globalAlpha = 1
  
  ctx.fillStyle = '#535353'
  ctx.font = 'bold 16px "Courier New", monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${displayScore.value.toString().padStart(5, '0')}`, CANVAS_WIDTH - 20, 30)
  
  const currentHigh = isChaosMode.value ? chaosHighScore.value : highScore.value
  if (currentHigh > 0) {
    ctx.fillStyle = '#999'
    ctx.font = '14px "Courier New", monospace'
    ctx.fillText(`HI ${currentHigh.toString().padStart(5, '0')}`, CANVAS_WIDTH - 120, 30)
  }
  
  if (combo.value > 1) {
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 20px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`COMBO x${combo.value}`, 20, 30)
  }
  
  // 显示生命值（仅混沌模式）
  if (isChaosMode.value) {
    ctx.textAlign = 'left'
    ctx.font = 'bold 18px Arial'
    
    // 受伤闪烁效果
    if (damageFlash.value > 0) {
      ctx.fillStyle = (damageFlash.value % 4 < 2) ? '#ff0000' : '#ffffff'
    } else {
      ctx.fillStyle = '#ff0000'
    }
    
    let heartsText = ''
    for (let i = 0; i < maxLives; i++) {
      heartsText += i < lives.value ? '❤️' : '🖤'
    }
    ctx.fillText(heartsText, 20, 55)
    
    // 无敌提示
    if (isInvincible.value) {
      ctx.fillStyle = '#ffff00'
      ctx.font = '14px Arial'
      ctx.fillText('无敌中', 20, 75)
    }
  }
  
  if (isChaosMode.value) {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(20, CANVAS_HEIGHT - 20, 100, 8)
    ctx.fillStyle = '#ff4400'
    ctx.fillRect(20, CANVAS_HEIGHT - 20, chaosMeter.value, 8)
    ctx.fillStyle = '#fff'
    ctx.font = '10px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('CHAOS', 20, CANVAS_HEIGHT - 25)
  }
  
  if (hasSlowMo.value) {
    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
  
  if (screenFlash.value > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash.value / 10})`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
  
  // 受伤红色闪烁
  if (damageFlash.value > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash.value / 20})`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
  
  if (warningFlash.value > 0 && warningFlash.value % 4 < 2) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
  
  if (!gameStarted.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(isChaosMode.value ? '混沌模式' : '恐龙跑酷', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
    
    ctx.font = '16px "Courier New", monospace'
    ctx.fillText('按空格键开始', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
    
    if (isChaosMode.value) {
      ctx.fillStyle = '#ff4400'
      ctx.font = '12px "Courier New", monospace'
      ctx.fillText('混沌模式: 特殊障碍物、随机事件、道具系统', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
    }
  }
  
  if (gameOver.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    ctx.fillStyle = isChaosMode.value ? '#ff4400' : '#fff'
    ctx.font = 'bold 28px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(isChaosMode.value ? '混沌终结' : '游戏结束', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)
    
    ctx.font = '18px "Courier New", monospace'
    ctx.fillStyle = '#fff'
    ctx.fillText(`得分: ${displayScore.value}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
    
    if (combo.value > 1) {
      ctx.fillStyle = '#ffd700'
      ctx.fillText(`最高连击: ${combo.value}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
    }
    
    if (isGamblingMode.value) {
      const multiplier = isChaosMode.value ? 2 : 1
      const bet = gamblingBet.value
      const threshold = bet * 2
      const finalScore = displayScore.value
      
      if (finalScore >= threshold) {
        const reward = Math.min(Math.floor(bet * (finalScore / threshold) * multiplier), bet * 15 * multiplier)
        ctx.fillStyle = '#00ff00'
        ctx.fillText(`赢得: +${reward} 击分!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
      } else if (finalScore >= bet) {
        const reward = Math.floor(bet * 0.5 * multiplier)
        ctx.fillStyle = '#ffff00'
        ctx.fillText(`小赢: +${reward} 击分`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
      } else {
        ctx.fillStyle = '#ff0000'
        ctx.fillText(`失去: ${bet} 击分`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
      }
    }
    
    ctx.fillStyle = '#aaa'
    ctx.font = '14px "Courier New", monospace'
    ctx.fillText('按空格键重新开始', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70)
  }
  
  if (isPaused.value && !gameOver.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 28px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('暂停', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  }
  
  ctx.restore()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault()
  }
  
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    jump()
  } else if (e.code === 'ArrowDown') {
    duck(true)
  } else if (e.code === 'KeyP') {
    togglePause()
  }
}

const handleKeyup = (e: KeyboardEvent) => {
  if (e.code === 'ArrowDown') {
    duck(false)
  }
}

const toggleGamblingMode = () => {
  if (gameStarted.value && !gameOver.value) return
  isGamblingMode.value = !isGamblingMode.value
}

const toggleChaosMode = () => {
  if (gameStarted.value && !gameOver.value) return
  isChaosMode.value = !isChaosMode.value
}

const adjustBet = (amount: number) => {
  if (gameStarted.value && !gameOver.value) return
  gamblingBet.value = Math.max(10, Math.min(props.gamblingScore, gamblingBet.value + amount))
}

type GameMode = 'normal' | 'gambling' | 'chaos'

const currentMode = computed<GameMode>(() => {
  if (isChaosMode.value && isGamblingMode.value) return 'chaos'
  if (isChaosMode.value) return 'chaos'
  if (isGamblingMode.value) return 'gambling'
  return 'normal'
})

const setMode = (mode: GameMode) => {
  if (gameStarted.value && !gameOver.value) return
  
  isGamblingMode.value = mode === 'gambling' || mode === 'chaos'
  isChaosMode.value = mode === 'chaos'
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  draw()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  if (animationId) cancelAnimationFrame(animationId)
})
</script>

<template>
  <div class="dino-game">
    <div class="game-header">
      <h2 class="game-title" :class="{ chaos: currentMode === 'chaos', gambling: currentMode === 'gambling' }">
        {{ currentMode === 'chaos' ? '🌋 混沌恐龙' : currentMode === 'gambling' ? '🎰 博彩恐龙' : '🦕 恐龙跑酷' }}
      </h2>
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">得分</span>
          <span class="stat-value">{{ displayScore }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">最高分</span>
          <span class="stat-value">{{ currentMode === 'chaos' ? chaosHighScore : highScore }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">连击</span>
          <span class="stat-value combo" :class="{ active: combo > 1 }">{{ combo }}</span>
        </div>
        <div v-if="currentMode === 'chaos'" class="stat">
          <span class="stat-label">生命</span>
          <span class="stat-value lives">
            <span v-for="i in maxLives" :key="i" :class="{ 'heart-full': i <= lives, 'heart-empty': i > lives }">
              {{ i <= lives ? '❤️' : '🖤' }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <div class="mode-section">
      <div class="mode-selector">
        <button 
          class="mode-btn" 
          :class="{ active: currentMode === 'normal' }" 
          @click="setMode('normal')"
        >
          <span class="mode-icon">🦕</span>
          <span class="mode-name">经典模式</span>
          <span class="mode-desc">基础玩法</span>
        </button>
        
        <button 
          class="mode-btn gambling" 
          :class="{ active: currentMode === 'gambling' }" 
          @click="setMode('gambling')"
        >
          <span class="mode-icon">🎰</span>
          <span class="mode-name">博彩模式</span>
          <span class="mode-desc">赢取奖励</span>
        </button>
        
        <button 
          class="mode-btn chaos" 
          :class="{ active: currentMode === 'chaos' }" 
          @click="setMode('chaos')"
        >
          <span class="mode-icon">🌋</span>
          <span class="mode-name">混沌模式</span>
          <span class="mode-desc">2倍奖励</span>
        </button>
      </div>
      
      <div v-if="currentMode === 'chaos'" class="chaos-features">
        <span class="feature-tag">🔥 特殊障碍物</span>
        <span class="feature-tag">⚡ 随机事件</span>
        <span class="feature-tag">🎁 道具系统</span>
        <span class="feature-tag">💰 2倍奖励</span>
      </div>
      
      <div v-if="currentMode === 'gambling'" class="gambling-info">
        <span class="feature-tag">🎰 赌注玩法</span>
        <span class="feature-tag">📈 高风险高回报</span>
      </div>
    </div>

    <div v-if="currentMode === 'gambling' || currentMode === 'chaos'" class="bet-section">
      <div class="bet-input">
        <label>投入击分:</label>
        <input 
          type="number" 
          v-model.number="gamblingBet" 
          :min="10"
          :max="gamblingScore"
          class="bet-number"
          :disabled="gameStarted && !gameOver"
        />
      </div>
      <div class="quick-bets">
        <button 
          v-for="amount in [10, 50, 100, 500]" 
          :key="amount"
          class="quick-btn"
          :disabled="gamblingScore < amount || (gameStarted && !gameOver)"
          @click="gamblingBet = amount"
        >
          {{ amount }}
        </button>
      </div>
      
      <div class="reward-info">
        <p>得分达到 {{ gamblingBet * 2 }} 可获得奖励</p>
        <p>最高可赢 {{ gamblingBet * (currentMode === 'chaos' ? 15 : 10) }} 击分!</p>
      </div>
    </div>

    <div class="canvas-container">
      <canvas
        ref="canvas"
        :width="CANVAS_WIDTH"
        :height="CANVAS_HEIGHT"
        class="game-canvas"
        :class="{ chaos: isChaosMode }"
        @click="jump"
      />
    </div>

    <div class="power-ups-display" v-if="isChaosMode && activePowerUps.length > 0">
      <div class="active-buff" v-for="pu in activePowerUps" :key="pu.type">
        <span v-if="pu.type === 'shield'">🛡 护盾</span>
        <span v-else-if="pu.type === 'magnet'">🧲 磁铁</span>
        <span v-else-if="pu.type === 'slowmo'">⏱ 减速</span>
        <span v-else-if="pu.type === 'shrink'">🔽 缩小</span>
      </div>
    </div>

    <div class="controls">
      <div class="control-group">
        <button class="control-btn" @click="jump">跳跃</button>
        <button class="control-btn" @mousedown="duck(true)" @mouseup="duck(false)" @mouseleave="duck(false)">下蹲</button>
        <button class="control-btn" @click="togglePause">{{ isPaused ? '继续' : '暂停' }}</button>
      </div>
      <div class="key-hints">
        <span class="key-hint">空格/↑: 跳跃</span>
        <span class="key-hint">↓: 下蹲</span>
        <span class="key-hint">P: 暂停</span>
        <span v-if="isChaosMode" class="key-hint chaos">双击空格: 二段跳</span>
      </div>
    </div>

    <div class="game-info" :class="{ chaos: isChaosMode }">
      <p v-if="isChaosMode">
        🌋 混沌模式: 收集道具增强能力，躲避火球、激光和传送门！随机事件随时触发！
      </p>
      <p v-else>
        控制恐龙跳跃躲避仙人掌和翼龙，坚持越久得分越高！
      </p>
    </div>
  </div>
</template>

<style scoped>
.dino-game {
  padding: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}

.game-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.game-title {
  font-size: 2rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 1rem;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  transition: all 0.3s;
}

.game-title.chaos {
  color: #ff4400;
  text-shadow: 0 0 20px rgba(255, 68, 0, 0.8);
  animation: chaosGlow 1s ease-in-out infinite alternate;
}

.game-title.gambling {
  color: #ffd700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
  animation: gamblingGlow 1.5s ease-in-out infinite alternate;
}

@keyframes chaosGlow {
  from { text-shadow: 0 0 10px rgba(255, 68, 0, 0.5); }
  to { text-shadow: 0 0 30px rgba(255, 68, 0, 1), 0 0 60px rgba(255, 0, 0, 0.5); }
}

@keyframes gamblingGlow {
  from { text-shadow: 0 0 10px rgba(255, 215, 0, 0.4); }
  to { text-shadow: 0 0 25px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 140, 0, 0.4); }
}

.game-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.stat-label {
  font-size: 0.85rem;
  color: #aaa;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: bold;
  color: #ffd700;
}

.stat-value.combo.active {
  color: #ff4400;
  animation: comboPulse 0.5s ease-in-out infinite;
}

.stat-value.lives {
  display: flex;
  gap: 2px;
}

.stat-value.loves .heart-full {
  color: #ff0000;
}

.stat-value.loves .heart-empty {
  color: #666;
}

@keyframes comboPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.mode-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.mode-selector {
  display: flex;
  gap: 0.8rem;
  width: 100%;
  max-width: 600px;
}

.mode-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1rem 0.8rem;
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.9), rgba(26, 26, 40, 0.9));
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.mode-btn:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
}

.mode-btn.active {
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.2), rgba(255, 140, 0, 0.2));
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.mode-btn.gambling.active {
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.3), rgba(255, 140, 0, 0.3));
  border-color: #ffd700;
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.4);
}

.mode-btn.chaos.active {
  background: linear-gradient(145deg, rgba(255, 68, 0, 0.3), rgba(255, 0, 0, 0.3));
  border-color: #ff4400;
  box-shadow: 0 0 25px rgba(255, 68, 0, 0.4);
  animation: chaosBorder 2s ease-in-out infinite;
}

@keyframes chaosBorder {
  0%, 100% { border-color: #ff4400; }
  50% { border-color: #ff0000; box-shadow: 0 0 30px rgba(255, 0, 0, 0.5); }
}

.mode-icon {
  font-size: 1.8rem;
}

.mode-name {
  font-size: 1rem;
  font-weight: 600;
}

.mode-desc {
  font-size: 0.75rem;
  color: #aaa;
}

.mode-btn.active .mode-desc {
  color: #ffd700;
}

.mode-btn.chaos.active .mode-desc {
  color: #ff8800;
}

.chaos-features,
.gambling-info {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}

.feature-tag {
  padding: 0.3rem 0.8rem;
  background: rgba(255, 68, 0, 0.2);
  border: 1px solid rgba(255, 68, 0, 0.4);
  border-radius: 15px;
  font-size: 0.8rem;
  color: #ff8800;
}

.gambling-info .feature-tag {
  background: rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.4);
  color: #ffd700;
}

.bet-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.bet-input {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bet-input label {
  color: #aaa;
  font-size: 0.95rem;
}

.bet-number {
  width: 100px;
  padding: 0.5rem 0.8rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #ffd700;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.bet-number:focus {
  outline: none;
  border-color: #ffd700;
}

.bet-number:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.quick-bets {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.4rem 0.8rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reward-info {
  text-align: center;
  color: #aaa;
  font-size: 0.9rem;
}

.reward-info p {
  margin: 0.2rem 0;
}

.canvas-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.game-canvas {
  background: #f7f7f7;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  max-width: 100%;
  height: auto;
  transition: all 0.3s;
}

.game-canvas.chaos {
  box-shadow: 0 0 30px rgba(255, 68, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.3);
}

.power-ups-display {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.active-buff {
  padding: 0.4rem 0.8rem;
  background: rgba(0, 255, 0, 0.2);
  border: 1px solid rgba(0, 255, 0, 0.4);
  border-radius: 15px;
  font-size: 0.85rem;
  color: #00ff00;
  animation: buffPulse 1s ease-in-out infinite;
}

@keyframes buffPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.control-group {
  display: flex;
  gap: 1rem;
}

.control-btn {
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, rgba(83, 83, 83, 0.8), rgba(50, 50, 50, 0.8));
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 80px;
}

.control-btn:hover {
  background: linear-gradient(135deg, rgba(100, 100, 100, 0.9), rgba(70, 70, 70, 0.9));
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

.key-hints {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.key-hint {
  font-size: 0.85rem;
  color: #888;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
}

.key-hint.chaos {
  color: #ff8800;
  background: rgba(255, 136, 0, 0.1);
  border: 1px solid rgba(255, 136, 0, 0.3);
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  color: #aaa;
  font-size: 0.95rem;
  transition: all 0.3s;
}

.game-info.chaos {
  background: rgba(255, 68, 0, 0.1);
  border: 1px solid rgba(255, 68, 0, 0.3);
  color: #ff8800;
}

@media (max-width: 600px) {
  .dino-game {
    padding: 1rem;
  }

  .game-title {
    font-size: 1.5rem;
  }

  .game-stats {
    gap: 1rem;
  }

  .stat-value {
    font-size: 1.1rem;
  }

  .chaos-features {
    gap: 0.5rem;
  }

  .feature-tag {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
  }

  .control-group {
    flex-wrap: wrap;
    justify-content: center;
  }

  .control-btn {
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
  }
}
</style>
