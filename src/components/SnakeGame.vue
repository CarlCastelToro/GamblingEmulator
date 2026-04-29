<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

interface Position {
  x: number
  y: number
}

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

const GRID_SIZE = 20
const CELL_SIZE = 22

const snake = ref<Position[]>([{ x: 10, y: 10 }])
const food = ref<Position>({ x: 15, y: 15 })
const direction = ref<Position>({ x: 1, y: 0 })
const nextDirection = ref<Position>({ x: 1, y: 0 })
const gameOver = ref(false)
const score = ref(0)
const speed = ref(150)
const isPaused = ref(false)
const extraLength = ref(0)

let gameLoop: number | null = null

const gridSize = GRID_SIZE * CELL_SIZE

const gridStyle = computed(() => ({
  width: `${gridSize}px`,
  height: `${gridSize}px`,
  gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`
}))

const getCellClass = (x: number, y: number): string => {
  const isFood = food.value.x === x && food.value.y === y
  const head = snake.value[0]
  const isHead = head && head.x === x && head.y === y
  
  if (isHead) return 'snake-head'
  
  // 检查是否是蛇身，并判断是否是额外长度部分
  const snakeIndex = snake.value.findIndex(segment => segment.x === x && segment.y === y)
  if (snakeIndex !== -1) {
    // 基本长度 = 初始1节 + 吃食物获得的长度(得分/10)
    const baseLength = 1 + Math.floor(score.value / 10)
    // 如果索引超过基本长度，说明是额外获得的长度
    if (snakeIndex >= baseLength) {
      return 'snake-body-gold'
    }
    return 'snake-body'
  }
  
  if (isFood) return 'food'
  return ''
}

const generateFood = (): void => {
  let newFood: Position
  do {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    }
  } while (snake.value.some(segment => segment.x === newFood.x && segment.y === newFood.y))
  food.value = newFood
}

const moveSnake = (): void => {
  if (gameOver.value || isPaused.value) return
  
  direction.value = nextDirection.value
  
  const currentHead = snake.value[0]
  if (!currentHead) return
  const head: Position = { x: currentHead.x, y: currentHead.y }
  head.x += direction.value.x
  head.y += direction.value.y
  
  // 穿墙逻辑：边缘穿越到对侧
  if (head.x < 0) head.x = GRID_SIZE - 1
  if (head.x >= GRID_SIZE) head.x = 0
  if (head.y < 0) head.y = GRID_SIZE - 1
  if (head.y >= GRID_SIZE) head.y = 0
  
  // 只有撞到自身才算游戏结束
  if (snake.value.some(segment => segment.x === head.x && segment.y === head.y)) {
    gameOver.value = true
    return
  }
  
  snake.value.unshift(head)
  
  if (head.x === food.value.x && head.y === food.value.y) {
    score.value += 10
    
    // 概率检查：概率 = 当前得分 / 1000，检查次数 = 当前得分 / 10
    const probability = score.value / 1000
    const checkCount = Math.floor(score.value / 10)
    
    for (let i = 0; i < checkCount; i++) {
      if (Math.random() < probability) {
        // 通过概率检查，蛇长度额外加一
        const tail = snake.value[snake.value.length - 1]
        if (tail) {
          snake.value.push({ x: tail.x, y: tail.y })
          extraLength.value++
        }
      }
    }
    
    generateFood()
  } else {
    snake.value.pop()
  }
}

const reviveSnake = (): void => {
  if (props.gamblingScore < 114) return
  
  // 花费114击分
  let newGamblingScore = props.gamblingScore - 114
  
  // 计算当前额外长度
  const currentExtra = extraLength.value
  
  // 长度减半（从末端开始）
  const halfLength = Math.ceil(snake.value.length / 2)
  snake.value = snake.value.slice(0, halfLength)
  
  // 计算新的额外长度
  const newBaseLength = 1 + Math.floor(score.value / 10)
  const newExtra = Math.max(0, snake.value.length - newBaseLength)
  const removedExtra = currentExtra - newExtra
  
  // 每减少一段额外长度获得5击分
  newGamblingScore += removedExtra * 5
  
  // 每一个减少的额外长度独立计算概率奖励
  for (let i = 0; i < removedExtra; i++) {
    const rand = Math.random()
    if (rand < 0.25) {
      newGamblingScore += 2
    } else if (rand < 0.75) {
      newGamblingScore += 1
    }
  }
  
  extraLength.value = newExtra
  gameOver.value = false
  
  // 更新外部击分
  emit('update:gamblingScore', newGamblingScore)
}

const startGame = (): void => {
  // 结算额外长度，每段获得2击分
  const reward = extraLength.value * 2
  emit('update:gamblingScore', props.gamblingScore + reward)
  
  snake.value = [{ x: 10, y: 10 }]
  direction.value = { x: 1, y: 0 }
  nextDirection.value = { x: 1, y: 0 }
  gameOver.value = false
  score.value = 0
  isPaused.value = false
  extraLength.value = 0
  generateFood()
  
  if (gameLoop) clearInterval(gameLoop)
  gameLoop = window.setInterval(moveSnake, speed.value)
}

const togglePause = (): void => {
  if (!gameOver.value) {
    isPaused.value = !isPaused.value
  }
}

const handleKeyDown = (e: KeyboardEvent): void => {
  if (gameOver.value) {
    if (e.key === 'Enter') startGame()
    return
  }
  
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      if (direction.value.y !== 1) nextDirection.value = { x: 0, y: -1 }
      break
    case 'ArrowDown':
      e.preventDefault()
      if (direction.value.y !== -1) nextDirection.value = { x: 0, y: 1 }
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (direction.value.x !== 1) nextDirection.value = { x: -1, y: 0 }
      break
    case 'ArrowRight':
      e.preventDefault()
      if (direction.value.x !== -1) nextDirection.value = { x: 1, y: 0 }
      break
    case ' ':
      e.preventDefault()
      togglePause()
      break
  }
}

watch(speed, (newSpeed) => {
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = window.setInterval(moveSnake, newSpeed)
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  startGame()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (gameLoop) clearInterval(gameLoop)
})

const speedOptions = [
  { label: '慢速', value: 200 },
  { label: '正常', value: 150 },
  { label: '快速', value: 100 },
  { label: '极速', value: 50 }
]

const cells = computed(() => {
  const result: Position[] = []
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      result.push({ x, y })
    }
  }
  return result
})
</script>

<template>
  <div class="snake-game">
    <h1 class="game-title">🐍 博彩蛇</h1>
    
    <div class="game-info">
      <div class="score-section">
        <div class="score">
          <span class="label">得分:</span>
          <span class="value">{{ score }}</span>
        </div>
        <div class="extra-length">
          <span class="label">额外:</span>
          <span class="value">+{{ extraLength }}</span>
        </div>
      </div>
      <div class="controls">
        <div class="speed-selector">
          <span class="speed-label">速度:</span>
          <select v-model.number="speed" class="speed-select">
            <option v-for="option in speedOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <button class="reset-btn" @click="startGame">🔄 重置</button>
      </div>
    </div>
    
    <div class="game-container">
      <div class="grid" :style="gridStyle">
        <div
          v-for="cell in cells"
          :key="`${cell.x}-${cell.y}`"
          class="cell"
          :class="getCellClass(cell.x, cell.y)"
        ></div>
      </div>
      
      <div v-if="gameOver" class="game-over-overlay">
        <div class="game-over-content">
          <h2>游戏结束</h2>
          <p>最终得分: {{ score }}</p>
          <p class="gambling-score">当前击分: {{ props.gamblingScore }}</p>
          <div class="end-buttons">
            <button 
              v-if="props.gamblingScore >= 114" 
              class="revive-btn" 
              @click="reviveSnake"
            >
              💀 花费114击分复活（长度减半）
            </button>
            <button class="restart-btn" @click="startGame">🔄 重新开始（额外长度每段+2击分）</button>
          </div>
        </div>
      </div>
      
      <div v-if="isPaused && !gameOver" class="paused-overlay">
        <div class="paused-content">
          <h2>游戏暂停</h2>
          <p>按空格键继续</p>
        </div>
      </div>
    </div>
    
    <div class="instructions">
      <h3>说明</h3>
      <ul>
        <li>⬆️⬇️⬅️➡️ 方向键控制蛇的移动方向</li>
        <li>空格键 暂停/继续游戏</li>
        <li>Enter 重新开始游戏</li>
        <li>🟢 绿色部分：正常蛇身</li>
        <li>🟡 金色部分：概率获得的额外长度</li>
        <li>🍎 红色圆点：食物，吃掉得10分</li>
        <li>🎯 得分时概率检查：得分/1000概率×得分/10次</li>
        <li>💀 游戏结束可花费114击分复活（长度减半）</li>
        <li>🔄 重新开始时额外长度每段+2击分</li>
      </ul>
    </div>
    
    <div class="gambling-info">
      <span class="gambling-label">💰 击分:</span>
      <span class="gambling-value">{{ props.gamblingScore }}</span>
    </div>
  </div>
</template>

<style scoped>
.snake-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
}

.game-title {
  font-size: 1.8rem;
  color: #4CAF50;
  margin-bottom: 1rem;
  text-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}

.game-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 440px;
  margin-bottom: 1rem;
  padding: 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  box-sizing: border-box;
}

.score {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.score .label {
  color: #888;
  font-size: 0.9rem;
}

.score .value {
  color: #ffd700;
  font-size: 1.4rem;
  font-weight: bold;
}

.score-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.extra-length {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.extra-length .label {
  color: #888;
  font-size: 0.9rem;
}

.extra-length .value {
  color: #ffd700;
  font-size: 1.4rem;
  font-weight: bold;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.speed-selector {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.speed-label {
  color: #888;
  font-size: 0.85rem;
}

.speed-select {
  padding: 0.35rem 0.7rem;
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
}

.speed-select:focus {
  border-color: #4CAF50;
}

.reset-btn {
  padding: 0.35rem 1rem;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.reset-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(238, 90, 36, 0.5);
}

.game-container {
  position: relative;
  width: 100%;
  max-width: 440px;
  display: flex;
  justify-content: center;
}

.grid {
  display: grid;
  background: #1a1a2e;
  border: 2px solid #333;
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

.cell {
  background: #16213e;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
}

.snake-head {
  background: linear-gradient(135deg, #4CAF50, #2e7d32) !important;
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.7);
}

.snake-body {
  background: linear-gradient(135deg, #388e3c, #2e7d32) !important;
  border-radius: 2px;
}

.snake-body-gold {
  background: linear-gradient(135deg, #ffd700, #ffb300) !important;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.6);
}

.food {
  background: radial-gradient(circle, #ff6b6b, #ee5a24) !important;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(238, 90, 36, 0.8);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.game-over-overlay,
.paused-overlay {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 440px;
  height: 440px;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.game-over-content,
.paused-content {
  text-align: center;
  padding: 1.2rem 1.8rem;
  background: linear-gradient(145deg, #2a2a40, #1f1f30);
  border-radius: 12px;
  border: 2px solid #ff6b6b;
}

.paused-content {
  border-color: #ffd700;
}

.game-over-content h2,
.paused-content h2 {
  color: #ff6b6b;
  margin-bottom: 0.8rem;
  font-size: 1.4rem;
}

.paused-content h2 {
  color: #ffd700;
}

.game-over-content p,
.paused-content p {
  color: #ccc;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.restart-btn {
  padding: 0.5rem 1.2rem;
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.restart-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.5);
}

.end-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.revive-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.revive-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.5);
}

.gambling-info {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.15), rgba(255, 173, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  width: 100%;
  max-width: 440px;
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
  color: #ffd700;
  font-size: 1.5rem;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.gambling-score {
  color: #ffd700;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.instructions {
  margin-top: 1.2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  width: 100%;
  max-width: 440px;
  box-sizing: border-box;
}

.instructions h3 {
  color: #ffd700;
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
  font-size: 0.8rem;
}

@media (max-width: 480px) {
  .game-title {
    font-size: 1.4rem;
  }
  
  .game-info {
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.6rem;
  }
  
  .controls {
    width: 100%;
    justify-content: center;
  }
}
</style>
