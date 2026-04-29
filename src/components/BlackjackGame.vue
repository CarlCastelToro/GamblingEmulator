<script setup lang="ts">
import { ref, computed } from 'vue'

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
}

const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const getCardValue = (rank: string): number => {
  if (rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank)
}

const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        value: getCardValue(rank),
        isHidden: false
      })
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
const playerHand = ref<Card[]>([])
const dealerHand = ref<Card[]>([])
const betAmount = ref(100)
const gameStatus = ref<'idle' | 'playing' | 'playerTurn' | 'dealerTurn' | 'ended'>('idle')
const gameResult = ref<{ type: string; message: string } | null>(null)
const canDouble = ref(false)
const canSplit = ref(false)

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

const playerHandValue = computed(() => getHandValue(playerHand.value))
const dealerHandValue = computed(() => getHandValue(dealerHand.value))
const dealerUpcard = computed(() => dealerHand.value[0] || null)

const isPlayerBust = computed(() => playerHandValue.value.value > 21)
const isDealerBust = computed(() => dealerHandValue.value.value > 21)

const drawCard = (): Card => {
  if (deck.value.length === 0) {
    deck.value = createDeck()
  }
  return deck.value.pop()!
}

const startGame = () => {
  if (props.gamblingScore < betAmount.value) {
    gameResult.value = { type: 'error', message: '击分不足！' }
    return
  }
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  
  playerHand.value = []
  dealerHand.value = []
  gameStatus.value = 'playing'
  gameResult.value = null
  
  playerHand.value.push(drawCard())
  playerHand.value.push(drawCard())
  dealerHand.value.push(drawCard())
  dealerHand.value.push(drawCard())
  if (dealerHand.value[1]) {
    dealerHand.value[1].isHidden = true
  }
  
  canDouble.value = playerHand.value.length === 2 && props.gamblingScore >= betAmount.value * 2
  canSplit.value = playerHand.value.length === 2 && 
                   !!playerHand.value[0] && !!playerHand.value[1] &&
                   playerHand.value[0].rank === playerHand.value[1].rank &&
                   props.gamblingScore >= betAmount.value * 2
  
  if (playerHandValue.value.value === 21) {
    checkBlackjack()
  } else {
    gameStatus.value = 'playerTurn'
  }
}

const checkBlackjack = () => {
  const dealerValue = getHandValue(dealerHand.value)
  if (playerHandValue.value.value === 21 && dealerValue.value === 21) {
    emit('update:gamblingScore', props.gamblingScore)
    gameResult.value = { type: 'draw', message: '🃏 双方黑杰克！平局，返还投入' }
  } else if (playerHandValue.value.value === 21) {
    const payout = Math.floor(betAmount.value * 1.5)
    emit('update:gamblingScore', props.gamblingScore + payout)
    gameResult.value = { type: 'success', message: `🃏 黑杰克！获得 ${payout} 击分！` }
  }
  gameStatus.value = 'ended'
}

const hit = () => {
  if (gameStatus.value !== 'playerTurn') return
  
  playerHand.value.push(drawCard())
  canDouble.value = false
  canSplit.value = false
  
  if (isPlayerBust.value) {
    gameResult.value = { type: 'fail', message: '💥 爆牌！你输了' }
    gameStatus.value = 'ended'
  } else if (playerHandValue.value.value === 21) {
    stand()
  }
}

const stand = () => {
  if (gameStatus.value !== 'playerTurn') return
  
  gameStatus.value = 'dealerTurn'
  if (dealerHand.value[1]) {
    dealerHand.value[1].isHidden = false
  }
  
  setTimeout(() => dealerTurn(), 500)
}

const dealerTurn = () => {
  const dealerValue = dealerHandValue.value.value
  
  if (dealerValue < 17) {
    dealerHand.value.push(drawCard())
    setTimeout(() => dealerTurn(), 500)
  } else {
    resolveGame()
  }
}

const resolveGame = () => {
  const playerValue = playerHandValue.value.value
  const dealerValue = dealerHandValue.value.value
  
  if (isPlayerBust.value) {
    gameResult.value = { type: 'fail', message: '💥 你爆牌了！' }
  } else if (isDealerBust.value) {
    const payout = betAmount.value * 2
    emit('update:gamblingScore', props.gamblingScore + payout)
    gameResult.value = { type: 'success', message: `🎉 庄家爆牌！获得 ${payout} 击分！` }
  } else if (playerValue > dealerValue) {
    const payout = betAmount.value * 2
    emit('update:gamblingScore', props.gamblingScore + payout)
    gameResult.value = { type: 'success', message: `🎉 恭喜！获得 ${payout} 击分！` }
  } else if (playerValue === dealerValue) {
    emit('update:gamblingScore', props.gamblingScore)
    gameResult.value = { type: 'draw', message: '🤝 平局！返还投入' }
  } else {
    gameResult.value = { type: 'fail', message: `😢 庄家获胜！庄家: ${dealerValue}, 你: ${playerValue}` }
  }
  
  gameStatus.value = 'ended'
}

const doubleDown = () => {
  if (!canDouble.value || gameStatus.value !== 'playerTurn') return
  
  emit('update:gamblingScore', props.gamblingScore - betAmount.value)
  betAmount.value *= 2
  
  playerHand.value.push(drawCard())
  canDouble.value = false
  canSplit.value = false
  
  if (isPlayerBust.value) {
    gameResult.value = { type: 'fail', message: '💥 爆牌！双倍投入输掉' }
    gameStatus.value = 'ended'
  } else {
    stand()
  }
}

const quickBet = (amount: number) => {
  betAmount.value = Math.min(props.gamblingScore, amount)
}
</script>

<template>
  <div class="blackjack-game">
    <h1 class="game-title">🂡 21点</h1>
    
    <div class="game-info">
      <div class="score-display">
        <span class="label">💰 击分:</span>
        <span class="value">{{ gamblingScore }}</span>
      </div>
      <div class="bet-display">
        <span class="label">投入:</span>
        <span class="value">{{ betAmount }}</span>
      </div>
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
          v-for="amount in [100, 500, 1000]" 
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
        <div class="hand-label">庄家</div>
        <div class="hand-cards">
          <div 
            v-for="(card, index) in dealerHand" 
            :key="'dealer-' + index"
            class="card"
            :class="{ hidden: card.isHidden }"
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
        </div>
      </div>

      <div class="player-area">
        <div class="hand-label">你</div>
        <div class="hand-cards">
          <div 
            v-for="(card, index) in playerHand" 
            :key="'player-' + index"
            class="card"
          >
            <span class="card-rank">{{ card.rank }}</span>
            <span class="card-suit" :class="card.suit === '♥' || card.suit === '♦' ? 'red' : ''">{{ card.suit }}</span>
          </div>
        </div>
        <div class="hand-value">
          点数: {{ playerHandValue.value }}
          <span v-if="playerHandValue.aces > 0" class="ace-hint">(含{{ playerHandValue.aces }}张A)</span>
        </div>
      </div>
    </div>

    <div v-if="gameResult" class="game-result" :class="gameResult.type">
      {{ gameResult.message }}
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
      
      <template v-else-if="gameStatus === 'playerTurn'">
        <button class="action-btn hit-btn" @click="hit">
          + 要牌
        </button>
        <button class="action-btn stand-btn" @click="stand">
          ✓ 停牌
        </button>
        <button 
          v-if="canDouble" 
          class="action-btn double-btn" 
          @click="doubleDown"
        >
          ⚡ 双倍
        </button>
      </template>
      
      <div v-else-if="gameStatus === 'dealerTurn'" class="waiting">
        庄家思考中...
      </div>
    </div>

    <div class="rules">
      <h3>游戏规则</h3>
      <ul>
        <li>• 目标：牌面点数接近21但不超过21</li>
        <li>• A可以算1或11</li>
        <li>• J/Q/K算10点</li>
        <li>• 黑杰克(首两张牌=21)赔率1:1.5</li>
        <li>• 普通赢牌赔率1:1</li>
        <li>• 庄家17点以下必须要牌</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.blackjack-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.game-title {
  color: #ffd700;
  font-size: 2rem;
  margin-bottom: 1.5rem;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.game-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.score-display, .bet-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}

.score-display .label, .bet-display .label {
  color: #888;
  font-size: 0.9rem;
}

.score-display .value, .bet-display .value {
  color: #ffd700;
  font-size: 1.3rem;
  font-weight: bold;
}

.bet-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
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
  border: 1px solid #444;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
  outline: none;
}

.bet-number:focus {
  border-color: #ffd700;
}

.quick-bets {
  display: flex;
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.4rem 0.8rem;
  background: #444;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}

.quick-btn:hover:not(:disabled) {
  background: #555;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.table {
  width: 100%;
  background: linear-gradient(135deg, #0d4f3c, #0a3d2e);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  margin-bottom: 1.5rem;
}

.dealer-area, .player-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
}

.dealer-area {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
}

.hand-label {
  color: #ffd700;
  font-size: 1rem;
  font-weight: bold;
}

.hand-cards {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.card {
  width: 55px;
  height: 75px;
  background: white;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-5px);
}

.card.hidden {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
}

.card-back {
  font-size: 2rem;
}

.card-rank {
  font-size: 1rem;
  font-weight: bold;
  color: #333;
}

.card-suit {
  font-size: 1.5rem;
  color: #333;
}

.card-suit.red {
  color: #dc3545;
}

.hand-value {
  color: #fff;
  font-size: 1rem;
}

.ace-hint {
  font-size: 0.75rem;
  color: #ffd700;
}

.game-result {
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  text-align: center;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  margin-bottom: 1.5rem;
}

.action-btn {
  padding: 0.7rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.start-btn {
  background: linear-gradient(135deg, #4CAF50, #2e7d32);
  color: white;
}

.start-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

.hit-btn {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
}

.hit-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(238, 90, 36, 0.4);
}

.stand-btn {
  background: linear-gradient(135deg, #42a5f5, #1e88e5);
  color: white;
}

.stand-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(66, 165, 245, 0.4);
}

.double-btn {
  background: linear-gradient(135deg, #ab47bc, #8e24aa);
  color: white;
}

.double-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(171, 71, 188, 0.4);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.waiting {
  padding: 0.7rem 1.5rem;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border-radius: 10px;
  font-size: 1rem;
}

.rules {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  width: 100%;
  max-width: 400px;
}

.rules h3 {
  color: #ffd700;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.rules ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rules li {
  color: #aaa;
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}
</style>