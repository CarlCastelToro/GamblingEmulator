<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

interface Position {
  x: number
  y: number
}

interface Tetromino {
  shape: number[][]
  color: string
  type: 'normal' | 'bomb' | 'powerup' | 'drill' | 'lightning'
  powerupType?: 'clear' | 'slow' | 'shuffle' | 'multiply'
}

const BOARD_WIDTH = 12
const BOARD_HEIGHT = 22
const CELL_SIZE = 22

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

// 基础方块形状
const BASE_TETROMINOES: Omit<Tetromino, 'type'>[] = [
  { shape: [[1, 1, 1, 1]], color: 'cyan' },
  { shape: [[1, 1], [1, 1]], color: 'yellow' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: 'blue' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: 'orange' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' },
  // 疯狂形状
  { shape: [[1, 0, 1], [0, 1, 0], [1, 0, 1]], color: 'pink' },
  { shape: [[1, 1, 1, 1, 1]], color: 'lime' },
  { shape: [[1, 0, 0, 1], [0, 1, 1, 0]], color: 'teal' },
]

// 钻地方块（1x1特殊方块）
const DRILL_TETROMINO: Tetromino = {
  shape: [[1]],
  color: 'silver',
  type: 'drill'
}

// 闪电方块（下落速度三倍，消除得10倍分数）
const LIGHTNING_TETROMINO: Tetromino = {
  shape: [[1, 1], [1, 0]],
  color: 'yellow',
  type: 'lightning'
}

const board = ref<(number | { type: string, color: string })[][]>([])
const currentPiece = ref<{ shape: number[][], color: string, x: number, y: number, type: string, powerupType?: string } | null>(null)
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
const selectedLevel = ref(1) // 初始选择的等级

// 混沌元素状态
const gravityDirection = ref<'down' | 'left' | 'right' | 'up'>('down')
const chaosMode = ref(false)
const chaosTimer = ref(0)
const boardShaking = ref(false)
const showWarning = ref(false)
const hasLightningBonus = ref(false) // 标记是否获得闪电奖励
const warningMessage = ref('')
const comboCount = ref(0)
const activePowerups = ref<string[]>([])
const speedMultiplier = ref(1)
const randomRotation = ref(false)

let gameLoop: number | null = null
let dropInterval: number | null = null
let chaosInterval: number | null = null
let shakeTimeout: number | null = null

const boardStyle = computed(() => ({
  width: `${BOARD_WIDTH * CELL_SIZE}px`,
  height: `${BOARD_HEIGHT * CELL_SIZE}px`,
  gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${CELL_SIZE}px)`
}))

const initBoard = () => {
  board.value = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))
}

// 计算闪电方块概率，随等级增加而增加（5% - 30%）
const getLightningProbability = (): number => {
  return Math.min(0.3, 0.05 + (level.value - 1) * 0.025)
}

// 根据等级计算特殊方块概率
const getSpecialProbabilities = () => {
  const lvl = level.value
  return {
    bomb: Math.min(0.10 + (lvl - 1) * 0.02, 0.25),      // 10%-25%
    powerup: Math.min(0.10 + (lvl - 1) * 0.02, 0.25),    // 10%-25%
    drill: Math.min(0.07 + (lvl - 1) * 0.015, 0.15),     // 7%-15%
    lightning: Math.min(0.03 + (lvl - 1) * 0.02, 0.15),  // 3%-15%
    chaos: Math.min(0.10 + (lvl - 1) * 0.03, 0.40)       // 10%-40% 混沌模式概率
  }
}

const getRandomTetromino = (): Tetromino => {
  const base = BASE_TETROMINOES[Math.floor(Math.random() * BASE_TETROMINOES.length)]!
  
  // 根据等级获取特殊方块概率
  const probs = getSpecialProbabilities()
  const rand = Math.random()
  
  let cumulative = 0
  
  if (rand < cumulative + probs.bomb) { // 炸弹方块
    cumulative += probs.bomb
    return { ...base, type: 'bomb', color: 'black' }
  }
  
  cumulative += probs.bomb
  if (rand < cumulative + probs.powerup) { // 道具方块
    const powerups: Tetromino['powerupType'][] = ['clear', 'slow', 'shuffle', 'multiply']
    const powerupType = powerups[Math.floor(Math.random() * powerups.length)]
    const powerupColors: Record<string, string> = {
      clear: 'red',
      slow: 'blue',
      shuffle: 'purple',
      multiply: 'gold'
    }
    return { ...base, type: 'powerup', powerupType, color: powerupColors[powerupType] }
  }
  
  cumulative += probs.powerup
  if (rand < cumulative + probs.drill) { // 钻地方块
    return { ...DRILL_TETROMINO }
  }
  
  cumulative += probs.drill
  if (rand < cumulative + probs.lightning) { // 闪电方块
    return { ...LIGHTNING_TETROMINO }
  }
  
  return { ...base, type: 'normal' }
}

const spawnPiece = () => {
  const tetromino = nextPiece.value || getRandomTetromino()
  const shapeRows = tetromino.shape
  
  // 随机旋转初始方块
  let rotatedShape = shapeRows.map(row => [...row])
  if (Math.random() < 0.3 && chaosMode.value) {
    for (let i = 0; i < Math.floor(Math.random() * 4); i++) {
      rotatedShape = rotateMatrix(rotatedShape)
    }
  }
  
  currentPiece.value = {
    shape: rotatedShape,
    color: tetromino.color,
    x: Math.floor((BOARD_WIDTH - (rotatedShape[0]?.length ?? 0)) / 2),
    y: 0,
    type: tetromino.type,
    powerupType: tetromino.powerupType
  }
  currentX.value = currentPiece.value.x
  currentY.value = currentPiece.value.y
  nextPiece.value = getRandomTetromino()

  if (checkCollision(currentPiece.value.shape, currentX.value, currentY.value)) {
    endGame()
    return
  }
  
  // 钻地方块特殊处理：立即开始钻地
  if (currentPiece.value.type === 'drill') {
    // 确保钻地方块不会生成在已经有方块的位置
    let safeY = currentY.value
    while (safeY < BOARD_HEIGHT && checkCollision(currentPiece.value.shape, currentX.value, safeY)) {
      safeY++
    }
    
    if (safeY < BOARD_HEIGHT) {
      currentY.value = safeY
    }
    
    setTimeout(() => {
      if (isPlaying.value && currentPiece.value?.type === 'drill') {
        drillPiece()
      }
    }, 100)
    return
  }
  
  // 生成新方块后重新计算下落速度（尤其是闪电方块）
  startDropInterval()
}

const rotateMatrix = (matrix: number[][]): number[][] => {
  if (!matrix.length || !matrix[0]) return matrix
  const rows = matrix.length
  const cols = matrix[0].length
  const rotated: number[][] = []
  for (let col = 0; col < cols; col++) {
    const newRow: number[] = []
    for (let row = rows - 1; row >= 0; row--) {
      newRow.push(matrix[row][col] || 0)
    }
    rotated.push(newRow)
  }
  return rotated
}

const checkCollision = (shape: number[][], x: number, y: number): boolean => {
  for (let row = 0; row < shape.length; row++) {
    const shapeRow = shape[row]
    if (!shapeRow) continue
    for (let col = 0; col < shapeRow.length; col++) {
      if (shapeRow[col]) {
        const newX = x + col
        const newY = y + row
        if (newX < 0 || newX >= BOARD_WIDTH || newY < 0 || newY >= BOARD_HEIGHT) {
          return true
        }
        if (newY >= 0 && newX >= 0) {
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
  
  // 处理炸弹方块
  if (piece.type === 'bomb') {
    explodePiece(currentX.value, currentY.value)
    spawnPiece()
    return
  }
  
  // 处理道具方块
  if (piece.type === 'powerup') {
    activatePowerup(piece.powerupType!)
  }

  // 处理闪电方块 - 设置奖励标记
  if (piece.type === 'lightning') {
    hasLightningBonus.value = true
    showNotification('⚡ 闪电模式激活！得分x10')
  }

  for (let row = 0; row < piece.shape.length; row++) {
    const shapeRow = piece.shape[row]
    if (!shapeRow) continue
    for (let col = 0; col < shapeRow.length; col++) {
      if (shapeRow[col]) {
        const newY = currentY.value + row
        const newX = currentX.value + col
        if (newY >= 0 && newX >= 0) {
          const boardRow = board.value[newY]
          if (boardRow) {
            boardRow[newX] = { type: 'normal', color: piece.color }
          }
        }
      }
    }
  }

  clearLines()
  spawnPiece()
}

// 钻地方块特殊处理：逐帧下落并钻穿方块
const drillPiece = () => {
  if (!currentPiece.value || !isPlaying.value) return
  
  const piece = currentPiece.value
  const nextY = currentY.value + 1
  
  // 检查是否到达底部
  if (nextY >= BOARD_HEIGHT) {
    lockPiece()
    return
  }
  
  // 先检查是否可以正常下落
  const canMove = !checkCollision(piece.shape, currentX.value, nextY)
  
  if (canMove) {
    // 可以继续下落，逐帧移动
    currentY.value = nextY
    
    // 继续下落动画
    setTimeout(() => {
      if (isPlaying.value && currentPiece.value?.type === 'drill') {
        drillPiece()
      }
    }, 50)
    return
  }
  
  // 无法正常下落，尝试钻穿所有阻挡的方块
  const destroyedBlocks = destroyBlocksAtPosition(nextY)
  
  if (destroyedBlocks > 0) {
    // 破坏了方块，可以继续下落
    currentY.value = nextY
    
    // 继续下落动画
    setTimeout(() => {
      if (isPlaying.value && currentPiece.value?.type === 'drill') {
        drillPiece()
      }
    }, 50)
    return
  }
  
  // 无法钻穿，停止下落并固定
  lockPiece()
}

// 破坏指定位置的所有阻挡方块
const destroyBlocksAtPosition = (targetY: number): number => {
  const piece = currentPiece.value
  if (!piece) return 0
  
  let destroyed = 0
  
  // 检查方块形状覆盖的所有位置
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row]?.length || 0; col++) {
      if (piece.shape[row]?.[col]) {
        const checkX = currentX.value + col
        const checkY = targetY + row
        
        if (checkY >= BOARD_HEIGHT || checkY < 0) continue
        if (checkX >= BOARD_WIDTH || checkX < 0) continue
        
        const cell = board.value[checkY]?.[checkX]
        if (cell) {
          // 破坏这个方块
          board.value[checkY][checkX] = 0
          score.value += 20 // 破坏方块得分
          destroyed++
        }
      }
    }
  }
  
  return destroyed
}

// 检查钻地方块能否向指定方向移动
const canDrillMoveSideways = (dx: number): boolean => {
  if (!currentPiece.value || currentPiece.value.type !== 'drill') return false
  if (currentX.value === undefined || currentY.value === undefined) return false
  
  const newX = currentX.value + dx
  const y = currentY.value
  
  // 检查边界
  if (newX < 0 || newX >= BOARD_WIDTH) return false
  
  // 检查目标位置是否有方块阻挡
  if (board.value[y]?.[newX]) return false
  
  // 检查两侧是否有"墙"（连续的方块列）
  // 如果移动方向的两侧都有连续的方块墙，则不能移动
  const hasLeftWall = checkWall(0, newX - 1)
  const hasRightWall = checkWall(newX + 1, BOARD_WIDTH - 1)
  
  // 如果两侧都有墙且没有间隙，则不能移动
  if (hasLeftWall && hasRightWall) {
    // 检查是否存在间隙
    const hasGap = checkGap(newX)
    return hasGap
  }
  
  return true
}

// 检查指定列范围内是否形成连续的墙
const checkWall = (startCol: number, endCol: number): boolean => {
  if (startCol > endCol) return false
  
  for (let x = startCol; x <= endCol; x++) {
    // 检查该列是否从底部到顶部都有方块
    let hasEmpty = false
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (!board.value[y]?.[x]) {
        hasEmpty = true
        break
      }
    }
    if (!hasEmpty) {
      return true // 找到一堵完整的墙
    }
  }
  return false
}

// 检查是否存在可以移动的间隙
const checkGap = (currentX: number): boolean => {
  // 检查当前位置左右是否有空隙
  const leftEmpty = currentX > 0 && !board.value[currentY.value]?.[currentX - 1]
  const rightEmpty = currentX < BOARD_WIDTH - 1 && !board.value[currentY.value]?.[currentX + 1]
  
  return leftEmpty || rightEmpty
}

const explodePiece = (centerX: number, centerY: number) => {
  // 难度等级 >= 3 时，炸弹方块添加方块而不是消除方块
  // 使用 selectedLevel.value（用户选择的初始难度）而不是 level.value（动态计算的等级）
  if (selectedLevel.value >= 3) {
    addBombBlocks(centerX, centerY)
    return
  }
  
  // 低难度等级：正常消除方块
  const explosionRadius = 2
  for (let dy = -explosionRadius; dy <= explosionRadius; dy++) {
    for (let dx = -explosionRadius; dx <= explosionRadius; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
        if (board.value[y][x]) {
          board.value[y][x] = 0
          score.value += 50
        }
      }
    }
  }
  
  // 下落填充
  applyGravity()
  triggerShake()
}

// 高难度炸弹：添加方块
const addBombBlocks = (centerX: number, centerY: number) => {
  const lvl = selectedLevel.value
  let radius: number
  let gapChance: number
  
  // 根据难度等级设置参数
  switch (lvl) {
    case 3:
      radius = 3
      gapChance = 0.2 // 20% 间隙
      break
    case 4:
      radius = 4
      gapChance = 0.4 // 40% 间隙
      break
    case 5:
    default:
      radius = 6
      gapChance = 0.6 // 60% 间隙
  }
  
  // 收集所有要添加方块的位置
  const positions: { x: number; y: number }[] = []
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // 计算距离，实现圆形区域
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= radius) {
        // 随机间隙
        if (Math.random() < gapChance) continue
        
        let x = centerX + dx
        let y = centerY + dy
        
        // 处理超出边缘的情况（顶部除外）
        if (x < 0) x = BOARD_WIDTH - 1
        if (x >= BOARD_WIDTH) x = 0
        if (y < 0) continue // 顶部除外，不添加
        
        // 确保不超出底部
        if (y >= BOARD_HEIGHT) {
          // 从底部向上找可用位置
          for (let searchY = BOARD_HEIGHT - 1; searchY >= 0; searchY--) {
            if (!board.value[searchY][x]) {
              y = searchY
              break
            }
          }
        }
        
        positions.push({ x, y })
      }
    }
  }
  
  // 添加方块（随机颜色）
  const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple']
  
  for (const pos of positions) {
    if (!board.value[pos.y][pos.x]) {
      board.value[pos.y][pos.x] = {
        type: 'normal',
        color: colors[Math.floor(Math.random() * colors.length)]
      }
    }
  }
  
  triggerShake()
}

const activatePowerup = (type: string) => {
  switch (type) {
    case 'clear':
      clearRandomLine()
      break
    case 'slow':
      speedMultiplier.value = 0.5
      setTimeout(() => {
        speedMultiplier.value = 1
      }, 5000)
      showNotification('⏱️ 速度减半！')
      break
    case 'shuffle':
      shuffleBoard()
      break
    case 'multiply':
      score.value *= 2
      showNotification('💥 分数翻倍！')
      break
  }
}

const clearRandomLine = () => {
  const filledRows: number[] = []
  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board.value[y].some(cell => cell !== 0)) {
      filledRows.push(y)
    }
  }
  if (filledRows.length > 0) {
    const randomRow = filledRows[Math.floor(Math.random() * filledRows.length)]
    board.value[randomRow] = Array(BOARD_WIDTH).fill(0)
    applyGravity()
    score.value += 200
    showNotification('🔥 清除一行！')
  }
}

const shuffleBoard = () => {
  const filledCells: (number | { type: string, color: string })[] = []
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (board.value[y][x] !== 0) {
        filledCells.push(board.value[y][x])
        board.value[y][x] = 0
      }
    }
  }
  
  // 随机打乱方块
  for (let i = filledCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filledCells[i], filledCells[j]] = [filledCells[j], filledCells[i]]
  }
  
  // 重新放置方块到随机位置，从底部开始填充
  let cellIndex = 0
  for (let y = BOARD_HEIGHT - 1; y >= 0 && cellIndex < filledCells.length; y--) {
    for (let x = 0; x < BOARD_WIDTH && cellIndex < filledCells.length; x++) {
      board.value[y][x] = filledCells[cellIndex]
      cellIndex++
    }
  }
  
  showNotification('🔀 棋盘打乱！')
}

const applyGravity = () => {
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let emptyRow = BOARD_HEIGHT - 1
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (board.value[y][x] !== 0) {
        if (y !== emptyRow) {
          board.value[emptyRow][x] = board.value[y][x]
          board.value[y][x] = 0
        }
        emptyRow--
      }
    }
  }
}

const clearLines = () => {
  let lines = 0

  for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
    if (board.value[row].every(cell => cell !== 0)) {
      board.value.splice(row, 1)
      board.value.unshift(Array(BOARD_WIDTH).fill(0))
      lines++
      row++
    }
  }

  if (lines > 0) {
    comboCount.value++
    const lineScores = [0, 100, 350, 600, 1000]
    const baseScore = lineScores[Math.min(lines, 4)] ?? 0
    const comboBonus = comboCount.value > 1 ? Math.floor(comboCount.value * 0.5) : 0
    
    // 闪电奖励：得分翻10倍
    const lightningMultiplier = hasLightningBonus.value ? 10 : 1
    const earnedScore = (baseScore + comboBonus) * level.value * speedMultiplier.value * lightningMultiplier
    score.value += earnedScore
    
    // 如果使用闪电方块消除了行，重置奖励标记
    if (hasLightningBonus.value) {
      hasLightningBonus.value = false
      showNotification(`⚡ 闪电得分！+${earnedScore}`)
    }
    
    linesCleared.value += lines
    level.value = Math.floor(linesCleared.value / 8) + 1
    
    // 检查是否进入混沌模式
    if (lines >= 3) {
      triggerChaosMode()
    }
  } else {
    comboCount.value = 0
  }
}

const triggerChaosMode = () => {
  // 根据等级决定是否触发混沌模式
  const probs = getSpecialProbabilities()
  if (!chaosMode.value && Math.random() < probs.chaos) {
    chaosMode.value = true
    chaosTimer.value = 10 + level.value * 2 // 等级越高，混沌模式持续时间越长
    showNotification('🌪️ 混沌模式激活！')
    
    // 随机改变重力方向
    const directions: ('down' | 'left' | 'right' | 'up')[] = ['down', 'left', 'right', 'up']
    gravityDirection.value = directions[Math.floor(Math.random() * directions.length)]
    
    // 开始混沌效果
    if (chaosInterval) clearInterval(chaosInterval)
    chaosInterval = window.setInterval(() => {
      if (chaosTimer.value > 0) {
        chaosTimer.value--
        
        // 随机事件
        if (Math.random() < 0.3) {
          const events = ['gravity', 'shake', 'rotate', 'speed']
          const event = events[Math.floor(Math.random() * events.length)]
          
          switch (event) {
            case 'gravity':
              const directions: ('down' | 'left' | 'right' | 'up')[] = ['down', 'left', 'right', 'up']
              gravityDirection.value = directions[Math.floor(Math.random() * directions.length)]
              showNotification(`🌀 重力方向: ${gravityDirection.value}`)
              break
            case 'shake':
              triggerShake()
              break
            case 'rotate':
              randomRotation.value = true
              setTimeout(() => { randomRotation.value = false }, 2000)
              break
            case 'speed':
              speedMultiplier.value = Math.random() > 0.5 ? 2 : 0.5
              setTimeout(() => { speedMultiplier.value = 1 }, 3000)
              break
          }
        }
      } else {
        chaosMode.value = false
        gravityDirection.value = 'down'
        speedMultiplier.value = 1
        if (chaosInterval) clearInterval(chaosInterval)
      }
    }, 1000)
  }
}

const triggerShake = () => {
  boardShaking.value = true
  if (shakeTimeout) clearTimeout(shakeTimeout)
  shakeTimeout = window.setTimeout(() => {
    boardShaking.value = false
  }, 500)
}

const showNotification = (message: string) => {
  warningMessage.value = message
  showWarning.value = true
  setTimeout(() => {
    showWarning.value = false
  }, 2000)
}

const movePiece = (dx: number, dy: number) => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  // 钻地方块的特殊移动逻辑
  if (currentPiece.value.type === 'drill') {
    // 左右移动需要检查墙壁间隙
    if (dx !== 0) {
      if (canDrillMoveSideways(dx)) {
        currentX.value += dx
      }
      return
    }
    
    // 上下移动
    const newY = currentY.value + dy
    if (!checkCollision(currentPiece.value.shape, currentX.value, newY)) {
      currentY.value = newY
      if (dy > 0) {
        score.value += 1
      }
    } else if (dy > 0) {
      lockPiece()
    }
    return
  }

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
  
  let rotated = firstRow.map((_, i) =>
    currentShape.map(row => row?.[i] ?? 0).reverse()
  )

  // 尝试墙踢
  const kicks = [0, -1, 1, -2, 2]
  for (const kick of kicks) {
    if (!checkCollision(rotated, currentX.value + kick, currentY.value)) {
      currentPiece.value.shape = rotated
      currentX.value += kick
      return
    }
  }
}

const dropPiece = () => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  let newX = currentX.value
  let newY = currentY.value

  // 根据重力方向移动
  switch (gravityDirection.value) {
    case 'down':
      newY++
      break
    case 'left':
      newX--
      break
    case 'right':
      newX++
      break
    case 'up':
      newY--
      break
  }

  if (!checkCollision(currentPiece.value.shape, newX, newY)) {
    currentX.value = newX
    currentY.value = newY
    if (gravityDirection.value === 'down') {
      score.value += 1
    }
  } else {
    // 如果触碰到边界，改变重力方向或锁定
    if (gravityDirection.value === 'down') {
      lockPiece()
    } else {
      // 侧方重力触边时，尝试向下落
      while (!checkCollision(currentPiece.value.shape, currentX.value, currentY.value + 1)) {
        currentY.value++
      }
      lockPiece()
    }
  }
}

const hardDrop = () => {
  if (!currentPiece.value || gameOver.value || !isPlaying.value) return

  // 钻地方块硬降：继续执行钻地逻辑
  if (currentPiece.value.type === 'drill') {
    drillPiece()
    return
  }

  while (!checkCollision(currentPiece.value.shape, currentX.value, currentY.value + 1)) {
    currentY.value++
    score.value += 2
  }
  lockPiece()
}

const getCellClass = (x: number, y: number): string => {
  // 检查当前方块
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
            const baseClass = `cell-${piece.color}`
            if (piece.type === 'bomb') return `${baseClass} cell-bomb`
            if (piece.type === 'powerup') return `${baseClass} cell-powerup`
            if (piece.type === 'drill') return `${baseClass} cell-drill`
            if (piece.type === 'lightning') return `${baseClass} cell-lightning`
            return baseClass
          }
        }
      }
    }
  }

  // 检查已放置的方块
  const boardRow = board.value[y]
  if (boardRow && boardRow[x]) {
    if (typeof boardRow[x] === 'object') {
      return `cell-placed cell-${boardRow[x].color}`
    }
    return 'cell-placed'
  }

  return ''
}

// 获取等级名称
const getLevelName = (lvl: number): string => {
  const names = [
    '',
    '入门',
    '普通',
    '困难',
    '命运',
    '混沌'
  ]
  return names[lvl] || '未知'
}

// 获取等级描述
const getLevelDescription = (lvl: number): string => {
  const descriptions = [
    '',
    '适合新手玩家，特殊方块较少',
    '标准难度，有一定挑战',
    '高难度，特殊方块频繁出现',
    '噩梦难度，混沌模式频发',
    '地狱难度，极限挑战'
  ]
  return descriptions[lvl] || ''
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    alert('击分不足！')
    return
  }

  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  initBoard()
  score.value = 0
  level.value = selectedLevel.value // 使用选择的等级
  linesCleared.value = 0
  gameOver.value = false
  isPlaying.value = true
  gameStarted.value = true
  lastResult.value = null
  chaosMode.value = false
  gravityDirection.value = 'down'
  speedMultiplier.value = 1
  comboCount.value = 0
  nextPiece.value = getRandomTetromino()
  spawnPiece()

  startDropInterval()
}

const startDropInterval = () => {
  let dropSpeed = Math.max(80, 1000 - (level.value - 1) * 80) / speedMultiplier.value
  
  // 闪电方块下落速度三倍
  if (currentPiece.value?.type === 'lightning') {
    dropSpeed /= 3
  }
  
  if (dropInterval) clearInterval(dropInterval)
  dropInterval = window.setInterval(() => {
    dropPiece()
    // 如果是闪电方块，每次下落间隔后重新计算速度（可能方块变了）
    if (currentPiece.value?.type !== 'lightning') {
      startDropInterval()
    }
  }, dropSpeed)
}

// 监听速度变化
watch(speedMultiplier, () => {
  if (isPlaying.value) {
    startDropInterval()
  }
})

// 监听等级变化
watch(level, () => {
  if (isPlaying.value) {
    startDropInterval()
  }
})

const endGame = () => {
  gameOver.value = true
  isPlaying.value = false
  if (dropInterval) {
    clearInterval(dropInterval)
    dropInterval = null
  }
  if (chaosInterval) {
    clearInterval(chaosInterval)
    chaosInterval = null
  }

  let winAmount = 0
  if (score.value >= 1500) {
    winAmount = betAmount.value * 3
  } else if (score.value >= 800) {
    winAmount = betAmount.value * 2
  } else if (score.value >= 300) {
    winAmount = betAmount.value * 1.5
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
    case 'z':
    case 'Z':
      // 快速旋转
      for (let i = 0; i < 3; i++) {
        rotatePiece()
      }
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
  if (chaosInterval) clearInterval(chaosInterval)
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
              :class="[
                'next-cell',
                cell ? `cell-${nextPiece.color}` : '',
                nextPiece.type === 'bomb' ? 'cell-bomb' : '',
                nextPiece.type === 'powerup' ? 'cell-powerup' : '',
                nextPiece.type === 'drill' ? 'cell-drill' : '',
                nextPiece.type === 'lightning' ? 'cell-lightning' : ''
              ]"
            ></span>
          </div>
        </div>
        <div v-if="nextPiece?.type === 'bomb'" class="piece-type">💣 炸弹</div>
        <div v-else-if="nextPiece?.type === 'powerup'" class="piece-type">
          {{ nextPiece.powerupType === 'clear' ? '🔥' : nextPiece.powerupType === 'slow' ? '⏱️' : nextPiece.powerupType === 'shuffle' ? '🔀' : '💥' }} 道具
        </div>
        <div v-else-if="nextPiece?.type === 'drill'" class="piece-type">⛏️ 钻头</div>
        <div v-else-if="nextPiece?.type === 'lightning'" class="piece-type lightning-indicator">
          <span class="lightning-icon">⚡</span>
          <span class="lightning-text">闪电方块</span>
          <span class="lightning-speed">3倍速</span>
          <span class="lightning-score">得分x10</span>
        </div>
      </div>

      <div class="score-box">
        <h3>本局得分</h3>
        <p class="score">{{ Math.floor(score) }}</p>
        <div v-if="comboCount > 1" class="combo">🔥 {{ comboCount }}x COMBO!</div>
      </div>

      <div class="stats-box">
        <h3>等级</h3>
        <p class="level">{{ level }}</p>
        <h3>消除行数</h3>
        <p class="lines">{{ linesCleared }}</p>
      </div>

      <div class="chaos-indicator" :class="{ active: chaosMode }">
        <div class="chaos-icon">🌪️</div>
        <div v-if="chaosMode" class="chaos-timer">{{ chaosTimer }}s</div>
        <div class="gravity-direction">重力: {{ gravityDirection }}</div>
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
        <p v-if="lastResult === 'win'">🎉 恭喜获胜！获得 {{ score >= 1500 ? betAmount * 3 : score >= 800 ? betAmount * 2 : betAmount * 1.5 }} 击分</p>
        <p v-else>😅 未达标，失去 {{ betAmount }} 击分</p>
      </div>
    </div>

    <div class="game-board-wrapper">
      <div class="board-container" :class="{ shaking: boardShaking, chaos: chaosMode }">
        <div class="game-board" :style="boardStyle">
          <div
            v-for="(row, y) in board"
            :key="y"
            class="board-row"
          >
            <div
              v-for="(cell, x) in row"
              :key="x"
              :class="['cell', getCellClass(x, y), cell ? 'cell-filled' : '']"
            ></div>
          </div>
        </div>

        <div v-if="gameOver" class="game-over-overlay">
          <div class="game-over-content">
            <h2>💥 游戏结束</h2>
            <p>最终得分: {{ Math.floor(score) }}</p>
            <p>消除行数: {{ linesCleared }}</p>
            <p>等级: {{ level }}</p>
          </div>
        </div>

        <div v-if="!gameStarted && !gameOver" class="start-overlay">
          <div class="start-content">
            <h2>🎮 俄罗斯彩礼</h2>
            
            <div class="start-layout">
              <!-- 左边：等级选择 -->
              <div class="start-left">
                <div class="level-selector">
                  <h3>🎯 选择难度等级</h3>
                  <div class="level-buttons">
                    <button 
                      v-for="lvl in 5" 
                      :key="lvl"
                      @click="selectedLevel = lvl"
                      :class="['level-btn', { active: selectedLevel === lvl }]"
                    >
                      <span class="level-number">{{ lvl }}</span>
                      <span class="level-name">{{ getLevelName(lvl) }}</span>
                    </button>
                  </div>
                  <div class="level-info">
                    <p>当前选择：<strong>{{ getLevelName(selectedLevel) }}</strong></p>
                    <p class="level-desc">{{ getLevelDescription(selectedLevel) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧信息面板 -->
    <div class="game-info-panel">
      <div class="info-section">
        <h3>🎯 操作说明</h3>
        <ul>
          <li>← → 移动</li>
          <li>↑ 旋转</li>
          <li>↓ 加速下落</li>
          <li>空格 硬降</li>
          <li>Z 快速旋转3次</li>
        </ul>
      </div>
      <div class="info-section">
        <h3>🌟 特色玩法</h3>
        <ul>
          <li>💣 炸弹方块 - 爆炸消除周围</li>
          <li>🔥 道具方块 - 各种特殊效果</li>
          <li>⛏️ 钻地方块 - 持续下落</li>
          <li>⚡ 闪电方块 - 3倍速，得分x10</li>
          <li>🌪️ 混沌模式 - 随机重力</li>
          <li>🔥 连击系统 - 连续消除加分</li>
        </ul>
      </div>
    </div>

    <!-- 通知消息 -->
    <Transition name="notification">
      <div v-if="showWarning" class="notification-popup">
        {{ warningMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tetris-container {
  display: flex;
  gap: 2rem;
  justify-content: center;
  padding: 1rem;
  min-height: 500px;
  position: relative;
}

.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 160px;
}

/* 右侧信息面板 */
.game-info-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
  padding: 1rem;
}

.info-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section h3 {
  margin: 0 0 0.8rem 0;
  color: #ffd700;
  font-size: 1rem;
  text-align: center;
}

.info-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-section li {
  padding: 0.4rem 0;
  font-size: 0.85rem;
  color: #ccc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-section li:last-child {
  border-bottom: none;
}

.next-piece-box,
.score-box,
.stats-box,
.bet-box {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  backdrop-filter: blur(10px);
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
  width: 18px;
  height: 18px;
  border-radius: 3px;
}

.piece-type {
  font-size: 0.75rem;
  margin-top: 0.5rem;
  color: #ffd700;
}

.score {
  font-size: 2rem;
  font-weight: bold;
  color: #ffd700;
  margin: 0;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.combo {
  font-size: 0.85rem;
  color: #ff6b6b;
  animation: pulse 0.5s infinite;
}

.level,
.lines {
  font-size: 1.2rem;
  color: #fff;
  margin: 0.3rem 0;
}

.chaos-indicator {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
}

.chaos-indicator.active {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  animation: glow 1s infinite alternate;
}

.chaos-icon {
  font-size: 1.5rem;
  animation: spin 2s linear infinite;
}

.chaos-timer {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ef4444;
}

.gravity-direction {
  font-size: 0.8rem;
  color: #888;
  margin-top: 0.3rem;
}

.bet-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.bet-controls button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.bet-controls button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.bet-amount {
  font-size: 1.3rem;
  color: #ffd700;
  min-width: 60px;
}

.bet-hint {
  font-size: 0.75rem;
  color: #888;
  margin: 0.5rem 0 0;
}

.start-btn {
  padding: 0.9rem 1.6rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #f97316 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
}

.playing-hint {
  color: #4ade80;
  font-size: 0.9rem;
  margin: 0;
  text-align: center;
}

.result-box {
  padding: 0.8rem;
  border-radius: 10px;
  text-align: center;
  font-size: 0.85rem;
  animation: fadeIn 0.3s ease;
}

.result-box.win {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.3), rgba(34, 197, 94, 0.2));
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.5);
}

.result-box.lose {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.5);
}

.game-board-wrapper {
  display: flex;
  justify-content: center;
}

.board-container {
  position: relative;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 6px;
  transition: all 0.1s ease;
}

.board-container.shaking {
  animation: shake 0.5s ease-in-out;
}

.board-container.chaos {
  border-color: #ef4444;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
}

.game-board {
  display: grid;
  gap: 1px;
}

.board-row {
  display: contents;
}

.cell {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  transition: all 0.15s ease;
}

.cell-filled {
  animation: place 0.15s ease;
}

.cell-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-yellow {
  background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
  box-shadow: 0 0 10px rgba(234, 179, 8, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-purple {
  background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-orange {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-green {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-pink {
  background: linear-gradient(135deg, #ec4899 0%, #be185d 100%);
  box-shadow: 0 0 10px rgba(236, 72, 153, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-lime {
  background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
  box-shadow: 0 0 10px rgba(132, 204, 22, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-teal {
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
  box-shadow: 0 0 10px rgba(20, 184, 166, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.cell-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  box-shadow: 0 0 15px rgba(251, 191, 36, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.4);
}

.cell-black {
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
}

.cell-silver {
  background: linear-gradient(135deg, #e5e7eb 0%, #9ca3af 50%, #6b7280 100%);
  box-shadow: 0 0 12px rgba(229, 231, 235, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.5);
}

.cell-drill {
  animation: drillPulse 0.8s infinite;
}

.cell-bomb {
  animation: bombPulse 1s infinite;
}

.cell-powerup {
  animation: powerupGlow 1.5s infinite alternate;
}

.cell-lightning {
  animation: lightningPulse 0.3s infinite;
  position: relative;
}

.cell-lightning::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 0, 0.3) 50%, transparent 70%);
  border-radius: 4px;
  animation: lightningFlash 0.3s infinite;
}

.cell-placed {
  opacity: 0.9;
}

/* 闪电方块预览提示 */
.lightning-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.3);
  animation: lightningGlow 1s infinite alternate;
  margin-top: 8px;
}

.lightning-icon {
  font-size: 28px;
  animation: lightningBolt 0.5s infinite;
}

.lightning-text {
  font-size: 14px;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin-top: 4px;
}

.lightning-speed,
.lightning-score {
  font-size: 12px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin-top: 2px;
}

@keyframes lightningGlow {
  from {
    box-shadow: 0 0 15px rgba(251, 191, 36, 0.5), 0 0 30px rgba(251, 191, 36, 0.3);
  }
  to {
    box-shadow: 0 0 25px rgba(251, 191, 36, 0.8), 0 0 50px rgba(251, 191, 36, 0.5);
  }
}

@keyframes lightningBolt {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  25% {
    transform: scale(1.2) rotate(-5deg);
    opacity: 0.8;
  }
  50% {
    transform: scale(0.9) rotate(5deg);
    opacity: 1;
  }
  75% {
    transform: scale(1.1) rotate(-3deg);
    opacity: 0.9;
  }
}

.game-over-overlay,
.start-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  backdrop-filter: blur(5px);
}

.game-over-content,
.start-content {
  text-align: center;
  color: #fff;
  padding: 2rem;
}

.game-over-content h2,
.start-content h2 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #ffd700, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.game-over-content p,
.start-content p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.start-content ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: #aaa;
}

.start-content li {
  margin: 0.4rem 0;
}

/* 开始界面布局 */
.start-layout {
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
}

.start-left {
  flex: 1;
  min-width: 200px;
}

.start-right {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 等级选择器样式 */
.level-selector {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.level-selector h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #ffd700;
}

.level-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.level-btn {
  padding: 0.6rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
}

.level-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.level-btn.active {
  background: linear-gradient(135deg, #ffd700, #ff6b6b);
  border-color: #ffd700;
  transform: scale(1.05);
}

.level-number {
  font-size: 1.2rem;
  font-weight: bold;
}

.level-name {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

.level-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.level-info p {
  margin: 0.3rem 0;
  font-size: 0.9rem;
}

.level-info strong {
  color: #ffd700;
}

.level-desc {
  color: #888 !important;
  font-size: 0.85rem !important;
}

.start-content .features {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.start-content .features ul {
  color: #ffd700;
}

.notification-popup {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(30, 30, 30, 0.9));
  border: 2px solid #ffd700;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1.2rem;
  color: #fff;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3);
}

/* 动画 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

@keyframes glow {
  from { box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
  to { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes place {
  0% { transform: scale(1.2); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes lightningPulse {
  0%, 100% { 
    box-shadow: 0 0 5px rgba(255, 255, 0, 0.5), 0 0 10px rgba(255, 255, 0, 0.3);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 15px rgba(255, 255, 0, 0.8), 0 0 25px rgba(255, 255, 0, 0.5), 0 0 35px rgba(255, 255, 0, 0.3);
    transform: scale(1.02);
  }
}

@keyframes lightningFlash {
  0%, 100% { 
    opacity: 0;
    transform: translateX(-50%) skewX(-10deg);
  }
  50% { 
    opacity: 1;
    transform: translateX(50%) skewX(10deg);
  }
}

@keyframes bombPulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.8); }
  50% { box-shadow: 0 0 25px rgba(255, 0, 0, 1); }
}

@keyframes drillPulse {
  0%, 100% { 
    box-shadow: 0 0 8px rgba(229, 231, 235, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.5);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 15px rgba(229, 231, 235, 0.9), inset 0 1px 2px rgba(255, 255, 255, 0.7);
    transform: scale(1.05);
  }
}

@keyframes powerupGlow {
  from { filter: brightness(1); }
  to { filter: brightness(1.5); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.notification-enter-active {
  animation: fadeIn 0.3s ease;
}

.notification-leave-active {
  animation: fadeIn 0.3s ease reverse;
}
</style>