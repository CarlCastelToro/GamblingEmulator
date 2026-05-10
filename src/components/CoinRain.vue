<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type GameState = 'idle' | 'playing' | 'finished'

interface FallingItem {
  x: number
  y: number
  speed: number
  type: 'coin' | 'diamond' | 'bomb' | 'star'
  size: number
  rotation: number
  rotationSpeed: number
}

const gameState = ref<GameState>('idle')
const betAmount = ref(100)
const score = ref(0)
const timeLeft = ref(30)
const combo = ref(0)
const bestScore = ref(parseInt(localStorage.getItem('coin_best_score') || '0'))
const playerX = ref(400)
const playerWidth = 80
const items = ref<FallingItem[]>([])
const particles = ref<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([])
const flashEffect = ref(0)

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let gameInterval: number | null = null
let frameCount = 0

const displayTime = computed(() => Math.ceil(timeLeft.value))

const startGame = () => {
  if (props.gamblingScore < betAmount.value) return
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  
  gameState.value = 'playing'
  score.value = 0
  timeLeft.value = 30
  combo.value = 0
  items.value = []
  particles.value = []
  flashEffect.value = 0
  
  if (gameInterval) clearInterval(gameInterval)
  gameInterval = window.setInterval(() => {
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      endGame()
    }
  }, 100)
  
  gameLoop()
}

const endGame = () => {
  gameState.value = 'finished'
  if (gameInterval) clearInterval(gameInterval)
  if (animationId) cancelAnimationFrame(animationId)
  
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('coin_best_score', bestScore.value.toString())
  }
  
  const reward = Math.floor(score.value * (betAmount.value / 100))
  if (reward > 0) {
    emit('score-gain', reward)
  }
  
  draw()
}

const gameLoop = () => {
  if (gameState.value !== 'playing') return
  
  frameCount++
  
  // 生成新物品
  if (frameCount % 15 === 0) {
    const rand = Math.random()
    let type: FallingItem['type'] = 'coin'
    
    if (rand < 0.05) type = 'diamond'
    else if (rand < 0.15) type = 'star'
    else if (rand < 0.25) type = 'bomb'
    
    items.value.push({
      x: Math.random() * 750 + 25,
      y: -30,
      speed: 2 + Math.random() * 3 + score.value * 0.01,
      type,
      size: type === 'diamond' ? 20 : type === 'bomb' ? 25 : 15,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.2
    })
  }
  
  // 更新物品位置
  for (let i = items.value.length - 1; i >= 0; i--) {
    const item = items.value[i]
    if (!item) continue
    
    item.y += item.speed
    item.rotation += item.rotationSpeed
    
    // 检测碰撞
    const playerY = 440
    if (
      item.y + item.size > playerY &&
      item.y < playerY + 30 &&
      item.x + item.size > playerX.value - playerWidth / 2 &&
      item.x - item.size < playerX.value + playerWidth / 2
    ) {
      // 碰撞处理
      if (item.type === 'bomb') {
        combo.value = 0
        flashEffect.value = 20
        spawnParticles(item.x, item.y, '#ff0000', 10)
        score.value = Math.max(0, score.value - 50)
      } else {
        const points = item.type === 'diamond' ? 50 : item.type === 'star' ? 30 : 10
        combo.value++
        score.value += points * Math.min(combo.value, 5)
        flashEffect.value = 5
        spawnParticles(item.x, item.y, item.type === 'diamond' ? '#00ffff' : '#ffd700', 5)
      }
      
      items.value.splice(i, 1)
      continue
    }
    
    // 移除超出屏幕的物品
    if (item.y > 500) {
      if (item.type !== 'bomb') combo.value = 0
      items.value.splice(i, 1)
    }
  }
  
  // 更新粒子
  for (let i = particles.value.length - 1; i >= 0; i--) {
    const p = particles.value[i]
    if (!p) continue
    
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.2
    p.life--
    
    if (p.life <= 0) {
      particles.value.splice(i, 1)
    }
  }
  
  if (flashEffect.value > 0) flashEffect.value--
  
  draw()
  animationId = requestAnimationFrame(gameLoop)
}

const spawnParticles = (x: number, y: number, color: string, count: number) => {
  for (let i = 0; i < count; i++) {
    particles.value.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 20 + Math.random() * 20,
      color
    })
  }
}

const adjustBet = (amount: number) => {
  if (gameState.value === 'playing') return
  betAmount.value = Math.max(10, Math.min(props.gamblingScore, betAmount.value + amount))
}

const draw = () => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  
  ctx.clearRect(0, 0, 800, 500)
  
  // 背景
  const bgGradient = ctx.createLinearGradient(0, 0, 0, 500)
  bgGradient.addColorStop(0, '#0a0a2a')
  bgGradient.addColorStop(1, '#1a0a3a')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, 800, 500)
  
  // 星星背景
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 50; i++) {
    const x = (i * 137.5) % 800
    const y = (i * 73.7) % 500
    const size = 1 + (i % 3)
    ctx.globalAlpha = 0.3 + (i % 5) * 0.1
    ctx.fillRect(x, y, size, size)
  }
  ctx.globalAlpha = 1
  
  // 金币收集器
  const playerY = 440
  
  // 收集器发光
  ctx.fillStyle = `rgba(255, 215, 0, ${0.1 + combo.value * 0.02})`
  ctx.beginPath()
  ctx.arc(playerX.value, playerY + 15, 50 + combo.value * 2, 0, Math.PI * 2)
  ctx.fill()
  
  // 收集器主体
  ctx.fillStyle = '#ffd700'
  ctx.beginPath()
  ctx.moveTo(playerX.value - playerWidth / 2, playerY + 30)
  ctx.lineTo(playerX.value - playerWidth / 2 + 10, playerY)
  ctx.lineTo(playerX.value + playerWidth / 2 - 10, playerY)
  ctx.lineTo(playerX.value + playerWidth / 2, playerY + 30)
  ctx.closePath()
  ctx.fill()
  
  // 收集器高光
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.beginPath()
  ctx.moveTo(playerX.value - playerWidth / 2 + 10, playerY + 5)
  ctx.lineTo(playerX.value - 5, playerY + 5)
  ctx.lineTo(playerX.value - 5, playerY + 25)
  ctx.lineTo(playerX.value - playerWidth / 2 + 10, playerY + 25)
  ctx.closePath()
  ctx.fill()
  
  // 掉落物品
  items.value.forEach(item => {
    ctx.save()
    ctx.translate(item.x, item.y)
    ctx.rotate(item.rotation)
    
    if (item.type === 'coin') {
      // 金币
      ctx.fillStyle = '#ffd700'
      ctx.beginPath()
      ctx.arc(0, 0, item.size, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#b8860b'
      ctx.beginPath()
      ctx.arc(0, 0, item.size * 0.7, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('$', 0, 0)
    } else if (item.type === 'diamond') {
      // 钻石
      ctx.fillStyle = '#00ffff'
      ctx.beginPath()
      ctx.moveTo(0, -item.size)
      ctx.lineTo(item.size, 0)
      ctx.lineTo(0, item.size)
      ctx.lineTo(-item.size, 0)
      ctx.closePath()
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.beginPath()
      ctx.moveTo(0, -item.size * 0.5)
      ctx.lineTo(item.size * 0.3, -item.size * 0.2)
      ctx.lineTo(0, item.size * 0.3)
      ctx.lineTo(-item.size * 0.3, -item.size * 0.2)
      ctx.closePath()
      ctx.fill()
    } else if (item.type === 'star') {
      // 星星
      ctx.fillStyle = '#ffff00'
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const x = Math.cos(angle) * item.size
        const y = Math.sin(angle) * item.size
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    } else if (item.type === 'bomb') {
      // 炸弹
      ctx.fillStyle = '#333'
      ctx.beginPath()
      ctx.arc(0, 0, item.size, 0, Math.PI * 2)
      ctx.fill()
      
      // 引线
      ctx.strokeStyle = '#888'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, -item.size)
      ctx.quadraticCurveTo(10, -item.size - 15, 5, -item.size - 20)
      ctx.stroke()
      
      // 火花
      ctx.fillStyle = '#ff0000'
      ctx.beginPath()
      ctx.arc(5, -item.size - 20, 5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#ffcc00'
      ctx.beginPath()
      ctx.arc(5, -item.size - 20, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  })
  
  // 粒子效果
  particles.value.forEach(p => {
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.life / 40
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
  })
  ctx.globalAlpha = 1
  
  // 闪光效果
  if (flashEffect.value > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashEffect.value / 20})`
    ctx.fillRect(0, 0, 800, 500)
  }
  
  // HUD
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, 800, 50)
  
  ctx.fillStyle = '#ffd700'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`分数: ${score.value}`, 20, 32)
  
  ctx.fillStyle = timeLeft.value < 5 ? '#ff0000' : '#00ff00'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`时间: ${displayTime.value}s`, 400, 32)
  
  if (combo.value > 1) {
    ctx.fillStyle = '#ff6600'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`连击: x${combo.value}`, 780, 32)
  }
  
  // 物品说明
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 470, 800, 30)
  
  ctx.fillStyle = '#ffd700'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🪙 金币 +10   💎 钻石 +50   ⭐ 星星 +30   💣 炸弹 -50', 400, 488)
  
  // 游戏状态
  if (gameState.value === 'idle') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('💰 金币雨', 400, 200)
    
    ctx.fillStyle = '#fff'
    ctx.font = '20px Arial'
    ctx.fillText('收集金币和钻石，躲避炸弹！', 400, 260)
    
    ctx.fillStyle = '#aaa'
    ctx.font = '16px Arial'
    ctx.fillText('移动鼠标控制收集器', 400, 300)
  }
  
  if (gameState.value === 'finished') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏结束!', 400, 180)
    
    ctx.fillStyle = '#fff'
    ctx.font = '28px Arial'
    ctx.fillText(`最终分数: ${score.value}`, 400, 240)
    
    if (score.value > 0) {
      const reward = Math.floor(score.value * (betAmount.value / 100))
      ctx.fillStyle = '#00ff00'
      ctx.fillText(`赢得: ${reward} 击分`, 400, 290)
    }
    
    if (score.value >= bestScore.value) {
      ctx.fillStyle = '#ff6600'
      ctx.font = '20px Arial'
      ctx.fillText('新纪录!', 400, 330)
    }
    
    ctx.fillStyle = '#aaa'
    ctx.font = '18px Arial'
    ctx.fillText('点击继续', 400, 380)
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (gameState.value !== 'playing') return
  
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  
  playerX.value = ((e.clientX - rect.left) / rect.width) * 800
  playerX.value = Math.max(playerWidth / 2, Math.min(800 - playerWidth / 2, playerX.value))
}

const handleClick = () => {
  if (gameState.value === 'finished') {
    gameState.value = 'idle'
    draw()
  } else if (gameState.value === 'idle') {
    startGame()
  }
}

onMounted(() => {
  draw()
  canvas.value?.addEventListener('mousemove', handleMouseMove)
  canvas.value?.addEventListener('click', handleClick)
})

onUnmounted(() => {
  if (gameInterval) clearInterval(gameInterval)
  if (animationId) cancelAnimationFrame(animationId)
  canvas.value?.removeEventListener('mousemove', handleMouseMove)
  canvas.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <div class="coin-game">
    <div class="game-header">
      <h2 class="game-title">💰 金币雨</h2>
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">余额</span>
          <span class="stat-value">{{ gamblingScore }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">最高分</span>
          <span class="stat-value">{{ bestScore }}</span>
        </div>
      </div>
    </div>

    <div class="bet-section" v-if="gameState === 'idle'">
      <div class="bet-input">
        <label>投入击分:</label>
        <input 
          type="number" 
          v-model.number="betAmount" 
          :min="10"
          :max="gamblingScore"
          class="bet-number"
        />
      </div>
      <div class="quick-bets">
        <button 
          v-for="amount in [10, 50, 100, 500]" 
          :key="amount"
          class="quick-btn"
          :disabled="gamblingScore < amount"
          @click="betAmount = amount"
        >
          {{ amount }}
        </button>
      </div>
      
      <div class="game-rules">
        <p>🪙 收集金币获得10分</p>
        <p>💎 收集钻石获得50分</p>
        <p>⭐ 收集星星获得30分</p>
        <p>💣 碰到炸弹扣50分</p>
        <p>🔥 连续收集获得倍数奖励</p>
      </div>
      
      <button class="start-btn" @click="startGame" :disabled="gamblingScore < betAmount">
        开始游戏
      </button>
    </div>

    <div class="canvas-container">
      <canvas ref="canvas" width="800" height="500" class="game-canvas" />
    </div>

    <div class="game-info">
      <p>移动鼠标收集金币和钻石，躲避炸弹！连击可获得更高分数！</p>
    </div>
  </div>
</template>

<style scoped>
.coin-game {
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
  animation: coinGlow 2s ease-in-out infinite;
}

@keyframes coinGlow {
  0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
  50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.3); }
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

.bet-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.bet-input {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bet-input label {
  color: #aaa;
  font-size: 1rem;
}

.bet-number {
  width: 120px;
  padding: 0.6rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #ffd700;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
}

.bet-number:focus {
  outline: none;
  border-color: #ffd700;
}

.quick-bets {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.5rem 1rem;
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

.game-rules {
  text-align: center;
  color: #aaa;
  font-size: 0.9rem;
  line-height: 1.8;
}

.game-rules p {
  margin: 0.3rem 0;
}

.start-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3);
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4);
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.canvas-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.game-canvas {
  background: #0a0a2a;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.1);
  cursor: none;
  max-width: 100%;
  height: auto;
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #ffd700;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .coin-game {
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

  .bet-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
