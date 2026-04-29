<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

interface Position {
  x: number
  y: number
}

interface Tetromino {
  shape: number[][]
  color: string
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const CELL_SIZE = 24

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

const TETROMINOES: Tetromino[] = [
  { shape: [[1, 1, 1, 1]], color: 'cyan' },
  { shape: [[1, 1], [1, 1]], color: 'yellow' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: 'blue' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: 'orange' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' }
]

const board = ref<number[][]>([])
const currentPiece = ref<{ shape: number[][], color: string, x: number, y: number } | null>(null)
const currentX = ref(0)
const currentY = ref(0)
const score = ref(0)
const gameOver = ref(false)
const isPlaying = ref(false)
const level = ref(1)
const linesCleared = ref(0)
const nextPiece = ref<Tetromino | null>(null)
const betAmount = ref(100)
const gameStarted = ref(false)
const lastResult = ref<'win' | 'lose' | null>(null)

let gameLoop: number | null = null
let dropInterval: number | null = null

const boardStyle = computed(() => ({
  width: `${BOARD_WIDTH * CELL_SIZE}px`,
  height: `${BOARD_HEIGHT * CELL_SIZE}px`,
  gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${CELL_SIZE}px)`
}))

const initBoard = () => {
  board.value = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))
}

const getRandomTetromino = (): Tetromino => {
  return TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)]!
}

const spawnPiece = () => {
  const tetromino = nextPiece.value || getRandomTetromino()
  const shapeRows = tetromino.shape
  currentPiece.value = {
    shape: shapeRows.map(row => [...row]),
    color: tetromino.color,
    x: Math.floor((BOARD_WIDTH - (shapeRows[0]?.length ?? 0)) / 2),
    y: 0
  }
  currentX.value = currentPiece.value.x
  currentY.value = currentPiece.value.y
  nextPiece.value = getRandomTetromino()

  if (checkCollision(currentPiece.value.shape, currentX.value, currentY.value)) {
    endGame()
  }
}

const checkCollision = (shape: number[][], x: number, y: number): boolean => {
  for (let row = 0; row < shape.length; row++) {
    const shapeRow = shape[row]
    if (!shapeRow) continue
    for (let col = 0; col < shapeRow.length; col++) {
      if (shapeRow[col]) {
        const newX = x + col
        const newY = y + row
        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return true
        }
        if (newY >= 0) {
          const boardRow = board.value[newY]
          if (boardRow && boardRow[newX]) {
            return true
          }
        }
      }
    }
  }
  return false
}

const lockPiece = () => {
  if (!currentPiece.value) return

  const piece = currentPiece.value
  for (let row = 0; row < piece.shape.length; row++) {
    const shapeRow = piece.shape[row]
    if (!shapeRow) continue
    for (let col = 0; col < shapeRow.length; col++) {
      if (shapeRow[col]) {
        const newY = currentY.value + row
        const newX = currentX.value + col
        if (newY >= 0) {
          const boardRow = board.value[newY]
          if (boardRow) {
            boardRow[newX] = 1
          }
        }
      }
    }
  }

  clearLines()
  spawnPiece()
}

const clearLines = () => {
  let lines = 0

  for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
    const boardRow = board.value[row]
    if (boardRow && boardRow.every(cell => cell === 1)) {
      board.value.splice(row, 1)
      board.value.unshift(Array(BOARD_WIDTH).fill(0))
      lines++
      row++
    }
  }

  if (lines > 0) {
    const lineScores = [0, 100, 300, 500, 800]
    score.value += (lineScores[Math.min(lines, 4)] ?? 0) * level.value
    linesCleared.value += lines
    level.value = Math.floor(linesCleared.value / 10) + 1
  }
}

const movePiece = (dx: number, dy: number) => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  const newX = currentX.value + dx
  const newY = currentY.value + dy

  if (!checkCollision(currentPiece.value.shape, newX, newY)) {
    currentX.value = newX
    currentY.value = newY
  } else if (dy > 0) {
    lockPiece()
  }
}

const rotatePiece = () => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  const currentShape = currentPiece.value.shape
  const firstRow = currentShape[0]
  if (!firstRow) return
  const rotated = firstRow.map((_, i) =>
    currentShape.map(row => row?.[i] ?? 0).reverse()
  )

  if (!checkCollision(rotated, currentX.value, currentY.value)) {
    currentPiece.value.shape = rotated
  }
}

const dropPiece = () => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  const newY = currentY.value + 1

  if (!checkCollision(currentPiece.value.shape, currentX.value, newY)) {
    currentY.value = newY
  } else {
    lockPiece()
  }
}

const hardDrop = () => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  while (!checkCollision(currentPiece.value.shape, currentX.value, currentY.value + 1)) {
    currentY.value++
    score.value += 2
  }
  lockPiece()
}

const getCellClass = (x: number, y: number): string => {
  if (currentPiece.value) {
    const piece = currentPiece.value
    for (let row = 0; row < piece.shape.length; row++) {
      const shapeRow = piece.shape[row]
      if (!shapeRow) continue
      for (let col = 0; col < shapeRow.length; col++) {
        if (shapeRow[col]) {
          const pieceX = currentX.value + col
          const pieceY = currentY.value + row
          if (pieceX === x && pieceY === y) {
            return `cell-${piece.color}`
          }
        }
      }
    }
  }

  const boardRow = board.value[y]
  if (boardRow && boardRow[x]) {
    return 'cell-placed'
  }

  return ''
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    alert('击分不足！')
    return
  }

  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  initBoard()
  score.value = 0
  level.value = 1
  linesCleared.value = 0
  gameOver.value = false
  isPlaying.value = true
  gameStarted.value = true
  lastResult.value = null
  nextPiece.value = getRandomTetromino()
  spawnPiece()

  const dropSpeed = Math.max(100, 800 - (level.value - 1) * 50)
  if (dropInterval) clearInterval(dropInterval)
  dropInterval = window.setInterval(() => {
    dropPiece()
  }, dropSpeed)
}

const endGame = () => {
  gameOver.value = true
  isPlaying.value = false
  if (dropInterval) {
    clearInterval(dropInterval)
    dropInterval = null
  }

  let winAmount = 0
  if (score.value >= 1000) {
    winAmount = betAmount.value * 2
  } else if (score.value >= 500) {
    winAmount = betAmount.value * 1.5
  } else if (score.value >= 200) {
    winAmount = betAmount.value
  }

  if (winAmount > 0) {
    lastResult.value = 'win'
    emit('update:gamblingScore', props.gamblingScore + winAmount)
  } else {
    lastResult.value = 'lose'
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!isPlaying.value) return

  switch (e.key) {
    case 'ArrowLeft':
      movePiece(-1, 0)
      break
    case 'ArrowRight':
      movePiece(1, 0)
      break
    case 'ArrowDown':
      movePiece(0, 1)
      score.value += 1
      break
    case 'ArrowUp':
      rotatePiece()
      break
    case ' ':
      hardDrop()
      break
  }
}

onMounted(() => {
  initBoard()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (dropInterval) clearInterval(dropInterval)
})
</script>

<template>
  <div class="tetris-container">
    <div class="game-sidebar">
      <div class="next-piece-box">
        <h3>下一个</h3>
        <div class="next-piece-preview" v-if="nextPiece">
          <div
            v-for="(row, rowIndex) in nextPiece.shape"
            :key="rowIndex"
            class="next-row"
          >
            <span
              v-for="(cell, colIndex) in row"
              :key="colIndex"
              :class="['next-cell', cell ? `cell-${nextPiece.color}` : '']"
            ></span>
          </div>
        </div>
      </div>

      <div class="score-box">
        <h3>本局得分</h3>
        <p class="score">{{ score }}</p>
      </div>

      <div class="stats-box">
        <h3>等级</h3>
        <p class="level">{{ level }}</p>
        <h3>消除行数</h3>
        <p class="lines">{{ linesCleared }}</p>
      </div>

      <div class="bet-box">
        <h3>下注金额</h3>
        <div class="bet-controls">
          <button @click="betAmount = Math.max(100, betAmount - 100)">-</button>
          <span class="bet-amount">{{ betAmount }}</span>
          <button @click="betAmount = Math.min(gamblingScore, betAmount + 100)">+</button>
        </div>
        <p class="bet-hint">当前可用: {{ gamblingScore }}</p>
      </div>

      <button v-if="!isPlaying" class="start-btn" @click="startGame">
        {{ gameOver ? '再来一局' : '开始游戏' }}
      </button>
      <p v-else class="playing-hint">游戏中...</p>

      <div v-if="lastResult" class="result-box" :class="lastResult">
        <p v-if="lastResult === 'win'">🎉 恭喜获胜！获得 {{ lastResult === 'win' ? (score >= 1000 ? betAmount * 2 : score >= 500 ? betAmount * 1.5 : betAmount) : 0 }} 击分</p>
        <p v-else>😅 未达标，失去 {{ betAmount }} 击分</p>
      </div>
    </div>

    <div class="game-board-wrapper">
      <div class="board-container">
        <div class="game-board" :style="boardStyle">
          <div
            v-for="(row, y) in board"
            :key="y"
            class="board-row"
          >
            <div
              v-for="(cell, x) in row"
              :key="x"
              :class="['cell', getCellClass(x, y), cell ? 'cell-placed' : '']"
            ></div>
          </div>
        </div>

        <div v-if="gameOver" class="game-over-overlay">
          <div class="game-over-content">
            <h2>游戏结束</h2>
            <p>最终得分: {{ score }}</p>
            <p>消除行数: {{ linesCleared }}</p>
            <p>等级: {{ level }}</p>
          </div>
        </div>

        <div v-if="!gameStarted && !gameOver" class="start-overlay">
          <div class="start-content">
            <h2>🎮 俄罗斯方块</h2>
            <p>操作说明：</p>
            <ul>
              <li>← → 移动</li>
              <li>↑ 旋转</li>
              <li>↓ 加速下落</li>
              <li>空格 硬降</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tetris-container {
  display: flex;
  gap: 2rem;
  justify-content: center;
  padding: 1rem;
  min-height: 500px;
}

.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 150px;
}

.next-piece-box,
.score-box,
.stats-box,
.bet-box {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
}

.next-piece-box h3,
.score-box h3,
.stats-box h3,
.bet-box h3 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #aaa;
}

.next-piece-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 60px;
  justify-content: center;
}

.next-row {
  display: flex;
  gap: 2px;
}

.next-cell {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.score {
  font-size: 1.8rem;
  font-weight: bold;
  color: #ffd700;
  margin: 0;
}

.level,
.lines {
  font-size: 1.2rem;
  color: #fff;
  margin: 0.3rem 0;
}

.bet-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.bet-controls button {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  cursor: pointer;
  font-size: 1rem;
}

.bet-controls button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.bet-amount {
  font-size: 1.2rem;
  color: #ffd700;
  min-width: 60px;
}

.bet-hint {
  font-size: 0.75rem;
  color: #888;
  margin: 0.5rem 0 0;
}

.start-btn {
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
}

.playing-hint {
  color: #4ade80;
  font-size: 0.9rem;
  margin: 0;
}

.result-box {
  padding: 0.8rem;
  border-radius: 10px;
  text-align: center;
  font-size: 0.85rem;
}

.result-box.win {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.result-box.lose {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
}

.game-board-wrapper {
  display: flex;
  justify-content: center;
}

.board-container {
  position: relative;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 4px;
}

.game-board {
  display: grid;
}

.board-row {
  display: contents;
}

.cell {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
}

.cell-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  box-shadow: inset 0 0 8px rgba(6, 182, 212, 0.5);
}

.cell-yellow {
  background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
  box-shadow: inset 0 0 8px rgba(234, 179, 8, 0.5);
}

.cell-purple {
  background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
  box-shadow: inset 0 0 8px rgba(168, 85, 247, 0.5);
}

.cell-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: inset 0 0 8px rgba(59, 130, 246, 0.5);
}

.cell-orange {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  box-shadow: inset 0 0 8px rgba(249, 115, 22, 0.5);
}

.cell-green {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  box-shadow: inset 0 0 8px rgba(34, 197, 94, 0.5);
}

.cell-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: inset 0 0 8px rgba(239, 68, 68, 0.5);
}

.cell-placed {
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  box-shadow: inset 0 0 6px rgba(74, 222, 128, 0.4);
}

.game-over-overlay,
.start-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.game-over-content,
.start-content {
  text-align: center;
  color: #fff;
}

.game-over-content h2,
.start-content h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #ffd700;
}

.game-over-content p,
.start-content p {
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.start-content ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
  font-size: 0.85rem;
  color: #aaa;
}

.start-content li {
  margin: 0.3rem 0;
}
</style>
