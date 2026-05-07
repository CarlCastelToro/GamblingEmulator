<script setup lang="ts">
import { ref, nextTick } from 'vue'

// Block types
const BLOCK_AIR = 0
const BLOCK_GRASS = 1
const BLOCK_DIRT = 2
const BLOCK_STONE = 3

const blockNames: Record<number, string> = {
  [BLOCK_AIR]: '空气',
  [BLOCK_GRASS]: '草方块',
  [BLOCK_DIRT]: '泥土',
  [BLOCK_STONE]: '石头'
}

const blockColors: Record<number, { top: string; front: string; side: string }> = {
  [BLOCK_GRASS]: { top: '#5B8C32', front: '#6B4226', side: '#5A3A1A' },
  [BLOCK_DIRT]: { top: '#6B4226', front: '#5A3A1A', side: '#4A2A0A' },
  [BLOCK_STONE]: { top: '#888888', front: '#777777', side: '#666666' }
}

// World size
const SIZE = 16
const HEIGHT = 8

// State
const world = ref<number[][][]>([])
const playerX = ref(8)
const playerZ = ref(8)
const selectedBlock = ref(BLOCK_GRASS)
const isPlaying = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

// Keys
const keys: Record<string, boolean> = {}

// Init world
const initWorld = () => {
  const w: number[][][] = []
  for (let x = 0; x < SIZE; x++) {
    w[x] = []
    for (let y = 0; y < HEIGHT; y++) {
      w[x]![y] = []
      for (let z = 0; z < SIZE; z++) {
        const h = Math.floor(3 + Math.sin(x * 0.5) + Math.cos(z * 0.5))
        if (y < h) {
          w[x]![y]![z] = y === h - 1 ? BLOCK_GRASS : BLOCK_DIRT
        } else {
          w[x]![y]![z] = BLOCK_AIR
        }
      }
    }
  }
  world.value = w
}

// Simple isometric render
const render = () => {
  if (!ctx || !canvasRef.value) return
  const c = canvasRef.value
  const g = ctx

  // Clear with sky color
  g.fillStyle = '#87CEEB'
  g.fillRect(0, 0, c.width, c.height)

  const tileW = 32
  const tileH = 16
  const centerX = c.width / 2
  const centerY = 100

  // Draw blocks from back to front
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      // Find highest non-air block
      let topY = -1
      for (let y = HEIGHT - 1; y >= 0; y--) {
        if (world.value[x]?.[y]?.[z] !== BLOCK_AIR) {
          topY = y
          break
        }
      }

      if (topY >= 0) {
        const block = world.value[x]?.[topY]?.[z] ?? BLOCK_AIR
        const colors = blockColors[block] || blockColors[BLOCK_STONE]!

        // Isometric position
        const isoX = centerX + (x - z) * tileW / 2
        const isoY = centerY + (x + z) * tileH / 2 - topY * 20

        // Draw top face
        g.fillStyle = colors.top
        g.beginPath()
        g.moveTo(isoX, isoY - tileH / 2)
        g.lineTo(isoX + tileW / 2, isoY)
        g.lineTo(isoX, isoY + tileH / 2)
        g.lineTo(isoX - tileW / 2, isoY)
        g.closePath()
        g.fill()

        // Draw left face
        g.fillStyle = colors.front
        g.beginPath()
        g.moveTo(isoX - tileW / 2, isoY)
        g.lineTo(isoX, isoY + tileH / 2)
        g.lineTo(isoX, isoY + tileH / 2 + 20)
        g.lineTo(isoX - tileW / 2, isoY + 20)
        g.closePath()
        g.fill()

        // Draw right face
        g.fillStyle = colors.side
        g.beginPath()
        g.moveTo(isoX + tileW / 2, isoY)
        g.lineTo(isoX, isoY + tileH / 2)
        g.lineTo(isoX, isoY + tileH / 2 + 20)
        g.lineTo(isoX + tileW / 2, isoY + 20)
        g.closePath()
        g.fill()
      }
    }
  }

  // Draw player indicator
  const px = centerX + (playerX.value - playerZ.value) * tileW / 2
  const py = centerY + (playerX.value + playerZ.value) * tileH / 2 - 40
  g.fillStyle = '#ff0000'
  g.beginPath()
  g.arc(px, py, 5, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '12px monospace'
  g.textAlign = 'center'
  g.fillText('你', px, py - 10)
}

// Game loop
let animId: number | null = null

const gameLoop = () => {
  const speed = 0.1

  if (keys['w'] || keys['W'] || keys['ArrowUp']) {
    playerX.value = Math.max(0, Math.min(SIZE - 1, playerX.value - speed))
    playerZ.value = Math.max(0, Math.min(SIZE - 1, playerZ.value - speed))
  }
  if (keys['s'] || keys['S'] || keys['ArrowDown']) {
    playerX.value = Math.max(0, Math.min(SIZE - 1, playerX.value + speed))
    playerZ.value = Math.max(0, Math.min(SIZE - 1, playerZ.value + speed))
  }
  if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
    playerX.value = Math.max(0, Math.min(SIZE - 1, playerX.value - speed))
    playerZ.value = Math.max(0, Math.min(SIZE - 1, playerZ.value + speed))
  }
  if (keys['d'] || keys['D'] || keys['ArrowRight']) {
    playerX.value = Math.max(0, Math.min(SIZE - 1, playerX.value + speed))
    playerZ.value = Math.max(0, Math.min(SIZE - 1, playerZ.value - speed))
  }

  render()
  animId = requestAnimationFrame(gameLoop)
}

// Input
const onKeyDown = (e: KeyboardEvent) => {
  // 阻止方向键和空格键的默认行为，防止页面滚动
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault()
  }
  
  keys[e.key] = true
  if (e.key >= '1' && e.key <= '3') {
    selectedBlock.value = parseInt(e.key)
  }
  if (e.key === 'r' || e.key === 'R') {
    playerX.value = 8
    playerZ.value = 8
  }
}

const onKeyUp = (e: KeyboardEvent) => {
  keys[e.key] = false
}

const handleClick = (e: MouseEvent) => {
  if (!canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Simple block placement based on click position
  const tileW = 32
  const tileH = 16
  const centerX = canvasRef.value.width / 2
  const centerY = 100

  // Convert screen to world coordinates (approximate)
  const relX = mouseX - centerX
  const relY = mouseY - centerY

  const worldX = Math.floor((relX / tileW + relY / tileH) / 2)
  const worldZ = Math.floor((relY / tileH - relX / tileW) / 2)

  if (worldX >= 0 && worldX < SIZE && worldZ >= 0 && worldZ < SIZE) {
    // Find highest block
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (world.value[worldX]?.[y]?.[worldZ] !== BLOCK_AIR) {
        if (e.button === 0) {
          // Left click - break
          world.value[worldX]![y]![worldZ] = BLOCK_AIR
        } else if (e.button === 2 && y + 1 < HEIGHT) {
          // Right click - place
          world.value[worldX]![y + 1]![worldZ] = selectedBlock.value
        }
        break
      }
    }

    // If no block found, place at bottom
    if (e.button === 2) {
      let hasBlock = false
      for (let y = 0; y < HEIGHT; y++) {
        if (world.value[worldX]?.[y]?.[worldZ] !== BLOCK_AIR) {
          hasBlock = true
          break
        }
      }
      if (!hasBlock) {
        world.value[worldX]![0]![worldZ] = selectedBlock.value
      }
    }
  }
}

const onContextMenu = (e: Event) => {
  e.preventDefault()
}

// Start game
const startGame = async () => {
  isPlaying.value = true
  initWorld()

  await nextTick()

  if (canvasRef.value) {
    canvasRef.value.width = 640
    canvasRef.value.height = 400
    ctx = canvasRef.value.getContext('2d')
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  animId = requestAnimationFrame(gameLoop)
}

// Cleanup
const onUnmounted = () => {
  if (animId) cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
}

// Auto cleanup
import { onUnmounted as onUnmount } from 'vue'
onUnmount(onUnmounted)
</script>

<template>
  <div class="mc-page">
    <h1 class="title">⛏️ Minecraft pre-Classic</h1>
    <p class="subtitle">致敬 2009年5月 Notch 的 Cave Game 原型</p>

    <div v-if="!isPlaying" class="start-screen">
      <div class="start-content">
        <h2>🎮 Cave Game Tech Test</h2>
        <p>2009年5月13日 - Minecraft 的第一个公开版本</p>
        <button class="start-btn" @click="startGame">开始游戏</button>
        <div class="info">
          <h3>📜 历史</h3>
          <p>pre-Classic 是 Minecraft 最早的开发阶段，当时被称为 "Cave Game"。</p>
          <p>世界只有 256×64×256 大小，光照只有明暗两档。</p>
        </div>
      </div>
    </div>

    <div v-else class="game-container">
      <div class="hud">
        <span>位置: {{ Math.floor(playerX) }}, {{ Math.floor(playerZ) }}</span>
        <span>方块: {{ blockNames[selectedBlock] }}</span>
      </div>

      <div class="canvas-wrapper">
        <canvas
          ref="canvasRef"
          class="game-canvas"
          @click="handleClick"
          @contextmenu="onContextMenu"
        />
      </div>

      <div class="hotbar">
        <div
          v-for="i in 3"
          :key="i"
          class="slot"
          :class="{ active: selectedBlock === i }"
          @click="selectedBlock = i"
        >
          <div class="block-icon" :style="{ background: blockColors[i]?.top || '#333' }"></div>
          <span class="key">{{ i }}</span>
          <span class="name">{{ blockNames[i] }}</span>
        </div>
      </div>

      <div class="controls">
        <h3>🎮 控制</h3>
        <div class="control-grid">
          <div><span class="key">WASD</span> 移动</div>
          <div><span class="key">左键</span> 破坏方块</div>
          <div><span class="key">右键</span> 放置方块</div>
          <div><span class="key">1-3</span> 选择方块</div>
          <div><span class="key">R</span> 回中心</div>
        </div>
      </div>

      <div class="history">
        <h3>📜 关于 pre-Classic</h3>
        <p>这是 Minecraft 最早的开发阶段，2009年5月10日开始开发。</p>
        <p>当时游戏被称为 "Cave Game"，只有简单的方块放置和破坏功能。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mc-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
  gap: 1rem;
}

.title {
  color: #ffd700;
  font-size: 1.8rem;
  text-shadow: 0 0 15px rgba(255,215,0,0.5);
}

.subtitle {
  color: #888;
  font-size: 0.9rem;
}

.start-screen {
  width: 100%;
  display: flex;
  justify-content: center;
}

.start-content {
  text-align: center;
  padding: 2rem;
  background: rgba(0,0,0,0.5);
  border-radius: 16px;
  border: 2px solid rgba(255,215,0,0.3);
  max-width: 500px;
}

.start-content h2 {
  color: #ffd700;
  margin-bottom: 1rem;
}

.start-content p {
  color: #ccc;
  margin-bottom: 1rem;
}

.start-btn {
  padding: 1rem 3rem;
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 1.5rem;
}

.start-btn:hover {
  transform: scale(1.05);
}

.info {
  text-align: left;
  padding: 1rem;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
}

.info h3 {
  color: #ffd700;
  margin-bottom: 0.5rem;
}

.info p {
  font-size: 0.85rem;
  margin: 0.3rem 0;
}

.game-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.hud {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: rgba(0,0,0,0.5);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #ccc;
}

.canvas-wrapper {
  border: 2px solid rgba(255,215,0,0.3);
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
}

.game-canvas {
  display: block;
  width: 100%;
  height: auto;
}

.hotbar {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 0.5rem;
  background: rgba(0,0,0,0.5);
  border-radius: 8px;
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  min-width: 70px;
}

.slot:hover {
  border-color: rgba(255,255,255,0.3);
}

.slot.active {
  border-color: #ffd700;
  background: rgba(255,215,0,0.2);
}

.block-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  box-shadow: inset 0 -4px 0 rgba(0,0,0,0.3);
}

.key {
  font-size: 0.75rem;
  color: #ffd700;
  padding: 2px 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}

.name {
  font-size: 0.7rem;
  color: #ccc;
}

.controls {
  padding: 1rem;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
}

.controls h3 {
  color: #ffd700;
  margin-bottom: 0.5rem;
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #ccc;
}

.control-grid .key {
  margin-right: 0.5rem;
}

.history {
  padding: 1rem;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
}

.history h3 {
  color: #ffd700;
  margin-bottom: 0.5rem;
}

.history p {
  color: #aaa;
  font-size: 0.85rem;
  margin: 0.3rem 0;
}
</style>
