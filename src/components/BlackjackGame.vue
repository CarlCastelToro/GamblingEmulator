<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  gamblingScore: number
}>()

const emit = defineEmits<{
  (e: 'update:gamblingScore', value: number): void
}>()

interface Card {
  suit: string
  rank: string
  value: number
  isHidden: boolean
  uid: number
}

interface PlayerHand {
  cards: Card[]
  isActive: boolean
  bet: number
  hasDoubled: boolean
  hasStand: boolean
}

const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const DECKS_COUNT = 6
let cardUid = 0

const getCardValue = (rank: string): number => {
  if (rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank)
}

const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (let d = 0; d < DECKS_COUNT; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          suit,
          rank,
          value: getCardValue(rank),
          isHidden: false,
          uid: ++cardUid
        })
      }
    }
  }
  return shuffleDeck(deck)
}

const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck]
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = newDeck[i]!
    newDeck[i] = newDeck[j]!
    newDeck[j] = temp
  }
  return newDeck
}

const deck = ref<Card[]>(createDeck())
const playerHands = ref<PlayerHand[]>([])
const dealerHand = ref<Card[]>([])
const betAmount = ref(100)
const gameStatus = ref<'idle' | 'playing' | 'insurance' | 'playerTurn' | 'dealerTurn' | 'ended'>('idle')
const gameResult = ref<{ type: string; message: string } | null>(null)
const insuranceBet = ref(0)
const tookInsurance = ref(false)

const stats = ref({
  wins: 0,
  losses: 0,
  draws: 0,
  blackjacks: 0,
  totalBets: 0,
  totalWinnings: 0
})

const getHandValue = (hand: Card[]): { value: number; aces: number } => {
  let value = 0
  let aces = 0
  for (const card of hand) {
    if (!card.isHidden) {
      value += card.value
      if (card.rank === 'A') aces++
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }
  return { value, aces }
}

const dealerHandValue = computed(() => getHandValue(dealerHand.value))
const dealerUpcard = computed(() => dealerHand.value[0] || null)
const canBuyInsurance = computed(() => dealerUpcard.value?.rank === 'A' && !tookInsurance.value)

const getHandScore = (hand: Card[]) => getHandValue(hand).value

const activeHand = computed(() => playerHands.value.find(h => h.isActive))

const deckRemaining = computed(() => deck.value.length)
const deckPercentage = computed(() => (deck.value.length / (DECKS_COUNT * 52)) * 100)

const drawCard = (): Card => {
  if (deck.value.length === 0) {
    deck.value = createDeck()
  }
  return deck.value.pop()!
}

const resetGame = () => {
  playerHands.value = []
  dealerHand.value = []
  gameStatus.value = 'idle'
  gameResult.value = null
  insuranceBet.value = 0
  tookInsurance.value = false
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    gameResult.value = { type: 'error', message: '❌ 击分不足！' }
    return
  }

  stats.value.totalBets += betAmount.value
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)

  resetGame()
  gameStatus.value = 'playing'

  playerHands.value.push({
    cards: [drawCard(), drawCard()],
    isActive: true,
    bet: betAmount.value,
    hasDoubled: false,
    hasStand: false
  })

  dealerHand.value.push(drawCard())
  dealerHand.value.push(drawCard())
  if (dealerHand.value[1]) {
    dealerHand.value[1].isHidden = true
  }

  if (dealerUpcard.value?.rank === 'A') {
    gameStatus.value = 'insurance'
  } else if (playerHands.value[0] && getHandScore(playerHands.value[0].cards) === 21) {
    checkBlackjack()
  } else {
    gameStatus.value = 'playerTurn'
  }
}

const checkBlackjack = () => {
  if (!playerHands.value[0]) return
  const playerValue = getHandScore(playerHands.value[0].cards)
  const dealerValue = getHandValue(dealerHand.value).value

  if (playerValue === 21 && dealerValue === 21) {
    emit('update:gamblingScore', props.gamblingScore)
    stats.value.draws++
    gameResult.value = { type: 'draw', message: '🃏 双方黑杰克！平局，返还投入' }
  } else if (playerValue === 21) {
    stats.value.blackjacks++
    stats.value.wins++
    const payout = Math.floor(playerHands.value[0].bet * 1.5)
    stats.value.totalWinnings += payout
    emit('update:gamblingScore', props.gamblingScore + payout)
    gameResult.value = { type: 'success', message: `🃏 黑杰克！获得 ${payout} 击分！` }
  }
  gameStatus.value = 'ended'
}

const buyInsurance = () => {
  if (!playerHands.value[0]) return
  const maxInsurance = Math.floor(playerHands.value[0].bet / 2)
  if (props.gamblingScore < maxInsurance) {
    gameResult.value = { type: 'error', message: '❌ 击分不足购买保险！' }
    return
  }

  insuranceBet.value = maxInsurance
  tookInsurance.value = true
  emit('update:gamblingScore', props.gamblingScore - maxInsurance)

  if (getHandScore(dealerHand.value) === 21) {
    if (dealerHand.value[1]) dealerHand.value[1].isHidden = false
    stats.value.draws++
    emit('update:gamblingScore', props.gamblingScore + insuranceBet.value * 2)
    gameResult.value = { type: 'draw', message: `🛡️ 庄家黑杰克！保险赔付 ${insuranceBet.value * 2} 击分，返还投入` }
    gameStatus.value = 'ended'
  } else {
    gameStatus.value = 'playerTurn'
  }
}

const skipInsurance = () => {
  tookInsurance.value = true
  if (playerHands.value[0] && getHandScore(playerHands.value[0].cards) === 21) {
    checkBlackjack()
  } else {
    gameStatus.value = 'playerTurn'
  }
}

const canSplit = (hand: PlayerHand): boolean => {
  if (hand.cards.length !== 2) return false
  if (hand.hasDoubled) return false
  if (props.gamblingScore < hand.bet) return false
  if (!hand.cards[0] || !hand.cards[1]) return false
  return hand.cards[0].rank === hand.cards[1].rank
}

const canDouble = (hand: PlayerHand): boolean => {
  if (hand.cards.length !== 2) return false
  if (hand.hasDoubled) return false
  return props.gamblingScore >= hand.bet
}

const hit = () => {
  if (gameStatus.value !== 'playerTurn' || !activeHand.value) return

  const hand = activeHand.value
  hand.cards.push(drawCard())

  if (getHandScore(hand.cards) > 21) {
    hand.isActive = false
    checkNextHand()
  } else if (getHandScore(hand.cards) === 21) {
    hand.isActive = false
    checkNextHand()
  }
}

const stand = () => {
  if (gameStatus.value !== 'playerTurn' || !activeHand.value) return

  const hand = activeHand.value
  hand.isActive = false
  hand.hasStand = true
  checkNextHand()
}

const doubleDown = () => {
  if (gameStatus.value !== 'playerTurn' || !activeHand.value) return
  const hand = activeHand.value
  if (!canDouble(hand)) return

  emit('update:gamblingScore', props.gamblingScore - hand.bet)
  hand.bet *= 2
  hand.hasDoubled = true
  hand.cards.push(drawCard())
  hand.isActive = false
  hand.hasStand = true

  checkNextHand()
}

const split = () => {
  if (gameStatus.value !== 'playerTurn' || !activeHand.value) return
  const hand = activeHand.value
  if (!canSplit(hand)) return

  emit('update:gamblingScore', props.gamblingScore - hand.bet)

  const newHand: PlayerHand = {
    cards: [hand.cards.pop()!],
    isActive: true,
    bet: hand.bet,
    hasDoubled: false,
    hasStand: false
  }

  hand.cards.push(drawCard())
  hand.isActive = false
  hand.hasStand = false
  newHand.cards.push(drawCard())
  playerHands.value.push(newHand)
  
  checkNextHand()
}

const checkNextHand = () => {
  const activeHand = playerHands.value.find(h => h.isActive)
  if (activeHand) {
    return
  }

  const pendingHands = playerHands.value.filter(h => !h.isActive && !h.hasStand && h.cards.length > 0 && getHandScore(h.cards) <= 21)
  if (pendingHands.length > 0 && pendingHands[0]) {
    pendingHands[0].isActive = true
    return
  }

  gameStatus.value = 'dealerTurn'
  if (dealerHand.value[1]) {
    dealerHand.value[1].isHidden = false
  }
  setTimeout(() => dealerTurn(), 800)
}

const dealerTurn = () => {
  const dealerValue = dealerHandValue.value.value

  if (dealerValue < 17 || (dealerValue === 17 && hasSoft17())) {
    dealerHand.value.push(drawCard())
    setTimeout(() => dealerTurn(), 600)
  } else {
    resolveGame()
  }
}

const hasSoft17 = (): boolean => {
  let value = 0
  let aces = 0
  for (const card of dealerHand.value) {
    if (!card.isHidden) {
      value += card.value
      if (card.rank === 'A') aces++
    }
  }
  return value === 18 && aces >= 1
}

const resolveGame = () => {
  let totalPayout = 0
  let wins = 0
  let losses = 0
  let draws = 0

  const dealerValue = dealerHandValue.value.value
  const isDealerBust = dealerValue > 21

  for (const hand of playerHands.value) {
    const playerValue = getHandScore(hand.cards)
    const isPlayerBust = playerValue > 21

    if (isPlayerBust) {
      losses++
    } else if (isDealerBust) {
      wins++
      totalPayout += hand.bet * 2
    } else if (playerValue > dealerValue) {
      wins++
      totalPayout += hand.bet * 2
    } else if (playerValue === dealerValue) {
      draws++
      totalPayout += hand.bet
    } else {
      losses++
    }
  }

  if (wins > 0) {
    stats.value.wins += wins
    stats.value.totalWinnings += totalPayout
    emit('update:gamblingScore', props.gamblingScore + totalPayout)
  } else if (draws > 0) {
    stats.value.draws += draws
    emit('update:gamblingScore', props.gamblingScore + totalPayout)
  } else {
    stats.value.losses += losses
  }

  let message = ''
  if (wins === playerHands.value.length) {
    message = `🎉 全胜！获得 ${totalPayout} 击分！`
  } else if (losses === playerHands.value.length) {
    message = '😢 全败！'
  } else if (wins > 0 && losses > 0) {
    message = `⚔️ 胜负各半！获得 ${totalPayout} 击分！`
  } else {
    message = '🤝 平局！返还投入'
  }

  gameResult.value = {
    type: wins > 0 ? 'success' : (losses > 0 && wins === 0 ? 'fail' : 'draw'),
    message
  }
  gameStatus.value = 'ended'
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(props.gamblingScore, amount)
}

watch(() => props.gamblingScore, (newScore) => {
  betAmount.value = Math.min(betAmount.value, newScore)
})
</script>

<template>
  <div class="blackjack-game">
    <h1 class="game-title">🂡 21点</h1>
    
    <div class="game-header">
      <div class="game-info">
        <div class="score-display">
          <span class="label">💰 击分:</span>
          <span class="value">{{ Math.floor(gamblingScore) }}</span>
        </div>
        <div class="bet-display">
          <span class="label">投入:</span>
          <span class="value">{{ Math.floor(betAmount) }}</span>
        </div>
        <div class="deck-display">
          <span class="label">剩余牌数:</span>
          <span class="value">{{ deckRemaining }}</span>
        </div>
      </div>
      
      <div class="stats-panel">
        <div class="stat-item">
          <span class="stat-label">胜</span>
          <span class="stat-value win">{{ stats.wins }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">负</span>
          <span class="stat-value lose">{{ stats.losses }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平</span>
          <span class="stat-value draw">{{ stats.draws }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">黑杰克</span>
          <span class="stat-value bj">{{ stats.blackjacks }}</span>
        </div>
      </div>
    </div>

    <div class="deck-indicator">
      <div class="deck-bar">
        <div class="deck-fill" :style="{ width: deckPercentage + '%' }"></div>
      </div>
      <span class="deck-text">牌池深度: {{ deckPercentage.toFixed(1) }}%</span>
    </div>

    <div class="bet-section">
      <div class="bet-input">
        <label>投入击分:</label>
        <input 
          type="number" 
          v-model.number="betAmount" 
          :min="1"
          :max="gamblingScore"
          class="bet-number"
        />
      </div>
      <div class="quick-bets">
        <button 
          v-for="amount in [100, 500, 1000, 5000]" 
          :key="amount"
          class="quick-btn"
          :disabled="gamblingScore < amount"
          @click="quickBet(amount)"
        >
          {{ amount }}
        </button>
      </div>
    </div>

    <div class="table">
      <div class="dealer-area">
        <div class="hand-label">
          <span>🎰 庄家</span>
          <span v-if="gameStatus !== 'playing'" class="hand-value-badge">{{ dealerHandValue.value }}</span>
        </div>
        <div class="hand-cards">
          <div 
            v-for="(card, index) in dealerHand" 
            :key="'dealer-' + card.uid"
            class="card"
            :class="{ hidden: card.isHidden, reveal: gameStatus !== 'playing' && gameStatus !== 'insurance' && index === 1 }"
          >
            <span v-if="card.isHidden" class="card-back">🂠</span>
            <template v-else>
              <span class="card-rank">{{ card.rank }}</span>
              <span class="card-suit" :class="card.suit === '♥' || card.suit === '♦' ? 'red' : ''">{{ card.suit }}</span>
            </template>
          </div>
        </div>
        <div v-if="gameStatus !== 'playing'" class="hand-value">
          点数: {{ dealerHandValue.value }}
          <span v-if="hasSoft17()" class="soft-hint">(软17)</span>
        </div>
      </div>

      <div class="player-areas">
        <div 
          v-for="(hand, handIndex) in playerHands" 
          :key="'player-hand-' + handIndex"
          class="player-area"
          :class="{ active: hand.isActive }"
        >
          <div class="hand-label">
            <span>👤 手牌 {{ handIndex + 1 }}</span>
            <span class="hand-bet">投入: {{ hand.bet }}</span>
            <span v-if="hand.isActive" class="active-indicator">●</span>
          </div>
          <div class="hand-cards">
            <div 
              v-for="(card, index) in hand.cards" 
              :key="'player-' + card.uid"
              class="card"
              :class="{ 'doubled': hand.hasDoubled && index === hand.cards.length - 1 }"
            >
              <span class="card-rank">{{ card.rank }}</span>
              <span class="card-suit" :class="card.suit === '♥' || card.suit === '♦' ? 'red' : ''">{{ card.suit }}</span>
            </div>
          </div>
          <div class="hand-value">
            点数: {{ getHandScore(hand.cards) }}
            <span v-if="getHandValue(hand.cards).aces > 0" class="ace-hint">(含{{ getHandValue(hand.cards).aces }}张A)</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="gameStatus === 'insurance'" class="insurance-modal">
      <div class="insurance-content">
        <h3>🔒 庄家明牌是A！</h3>
        <p>购买保险？投入: {{ playerHands[0] ? Math.floor(playerHands[0].bet / 2) : 0 }} 击分</p>
        <p class="insurance-note">* 如果庄家是黑杰克，保险赔付2倍</p>
        <div class="insurance-actions">
          <button class="insurance-btn buy" @click="buyInsurance">购买保险</button>
          <button class="insurance-btn skip" @click="skipInsurance">跳过</button>
        </div>
      </div>
    </div>

    <div v-if="gameResult" class="game-result" :class="gameResult.type">
      <div class="result-icon">{{ gameResult.type === 'success' ? '🎉' : gameResult.type === 'fail' ? '😢' : '🤝' }}</div>
      <div class="result-message">{{ gameResult.message }}</div>
    </div>

    <div class="actions">
      <button 
        v-if="gameStatus === 'idle' || gameStatus === 'ended'"
        class="action-btn start-btn"
        :disabled="gamblingScore < betAmount"
        @click="startGame"
      >
        🎮 开始游戏
      </button>
      
      <template v-else-if="gameStatus === 'playerTurn' && activeHand">
        <button class="action-btn hit-btn" @click="hit">
          + 要牌
        </button>
        <button class="action-btn stand-btn" @click="stand">
          ✓ 停牌
        </button>
        <button 
          v-if="canDouble(activeHand)" 
          class="action-btn double-btn" 
          @click="doubleDown"
        >
          ⚡ 双倍
        </button>
        <button 
          v-if="canSplit(activeHand)" 
          class="action-btn split-btn" 
          @click="split"
        >
          🔀 分牌
        </button>
      </template>
      
      <div v-else-if="gameStatus === 'dealerTurn'" class="waiting">
        <span class="waiting-dots">庄家思考中</span>
      </div>
    </div>

    <div class="rules">
      <h3>📜 游戏规则</h3>
      <div class="rules-grid">
        <div class="rule-item">
          <span class="rule-icon">🎯</span>
          <span>目标：接近21点但不超过</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">🅰️</span>
          <span>A可算1或11点</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">👑</span>
          <span>J/Q/K算10点</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">🃏</span>
          <span>黑杰克赔率 3:2</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">⚡</span>
          <span>双倍下注后只能要一张牌</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">🔀</span>
          <span>相同牌可分牌，需额外投入</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">🛡️</span>
          <span>庄家A时可买保险，赔率2:1</span>
        </div>
        <div class="rule-item">
          <span class="rule-icon">🎰</span>
          <span>庄家软17点必须要牌</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blackjack-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  max-width: 700px;
  margin: 0 auto;
  gap: 1rem;
}

.game-title {
  color: #ffd700;
  font-size: 2.2rem;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
  animation: titleGlow 2s ease-in-out infinite;
}

@keyframes titleGlow {
  0%, 100% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
  50% { text-shadow: 0 0 40px rgba(255, 215, 0, 0.8); }
}

.game-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.game-info {
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
}

.score-display, .bet-display, .deck-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.score-display .label, .bet-display .label, .deck-display .label {
  color: #888;
  font-size: 0.85rem;
}

.score-display .value, .bet-display .value, .deck-display .value {
  color: #ffd700;
  font-size: 1.2rem;
  font-weight: bold;
}

.stats-panel {
  display: flex;
  gap: 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #888;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: bold;
}

.stat-value.win { color: #28a745; }
.stat-value.lose { color: #dc3545; }
.stat-value.draw { color: #ffc107; }
.stat-value.bj { color: #e91e63; }

.deck-indicator {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.deck-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.deck-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #ffd700, #dc3545);
  transition: width 0.3s ease;
}

.deck-text {
  font-size: 0.8rem;
  color: #888;
  white-space: nowrap;
}

.bet-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.bet-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bet-input label {
  color: #ccc;
  font-size: 0.95rem;
}

.bet-number {
  width: 120px;
  padding: 0.5rem;
  background: #333;
  color: #ffd700;
  border: 2px solid #444;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
  outline: none;
  transition: border-color 0.3s;
}

.bet-number:focus {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.quick-bets {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.4rem 1rem;
  background: linear-gradient(135deg, #444, #333);
  color: #fff;
  border: 1px solid #555;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #555, #444);
  transform: translateY(-2px);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table {
  width: 100%;
  background: linear-gradient(135deg, #0d4f3c, #0a3d2e);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.table::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%);
  pointer-events: none;
}

.dealer-area, .player-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  position: relative;
  z-index: 1;
}

.dealer-area {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px dashed rgba(255, 255, 255, 0.15);
}

.player-areas {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-area {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  transition: all 0.3s;
}

.player-area.active {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
}

.hand-label {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: #ffd700;
  font-size: 1rem;
  font-weight: bold;
}

.hand-bet {
  font-size: 0.8rem;
  color: #fff;
  background: rgba(255, 215, 0, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.active-indicator {
  color: #28a745;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hand-value-badge {
  font-size: 0.9rem;
  background: rgba(255, 215, 0, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.hand-cards {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.card {
  width: 60px;
  height: 85px;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: all 0.3s;
  position: relative;
}

.card:hover {
  transform: translateY(-8px) scale(1.05);
}

.card.hidden {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  animation: cardShimmer 2s linear infinite;
}

@keyframes cardShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.card.hidden.reveal {
  animation: cardFlip 0.5s ease-out forwards;
}

@keyframes cardFlip {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}

.card-back {
  font-size: 2.5rem;
  animation: spin 3s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.card.doubled::after {
  content: '⚡';
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 1rem;
  animation: bounce 0.5s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.card-rank {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
}

.card-suit {
  font-size: 1.8rem;
  color: #333;
}

.card-suit.red {
  color: #dc3545;
}

.hand-value {
  color: #fff;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.soft-hint {
  font-size: 0.7rem;
  color: #ffc107;
}

.ace-hint {
  font-size: 0.75rem;
  color: #ffd700;
}

.insurance-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.insurance-content {
  background: linear-gradient(135deg, #2d3748, #1a202c);
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  border: 2px solid #ffd700;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.insurance-content h3 {
  color: #ffd700;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.insurance-content p {
  color: #ccc;
  margin-bottom: 0.5rem;
}

.insurance-note {
  font-size: 0.8rem !important;
  color: #888 !important;
}

.insurance-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: center;
}

.insurance-btn {
  padding: 0.7rem 2rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.insurance-btn.buy {
  background: linear-gradient(135deg, #28a745, #1e7e34);
  color: white;
}

.insurance-btn.buy:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(40, 167, 69, 0.4);
}

.insurance-btn.skip {
  background: linear-gradient(135deg, #6c757d, #5a6268);
  color: white;
}

.insurance-btn.skip:hover {
  transform: scale(1.05);
}

.game-result {
  padding: 1rem 2rem;
  border-radius: 16px;
  font-size: 1.2rem;
  font-weight: bold;
  text-align: center;
  animation: resultAppear 0.5s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

@keyframes resultAppear {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.result-icon {
  font-size: 2.5rem;
  animation: bounceIn 0.5s ease-out;
}

@keyframes bounceIn {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.result-message {
  font-size: 1.1rem;
}

.game-result.success {
  background: linear-gradient(135deg, rgba(40, 167, 69, 0.3), rgba(40, 167, 69, 0.1));
  color: #28a745;
  border: 1px solid rgba(40, 167, 69, 0.5);
}

.game-result.fail {
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.3), rgba(220, 53, 69, 0.1));
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.5);
}

.game-result.draw {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 193, 7, 0.1));
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.5);
}

.game-result.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1));
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.actions {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  padding: 0.8rem 1.8rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 100px;
}

.start-btn {
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
}

.start-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 25px rgba(76, 175, 80, 0.5);
}

.hit-btn {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  box-shadow: 0 4px 15px rgba(238, 90, 36, 0.3);
}

.hit-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 25px rgba(238, 90, 36, 0.5);
}

.stand-btn {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: white;
  box-shadow: 0 4px 15px rgba(66, 165, 245, 0.3);
}

.stand-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 25px rgba(66, 165, 245, 0.5);
}

.double-btn {
  background: linear-gradient(135deg, #ab47bc, #8e24aa);
  color: white;
  box-shadow: 0 4px 15px rgba(171, 71, 188, 0.3);
}

.double-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 25px rgba(171, 71, 188, 0.5);
}

.split-btn {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
  box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
}

.split-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 25px rgba(255, 152, 0, 0.5);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.waiting {
  padding: 0.8rem 2rem;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: bold;
}

.waiting-dots::after {
  content: '';
  animation: dots 1.5s infinite;
}

@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60% { content: '...'; }
  80%, 100% { content: ''; }
}

.rules {
  padding: 1.2rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
}

.rules h3 {
  color: #ffd700;
  font-size: 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #aaa;
  font-size: 0.85rem;
}

.rule-icon {
  font-size: 1rem;
}

@media (max-width: 600px) {
  .blackjack-game {
    padding: 1rem;
  }
  
  .game-header {
    flex-direction: column;
    align-items: center;
  }
  
  .game-info {
    justify-content: center;
  }
  
  .rules-grid {
    grid-template-columns: 1fr;
  }
  
  .card {
    width: 50px;
    height: 70px;
    font-size: 1.1rem;
  }
  
  .actions {
    flex-direction: column;
    width: 100%;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>