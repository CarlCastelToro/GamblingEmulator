<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

const score = ref(props.gamblingScore)

watch(() => props.gamblingScore, (newScore) => {
  score.value = newScore
})

watch(score, (newScore) => {
  emit('update:gamblingScore', newScore)
  localStorage.setItem('gambling_score', newScore.toString())
})

const addScore = (amount: number) => {
  emit('score-gain', amount)
}

// 游戏配置
const lanes = ['D', 'F', 'J', 'K']
const laneColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']
const noteSpeed = ref(3) // 下落速度（秒）
const noteFrequency = ref(0.5) // 音符生成频率（秒）

// 游戏状态
const isPlaying = ref(false)
const isPaused = ref(false)
const gameTime = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const score_points = ref(0)
const perfectCount = ref(0)
const greatCount = ref(0)
const goodCount = ref(0)
const missCount = ref(0)
const betAmount = ref(100)
const gameResult = ref<{ message: string; winAmount: number } | null>(null)

// 音符数据
interface Note {
  id: number
  lane: number
  y: number
  active: boolean
  hit: boolean
}

const notes = ref<Note[]>([])
let noteIdCounter = 0
let gameTimer: number | null = null
let noteTimer: number | null = null
let animationTimer: number | null = null

// 按键状态
const keyStates = ref([false, false, false, false])

// 判定区域
const judgeLineY = 80 // 判定线位置（百分比）

// 生成音符
const generateNote = () => {
  if (!isPlaying.value || isPaused.value) return
  
  const lane = Math.floor(Math.random() * 4)
  const note: Note = {
    id: noteIdCounter++,
    lane,
    y: 0,
    active: true,
    hit: false
  }
  notes.value.push(note)
}

// 更新音符位置
const updateNotes = () => {
  if (!isPlaying.value || isPaused.value) return
  
  const speed = 100 / (noteSpeed.value * 60) // 每帧移动的百分比
  
  notes.value.forEach(note => {
    if (note.active) {
      note.y += speed
      
      // 检查是否错过
      if (note.y > 100) {
        note.active = false
        missCount.value++
        combo.value = 0
        showJudgment('Miss')
      }
    }
  })
  
  // 清理无效音符
  notes.value = notes.value.filter(note => note.y <= 100)
}

// 检查按键判定
const checkHit = (lane: number) => {
  if (!isPlaying.value || isPaused.value) return
  
  const hitZone = 10 // 判定区域大小（百分比）
  
  // 查找该车道最近的音符
  const closestNote = notes.value
    .filter(note => note.active && note.lane === lane)
    .sort((a, b) => Math.abs(a.y - judgeLineY) - Math.abs(b.y - judgeLineY))[0]
  
  if (!closestNote) return
  
  const distance = Math.abs(closestNote.y - judgeLineY)
  
  if (distance <= hitZone) {
    closestNote.active = false
    closestNote.hit = true
    
    // 判定
    if (distance <= 3) {
      // Perfect
      score_points.value += 100 * (1 + combo.value * 0.1)
      perfectCount.value++
      combo.value++
      showJudgment('Perfect!')
    } else if (distance <= 6) {
      // Great
      score_points.value += 75 * (1 + combo.value * 0.1)
      greatCount.value++
      combo.value++
      showJudgment('Great!')
    } else {
      // Good
      score_points.value += 50
      goodCount.value++
      combo.value++
      showJudgment('Good')
    }
    
    maxCombo.value = Math.max(maxCombo.value, combo.value)
  }
}

// 显示判定
const judgmentText = ref('')
const judgmentColor = ref('')
const showJudgmentTimer = ref(0)
const judgmentScale = ref(1)

const showJudgment = (text: string) => {
  judgmentText.value = text
  judgmentColor.value = text === 'Perfect!' ? '#f1c40f' : text === 'Great!' ? '#2ecc71' : text === 'Good' ? '#3498db' : '#e74c3c'
  showJudgmentTimer.value = 45 // 显示约 750ms
  judgmentScale.value = 1.5
}

// 开始游戏
const startGame = () => {
  if (score.value < betAmount.value) {
    gameResult.value = { message: '击分不足！', winAmount: 0 }
    return
  }
  
  isPlaying.value = true
  isPaused.value = false
  gameTime.value = 0
  combo.value = 0
  maxCombo.value = 0
  score_points.value = 0
  perfectCount.value = 0
  greatCount.value = 0
  goodCount.value = 0
  missCount.value = 0
  notes.value = []
  gameResult.value = null
  
  score.value -= betAmount.value
  
  // 游戏计时器
  gameTimer = window.setInterval(() => {
    if (!isPaused.value) {
      gameTime.value++
    }
  }, 1000)
  
  // 音符生成器
  noteTimer = window.setInterval(generateNote, noteFrequency.value * 1000)
  
  // 动画循环
  const animate = () => {
    updateNotes()
    
    // 更新判定显示
    if (showJudgmentTimer.value > 0) {
      showJudgmentTimer.value--
      // 缩小动画
      if (showJudgmentTimer.value < 30) {
        judgmentScale.value = Math.max(1, judgmentScale.value - 0.02)
      }
    }
    
    animationTimer = requestAnimationFrame(animate)
  }
  animate()
  
  // 30秒后结束游戏
  setTimeout(() => {
    if (isPlaying.value) {
      endGame()
    }
  }, 30000)
}

// 暂停/继续游戏
const togglePause = () => {
  isPaused.value = !isPaused.value
}

// 结束游戏
const endGame = () => {
  isPlaying.value = false
  isPaused.value = false
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  
  if (noteTimer) {
    clearInterval(noteTimer)
    noteTimer = null
  }
  
  if (animationTimer) {
    cancelAnimationFrame(animationTimer)
    animationTimer = null
  }
  
  // 计算奖励
  const totalNotes = perfectCount.value + greatCount.value + goodCount.value + missCount.value
  const accuracy = totalNotes > 0 ? (perfectCount.value + greatCount.value + goodCount.value) / totalNotes : 0
  const baseReward = Math.floor(score_points.value)
  const comboBonus = maxCombo.value * 10
  const accuracyBonus = Math.floor(accuracy * 500)
  const totalReward = baseReward + comboBonus + accuracyBonus
  
  if (totalReward > 0) {
    addScore(totalReward)
  }
  
  gameResult.value = {
    message: `游戏结束！得分: ${Math.floor(score_points.value)} | 最大连击: ${maxCombo.value}`,
    winAmount: totalReward
  }
}

// 键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  const laneIndex = lanes.indexOf(e.key.toUpperCase())
  if (laneIndex !== -1) {
    keyStates.value[laneIndex] = true
    checkHit(laneIndex)
  }
  
  if (e.key === 'Escape') {
    if (isPlaying.value) {
      togglePause()
    }
  }
}

const handleKeyUp = (e: KeyboardEvent) => {
  const laneIndex = lanes.indexOf(e.key.toUpperCase())
  if (laneIndex !== -1) {
    keyStates.value[laneIndex] = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  
  if (gameTimer) clearInterval(gameTimer)
  if (noteTimer) clearInterval(noteTimer)
  if (animationTimer) cancelAnimationFrame(animationTimer)
})

// 统计数据
const stats = computed(() => {
  const totalNotes = perfectCount.value + greatCount.value + goodCount.value + missCount.value
  const accuracy = totalNotes > 0 ? ((perfectCount.value + greatCount.value + goodCount.value) / totalNotes * 100).toFixed(1) : '0'
  
  return {
    totalNotes,
    accuracy,
    perfect: perfectCount.value,
    great: greatCount.value,
    good: goodCount.value,
    miss: missCount.value,
    maxCombo: maxCombo.value,
    score: Math.floor(score_points.value)
  }
})
</script>

<template>
  <div class="rhythm-game">
    <h1>🎵 节奏大师</h1>
    <p class="subtitle">跟着节奏按键得分！按 D F J K 对应四个车道</p>
    
    <div class="game-area" :class="{ playing: isPlaying }">
      <div class="lanes">
        <div 
          v-for="(lane, index) in lanes" 
          :key="index"
          class="lane"
          :class="{ active: keyStates[index] }"
          :style="{ borderColor: laneColors[index] }"
        >
          <div class="lane-label">{{ lane }}</div>
          
          <div 
            v-for="note in notes.filter(n => n.lane === index && n.active)" 
            :key="note.id"
            class="note"
            :style="{
              top: `${note.y}%`,
              backgroundColor: laneColors[index]
            }"
          ></div>
        </div>
      </div>
      
      <div class="judge-line" :style="{ top: `${judgeLineY}%` }">
        <div 
          v-for="(lane, index) in lanes" 
          :key="index"
          class="judge-zone"
          :class="{ hit: keyStates[index] }"
          :style="{ backgroundColor: laneColors[index] }"
        ></div>
      </div>
      
      <div v-if="showJudgmentTimer > 0 && isPlaying" class="judgment-popup" :style="{ 
        color: judgmentColor, 
        transform: `translate(-50%, -50%) scale(${judgmentScale})`,
        opacity: showJudgmentTimer > 30 ? 1 : showJudgmentTimer / 30
      }">
        {{ judgmentText }}
      </div>
    </div>
    
    <div class="game-info">
      <div class="info-item">
        <span class="label">得分</span>
        <span class="value">{{ Math.floor(score_points) }}</span>
      </div>
      <div class="info-item">
        <span class="label">连击</span>
        <span class="value combo">{{ combo }}</span>
      </div>
      <div class="info-item">
        <span class="label">时间</span>
        <span class="value">{{ gameTime }}s</span>
      </div>
    </div>
    
    <div v-if="gameResult" class="result" :class="{ win: gameResult.winAmount > 0 }">
      {{ gameResult.message }}
      <span v-if="gameResult.winAmount > 0">+{{ gameResult.winAmount }} 击分</span>
    </div>
    
    <div class="controls">
      <div v-if="!isPlaying" class="start-controls">
        <div class="bet-amounts">
          <button @click="betAmount = 50" :class="{ active: betAmount === 50 }">50</button>
          <button @click="betAmount = 100" :class="{ active: betAmount === 100 }">100</button>
          <button @click="betAmount = 200" :class="{ active: betAmount === 200 }">200</button>
          <button @click="betAmount = 500" :class="{ active: betAmount === 500 }">500</button>
        </div>
        <button class="start-btn" @click="startGame" :disabled="score < betAmount">
          开始游戏 ({{ betAmount }}击分)
        </button>
      </div>
      
      <div v-else class="playing-controls">
        <button class="pause-btn" @click="togglePause">
          {{ isPaused ? '继续' : '暂停' }}
        </button>
        <button class="end-btn" @click="endGame">结束游戏</button>
      </div>
    </div>
    
    <div class="info-panel">
      <div class="info-item">
        <span class="label">当前击分</span>
        <span class="value">{{ score.toLocaleString() }}</span>
      </div>
      <div class="info-item">
        <span class="label">下落速度</span>
        <span class="value">{{ noteSpeed }}s</span>
      </div>
      <div class="info-item">
        <span class="label">音符频率</span>
        <span class="value">{{ noteFrequency }}s</span>
      </div>
    </div>
    
    <div v-if="stats.totalNotes > 0" class="stats">
      <h3>📊 统计数据</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总音符</span>
          <span class="stat-value">{{ stats.totalNotes }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">准确率</span>
          <span class="stat-value">{{ stats.accuracy }}%</span>
        </div>
        <div class="stat-item perfect">
          <span class="stat-label">Perfect</span>
          <span class="stat-value">{{ stats.perfect }}</span>
        </div>
        <div class="stat-item great">
          <span class="stat-label">Great</span>
          <span class="stat-value">{{ stats.great }}</span>
        </div>
        <div class="stat-item good">
          <span class="stat-label">Good</span>
          <span class="stat-value">{{ stats.good }}</span>
        </div>
        <div class="stat-item miss">
          <span class="stat-label">Miss</span>
          <span class="stat-value">{{ stats.miss }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最大连击</span>
          <span class="stat-value">{{ stats.maxCombo }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">得分</span>
          <span class="stat-value">{{ stats.score }}</span>
        </div>
      </div>
    </div>
    
    <div class="controls-info">
      <h3>🎮 操作说明</h3>
      <div class="controls-list">
        <div class="control-item">
          <span class="key">D</span>
          <span class="desc">第一车道</span>
        </div>
        <div class="control-item">
          <span class="key">F</span>
          <span class="desc">第二车道</span>
        </div>
        <div class="control-item">
          <span class="key">J</span>
          <span class="desc">第三车道</span>
        </div>
        <div class="control-item">
          <span class="key">K</span>
          <span class="desc">第四车道</span>
        </div>
        <div class="control-item">
          <span class="key">ESC</span>
          <span class="desc">暂停/继续</span>
        </div>
      </div>
      <div class="judgment-info">
        <div class="judgment-item">
          <span class="judgment perfect">Perfect</span>
          <span class="judgment-desc">100分 + 连击加成</span>
        </div>
        <div class="judgment-item">
          <span class="judgment great">Great</span>
          <span class="judgment-desc">75分 + 连击加成</span>
        </div>
        <div class="judgment-item">
          <span class="judgment good">Good</span>
          <span class="judgment-desc">50分</span>
        </div>
        <div class="judgment-item">
          <span class="judgment miss">Miss</span>
          <span class="judgment-desc">0分 + 连击重置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rhythm-game {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

h1 {
  color: #f1c40f;
  margin-bottom: 10px;
}

.subtitle {
  color: #bdc3c7;
  margin-bottom: 30px;
}

.game-area {
  position: relative;
  width: 300px;
  height: 400px;
  margin: 0 auto 30px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  overflow: hidden;
}

.game-area.playing {
  border: 2px solid #3498db;
}

.lanes {
  display: flex;
  height: 100%;
}

.lane {
  flex: 1;
  position: relative;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  transition: background-color 0.1s;
}

.lane:last-child {
  border-right: none;
}

.lane.active {
  background: rgba(255, 255, 255, 0.1);
}

.lane-label {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  font-weight: bold;
  z-index: 10;
}

.note {
  position: absolute;
  left: 10%;
  width: 80%;
  height: 20px;
  border-radius: 10px;
  transition: top 0.05s linear;
}

.judge-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: white;
  display: flex;
}

.judge-zone {
  flex: 1;
  height: 30px;
  margin-top: -15px;
  opacity: 0.3;
  transition: opacity 0.1s;
}

.judge-zone.hit {
  opacity: 0.8;
}

.judgment-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 0 10px currentColor;
  z-index: 100;
  pointer-events: none;
  transition: opacity 0.1s ease-out;
}

.game-info {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 20px;
}

.game-info .info-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px 20px;
  border-radius: 10px;
}

.game-info .label {
  display: block;
  color: #bdc3c7;
  font-size: 12px;
  margin-bottom: 5px;
}

.game-info .value {
  display: block;
  color: #ecf0f1;
  font-size: 24px;
  font-weight: bold;
}

.game-info .combo {
  color: #f1c40f;
}

.result {
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 2px solid #2ecc71;
}

.controls {
  margin-bottom: 30px;
}

.start-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.bet-amounts {
  display: flex;
  gap: 10px;
}

.bet-amounts button {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  background: #34495e;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.bet-amounts button:hover {
  background: #2c3e50;
}

.bet-amounts button.active {
  background: #3498db;
}

.start-btn {
  padding: 15px 40px;
  font-size: 18px;
  font-weight: bold;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.start-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
}

.start-btn:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}

.playing-controls {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.pause-btn,
.end-btn {
  padding: 12px 30px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.pause-btn {
  background: #3498db;
  color: white;
}

.end-btn {
  background: #e74c3c;
  color: white;
}

.pause-btn:hover,
.end-btn:hover {
  transform: scale(1.05);
}

.info-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.info-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 10px;
}

.info-item .label {
  display: block;
  color: #bdc3c7;
  font-size: 14px;
  margin-bottom: 5px;
}

.info-item .value {
  display: block;
  color: #ecf0f1;
  font-size: 20px;
  font-weight: bold;
}

.stats {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
}

.stats h3 {
  color: #f1c40f;
  margin-bottom: 15px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 15px;
}

.stat-item {
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
}

.stat-label {
  display: block;
  color: #bdc3c7;
  font-size: 12px;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  color: #ecf0f1;
  font-size: 18px;
  font-weight: bold;
}

.stat-item.perfect .stat-value {
  color: #f1c40f;
}

.stat-item.great .stat-value {
  color: #2ecc71;
}

.stat-item.good .stat-value {
  color: #3498db;
}

.stat-item.miss .stat-value {
  color: #e74c3c;
}

.controls-info {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
}

.controls-info h3 {
  color: #f1c40f;
  margin-bottom: 15px;
}

.controls-list {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.control-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.key {
  display: inline-block;
  padding: 10px 15px;
  background: #34495e;
  color: white;
  border-radius: 5px;
  font-weight: bold;
  font-size: 18px;
  min-width: 40px;
}

.desc {
  color: #bdc3c7;
  font-size: 12px;
}

.judgment-info {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.judgment-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.judgment {
  padding: 5px 10px;
  border-radius: 5px;
  font-weight: bold;
  font-size: 14px;
}

.judgment.perfect {
  background: rgba(241, 196, 15, 0.2);
  color: #f1c40f;
}

.judgment.great {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.judgment.good {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
}

.judgment.miss {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.judgment-desc {
  color: #bdc3c7;
  font-size: 12px;
}

@media (max-width: 768px) {
  .game-area {
    width: 250px;
    height: 350px;
  }
  
  .game-info {
    flex-direction: column;
    gap: 10px;
  }
  
  .controls-list {
    flex-direction: column;
    align-items: center;
  }
  
  .judgment-info {
    flex-direction: column;
    align-items: center;
  }
}
</style>
