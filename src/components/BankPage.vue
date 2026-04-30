<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  gamblingScore: number
  loanAmount: number
  depositAmount: number
  maxLoan: number
}>()

const emit = defineEmits<{
  (e: 'update:gambling-score', value: number): void
  (e: 'loan', amount: number): void
  (e: 'deposit', amount: number): void
  (e: 'withdraw', amount: number): void
  (e: 'repay', amount: number): void
}>()

// 输入金额
const loanInput = ref('')
const depositInput = ref('')
const withdrawInput = ref('')
const repayInput = ref('')

// 消息提示
const message = ref('')
const messageType = ref<'success' | 'error' | 'info'>('info')

// 计算属性
const canLoan = computed(() => props.loanAmount < props.maxLoan)
const canWithdraw = computed(() => props.depositAmount > 0)
const canRepay = computed(() => props.loanAmount > 0 && props.gamblingScore > 0)

// 显示消息
const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

// 贷款
const takeLoan = () => {
  const amount = parseInt(loanInput.value) || 0
  
  if (amount <= 0) {
    showMessage('请输入有效的贷款金额', 'error')
    return
  }
  
  const availableLoan = props.maxLoan - props.loanAmount
  if (amount > availableLoan) {
    showMessage(`最大可贷款金额: ${availableLoan}`, 'error')
    return
  }
  
  emit('loan', amount)
  loanInput.value = ''
  showMessage(`成功贷款 ${amount} 击分！`, 'success')
}

// 存款
const makeDeposit = () => {
  const amount = parseInt(depositInput.value) || 0
  
  if (amount <= 0) {
    showMessage('请输入有效的存款金额', 'error')
    return
  }
  
  if (amount > props.gamblingScore) {
    showMessage('余额不足！', 'error')
    return
  }
  
  emit('deposit', amount)
  depositInput.value = ''
  showMessage(`成功存款 ${amount} 击分！`, 'success')
}

// 取款
const withdrawDeposit = () => {
  const amount = parseInt(withdrawInput.value) || 0
  
  if (amount <= 0) {
    showMessage('请输入有效的取款金额', 'error')
    return
  }
  
  if (amount > props.depositAmount) {
    showMessage(`存款余额不足！当前存款: ${props.depositAmount}`, 'error')
    return
  }
  
  emit('withdraw', amount)
  withdrawInput.value = ''
  showMessage(`成功取款 ${amount} 击分！`, 'success')
}

// 还款
const repayLoan = () => {
  const amount = parseInt(repayInput.value) || 0
  
  if (amount <= 0) {
    showMessage('请输入有效的还款金额', 'error')
    return
  }
  
  if (amount > props.gamblingScore) {
    showMessage(`余额不足！当前余额: ${props.gamblingScore}`, 'error')
    return
  }
  
  const actualRepay = Math.min(amount, props.loanAmount)
  emit('repay', actualRepay)
  repayInput.value = ''
  
  if (actualRepay === props.loanAmount) {
    showMessage(`🎉 恭喜！已全额还清贷款！`, 'success')
  } else {
    showMessage(`成功还款 ${actualRepay} 击分！剩余欠款: ${props.loanAmount - actualRepay}`, 'success')
  }
}
</script>

<template>
  <div class="bank-container">
    <div class="bank-header">
      <h1 class="bank-title">🏦 博彩银行</h1>
      <p class="bank-subtitle">管理您的资产，实现财富增长！</p>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" :class="['message', `message-${messageType}`]">
      {{ message }}
    </div>

    <!-- 资产概览 -->
    <div class="overview-section">
      <h2 class="section-title">💰 资产概览</h2>
      <div class="overview-grid">
        <div class="overview-card balance-card">
          <span class="card-icon">💎</span>
          <div class="card-content">
            <span class="card-label">当前余额</span>
            <span class="card-value">{{ gamblingScore.toLocaleString() }}</span>
          </div>
        </div>
        <div class="overview-card loan-card">
          <span class="card-icon">💸</span>
          <div class="card-content">
            <span class="card-label">贷款金额</span>
            <span class="card-value loan-value">{{ loanAmount.toLocaleString() }}</span>
          </div>
        </div>
        <div class="overview-card deposit-card">
          <span class="card-icon">📊</span>
          <div class="card-content">
            <span class="card-label">存款金额</span>
            <span class="card-value deposit-value">{{ depositAmount.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 贷款业务 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">🏠 贷款业务</h2>
        <span class="section-badge">最高 {{ maxLoan.toLocaleString() }} 击分</span>
      </div>
      <div class="loan-content">
        <div class="info-box">
          <p class="info-text"><strong>利息:</strong> 每秒增加 0.01%</p>
          <p class="info-text"><strong>还款:</strong> 获得击分时自动扣除10%</p>
          <p class="info-text"><strong>当前欠款:</strong> {{ loanAmount.toLocaleString() }} 击分</p>
          <p class="info-text"><strong>可贷款:</strong> {{ (maxLoan - loanAmount).toLocaleString() }} 击分</p>
        </div>
        <div class="input-group">
          <input
            v-model="loanInput"
            type="number"
            placeholder="输入贷款金额"
            class="input-field"
            :disabled="!canLoan"
          />
          <button 
            @click="takeLoan" 
            class="action-btn loan-btn"
            :disabled="!canLoan"
          >
            申请贷款
          </button>
        </div>
        <div class="repay-section" v-if="loanAmount > 0">
          <div class="input-group">
            <input
              v-model="repayInput"
              type="number"
              placeholder="输入还款金额"
              class="input-field"
              :disabled="!canRepay"
            />
            <button 
              @click="repayLoan" 
              class="action-btn repay-btn"
              :disabled="!canRepay"
            >
              还款
            </button>
          </div>
          <div class="quick-buttons">
            <button 
              @click="repayInput = Math.min(props.gamblingScore, props.loanAmount).toString(); repayLoan()" 
              class="quick-btn"
              :disabled="!canRepay"
            >
              全额还款
            </button>
            <button 
              @click="repayInput = Math.min(props.gamblingScore, Math.floor(props.loanAmount / 2)).toString(); repayLoan()" 
              class="quick-btn"
              :disabled="!canRepay"
            >
              还一半
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 存款业务 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">💵 存款业务</h2>
        <span class="section-badge">不限额度</span>
      </div>
      <div class="deposit-content">
        <div class="info-box">
          <p class="info-text"><strong>利息:</strong> 每秒增加 0.001%</p>
          <p class="info-text"><strong>当前存款:</strong> {{ depositAmount.toLocaleString() }} 击分</p>
        </div>
        
        <div class="deposit-actions">
          <div class="input-group">
            <input
              v-model="depositInput"
              type="number"
              placeholder="输入存款金额"
              class="input-field"
            />
            <button 
              @click="makeDeposit" 
              class="action-btn deposit-btn"
              :disabled="gamblingScore <= 0"
            >
              存入
            </button>
          </div>
          
          <div class="input-group">
            <input
              v-model="withdrawInput"
              type="number"
              placeholder="输入取款金额"
              class="input-field"
              :disabled="!canWithdraw"
            />
            <button 
              @click="withdrawDeposit" 
              class="action-btn withdraw-btn"
              :disabled="!canWithdraw"
            >
              取出
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 利率说明 -->
    <div class="section info-section">
      <h2 class="section-title">📋 利率说明</h2>
      <div class="rate-info">
        <div class="rate-item">
          <span class="rate-icon">💸</span>
          <div class="rate-content">
            <span class="rate-title">贷款利率</span>
            <span class="rate-value">0.01%/秒</span>
            <span class="rate-desc">贷款金额将随时间产生利息</span>
          </div>
        </div>
        <div class="rate-item">
          <span class="rate-icon">📈</span>
          <div class="rate-content">
            <span class="rate-title">存款利率</span>
            <span class="rate-value">0.001%/秒</span>
            <span class="rate-desc">存款金额将随时间增值</span>
          </div>
        </div>
        <div class="rate-item">
          <span class="rate-icon">🔄</span>
          <div class="rate-content">
            <span class="rate-title">自动还款</span>
            <span class="rate-value">10%</span>
            <span class="rate-desc">获得击分时自动扣除10%用于还款</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bank-container {
  min-height: 100vh;
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.bank-header {
  text-align: center;
  margin-bottom: 2rem;
}

.bank-title {
  font-size: 2rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
  margin-bottom: 0.5rem;
}

.bank-subtitle {
  color: #888;
  font-size: 1rem;
}

/* 消息提示 */
.message {
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  text-align: center;
  font-weight: bold;
  animation: fadeIn 0.3s ease;
}

.message-success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.message-error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.message-info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 资产概览 */
.overview-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 1rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
}

.overview-card {
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.9), rgba(26, 26, 40, 0.9));
  border-radius: 16px;
  padding: 1rem;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.balance-card {
  border-color: rgba(59, 130, 246, 0.3);
}

.loan-card {
  border-color: rgba(239, 68, 68, 0.3);
}

.deposit-card {
  border-color: rgba(34, 197, 94, 0.3);
}

.card-icon {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.card-label {
  display: block;
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 0.3rem;
}

.card-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #fff;
}

.loan-value {
  color: #ef4444;
}

.deposit-value {
  color: #22c55e;
}

/* 业务区块 */
.section {
  background: linear-gradient(145deg, rgba(37, 37, 56, 0.9), rgba(26, 26, 40, 0.9));
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-badge {
  padding: 0.3rem 0.8rem;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border-radius: 20px;
  font-size: 0.8rem;
}

.info-box {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-text {
  margin: 0.5rem 0;
  color: #ccc;
  font-size: 0.9rem;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.input-field {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s;
}

.input-field:focus {
  border-color: #ffd700;
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn {
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.loan-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}

.loan-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(239, 68, 68, 0.4);
}

.deposit-btn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
}

.deposit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(34, 197, 94, 0.4);
}

.withdraw-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}

.withdraw-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(59, 130, 246, 0.4);
}

.repay-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
}

.repay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(245, 158, 11, 0.4);
}

.repay-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.quick-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.quick-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.8);
  color: #333;
}

.quick-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.1);
  border-color: #f59e0b;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deposit-actions {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

/* 利率说明 */
.info-section {
  background: rgba(37, 37, 56, 0.5);
}

.rate-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rate-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.rate-icon {
  font-size: 1.5rem;
}

.rate-content {
  flex: 1;
}

.rate-title {
  display: block;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.2rem;
}

.rate-value {
  display: block;
  font-size: 1.1rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 0.2rem;
}

.rate-desc {
  font-size: 0.85rem;
  color: #888;
}

/* 响应式 */
@media (max-width: 480px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  
  .input-group {
    flex-direction: column;
  }
  
  .action-btn {
    padding: 0.8rem;
  }
}
</style>