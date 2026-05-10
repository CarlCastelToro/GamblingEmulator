<script setup lang="ts">
import { ref, computed, watch } from 'vue'

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

// 扑克牌定义
const suits = ['♠', '♥', '♦', '♣']
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

interface Card {
  suit: string
  rank: string
  value: number
}

// 创建牌组
const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        value: ranks.indexOf(rank) + 2
      })
    }
  }
  return deck
}

// 洗牌
const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]
    const temp2 = shuffled[j]
    if (temp !== undefined && temp2 !== undefined) {
      shuffled[i] = temp2
      shuffled[j] = temp
    }
  }
  return shuffled
}

// 游戏状态
const deck = ref<Card[]>([])
const playerHand = ref<Card[]>([])
const dealerHand = ref<Card[]>([])
const communityCards = ref<Card[]>([])
const pot = ref(0)
const playerBet = ref(0)
const dealerBet = ref(0)
const currentBet = ref(0)
const gamePhase = ref<'betting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'>('betting')
const betAmount = ref(100)
const gameResult = ref<{ message: string; winAmount: number } | null>(null)
const isDealing = ref(false)
const playerChips = ref(1000)
const dealerChips = ref(1000)
const foldCount = ref(0)
const winCount = ref(0)

// 牌型评估
const evaluateHand = (hand: Card[], community: Card[]): { rank: number; name: string; description: string } => {
  const allCards = [...hand, ...community]
  
  // 简化版牌型评估
  const values = allCards.map(c => c.value).sort((a, b) => b - a)
  const suits = allCards.map(c => c.suit)
  
  // 统计每个点数的出现次数
  const valueCounts: Record<number, number> = {}
  values.forEach(v => {
    valueCounts[v] = (valueCounts[v] || 0) + 1
  })
  
  const counts = Object.values(valueCounts).sort((a, b) => b - a)
  const uniqueValues = Object.keys(valueCounts).map(Number).sort((a, b) => b - a)
  
  // 检查同花
  const suitCounts: Record<string, number> = {}
  suits.forEach(s => {
    suitCounts[s] = (suitCounts[s] || 0) + 1
  })
  const isFlush = Object.values(suitCounts).some(count => count >= 5)
  
  // 检查顺子
  let isStraight = false
  let straightHigh = 0
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    const current = uniqueValues[i]
    const next = uniqueValues[i + 4]
    if (current !== undefined && next !== undefined && current - next === 4) {
      isStraight = true
      straightHigh = current
      break
    }
  }
  
  // 特殊顺子 A-2-3-4-5
  if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && 
      uniqueValues.includes(4) && uniqueValues.includes(5)) {
    isStraight = true
    straightHigh = 5
  }
  
  // 评估牌型
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: 10, name: '皇家同花顺', description: 'A-K-Q-J-10 同花' }
    }
    return { rank: 9, name: '同花顺', description: `${straightHigh}高同花顺` }
  }
  
  if (counts[0] === 4) {
    return { rank: 8, name: '四条', description: `${uniqueValues[0] ?? 0}四条` }
  }
  
  if (counts[0] === 3 && counts[1] !== undefined && counts[1] >= 2) {
    return { rank: 7, name: '葫芦', description: `${uniqueValues[0] ?? 0}满${uniqueValues[1] ?? 0}` }
  }
  
  if (isFlush) {
    return { rank: 6, name: '同花', description: `${uniqueValues[0] ?? 0}高同花` }
  }
  
  if (isStraight) {
    return { rank: 5, name: '顺子', description: `${straightHigh}高顺子` }
  }
  
  if (counts[0] === 3) {
    return { rank: 4, name: '三条', description: `${uniqueValues[0] ?? 0}三条` }
  }
  
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 3, name: '两对', description: `${uniqueValues[0] ?? 0}和${uniqueValues[1] ?? 0}两对` }
  }
  
  if (counts[0] === 2) {
    return { rank: 2, name: '一对', description: `${uniqueValues[0] ?? 0}一对` }
  }
  
  return { rank: 1, name: '高牌', description: `${uniqueValues[0]}高牌` }
}

// 发牌
const dealCards = () => {
  if (score.value < betAmount.value) {
    gameResult.value = { message: '击分不足！', winAmount: 0 }
    return
  }
  
  isDealing.value = true
  gameResult.value = null
  
  // 重置
  deck.value = shuffleDeck(createDeck())
  playerHand.value = []
  dealerHand.value = []
  communityCards.value = []
  pot.value = 0
  playerBet.value = 0
  dealerBet.value = 0
  currentBet.value = 0
  
  // 扣除盲注
  score.value -= betAmount.value
  playerBet.value = betAmount.value
  dealerBet.value = betAmount.value
  pot.value = betAmount.value * 2
  currentBet.value = betAmount.value
  
  // 发手牌
  setTimeout(() => {
    playerHand.value = [deck.value.pop()!, deck.value.pop()!]
    dealerHand.value = [deck.value.pop()!, deck.value.pop()!]
    gamePhase.value = 'preflop'
    isDealing.value = false
  }, 500)
}

// 下注
const placeBet = (amount: number) => {
  if (amount > score.value) return
  
  score.value -= amount
  playerBet.value += amount
  pot.value += amount
  currentBet.value = amount
  
  // 庄家跟注或加注
  const dealerAction = Math.random()
  if (dealerAction > 0.3) {
    const dealerCall = Math.min(amount, dealerChips.value)
    dealerBet.value += dealerCall
    pot.value += dealerCall
  } else {
    // 庄家弃牌
    const winAmount = pot.value
    addScore(winAmount)
    gameResult.value = { message: '🃏 庄家弃牌！你赢了！', winAmount }
    gamePhase.value = 'betting'
    return
  }
  
  // 进入下一阶段
  nextPhase()
}

// 过牌
const check = () => {
  // 庄家随机过牌或下注
  const dealerAction = Math.random()
  if (dealerAction > 0.5 && communityCards.value.length > 0) {
    const dealerBetAmount = Math.floor(pot.value * 0.5)
    dealerBet.value += dealerBetAmount
    pot.value += dealerBetAmount
  }
  nextPhase()
}

// 弃牌
const fold = () => {
  foldCount.value++
  gameResult.value = { message: '🃏 你弃牌了', winAmount: 0 }
  gamePhase.value = 'betting'
}

// 全押
const allIn = () => {
  const allInAmount = score.value
  score.value = 0
  playerBet.value += allInAmount
  pot.value += allInAmount
  
  // 庄家随机决定
  const dealerAction = Math.random()
  if (dealerAction > 0.2) {
    const dealerCall = Math.min(allInAmount, dealerChips.value)
    dealerBet.value += dealerCall
    pot.value += dealerCall
  }
  
  // 直接摊牌
  gamePhase.value = 'river'
  communityCards.value = [
    deck.value.pop()!,
    deck.value.pop()!,
    deck.value.pop()!,
    deck.value.pop()!,
    deck.value.pop()!
  ]
  showdown()
}

// 下一阶段
const nextPhase = () => {
  switch (gamePhase.value) {
    case 'preflop':
      gamePhase.value = 'flop'
      communityCards.value = [deck.value.pop()!, deck.value.pop()!, deck.value.pop()!]
      break
    case 'flop':
      gamePhase.value = 'turn'
      communityCards.value.push(deck.value.pop()!)
      break
    case 'turn':
      gamePhase.value = 'river'
      communityCards.value.push(deck.value.pop()!)
      break
    case 'river':
      showdown()
      break
  }
}

// 摊牌
const showdown = () => {
  gamePhase.value = 'showdown'
  
  const playerHandRank = evaluateHand(playerHand.value, communityCards.value)
  const dealerHandRank = evaluateHand(dealerHand.value, communityCards.value)
  
  if (playerHandRank.rank > dealerHandRank.rank) {
    // 玩家赢
    const winAmount = pot.value
    addScore(winAmount)
    winCount.value++
    gameResult.value = { 
      message: `🎉 你赢了！${playerHandRank.name} > ${dealerHandRank.name}`, 
      winAmount 
    }
  } else if (playerHandRank.rank < dealerHandRank.rank) {
    // 庄家赢
    gameResult.value = { 
      message: `😢 庄家赢了！${dealerHandRank.name} > ${playerHandRank.name}`, 
      winAmount: 0 
    }
  } else {
    // 平局
    const tieAmount = Math.floor(pot.value / 2)
    addScore(tieAmount)
    gameResult.value = { 
      message: `🤝 平局！都是${playerHandRank.name}`, 
      winAmount: tieAmount 
    }
  }
  
  setTimeout(() => {
    gamePhase.value = 'betting'
  }, 3000)
}

// 获取牌面显示
const getCardDisplay = (card: Card): string => {
  return `${card.rank}${card.suit}`
}

// 获取牌面颜色
const getCardColor = (card: Card): string => {
  return card.suit === '♥' || card.suit === '♦' ? '#e74c3c' : '#2c3e50'
}

// 统计数据
const stats = computed(() => {
  const totalGames = winCount.value + foldCount.value
  return {
    totalGames,
    winRate: totalGames > 0 ? ((winCount.value / totalGames) * 100).toFixed(1) : '0',
    wins: winCount.value,
    folds: foldCount.value
  }
})
</script>

<template>
  <div class="texas-holdem">
    <h1>🃏 德州扑克</h1>
    <p class="subtitle">与庄家一决高下！</p>
    
    <div class="game-table">
      <div class="dealer-area">
        <h3>庄家</h3>
        <div class="hand">
          <div 
            v-for="(card, index) in dealerHand" 
            :key="index"
            class="card"
            :class="{ hidden: gamePhase !== 'showdown' && index === 0 }"
            :style="{ color: getCardColor(card) }"
          >
            {{ gamePhase === 'showdown' ? getCardDisplay(card) : '?' }}
          </div>
        </div>
        <div class="chips">筹码: {{ dealerChips }}</div>
      </div>
      
      <div class="community-area">
        <h3>公共牌</h3>
        <div class="community-cards">
          <div 
            v-for="(card, index) in communityCards" 
            :key="index"
            class="card"
            :style="{ color: getCardColor(card) }"
          >
            {{ getCardDisplay(card) }}
          </div>
          <div v-for="i in (5 - communityCards.length)" :key="'empty-' + i" class="card empty">
            ?
          </div>
        </div>
        <div class="pot">底池: {{ pot }} 击分</div>
      </div>
      
      <div class="player-area">
        <h3>你的手牌</h3>
        <div class="hand">
          <div 
            v-for="(card, index) in playerHand" 
            :key="index"
            class="card"
            :style="{ color: getCardColor(card) }"
          >
            {{ getCardDisplay(card) }}
          </div>
        </div>
        <div class="chips">筹码: {{ score }}</div>
      </div>
    </div>
    
    <div v-if="gameResult" class="result" :class="{ win: gameResult.winAmount > 0, lose: gameResult.winAmount === 0 }">
      {{ gameResult.message }}
      <span v-if="gameResult.winAmount > 0">+{{ gameResult.winAmount }} 击分</span>
    </div>
    
    <div class="controls">
      <div v-if="gamePhase === 'betting'" class="betting-controls">
        <div class="bet-amounts">
          <button @click="betAmount = 100" :class="{ active: betAmount === 100 }">100</button>
          <button @click="betAmount = 200" :class="{ active: betAmount === 200 }">200</button>
          <button @click="betAmount = 500" :class="{ active: betAmount === 500 }">500</button>
          <button @click="betAmount = 1000" :class="{ active: betAmount === 1000 }">1000</button>
        </div>
        <button class="deal-btn" @click="dealCards" :disabled="score < betAmount">
          发牌 ({{ betAmount }}击分)
        </button>
      </div>
      
      <div v-else-if="gamePhase !== 'showdown'" class="action-controls">
        <button class="fold-btn" @click="fold">弃牌</button>
        <button class="check-btn" @click="check">过牌</button>
        <button class="bet-btn" @click="placeBet(betAmount)">下注 {{ betAmount }}</button>
        <button class="raise-btn" @click="placeBet(betAmount * 2)">加注 {{ betAmount * 2 }}</button>
        <button class="allin-btn" @click="allIn">全押</button>
      </div>
      
      <div v-else class="showdown-controls">
        <button class="new-game-btn" @click="gamePhase = 'betting'">新一局</button>
      </div>
    </div>
    
    <div class="info-panel">
      <div class="info-item">
        <span class="label">当前击分</span>
        <span class="value">{{ score.toLocaleString() }}</span>
      </div>
      <div class="info-item">
        <span class="label">当前赌注</span>
        <span class="value">{{ betAmount }}</span>
      </div>
      <div class="info-item">
        <span class="label">游戏阶段</span>
        <span class="value">{{ gamePhase === 'betting' ? '下注' : gamePhase === 'preflop' ? '翻牌前' : gamePhase === 'flop' ? '翻牌' : gamePhase === 'turn' ? '转牌' : gamePhase === 'river' ? '河牌' : '摊牌' }}</span>
      </div>
    </div>
    
    <div v-if="stats.totalGames > 0" class="stats">
      <h3>📊 统计数据</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总局数</span>
          <span class="stat-value">{{ stats.totalGames }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">胜率</span>
          <span class="stat-value">{{ stats.winRate }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">胜利</span>
          <span class="stat-value">{{ stats.wins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">弃牌</span>
          <span class="stat-value">{{ stats.folds }}</span>
        </div>
      </div>
    </div>
    
    <div class="rules">
      <h3>📋 牌型大小</h3>
      <div class="rules-list">
        <div class="rule">皇家同花顺 > 同花顺 > 四条 > 葫芦</div>
        <div class="rule">同花 > 顺子 > 三条 > 两对 > 一对 > 高牌</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.texas-holdem {
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

.game-table {
  background: linear-gradient(135deg, #27ae60, #229954);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.dealer-area,
.community-area,
.player-area {
  margin-bottom: 20px;
}

h3 {
  color: #ecf0f1;
  margin-bottom: 10px;
  font-size: 16px;
}

.hand {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
}

.card {
  width: 60px;
  height: 80px;
  background: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s;
}

.card:hover {
  transform: translateY(-5px);
}

.card.hidden {
  background: #3498db;
  color: white;
}

.card.empty {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
}

.community-cards {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
}

.pot {
  color: #f1c40f;
  font-size: 20px;
  font-weight: bold;
}

.chips {
  color: #ecf0f1;
  font-size: 14px;
}

.result {
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
}

.result.win {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 2px solid #2ecc71;
}

.result.lose {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 2px solid #e74c3c;
}

.controls {
  margin-bottom: 30px;
}

.betting-controls {
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

.deal-btn {
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

.deal-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
}

.deal-btn:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}

.action-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-controls button {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.fold-btn {
  background: #e74c3c;
  color: white;
}

.check-btn {
  background: #3498db;
  color: white;
}

.bet-btn {
  background: #2ecc71;
  color: white;
}

.raise-btn {
  background: #f39c12;
  color: white;
}

.allin-btn {
  background: #9b59b6;
  color: white;
}

.action-controls button:hover {
  transform: scale(1.05);
}

.new-game-btn {
  padding: 15px 40px;
  font-size: 18px;
  font-weight: bold;
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.new-game-btn:hover {
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

.rules {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
}

.rules h3 {
  color: #f1c40f;
  margin-bottom: 15px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule {
  color: #ecf0f1;
  font-size: 14px;
}

@media (max-width: 768px) {
  .game-table {
    padding: 20px;
  }
  
  .card {
    width: 50px;
    height: 70px;
    font-size: 14px;
  }
  
  .action-controls {
    flex-direction: column;
  }
  
  .action-controls button {
    width: 100%;
  }
}
</style>
