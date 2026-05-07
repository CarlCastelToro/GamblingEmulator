<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
  (e: 'score-gain', amount: number): void
}>()

type Difficulty = 'easy' | 'medium' | 'hard'

const DIFF = {
  easy: { rows: 9, cols: 9, mines: 10, reward: 2 },
  medium: { rows: 16, cols: 16, mines: 40, reward: 4 },
  hard: { rows: 16, cols: 30, mines: 99, reward: 8 }
}

const difficulty = ref<Difficulty>('easy')
const betAmount = ref(100)
const boardVisible = ref(false)
const minesPlaced = ref(false)
const gameOver = ref(false)
const won = ref(false)
const timer = ref(0)
const flags = ref(0)
const message = ref('')

const board = ref<number[]>([])
const state = ref<string[]>([])

const diff = computed(() => DIFF[difficulty.value])
const total = computed(() => diff.value.rows * diff.value.cols)
const minesLeft = computed(() => diff.value.mines - flags.value)

let timerH: number | null = null

const I = (r: number, c: number) => r * diff.value.cols + c
const R = (i: number) => Math.floor(i / diff.value.cols)
const C = (i: number) => i % diff.value.cols

function resetBoard() {
  board.value = Array(total.value).fill(0)
  state.value = Array(total.value).fill('hidden')
  flags.value = 0
  timer.value = 0
  gameOver.value = false
  won.value = false
  minesPlaced.value = false
  message.value = ''
  if (timerH) { clearInterval(timerH); timerH = null }
}

function layMines(safe: number) {
  const { mines, rows, cols } = diff.value
  let placed = 0
  while (placed < mines) {
    const i = Math.floor(Math.random() * total.value)
    if (i === safe || board.value[i] === 9) continue
    board.value[i] = 9
    placed++
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = I(r, c)
      if (board.value[i] === 9) continue
      let n = 0
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board.value[I(nr, nc)] === 9) n++
        }
      board.value[i] = n
    }
  }
  minesPlaced.value = true
}

function open(i: number) {
  if (state.value[i] !== 'hidden') return
  state.value[i] = 'revealed'

  if (board.value[i] === 9) {
    gameOver.value = true; won.value = false
    if (timerH) { clearInterval(timerH); timerH = null }
    for (let j = 0; j < total.value; j++) state.value[j] = 'revealed'
    message.value = '💥 踩到地雷！'
    return
  }
  if (board.value[i] === 0) {
    const r = R(i), c = C(i)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < diff.value.rows && nc >= 0 && nc < diff.value.cols)
          open(I(nr, nc))
      }
  }
}

function checkWin() {
  let hidden = 0
  for (let i = 0; i < total.value; i++) if (state.value[i] === 'hidden') hidden++
  if (hidden === diff.value.mines) {
    gameOver.value = true; won.value = true
    if (timerH) { clearInterval(timerH); timerH = null }
    const base = betAmount.value * diff.value.reward
    const bonus = Math.max(0, 300 - timer.value) * 2
    emit('score-gain', base + bonus)
    message.value = `🎉 胜利！获得 ${base + bonus} 击分！`
  }
}

function onCell(r: number, c: number) {
  if (gameOver.value) return
  const i = I(r, c)
  if (state.value[i] === 'flagged' || state.value[i] === 'revealed') return

  if (!minesPlaced.value) {
    // First click on board: place mines then start timer
    layMines(i)
    timerH = window.setInterval(() => timer.value++, 1000)
  }

  open(i)
  if (!gameOver.value) checkWin()
}

function onRight(e: Event, r: number, c: number) {
  e.preventDefault()
  if (gameOver.value || !minesPlaced.value) return
  const i = I(r, c)
  if (state.value[i] === 'revealed') return
  if (state.value[i] === 'flagged') { state.value[i] = 'hidden'; flags.value-- }
  else { state.value[i] = 'flagged'; flags.value++ }
}

function cellText(r: number, c: number): string {
  const i = I(r, c), s = state.value[i]
  if (s === 'hidden') return ''
  if (s === 'flagged') return '🚩'
  if (board.value[i] === 9) return '💣'
  if (board.value[i] === 0) return ''
  return String(board.value[i])
}

function cellCls(r: number, c: number): string {
  const i = I(r, c), s = state.value[i]
  if (s === 'hidden' || s === 'flagged') return s
  const v = board.value[i]
  if (v === 9) return 'mine'
  return 'n' + v
}

function go() {
  if (props.gamblingScore < betAmount.value) { message.value = '击分不足！'; return }
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  resetBoard()
  boardVisible.value = true
}

function restart() {
  boardVisible.value = false
}

resetBoard()
</script>

<template>
  <div class="ms">
    <h1>💣 扫雷</h1>

    <div class="bar">
      <span>💰 {{ Math.floor(gamblingScore) }}</span>
      <span v-if="boardVisible">💣 {{ minesLeft }}</span>
      <span v-if="boardVisible">⏱️ {{ timer }}s</span>
    </div>

    <div v-if="!boardVisible" class="panel">
      <div class="sec">
        <label>难度</label>
        <div class="bg">
          <button :class="{on:difficulty==='easy'}" @click="difficulty='easy'">简单</button>
          <button :class="{on:difficulty==='medium'}" @click="difficulty='medium'">普通</button>
          <button :class="{on:difficulty==='hard'}" @click="difficulty='hard'">困难</button>
        </div>
        <p class="note">{{ diff.rows }}×{{ diff.cols }} · {{ diff.mines }}雷 · {{ diff.reward }}倍</p>
      </div>
      <div class="sec">
        <label>下注</label>
        <div class="bet">
          <button @click="betAmount=Math.max(10,betAmount-10)">-</button>
          <span>{{ betAmount }}</span>
          <button @click="betAmount=Math.min(props.gamblingScore,betAmount+10)">+</button>
        </div>
      </div>
      <button class="go" @click="go">开始游戏</button>
    </div>

    <div v-else class="bw">
      <table>
        <tr v-for="r in diff.rows" :key="r">
          <td v-for="c in diff.cols" :key="c"
            class="c" :class="cellCls(r-1,c-1)"
            @click="onCell(r-1,c-1)"
            @contextmenu="onRight($event,r-1,c-1)"
          >{{ cellText(r-1,c-1) }}</td>
        </tr>
      </table>
      <div v-if="gameOver" class="ov">
        <p :class="won?'w':'l'">{{ won?'🎉 胜利！':'💥 失败！' }}</p>
        <button @click="restart">再来一局</button>
      </div>
    </div>

    <p v-if="message" class="msg">{{ message }}</p>

    <div class="rules">
      <p>左键揭开 · 右键标旗 · 数字=周围雷数</p>
    </div>
  </div>
</template>

<style scoped>
.ms { display:flex; flex-direction:column; align-items:center; padding:1rem; gap:1rem; }
h1 { color:#ffd700; font-size:2rem; }
.bar { display:flex; gap:1.5rem; padding:.5rem 1.5rem; background:rgba(0,0,0,.4); border-radius:8px; font-weight:bold; }
.panel { background:rgba(0,0,0,.3); padding:1.5rem; border-radius:12px; display:flex; flex-direction:column; gap:1rem; min-width:280px; }
.sec { display:flex; flex-direction:column; gap:.5rem; align-items:center; }
.sec label { color:#ffd700; font-weight:bold; }
.bg { display:flex; gap:.5rem; }
.bg button { padding:.5rem 1rem; background:rgba(255,255,255,.1); border:2px solid #444; border-radius:6px; color:#fff; cursor:pointer; }
.bg button.on { border-color:#ffd700; background:rgba(255,215,0,.2); color:#ffd700; }
.note { color:#888; font-size:.85rem; }
.bet { display:flex; align-items:center; gap:1rem; }
.bet button { width:30px; height:30px; background:rgba(255,255,255,.15); border:none; border-radius:6px; color:#fff; font-size:1.1rem; cursor:pointer; }
.bet span { color:#ffd700; font-size:1.3rem; font-weight:bold; min-width:50px; text-align:center; }
.go { padding:.8rem; background:#4CAF50; color:white; border:none; border-radius:8px; font-size:1rem; font-weight:bold; cursor:pointer; }
.go:hover { background:#45a049; }
.bw { position:relative; overflow:auto; padding:6px; background:rgba(0,0,0,.3); border-radius:8px; }
table { border-collapse:collapse; }
.c { width:28px; height:28px; text-align:center; vertical-align:middle; font-size:13px; font-weight:bold; cursor:pointer; border:1px solid #3a3a4a; user-select:none; }
.c.hidden { background:#4a4a6a; }
.c.hidden:hover { background:#5a5a7a; }
.c.flagged { background:#4a4a6a; }
.c.mine { background:#c0392b; }
.c.n0 { background:#2a2a3e; }
.c.n1 { background:#2a2a3e; color:#3b82f6; }
.c.n2 { background:#2a2a3e; color:#22c55e; }
.c.n3 { background:#2a2a3e; color:#ef4444; }
.c.n4 { background:#2a2a3e; color:#8b5cf6; }
.c.n5 { background:#2a2a3e; color:#f59e0b; }
.c.n6 { background:#2a2a3e; color:#06b6d4; }
.c.n7 { background:#2a2a3e; color:#ec4899; }
.c.n8 { background:#2a2a3e; color:#9ca3af; }
.ov { position:absolute; inset:0; background:rgba(0,0,0,.7); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; border-radius:8px; }
.ov .w { color:#22c55e; font-size:1.5rem; font-weight:bold; }
.ov .l { color:#ef4444; font-size:1.5rem; font-weight:bold; }
.ov button { padding:.6rem 2rem; background:#4CAF50; color:white; border:none; border-radius:8px; font-size:1rem; cursor:pointer; }
.msg { color:#ffd700; font-weight:bold; }
.rules { padding:.5rem 1rem; background:rgba(0,0,0,.2); border-radius:8px; }
.rules p { color:#888; font-size:.85rem; }
</style>
