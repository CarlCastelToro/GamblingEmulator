<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  id: number
}

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 500
const PEG_ROWS = 8
const PEGS_PER_ROW = 9
const PEG_RADIUS = 6
const BALL_RADIUS = 8
const SLOT_HEIGHT = 40

const betAmount = ref(100)
const balls = ref<Ball[]>([])
const isDropping = ref(false)
const lastResult = ref<{ type: string; message: string } | null>(null)
const totalWin = ref(0)
const ballCount = ref(0)

// Multiplier slots at bottom - evenly distributed
const SLOT_COUNT = 9
const SLOT_WIDTH = CANVAS_WIDTH / SLOT_COUNT
const slotMultipliers = [10, 5, 3, 2, 1, 2, 3, 5, 10]

const slots = slotMultipliers.map((mult, i) => ({
  x: i * SLOT_WIDTH,
  width: SLOT_WIDTH,
  multiplier: mult,
  label: `${mult}x`,
  color: mult >= 5 ? '#ff6b6b' : mult >= 3 ? '#ffd700' : mult >= 2 ? '#4CAF50' : '#666'
}))

const getPegs = () => {
  const pegs: { x: number; y: number }[] = []
  const startY = 60
  const endY = CANVAS_HEIGHT - SLOT_HEIGHT - 40
  const rowSpacing = (endY - startY) / (PEG_ROWS - 1)

  for (let row = 0; row < PEG_ROWS; row++) {
    const pegsInRow = row % 2 === 0 ? PEGS_PER_ROW : PEGS_PER_ROW - 1
    const startX = row % 2 === 0 ? CANVAS_WIDTH / (PEGS_PER_ROW + 1) : CANVAS_WIDTH / (PEGS_PER_ROW)
    const spacing = (CANVAS_WIDTH - startX * 2) / (pegsInRow - 1)

    for (let col = 0; col < pegsInRow; col++) {
      pegs.push({
        x: startX + col * spacing,
        y: startY + row * rowSpacing
      })
    }
  }
  return pegs
}

const pegs = getPegs()

let animFrame: number | null = null
let ballIdCounter = 0

const dropBall = () => {
  if (isDropping.value) return
  if (props.gamblingScore < betAmount.value) {
    lastResult.value = { type: 'error', message: '击分不足！' }
    return
  }

  const currentBet = betAmount.value
  emit('update:gamblingScore', props.gamblingScore - currentBet)
  isDropping.value = true
  totalWin.value = 0
  ballCount.value = 0
  lastResult.value = null

  // Drop 5 balls with staggered timing
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const ball: Ball = {
        x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 60,
        y: 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0,
        id: ballIdCounter++
      }
      balls.value.push(ball)
    }, i * 250)
  }

  // Start animation loop
  const animate = () => {
    let activeCount = 0

    balls.value.forEach(ball => {
      // Skip if already settled
      if (ball.y >= CANVAS_HEIGHT) return
      activeCount++

      // Apply gravity
      ball.vy += 0.25
      ball.vy = Math.min(ball.vy, 12) // Terminal velocity

      // Update position
      ball.y += ball.vy
      ball.x += ball.vx

      // Wall bounce (left/right)
      if (ball.x < BALL_RADIUS) {
        ball.x = BALL_RADIUS
        ball.vx = Math.abs(ball.vx) * 0.7
      } else if (ball.x > CANVAS_WIDTH - BALL_RADIUS) {
        ball.x = CANVAS_WIDTH - BALL_RADIUS
        ball.vx = -Math.abs(ball.vx) * 0.7
      }

      // Peg collision detection
      for (const peg of pegs) {
        const dx = ball.x - peg.x
        const dy = ball.y - peg.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = PEG_RADIUS + BALL_RADIUS

        if (dist < minDist && dist > 0) {
          // Normalize direction
          const nx = dx / dist
          const ny = dy / dist

          // Push ball out of peg
          ball.x = peg.x + nx * minDist
          ball.y = peg.y + ny * minDist

          // Reflect velocity with some randomness
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
          const bounceSpeed = Math.max(speed, 2)
          ball.vx = nx * bounceSpeed + (Math.random() - 0.5) * 1.5
          ball.vy = Math.abs(ny * bounceSpeed) * 0.8 + 0.5
        }
      }

      // Check if ball reached bottom slot area
      const slotTop = CANVAS_HEIGHT - SLOT_HEIGHT
      if (ball.y >= slotTop) {
        // Find which slot the ball landed in
        const slotIndex = Math.floor(ball.x / SLOT_WIDTH)
        const clampedIndex = Math.max(0, Math.min(slotIndex, SLOT_COUNT - 1))
        const slot = slots[clampedIndex]

        if (slot) {
          const win = Math.floor(currentBet * slot.multiplier / 5)
          totalWin.value += win
          ballCount.value++
        }

        // Settle ball
        ball.y = CANVAS_HEIGHT + 10
        ball.vy = 0
        ball.vx = 0
      }
    })

    // Clean up settled balls after a delay
    if (activeCount === 0 && balls.value.length > 0) {
      balls.value = []
      isDropping.value = false

      if (totalWin.value > 0) {
        emit('score-gain', totalWin.value)
        lastResult.value = { type: 'success', message: `🎯 获得 ${totalWin.value} 击分！` }
      } else {
        lastResult.value = { type: 'fail', message: '很遗憾，未中奖！' }
      }
      return
    }

    animFrame = requestAnimationFrame(animate)
  }

  animFrame = requestAnimationFrame(animate)
}

onUnmounted(() => {
  if (animFrame) {
    cancelAnimationFrame(animFrame)
    animFrame = null
  }
})

const quickBet = (amount: number) => {
  betAmount.value = Math.min(amount, props.gamblingScore)
}
</script>

<template>
  <div class="plinko-game">
    <h1 class="game-title">🎯 弹球</h1>

    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ Math.floor(gamblingScore) }}</span>
      </div>
      <div v-if="totalWin > 0" class="win-display">
        🏆 中奖: {{ totalWin }}
      </div>
      <div v-if="ballCount > 0" class="ball-count">
        球数: {{ ballCount }}/5
      </div>
    </div>

    <div class="board-container">
      <svg :width="CANVAS_WIDTH" :height="CANVAS_HEIGHT" class="board" viewBox="0 0 400 500">
        <!-- Background gradient -->
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1a1a2e" />
            <stop offset="100%" stop-color="#0f0f1a" />
          </linearGradient>
        </defs>
        <rect width="CANVAS_WIDTH" height="CANVAS_HEIGHT" fill="url(#bgGrad)" />

        <!-- Pegs -->
        <circle
          v-for="(peg, i) in pegs"
          :key="'peg-' + i"
          :cx="peg.x"
          :cy="peg.y"
          :r="PEG_RADIUS"
          fill="#ffd700"
          stroke="#b8860b"
          stroke-width="1.5"
          opacity="0.9"
        />

        <!-- Slots background -->
        <rect
          v-for="(slot, i) in slots"
          :key="'slot-bg-' + i"
          :x="slot.x"
          :y="CANVAS_HEIGHT - SLOT_HEIGHT"
          :width="slot.width"
          :height="SLOT_HEIGHT"
          :fill="slot.color"
          stroke="#222"
          stroke-width="1"
          opacity="0.8"
        />

        <!-- Slots labels -->
        <text
          v-for="(slot, i) in slots"
          :key="'slot-label-' + i"
          :x="slot.x + slot.width / 2"
          :y="CANVAS_HEIGHT - SLOT_HEIGHT / 2 + 5"
          text-anchor="middle"
          fill="white"
          font-size="14"
          font-weight="bold"
        >{{ slot.label }}</text>

        <!-- Balls -->
        <circle
          v-for="ball in balls"
          :key="'ball-' + ball.id"
          :cx="ball.x"
          :cy="Math.min(ball.y, CANVAS_HEIGHT)"
          :r="BALL_RADIUS"
          fill="#ff6b6b"
          stroke="#dc3545"
          stroke-width="2"
        >
          <animate attributeName="opacity" values="0.8;1;0.8" dur="0.5s" repeatCount="indefinite" />
        </circle>

        <!-- Top drop zone indicator -->
        <rect x="0" y="0" :width="CANVAS_WIDTH" height="30" fill="rgba(0,0,0,0.5)" />
        <text x="CANVAS_WIDTH/2" y="20" text-anchor="middle" fill="#888" font-size="12">投放区域</text>
      </svg>
    </div>

    <div class="controls">
      <div class="bet-area">
        <label>下注:</label>
        <div class="bet-controls">
          <button @click="betAmount = Math.max(10, betAmount - 10)" class="adj-btn">-</button>
          <span class="bet-amount">{{ betAmount }}</span>
          <button @click="betAmount = Math.min(gamblingScore, betAmount + 10)" class="adj-btn">+</button>
        </div>
        <div class="quick-bets">
          <button @click="quickBet(50)" class="quick-btn">50</button>
          <button @click="quickBet(100)" class="quick-btn">100</button>
          <button @click="quickBet(500)" class="quick-btn">500</button>
        </div>
      </div>

      <button
        class="drop-btn"
        :disabled="isDropping || gamblingScore < betAmount"
        @click="dropBall"
      >
        {{ isDropping ? '🎯 弹球中...' : '🎯 投放弹球 (5个)' }}
      </button>
    </div>

    <div v-if="lastResult" class="result" :class="lastResult.type">
      {{ lastResult.message }}
    </div>

    <div class="multiplier-info">
      <h3>📊 倍率表</h3>
      <div class="mult-grid">
        <div v-for="(slot, i) in slots" :key="'info-' + i" class="mult-item" :style="{ background: slot.color + '33' }">
          <span class="mult-label">{{ slot.label }}</span>
        </div>
      </div>
    </div>

    <div class="rules">
      <h3>📜 规则</h3>
      <ul>
        <li>• 点击投放5个弹球</li>
        <li>• 弹球经过钉子弹跳</li>
        <li>• 落入底部不同倍率槽</li>
        <li>• 中间1x，两侧倍率递增</li>
        <li>• 最高可获10x奖励</li>
        <li>• 每球奖励 = 下注 × 倍率 ÷ 5</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.plinko-game {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; max-width: 500px; margin: 0 auto; gap: 1rem;
}
.game-title { color: #ffd700; font-size: 2rem; text-shadow: 0 0 15px rgba(255,215,0,0.5); }

.game-info { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center; }
.score-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.score-display .label { color: #888; }
.score-display .value { color: #ffd700; font-size: 1.3rem; font-weight: bold; }
.win-display { color: #28a745; font-weight: bold; padding: 0.5rem 1rem; background: rgba(40,167,69,0.2); border-radius: 10px; animation: pulse 0.5s infinite; }
.ball-count { color: #ccc; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }

@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }

.board-container {
  background: linear-gradient(180deg, #1a1a2e, #0f0f1a);
  border-radius: 12px; padding: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  border: 2px solid rgba(255,215,0,0.3);
  width: 100%; max-width: 420px;
}
.board { display: block; width: 100%; height: auto; }

.controls { width: 100%; display: flex; flex-direction: column; gap: 1rem; }
.bet-area { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.bet-area label { color: #ccc; }
.bet-controls { display: flex; align-items: center; gap: 0.5rem; }
.adj-btn { width: 30px; height: 30px; border: none; border-radius: 6px; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; font-size: 1rem; }
.adj-btn:hover { background: rgba(255,255,255,0.3); }
.bet-amount { color: #ffd700; font-size: 1.3rem; font-weight: bold; min-width: 60px; text-align: center; }
.quick-bets { display: flex; gap: 0.5rem; }
.quick-btn { padding: 0.3rem 0.6rem; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
.quick-btn:hover { background: #555; }

.drop-btn {
  width: 100%; padding: 1rem; background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white; border: none; border-radius: 12px; font-size: 1.2rem;
  font-weight: bold; cursor: pointer; transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(238,90,36,0.4);
}
.drop-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 6px 20px rgba(238,90,36,0.6); }
.drop-btn:disabled { background: #444; cursor: not-allowed; box-shadow: none; }

.result {
  padding: 0.8rem; border-radius: 10px; font-size: 1rem;
  font-weight: bold; text-align: center; width: 100%;
}
.result.success { background: rgba(40,167,69,0.2); color: #28a745; border: 1px solid rgba(40,167,69,0.3); }
.result.fail { background: rgba(220,53,69,0.2); color: #dc3545; border: 1px solid rgba(220,53,69,0.3); }
.result.error { background: rgba(255,193,7,0.2); color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }

.multiplier-info { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.multiplier-info h3 { color: #ffd700; margin-bottom: 0.8rem; text-align: center; }
.mult-grid { display: flex; gap: 4px; justify-content: center; }
.mult-item {
  padding: 0.4rem 0.6rem; border-radius: 6px; text-align: center;
  min-width: 40px; border: 1px solid rgba(255,255,255,0.1);
}
.mult-label { color: #fff; font-weight: bold; font-size: 0.85rem; }

.rules { width: 100%; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 10px; }
.rules h3 { color: #ffd700; margin-bottom: 0.5rem; }
.rules ul { list-style: none; padding: 0; }
.rules li { color: #ccc; padding: 0.3rem 0; font-size: 0.85rem; }
</style>
