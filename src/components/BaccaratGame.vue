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
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

interface Card {
  suit: string
  rank: string
  value: number
}

// 创建牌组
const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (let i = 0; i < 8; i++) { // 8副牌
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          suit,
          rank,
          value: rank === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(rank) ? 0 : parseInt(rank)
        })
      }
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
const bankerHand = ref<Card[]>([])
const playerScore = ref(0)
const bankerScore = ref(0)
const betAmount = ref(100)
const betType = ref<'player' | 'banker' | 'tie'>('player')
const gamePhase = ref<'betting' | 'dealing' | 'result'>('betting')
const gameResult = ref<{ message: string; winAmount: number; winner: string } | null>(null)
const isDealing = ref(false)
const roundCount = ref(0)
const winCount = ref(0)
const lossCount = ref(0)
const tieCount = ref(0)
const playerWinCount = ref(0)
const bankerWinCount = ref(0)

// 计算点数
const calculateScore = (hand: Card[]): number => {
  const total = hand.reduce((sum, card) => sum + card.value, 0)
  return total % 10
}

// 发牌
const dealCards = () => {
  if (score.value < betAmount.value) {
    gameResult.value = { message: '击分不足！', winAmount: 0, winner: '' }
    return
  }
  
  isDealing.value = true
  gameResult.value = null
  
  // 重置
  deck.value = shuffleDeck(createDeck())
  playerHand.value = []
  bankerHand.value = []
  
  // 扣除赌注
  score.value -= betAmount.value
  
  // 发初始牌
  setTimeout(() => {
    playerHand.value.push(deck.value.pop()!)
    bankerHand.value.push(deck.value.pop()!)
    playerHand.value.push(deck.value.pop()!)
    bankerHand.value.push(deck.value.pop()!)
    
    playerScore.value = calculateScore(playerHand.value)
    bankerScore.value = calculateScore(bankerHand.value)
    
    // 检查是否需要补牌
    checkThirdCard()
  }, 500)
}

// 检查第三张牌
const checkThirdCard = () => {
  const playerTotal = playerScore.value
  const bankerTotal = bankerScore.value
  
  // 天然赢家
  if (playerTotal >= 8 || bankerTotal >= 8) {
    setTimeout(() => determineWinner(), 1000)
    return
  }
  
  // 玩家补牌规则
  if (playerTotal <= 5) {
    setTimeout(() => {
      playerHand.value.push(deck.value.pop()!)
      playerScore.value = calculateScore(playerHand.value)
      
      // 庄家补牌规则
      checkBankerThirdCard()
    }, 800)
  } else {
    // 庄家补牌规则
    checkBankerThirdCard()
  }
}

// 庄家第三张牌规则
const checkBankerThirdCard = () => {
  const bankerTotal = bankerScore.value
  const playerThirdCard = playerHand.value.length === 3 && playerHand.value[2] ? playerHand.value[2].value : -1
  
  let shouldDraw = false
  
  if (bankerTotal <= 2) {
    shouldDraw = true
  } else if (bankerTotal === 3) {
    shouldDraw = playerThirdCard !== 8
  } else if (bankerTotal === 4) {
    shouldDraw = playerThirdCard >= 2 && playerThirdCard <= 7
  } else if (bankerTotal === 5) {
    shouldDraw = playerThirdCard >= 4 && playerThirdCard <= 7
  } else if (bankerTotal === 6) {
    shouldDraw = playerThirdCard === 6 || playerThirdCard === 7
  }
  
  if (shouldDraw) {
    setTimeout(() => {
      bankerHand.value.push(deck.value.pop()!)
      bankerScore.value = calculateScore(bankerHand.value)
      determineWinner()
    }, 800)
  } else {
    setTimeout(() => determineWinner(), 1000)
  }
}

// 确定赢家
const determineWinner = () => {
  gamePhase.value = 'result'
  isDealing.value = false
  roundCount.value++
  
  let winner = ''
  if (playerScore.value > bankerScore.value) {
    winner = 'player'
    playerWinCount.value++
  } else if (bankerScore.value > playerScore.value) {
    winner = 'banker'
    bankerWinCount.value++
  } else {
    winner = 'tie'
    tieCount.value++
  }
  
  // 计算奖励
  let winAmount = 0
  let message = ''
  
  if (betType.value === winner) {
    if (winner === 'player') {
      winAmount = betAmount.value * 2
      message = '🎉 闲家赢了！'
    } else if (winner === 'banker') {
      winAmount = Math.floor(betAmount.value * 1.95) // 庄家抽水5%
      message = '🎉 庄家赢了！'
    } else {
      winAmount = betAmount.value * 8
      message = '🎉 平局！大奖！'
    }
    winCount.value++
    addScore(winAmount)
  } else {
    message = winner === 'player' ? '闲家赢' : winner === 'banker' ? '庄家赢' : '平局'
    lossCount.value++
  }
  
  gameResult.value = {
    message,
    winAmount,
    winner
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
  const totalRounds = roundCount.value
  return {
    totalRounds,
    winRate: totalRounds > 0 ? ((winCount.value / totalRounds) * 100).toFixed(1) : '0',
    wins: winCount.value,
    losses: lossCount.value,
    ties: tieCount.value,
    playerWins: playerWinCount.value,
    bankerWins: bankerWinCount.value
  }
})
</script>

<template>
  <div class="baccarat-game">
    <h1>🎴 百家乐</h1>
    <p class="subtitle">经典赌场游戏，猜闲家、庄家或平局！</p>
    
    <div class="game-table">
      <div class="score-area">
        <div class="score-box player" :class="{ winner: gameResult?.winner === 'player' }">
          <h3>闲家</h3>
          <div class="score">{{ playerScore }}</div>
        </div>
        <div class="vs">VS</div>
        <div class="score-box banker" :class="{ winner: gameResult?.winner === 'banker' }">
          <h3>庄家</h3>
          <div class="score">{{ bankerScore }}</div>
        </div>
      </div>
      
      <div class="cards-area">
        <div class="hand player-hand">
          <div 
            v-for="(card, index) in playerHand" 
            :key="index"
            class="card"
            :style="{ color: getCardColor(card) }"
          >
            {{ getCardDisplay(card) }}
          </div>
        </div>
        
        <div class="hand banker-hand">
          <div 
            v-for="(card, index) in bankerHand" 
            :key="index"
            class="card"
            :style="{ color: getCardColor(card) }"
          >
            {{ getCardDisplay(card) }}
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="gameResult" class="result" :class="{ win: gameResult.winAmount > 0, tie: gameResult.winner === 'tie' }">
      {{ gameResult.message }}
      <span v-if="gameResult.winAmount > 0">+{{ gameResult.winAmount }} 击分</span>
    </div>
    
    <div class="betting-area">
      <h3>选择下注</h3>
      <div class="bet-types">
        <button 
          class="bet-type player" 
          :class="{ active: betType === 'player' }"
          @click="betType = 'player'"
        >
          <span class="label">闲家</span>
          <span class="payout">1:1</span>
        </button>
        <button 
          class="bet-type tie" 
          :class="{ active: betType === 'tie' }"
          @click="betType = 'tie'"
        >
          <span class="label">平局</span>
          <span class="payout">8:1</span>
        </button>
        <button 
          class="bet-type banker" 
          :class="{ active: betType === 'banker' }"
          @click="betType = 'banker'"
        >
          <span class="label">庄家</span>
          <span class="payout">1.95:1</span>
        </button>
      </div>
      
      <div class="bet-amounts">
        <button @click="betAmount = 100" :class="{ active: betAmount === 100 }">100</button>
        <button @click="betAmount = 200" :class="{ active: betAmount === 200 }">200</button>
        <button @click="betAmount = 500" :class="{ active: betAmount === 500 }">500</button>
        <button @click="betAmount = 1000" :class="{ active: betAmount === 1000 }">1000</button>
        <button @click="betAmount = Math.floor(score / 2)">一半</button>
        <button @click="betAmount = score">全押</button>
      </div>
      
      <button 
        class="deal-btn" 
        @click="dealCards" 
        :disabled="isDealing || score < betAmount"
      >
        {{ isDealing ? '发牌中...' : `下注 ${betAmount} 击分` }}
      </button>
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
        <span class="label">下注对象</span>
        <span class="value">{{ betType === 'player' ? '闲家' : betType === 'banker' ? '庄家' : '平局' }}</span>
      </div>
    </div>
    
    <div v-if="stats.totalRounds > 0" class="stats">
      <h3>📊 统计数据</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总局数</span>
          <span class="stat-value">{{ stats.totalRounds }}</span>
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
          <span class="stat-label">失败</span>
          <span class="stat-value">{{ stats.losses }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平局</span>
          <span class="stat-value">{{ stats.ties }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">闲家赢</span>
          <span class="stat-value">{{ stats.playerWins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">庄家赢</span>
          <span class="stat-value">{{ stats.bankerWins }}</span>
        </div>
      </div>
    </div>
    
    <div class="rules">
      <h3>📋 游戏规则</h3>
      <div class="rules-list">
        <div class="rule">• 闲家和庄家各发2-3张牌</div>
        <div class="rule">• 点数最接近9的一方获胜</div>
        <div class="rule">• 10、J、Q、K 算0点，A算1点</div>
        <div class="rule">• 超过10点只算个位数</div>
        <div class="rule">• 庄家赢抽水5%</div>
        <div class="rule">• 平局赔率8:1</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.baccarat-game {
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
  background: linear-gradient(135deg, #2c3e50, #34495e);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.score-area {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
  margin-bottom: 30px;
}

.score-box {
  background: rgba(0, 0, 0, 0.3);
  padding: 20px 40px;
  border-radius: 15px;
  min-width: 120px;
  transition: all 0.3s;
}

.score-box.winner {
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(241, 196, 15, 0.5);
}

.score-box.player {
  border: 2px solid #3498db;
}

.score-box.banker {
  border: 2px solid #e74c3c;
}

.score-box h3 {
  color: #ecf0f1;
  margin-bottom: 10px;
  font-size: 16px;
}

.score-box .score {
  color: #f1c40f;
  font-size: 48px;
  font-weight: bold;
}

.vs {
  color: #7f8c8d;
  font-size: 24px;
  font-weight: bold;
}

.cards-area {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.hand {
  display: flex;
  gap: 10px;
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

.result.tie {
  background: rgba(241, 196, 15, 0.2);
  color: #f1c40f;
  border: 2px solid #f1c40f;
}

.betting-area {
  margin-bottom: 30px;
}

.betting-area h3 {
  color: #ecf0f1;
  margin-bottom: 15px;
}

.bet-types {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 20px;
}

.bet-type {
  padding: 15px 25px;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.bet-type:hover {
  transform: scale(1.05);
}

.bet-type.active {
  transform: scale(1.1);
}

.bet-type.player {
  background: rgba(52, 152, 219, 0.2);
  color: #3498db;
}

.bet-type.player.active {
  border-color: #3498db;
  background: rgba(52, 152, 219, 0.4);
}

.bet-type.banker {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.bet-type.banker.active {
  border-color: #e74c3c;
  background: rgba(231, 76, 60, 0.4);
}

.bet-type.tie {
  background: rgba(241, 196, 15, 0.2);
  color: #f1c40f;
}

.bet-type.tie.active {
  border-color: #f1c40f;
  background: rgba(241, 196, 15, 0.4);
}

.bet-type .label {
  font-weight: bold;
  font-size: 16px;
}

.bet-type .payout {
  font-size: 12px;
  opacity: 0.8;
}

.bet-amounts {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
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
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.deal-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(46, 204, 113, 0.4);
}

.deal-btn:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
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
  text-align: left;
}

@media (max-width: 768px) {
  .score-area {
    flex-direction: column;
    gap: 15px;
  }
  
  .score-box {
    padding: 15px 30px;
  }
  
  .score-box .score {
    font-size: 36px;
  }
  
  .cards-area {
    flex-direction: column;
    gap: 20px;
  }
  
  .bet-types {
    flex-direction: column;
    align-items: center;
  }
  
  .bet-type {
    width: 100%;
    max-width: 200px;
  }
  
  .bet-amounts {
    flex-direction: column;
    align-items: center;
  }
  
  .bet-amounts button {
    width: 100%;
    max-width: 200px;
  }
}
</style>
