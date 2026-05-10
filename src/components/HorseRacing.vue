<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type GameState = 'betting' | 'racing' | 'finished'

interface Horse {
  id: number
  name: string
  color: string
  position: number
  speed: number
  stamina: number
  icon: string
  odds: number
}

const gameState = ref<GameState>('betting')
const betAmount = ref(100)
const selectedHorse = ref<number | null>(null)
const raceProgress = ref(0)
const countdown = ref(3)
const winner = ref<Horse | null>(null)
const winAmount = ref(0)

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let frameCount = 0

const horses = ref<Horse[]>([
  { id: 0, name: '烈焰', color: '#ff0000', position: 0, speed: 0, stamina: 100, icon: '🐎', odds: 2.5 },
  { id: 1, name: '疾风', color: '#00ccff', position: 0, speed: 0, stamina: 100, icon: '🏇', odds: 3.0 },
  { id: 2, name: '雷霆', color: '#ffcc00', position: 0, speed: 0, stamina: 100, icon: '⚡', odds: 2.0 },
  { id: 3, name: '暗影', color: '#9900ff', position: 0, speed: 0, stamina: 100, icon: '🌑', odds: 3.5 },
  { id: 4, name: '流星', color: '#00ff00', position: 0, speed: 0, stamina: 100, icon: '☄️', odds: 4.0 }
])

const startRace = () => {
  if (selectedHorse.value === null || props.gamblingScore < betAmount.value) return
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  
  gameState.value = 'racing'
  raceProgress.value = 0
  winner.value = null
  winAmount.value = 0
  countdown.value = 3
  
  horses.value.forEach(h => {
    h.position = 0
    h.speed = 0
    h.stamina = 100
  })
  
  const countInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countInterval)
      startRunning()
    }
  }, 1000)
}

const startRunning = () => {
  const raceInterval = setInterval(() => {
    frameCount++
    
    horses.value.forEach(horse => {
      const baseSpeed = 2 + Math.random() * 2
      const staminaFactor = horse.stamina / 100
      const randomBoost = Math.random() < 0.05 ? 2 : 1
      
      horse.speed = baseSpeed * staminaFactor * randomBoost
      horse.position += horse.speed
      horse.stamina -= 0.1 + Math.random() * 0.2
      
      if (horse.stamina < 0) horse.stamina = 0
    })
    
    raceProgress.value = Math.max(...horses.value.map(h => h.position))
    
    const finishLine = 700
    const winnerHorse = horses.value.find(h => h.position >= finishLine)
    
    if (winnerHorse && !winner.value) {
      winner.value = winnerHorse
      gameState.value = 'finished'
      clearInterval(raceInterval)
      
      if (winnerHorse.id === selectedHorse.value) {
        winAmount.value = Math.floor(betAmount.value * winnerHorse.odds)
        emit('score-gain', winAmount.value)
      }
    }
    
    draw()
  }, 50)
}

const selectHorse = (id: number) => {
  if (gameState.value !== 'betting') return
  selectedHorse.value = id
}

const adjustBet = (amount: number) => {
  if (gameState.value !== 'betting') return
  betAmount.value = Math.max(10, Math.min(props.gamblingScore, betAmount.value + amount))
}

const resetGame = () => {
  gameState.value = 'betting'
  selectedHorse.value = null
  winner.value = null
  winAmount.value = 0
  frameCount = 0
  draw()
}

const draw = () => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  
  ctx.clearRect(0, 0, 800, 500)
  
  // 背景 - 草地
  const grassGradient = ctx.createLinearGradient(0, 0, 0, 500)
  grassGradient.addColorStop(0, '#2d5a1e')
  grassGradient.addColorStop(1, '#1a3a0e')
  ctx.fillStyle = grassGradient
  ctx.fillRect(0, 0, 800, 500)
  
  // 赛道
  const trackY = 100
  const trackHeight = 350
  const trackColor1 = '#8B4513'
  const trackColor2 = '#A0522D'
  
  for (let i = 0; i < 5; i++) {
    const y = trackY + i * 70
    ctx.fillStyle = i % 2 === 0 ? trackColor1 : trackColor2
    ctx.fillRect(0, y, 800, 65)
    
    // 赛道线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(0, y + 32)
    ctx.lineTo(800, y + 32)
    ctx.stroke()
    ctx.setLineDash([])
  }
  
  // 起跑线
  ctx.fillStyle = '#fff'
  ctx.fillRect(80, trackY, 4, trackHeight)
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('START', 80, trackY - 5)
  
  // 终点线
  ctx.fillRect(700, trackY, 4, trackHeight)
  ctx.fillText('FINISH', 700, trackY - 5)
  
  // 终点格子旗
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#000' : '#fff'
      ctx.fillRect(704 + col * 12, trackY + row * 12, 12, 12)
    }
  }
  
  // 马匹
  horses.value.forEach((horse, i) => {
    const x = 80 + horse.position
    const y = trackY + i * 70 + 15
    
    // 马匹阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.ellipse(x + 20, y + 45, 25, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 马匹身体
    ctx.fillStyle = horse.color
    ctx.beginPath()
    ctx.ellipse(x + 20, y + 25, 25, 18, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 马头
    ctx.beginPath()
    ctx.ellipse(x + 40, y + 20, 12, 10, -0.3, 0, Math.PI * 2)
    ctx.fill()
    
    // 马腿动画
    const legAngle = Math.sin(frameCount * 0.3 + i) * 0.5
    ctx.strokeStyle = horse.color
    ctx.lineWidth = 4
    
    // 前腿
    ctx.beginPath()
    ctx.moveTo(x + 10, y + 35)
    ctx.lineTo(x + 10 + Math.sin(legAngle) * 15, y + 50)
    ctx.stroke()
    
    ctx.beginPath()
    ctx.moveTo(x + 25, y + 35)
    ctx.lineTo(x + 25 + Math.sin(-legAngle) * 15, y + 50)
    ctx.stroke()
    
    // 后腿
    ctx.beginPath()
    ctx.moveTo(x + 5, y + 30)
    ctx.lineTo(x + 5 + Math.sin(-legAngle) * 12, y + 48)
    ctx.stroke()
    
    ctx.beginPath()
    ctx.moveTo(x + 20, y + 30)
    ctx.lineTo(x + 20 + Math.sin(legAngle) * 12, y + 48)
    ctx.stroke()
    
    // 选中标记
    if (selectedHorse.value === i) {
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 3
      ctx.strokeRect(x - 5, y - 5, 55, 60)
    }
    
    // 马匹名称和赔率
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`${horse.icon} ${horse.name}`, 5, y + 30)
    ctx.font = '10px Arial'
    ctx.fillText(`x${horse.odds}`, 5, y + 45)
    
    // 耐力条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(x - 5, y - 12, 50, 6)
    ctx.fillStyle = horse.stamina > 50 ? '#00ff00' : horse.stamina > 20 ? '#ffcc00' : '#ff0000'
    ctx.fillRect(x - 5, y - 12, horse.stamina * 0.5, 6)
  })
  
  // 倒计时
  if (gameState.value === 'racing' && countdown.value > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 120px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(countdown.value.toString(), 400, 300)
  }
  
  // 游戏结束
  if (gameState.value === 'finished' && winner.value) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, 800, 500)
    
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('比赛结束!', 400, 180)
    
    ctx.fillStyle = winner.value.color
    ctx.font = 'bold 36px Arial'
    ctx.fillText(`${winner.value.icon} ${winner.value.name} 获胜!`, 400, 250)
    
    if (selectedHorse.value === winner.value.id) {
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 28px Arial'
      ctx.fillText(`恭喜! 赢得 ${winAmount.value} 击分!`, 400, 310)
    } else {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 28px Arial'
      ctx.fillText(`很遗憾, 失去 ${betAmount.value} 击分`, 400, 310)
    }
    
    ctx.fillStyle = '#aaa'
    ctx.font = '18px Arial'
    ctx.fillText('点击继续', 400, 380)
  }
}

const handleClick = () => {
  if (gameState.value === 'finished') {
    resetGame()
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
  <div class="horse-game">
    <div class="game-header">
      <h2 class="game-title">🏇 赛马竞速</h2>
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">余额</span>
          <span class="stat-value">{{ gamblingScore }}</span>
        </div>
      </div>
    </div>

    <div class="bet-section" v-if="gameState === 'betting'">
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
      
      <div class="horse-selector">
        <p class="select-title">选择你的马匹:</p>
        <div class="horse-options">
          <button 
            v-for="horse in horses" 
            :key="horse.id"
            class="horse-btn"
            :class="{ selected: selectedHorse === horse.id }"
            :style="{ '--horse-color': horse.color }"
            @click="selectHorse(horse.id)"
          >
            <span class="horse-icon">{{ horse.icon }}</span>
            <span class="horse-name">{{ horse.name }}</span>
            <span class="horse-odds">赔率: x{{ horse.odds }}</span>
          </button>
        </div>
      </div>
      
      <button 
        class="start-btn" 
        @click="startRace" 
        :disabled="selectedHorse === null || gamblingScore < betAmount"
      >
        开始比赛
      </button>
    </div>

    <div class="canvas-container">
      <canvas ref="canvas" width="800" height="500" class="game-canvas" />
    </div>

    <div class="game-info">
      <p>选择你看好的马匹，下注赢取大奖！耐力和速度决定胜负！</p>
    </div>
  </div>
</template>

<style scoped>
.horse-game {
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
  color: #8B4513;
  margin-bottom: 1rem;
  text-shadow: 0 0 10px rgba(139, 69, 19, 0.5);
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
  background: rgba(139, 69, 19, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(139, 69, 19, 0.4);
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
  border-color: #8B4513;
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
  background: rgba(139, 69, 19, 0.3);
  border-color: #8B4513;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-btn:hover {
  background: rgba(139, 69, 19, 0.3);
  border-color: #8B4513;
}

.bet-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
  min-width: 80px;
  text-align: center;
}

.horse-selector {
  width: 100%;
}

.select-title {
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.horse-options {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}

.horse-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid var(--horse-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 100px;
}

.horse-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.horse-btn.selected {
  background: rgba(var(--horse-color), 0.3);
  box-shadow: 0 0 20px var(--horse-color);
}

.horse-icon {
  font-size: 1.5rem;
}

.horse-name {
  color: var(--horse-color);
  font-weight: 600;
  font-size: 0.95rem;
}

.horse-odds {
  color: #aaa;
  font-size: 0.8rem;
}

.start-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #8B4513, #A0522D);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 5px 20px rgba(139, 69, 19, 0.3);
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(139, 69, 19, 0.4);
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
  background: #2d5a1e;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  max-width: 100%;
  height: auto;
}

.game-info {
  text-align: center;
  padding: 1rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(139, 69, 19, 0.4);
  color: #d2691e;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .horse-game {
    padding: 1rem;
  }

  .game-title {
    font-size: 1.5rem;
  }

  .horse-options {
    gap: 0.5rem;
  }

  .horse-btn {
    padding: 0.8rem;
    min-width: 80px;
  }

  .horse-name {
    font-size: 0.85rem;
  }
}
</style>
