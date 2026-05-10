<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type GameState = 'idle' | 'spinning' | 'result'

interface WheelSegment {
  label: string
  value: number
  color: string
  icon: string
}

const gameState = ref<GameState>('idle')
const betAmount = ref(100)
const currentRotation = ref(0)
const spinSpeed = ref(0)
const selectedSegment = ref<WheelSegment | null>(null)
const winAmount = ref(0)
const totalSpins = ref(parseInt(localStorage.getItem('wheel_spins') || '0'))
const totalWins = ref(parseInt(localStorage.getItem('wheel_wins') || '0'))

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let frameCount = 0

const segments: WheelSegment[] = [
  { label: 'x0', value: 0, color: '#ff0000', icon: '💀' },
  { label: 'x0.5', value: 0.5, color: '#333', icon: '🌑' },
  { label: 'x1', value: 1, color: '#0066ff', icon: '💎' },
  { label: 'x1.5', value: 1.5, color: '#00cc00', icon: '🍀' },
  { label: 'x2', value: 2, color: '#ffcc00', icon: '⭐' },
  { label: 'x0.5', value: 0.5, color: '#333', icon: '🌑' },
  { label: 'x3', value: 3, color: '#ff6600', icon: '🔥' },
  { label: 'x0.5', value: 0.5, color: '#333', icon: '🌑' },
  { label: 'x1', value: 1, color: '#0066ff', icon: '💎' },
  { label: 'x5', value: 5, color: '#9900ff', icon: '👑' },
  { label: 'x0.5', value: 0.5, color: '#333', icon: '🌑' },
  { label: 'x2', value: 2, color: '#ffcc00', icon: '⭐' },
  { label: 'x1', value: 1, color: '#0066ff', icon: '💎' },
  { label: 'x0', value: 0, color: '#ff0000', icon: '💀' },
  { label: 'x1.5', value: 1.5, color: '#00cc00', icon: '🍀' },
  { label: 'x10', value: 10, color: '#ff00ff', icon: '🎰' }
]

const startSpin = () => {
  if (props.gamblingScore < betAmount.value || gameState.value === 'spinning') return
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  
  gameState.value = 'spinning'
  selectedSegment.value = null
  winAmount.value = 0
  
  spinSpeed.value = 20 + Math.random() * 10
  
  totalSpins.value++
  localStorage.setItem('wheel_spins', totalSpins.value.toString())
  
  spinWheel()
}

const spinWheel = () => {
  const spin = () => {
    frameCount++
    
    currentRotation.value += spinSpeed.value
    spinSpeed.value *= 0.995
    
    if (spinSpeed.value < 0.5) {
      spinSpeed.value = 0
      determineResult()
      return
    }
    
    draw()
    animationId = requestAnimationFrame(spin)
  }
  
  spin()
}

const determineResult = () => {
  const segmentAngle = 360 / segments.length
  const normalizedRotation = currentRotation.value % 360
  
  // 计算最终指针位置的扇形索引
  // 指针在270度(顶部)，旋转后需要找到在270度位置的原始角度
  // 使用: (270 - rotation + 360) % 360 找到相对于顶部的原始角度
  const angleAtPointer = (270 - normalizedRotation + 360) % 360
  const selectedIndex = Math.floor(angleAtPointer / segmentAngle) % segments.length
  
  console.log('Final rotation:', normalizedRotation, 'Selected index:', selectedIndex, 'Segment:', segments[selectedIndex]?.label)
  
  const segment = segments[selectedIndex]
  if (!segment) return
  
  selectedSegment.value = segment
  winAmount.value = Math.floor(betAmount.value * segment.value)
  
  if (winAmount.value > 0) {
    emit('score-gain', winAmount.value)
    totalWins.value++
    localStorage.setItem('wheel_wins', totalWins.value.toString())
  }
  
  gameState.value = 'result'
  draw()
}

const adjustBet = (amount: number) => {
  if (gameState.value === 'spinning') return
  betAmount.value = Math.max(10, Math.min(props.gamblingScore, betAmount.value + amount))
}

const resetGame = () => {
  gameState.value = 'idle'
  selectedSegment.value = null
  winAmount.value = 0
  draw()
}

const draw = () => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  
  ctx.clearRect(0, 0, 800, 600)
  
  // 背景
  const bgGradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 400)
  bgGradient.addColorStop(0, '#1a0a2a')
  bgGradient.addColorStop(1, '#0a0a1a')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, 800, 600)
  
  // 装饰灯泡
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    const x = 400 + Math.cos(angle) * 280
    const y = 280 + Math.sin(angle) * 280
    
    const brightness = Math.sin(frameCount * 0.1 + i) * 0.3 + 0.7
    ctx.fillStyle = `rgba(255, 215, 0, ${brightness})`
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // 转盘
  const centerX = 400
  const centerY = 280
  const radius = 220
  
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate((currentRotation.value * Math.PI) / 180)
  
  // 绘制扇形
  const segmentAngle = (2 * Math.PI) / segments.length
  segments.forEach((seg, i) => {
    const startAngle = i * segmentAngle
    const endAngle = startAngle + segmentAngle
    
    ctx.fillStyle = seg.color
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // 文字和图标
    ctx.save()
    ctx.rotate(startAngle + segmentAngle / 2)
    ctx.translate(radius * 0.7, 0)
    ctx.rotate(Math.PI / 2)
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(seg.label, 0, -15)
    ctx.font = '24px Arial'
    ctx.fillText(seg.icon, 0, 15)
    
    ctx.restore()
  })
  
  // 中心圆
  ctx.fillStyle = '#ffd700'
  ctx.beginPath()
  ctx.arc(0, 0, 30, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#b8860b'
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#ffd700'
  ctx.font = 'bold 14px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('GO', 0, 0)
  
  ctx.restore()
  
  // 指针
  ctx.fillStyle = '#ff0000'
  ctx.beginPath()
  ctx.moveTo(centerX, centerY - radius - 20)
  ctx.lineTo(centerX - 15, centerY - radius - 40)
  ctx.lineTo(centerX + 15, centerY - radius - 40)
  ctx.closePath()
  ctx.fill()
  
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()
  
  // 结果显示
  if (gameState.value === 'result' && selectedSegment.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, 800, 600)
    
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('转盘停止!', 400, 200)
    
    ctx.fillStyle = selectedSegment.value.color
    ctx.font = 'bold 64px Arial'
    ctx.fillText(selectedSegment.value.icon, 400, 300)
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px Arial'
    ctx.fillText(selectedSegment.value.label, 400, 360)
    
    if (winAmount.value > 0) {
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 28px Arial'
      ctx.fillText(`赢得: ${winAmount.value} 击分!`, 400, 420)
    } else {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 28px Arial'
      ctx.fillText('很遗憾, 未中奖', 400, 420)
    }
    
    ctx.fillStyle = '#aaa'
    ctx.font = '18px Arial'
    ctx.fillText('点击继续', 400, 480)
  }
  
  // 统计信息
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 560, 800, 40)
  
  ctx.fillStyle = '#aaa'
  ctx.font = '14px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`总次数: ${totalSpins.value}   中奖次数: ${totalWins.value}   中奖率: ${totalSpins.value > 0 ? Math.round(totalWins.value / totalSpins.value * 100) : 0}%`, 400, 585)
}

const handleClick = () => {
  if (gameState.value === 'result') {
    resetGame()
  } else if (gameState.value === 'idle') {
    startSpin()
  }
}

onMounted(() => {
  draw()
  canvas.value?.addEventListener('click', handleClick)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  canvas.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <div class="wheel-game">
    <div class="game-header">
      <h2 class="game-title">🎡 命运之轮</h2>
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">余额</span>
          <span class="stat-value">{{ gamblingScore }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">中奖率</span>
          <span class="stat-value">{{ totalSpins > 0 ? Math.round(totalWins / totalSpins * 100) : 0 }}%</span>
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
      
      <div class="wheel-info">
        <p class="info-title">转盘奖励:</p>
        <div class="reward-list">
          <span class="reward-item" v-for="seg in segments.slice(0, 8)" :key="seg.label">
            {{ seg.icon }} {{ seg.label }}
          </span>
        </div>
        <p class="info-note">最高可赢 x10 倍奖励!</p>
      </div>
      
      <button class="start-btn" @click="startSpin" :disabled="gamblingScore < betAmount">
        转动转盘
      </button>
    </div>

    <div class="canvas-container">
      <canvas ref="canvas" width="800" height="600" class="game-canvas" />
    </div>

    <div class="game-info">
      <p>转动命运之轮，赢取丰厚奖励！最高可获得10倍赌注！</p>
    </div>
  </div>
</template>

<style scoped>
.wheel-game {
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
  color: #9900ff;
  margin-bottom: 1rem;
  text-shadow: 0 0 10px rgba(153, 0, 255, 0.5);
  animation: wheelGlow 2s ease-in-out infinite;
}

@keyframes wheelGlow {
  0%, 100% { text-shadow: 0 0 10px rgba(153, 0, 255, 0.5); }
  50% { text-shadow: 0 0 20px rgba(153, 0, 255, 0.8), 0 0 40px rgba(153, 0, 255, 0.3); }
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
  background: rgba(153, 0, 255, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(153, 0, 255, 0.3);
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
  border-color: #9900ff;
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
  background: rgba(153, 0, 255, 0.2);
  border-color: #9900ff;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-btn:hover {
  background: rgba(153, 0, 255, 0.2);
  border-color: #9900ff;
}

.bet-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
  min-width: 80px;
  text-align: center;
}

.wheel-info {
  text-align: center;
  width: 100%;
}

.info-title {
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.reward-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.reward-item {
  padding: 0.4rem 0.8rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 0.85rem;
  color: #fff;
}

.info-note {
  color: #ffd700;
  font-size: 0.9rem;
  font-weight: 600;
}

.start-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #9900ff, #6600cc);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 5px 20px rgba(153, 0, 255, 0.3);
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(153, 0, 255, 0.4);
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
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(153, 0, 255, 0.1);
  cursor: pointer;
  max-width: 100%;
  height: auto;
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(153, 0, 255, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(153, 0, 255, 0.3);
  color: #cc66ff;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .wheel-game {
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

  .reward-list {
    gap: 0.5rem;
  }

  .reward-item {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }
}
</style>
