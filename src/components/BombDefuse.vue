<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type GameState = 'idle' | 'playing' | 'defused' | 'exploded'

const gameState = ref<GameState>('idle')
const betAmount = ref(100)
const timeLeft = ref(10)
const wires = ref<{ color: string; name: string; cut: boolean; isCorrect: boolean }[]>([])
const currentRound = ref(0)
const totalRounds = ref(5)
const roundReward = ref(0)
const totalReward = ref(0)
const streak = ref(0)
const bestStreak = ref(parseInt(localStorage.getItem('bomb_best_streak') || '0'))

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let timerInterval: number | null = null
let frameCount = 0
let explosionParticles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = []
const correctWireName = ref('')

const wireColors = [
  { name: '红色', color: '#ff0000' },
  { name: '蓝色', color: '#0066ff' },
  { name: '绿色', color: '#00cc00' },
  { name: '黄色', color: '#ffcc00' },
  { name: '紫色', color: '#9900ff' },
  { name: '橙色', color: '#ff6600' },
  { name: '粉色', color: '#ff66cc' },
  { name: '白色', color: '#ffffff' }
]

const displayTime = computed(() => timeLeft.value.toFixed(1))

const startGame = () => {
  if (props.gamblingScore < betAmount.value) return
  
  gameState.value = 'playing'
  currentRound.value = 0
  totalReward.value = 0
  streak.value = 0
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  
  startRound()
}

const startRound = () => {
  currentRound.value++
  timeLeft.value = 10 - (currentRound.value - 1) * 0.5
  
  const wireCount = 3 + Math.floor(currentRound.value / 2)
  const correctIndex = Math.floor(Math.random() * wireCount)
  
  const shuffled = [...wireColors].sort(() => Math.random() - 0.5)
  
  wires.value = shuffled.slice(0, wireCount).map((w, i) => ({
    color: w.color,
    name: w.name,
    cut: false,
    isCorrect: i === correctIndex
  }))
  
  roundReward.value = betAmount.value * currentRound.value * 0.8
  
  // 记录正确的线用于提示
  correctWireName.value = wires.value[correctIndex]?.name || ''
  
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = window.setInterval(() => {
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      explode()
    }
  }, 100)
  
  draw()
}

const cutWire = (index: number) => {
  if (gameState.value !== 'playing') return
  
  const wire = wires.value[index]
  if (!wire || wire.cut) return
  
  wire.cut = true
  
  if (wire.isCorrect) {
    totalReward.value += roundReward.value
    streak.value++
    
    if (streak.value > bestStreak.value) {
      bestStreak.value = streak.value
      localStorage.setItem('bomb_best_streak', bestStreak.value.toString())
    }
    
    if (currentRound.value >= totalRounds.value) {
      defuse()
    } else {
      setTimeout(() => startRound(), 500)
    }
  } else {
    explode()
  }
  
  draw()
}

const defuse = () => {
  gameState.value = 'defused'
  if (timerInterval) clearInterval(timerInterval)
  
  const finalReward = Math.floor(totalReward.value)
  emit('score-gain', finalReward)
  
  draw()
}

const explode = () => {
  gameState.value = 'exploded'
  if (timerInterval) clearInterval(timerInterval)
  
  explosionParticles = []
  const colors = ['#ff0000', '#ff6600', '#ffcc00', '#ff3300']
  for (let i = 0; i < 50; i++) {
    explosionParticles.push({
      x: 400,
      y: 250,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      life: 60 + Math.random() * 30,
      color: colors[Math.floor(Math.random() * colors.length)] || '#ff0000'
    })
  }
  
  draw()
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
  const gradient = ctx.createLinearGradient(0, 0, 0, 500)
  gradient.addColorStop(0, '#1a1a2e')
  gradient.addColorStop(1, '#0a0a1a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 800, 500)
  
  // 网格背景
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i < 800; i += 40) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 500)
    ctx.stroke()
  }
  for (let i = 0; i < 500; i += 40) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(800, i)
    ctx.stroke()
  }
  
  // 炸弹主体
  const bombX = 400
  const bombY = 200
  
  // 炸弹阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(bombX, bombY + 120, 80, 20, 0, 0, Math.PI * 2)
  ctx.fill()
  
  // 炸弹身体
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.arc(bombX, bombY, 80, 0, Math.PI * 2)
  ctx.fill()
  
  // 炸弹高光
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.beginPath()
  ctx.arc(bombX - 20, bombY - 20, 30, 0, Math.PI * 2)
  ctx.fill()
  
  // 炸弹引线
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(bombX + 50, bombY - 50)
  ctx.quadraticCurveTo(bombX + 80, bombY - 100, bombX + 60, bombY - 130)
  ctx.stroke()
  
  // 引线火花
  if (gameState.value === 'playing') {
    const sparkSize = 5 + Math.sin(frameCount * 0.3) * 3
    ctx.fillStyle = '#ffcc00'
    ctx.beginPath()
    ctx.arc(bombX + 60, bombY - 130, sparkSize, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#ff6600'
    ctx.beginPath()
    ctx.arc(bombX + 60, bombY - 130, sparkSize * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // 计时器
  if (gameState.value === 'playing') {
    ctx.fillStyle = timeLeft.value < 3 ? '#ff0000' : timeLeft.value < 5 ? '#ffcc00' : '#00ff00'
    ctx.font = 'bold 36px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${displayTime.value}s`, bombX, bombY + 10)
    
    // 计时器脉冲效果
    if (timeLeft.value < 3) {
      const pulse = Math.sin(frameCount * 0.2) * 0.3 + 0.7
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.3})`
      ctx.beginPath()
      ctx.arc(bombX, bombY, 85, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  
  // 电线区域
  if (gameState.value === 'playing' && wires.value.length > 0) {
    const wireY = 370
    const wireSpacing = 600 / (wires.value.length + 1)
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(80, 330, 640, 100)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 2
    ctx.strokeRect(80, 330, 640, 100)
    
    ctx.fillStyle = '#aaa'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('选择正确的电线拆除炸弹', 400, 355)
    
    wires.value.forEach((wire, i) => {
      const x = 80 + wireSpacing * (i + 1)
      
      if (wire.cut) {
        ctx.strokeStyle = wire.isCorrect ? '#00ff00' : '#ff0000'
        ctx.lineWidth = 4
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(x - 20, wireY - 15)
        ctx.lineTo(x + 20, wireY + 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + 20, wireY - 15)
        ctx.lineTo(x - 20, wireY + 15)
        ctx.stroke()
        ctx.setLineDash([])
        
        ctx.fillStyle = wire.isCorrect ? '#00ff00' : '#ff0000'
        ctx.font = '20px Arial'
        ctx.fillText(wire.isCorrect ? '✓' : '✗', x, wireY + 40)
      } else {
        ctx.fillStyle = wire.color
        ctx.fillRect(x - 25, wireY - 8, 50, 16)
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.fillRect(x - 25, wireY - 8, 50, 4)
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.lineWidth = 1
        ctx.strokeRect(x - 25, wireY - 8, 50, 16)
        
        ctx.fillStyle = '#fff'
        ctx.font = '12px Arial'
        ctx.fillText(wireColors.find(c => c.color === wire.color)?.name || '', x, wireY + 35)
      }
    })
  }
  
  // 爆炸粒子效果
  if (gameState.value === 'exploded') {
    explosionParticles.forEach(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.2
      p.life--
      
      if (p.life > 0) {
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life / 90
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3 + (90 - p.life) * 0.1, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1
    
    if (explosionParticles.some(p => p.life > 0)) {
      animationId = requestAnimationFrame(draw)
    }
  }
  
  // 游戏状态显示
  if (gameState.value === 'defused') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#00ff00'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('炸弹已拆除!', 400, 220)
    
    ctx.fillStyle = '#ffd700'
    ctx.font = '28px Arial'
    ctx.fillText(`赢得: ${Math.floor(totalReward.value)} 击分`, 400, 280)
    
    ctx.fillStyle = '#ffcc00'
    ctx.font = '20px Arial'
    ctx.fillText(`连续拆除: ${streak.value} 次`, 400, 320)
    
    ctx.fillStyle = '#aaa'
    ctx.font = '16px Arial'
    ctx.fillText('点击继续', 400, 370)
  }
  
  if (gameState.value === 'exploded' && explosionParticles.every(p => p.life <= 0)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('BOOM!', 400, 220)
    
    ctx.fillStyle = '#ff6600'
    ctx.font = '24px Arial'
    ctx.fillText(`失去: ${betAmount.value} 击分`, 400, 280)
    
    ctx.fillStyle = '#aaa'
    ctx.font = '16px Arial'
    ctx.fillText('点击继续', 400, 330)
  }
  
  // 回合信息
  if (gameState.value === 'playing') {
    ctx.fillStyle = '#ffd700'
    ctx.font = '16px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`回合: ${currentRound.value}/${totalRounds.value}`, 20, 30)
    ctx.fillText(`奖励: ${Math.floor(roundReward.value)}`, 20, 55)
    ctx.fillText(`累计: ${Math.floor(totalReward.value)}`, 20, 80)
    
    // 显示提示
    if (correctWireName.value) {
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(`💡 提示: 剪断${correctWireName.value}线!`, 780, 30)
    }
  }
}

const handleClick = (e: MouseEvent) => {
  if (gameState.value === 'defused' || gameState.value === 'exploded') {
    gameState.value = 'idle'
    draw()
    return
  }
  
  if (gameState.value !== 'playing') return
  
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  
  const x = (e.clientX - rect.left) * (800 / rect.width)
  const y = (e.clientY - rect.top) * (500 / rect.height)
  
  if (y > 330 && y < 430) {
    const wireSpacing = 600 / (wires.value.length + 1)
    for (let i = 0; i < wires.value.length; i++) {
      const wireX = 80 + wireSpacing * (i + 1)
      if (x > wireX - 30 && x < wireX + 30) {
        cutWire(i)
        break
      }
    }
  }
}

onMounted(() => {
  draw()
  canvas.value?.addEventListener('click', handleClick)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (animationId) cancelAnimationFrame(animationId)
  canvas.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <div class="bomb-game">
    <div class="game-header">
      <h2 class="game-title">💣 炸弹拆除</h2>
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">余额</span>
          <span class="stat-value">{{ gamblingScore }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">最高连续</span>
          <span class="stat-value">{{ bestStreak }}</span>
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
        <p>🎯 选择正确的电线拆除炸弹</p>
        <p>⏱ 每回合时间递减，难度递增</p>
        <p>💰 连续拆除可获得更高奖励</p>
        <p>💀 选错电线或时间耗尽则爆炸</p>
      </div>
      
      <button class="start-btn" @click="startGame" :disabled="gamblingScore < betAmount">
        开始游戏
      </button>
    </div>

    <div class="canvas-container">
      <canvas ref="canvas" width="800" height="500" class="game-canvas" />
    </div>

    <div class="game-info">
      <p>紧张刺激的拆弹游戏！在限定时间内选择正确的电线拆除炸弹！</p>
    </div>
  </div>
</template>

<style scoped>
.bomb-game {
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
  color: #ff0000;
  margin-bottom: 1rem;
  text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  animation: bombPulse 2s ease-in-out infinite;
}

@keyframes bombPulse {
  0%, 100% { text-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
  50% { text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.3); }
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
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
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
  border-color: #ff0000;
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
  background: rgba(255, 0, 0, 0.2);
  border-color: #ff0000;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-btn {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.bet-btn:hover {
  background: rgba(255, 0, 0, 0.2);
  border-color: #ff0000;
}

.bet-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ff0000;
  min-width: 80px;
  text-align: center;
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
  background: linear-gradient(135deg, #ff0000, #cc0000);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 5px 20px rgba(255, 0, 0, 0.3);
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(255, 0, 0, 0.4);
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
  background: #0a0a1a;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 0, 0, 0.1);
  cursor: pointer;
  max-width: 100%;
  height: auto;
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(255, 0, 0, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(255, 0, 0, 0.3);
  color: #ff6666;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .bomb-game {
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
