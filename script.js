// ===== CONFIG =====
const API_URL = 'gdsiftsaswheeelsadsad-production.up.railway.app'

// ===== TELEGRAM INTEGRATION =====
const tg = window.Telegram?.WebApp

if (tg) {
  tg.ready()
  tg.expand()
  document.body.style.backgroundColor = tg.themeParams.bg_color || '#02051a'
  console.log('✅ Telegram Web App инициализирован')
  console.log('Telegram User:', tg.initDataUnsafe?.user)
}

const telegramUser = tg?.initDataUnsafe?.user
const TELEGRAM_ID = telegramUser ? telegramUser.id.toString() : '123456789'

console.log('🆔 Telegram ID:', TELEGRAM_ID)
console.log('👤 User Data:', telegramUser)

// ===== UI =====
const wheel = document.getElementById('wheel')
const spinButton = document.getElementById('spin-button')
const balanceValueSpan = document.getElementById('balance-value')
const balanceValueSpan2 = document.getElementById('balance-value-2')
const balanceValueSpan3 = document.getElementById('balance-value-3')
const lastPrizeSpan = document.getElementById('last-prize')

const promoInput = document.getElementById('promo-input')
const promoApplyBtn = document.getElementById('promo-apply')

const navButtons = document.querySelectorAll('.nav-btn')
const screens = {
  wheel: document.getElementById('screen-wheel'),
  crash: document.getElementById('screen-crash'),
  bonus: document.getElementById('screen-bonus'),
  profile: document.getElementById('screen-profile'),
}

const depositBtn = document.getElementById('deposit-btn')
const withdrawBtn = document.getElementById('withdraw-btn')

const prizeModal = document.getElementById('prize-modal')
const modalPrizeEmoji = document.getElementById('modal-prize-emoji')
const modalPrizeName = document.getElementById('modal-prize-name')
const modalPrizePrice = document.getElementById('modal-prize-price')
const modalSellBtn = document.getElementById('modal-sell')
const modalKeepBtn = document.getElementById('modal-keep')
const inventoryList = document.getElementById('inventory-list')

// deposit modal
const depositModal = document.getElementById('deposit-modal')
const depositAmountInput = document.getElementById('deposit-amount')
const depositConfirmBtn = document.getElementById('deposit-confirm-btn')
const depositCancelBtn = document.getElementById('deposit-cancel-btn')
const depositStatus = document.getElementById('deposit-status')

// ===== STATE =====
let currentRotation = 0
let balance = 5
let currentPrize = null
let inventory = []
let isSpinning = false
let userData = null
let sectorBaseAngles = null

const wheelSectors = [
  { emoji: '🧸', name: 'Мишка', price: 0.1 },
  { emoji: '🐸', name: 'Пепе', price: 0 },
  { emoji: '💋', name: 'Губы', price: 0 },
  { emoji: '📅', name: 'Календарь', price: 1.5 },
  { emoji: '🍀', name: 'Клевер', price: 0 },
  { emoji: '🍑', name: 'Слива', price: 0 },
  { emoji: '🧸', name: 'Мишка', price: 0.1 },
]

const SPIN_PRICE = 1
const FULL_ROUNDS = 5

// ===== API FUNCTIONS =====
async function fetchUserData() {
  try {
    const res = await fetch(`${API_URL}/me?telegramId=${TELEGRAM_ID}`)
    const data = await res.json()

    if (res.ok) {
      userData = data
      balance = data.balance
      inventory = data.inventory || []
      updateBalanceUI()
      renderInventory()
      return data
    } else {
      console.error('Failed to fetch user:', data)
      alert('Ошибка загрузки данных пользователя')
    }
  } catch (error) {
    console.error('Error fetching user:', error)
    alert('Ошибка подключения к серверу')
  }
}

async function spinWheel() {
  try {
    const res = await fetch(`${API_URL}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: TELEGRAM_ID }),
    })

    const data = await res.json()
    if (res.ok) return data

    alert(data.error || 'Ошибка при прокрутке')
    return null
  } catch (error) {
    console.error('Error spinning:', error)
    alert('Ошибка подключения к серверу')
    return null
  }
}

async function keepPrize(prize) {
  try {
    const res = await fetch(`${API_URL}/prize/keep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: TELEGRAM_ID, prize }),
    })

    if (res.ok) {
      await fetchUserData()
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка')
    }
  } catch (error) {
    console.error('Error keeping prize:', error)
    alert('Ошибка подключения к серверу')
  }
}

async function sellPrize(prize) {
  try {
    const res = await fetch(`${API_URL}/prize/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: TELEGRAM_ID, prize }),
    })

    const data = await res.json()
    if (res.ok) {
      balance = data.newBalance
      updateBalanceUI()
    } else {
      alert(data.error || 'Ошибка')
    }
  } catch (error) {
    console.error('Error selling prize:', error)
    alert('Ошибка подключения к серверу')
  }
}

// ===== UI HELPERS =====
function updateBalanceUI() {
  const rounded = Number(balance.toFixed(2))
  balanceValueSpan.textContent = rounded
  balanceValueSpan2.textContent = rounded
  balanceValueSpan3.textContent = rounded
}

function setLastPrizeText(prize) {
  lastPrizeSpan.textContent = prize ? `${prize.emoji} ${prize.name}` : '—'
}

function openModal(prize) {
  modalPrizeEmoji.textContent = prize.emoji
  modalPrizeName.textContent = prize.name
  modalPrizePrice.textContent = Number(prize.price || 0).toFixed(2)
  prizeModal.classList.add('active')
}

function closeModal() {
  prizeModal.classList.remove('active')
}

function renderWheel() {
  const sectorNodes = wheel.querySelectorAll('.sector')
  sectorNodes.forEach((node, i) => {
    const s = wheelSectors[i]
    node.textContent = s ? s.emoji : '❔'
    node.title = s ? `${s.name} (${s.price} TON)` : ''
  })
}

function renderInventory() {
  if (!inventoryList) return

  if (inventory.length === 0) {
    inventoryList.innerHTML = `
      <div class="inventory-empty">У вас пока нет подарков</div>
    `
    return
  }

  inventoryList.innerHTML = inventory
    .map((item, idx) => {
      const price = Number(item.price || 0).toFixed(2)
      return `
        <div class="inventory-item" data-idx="${idx}">
          <div class="inventory-item-top">
            <div class="inventory-item-emoji">${item.emoji}</div>
            <div class="inventory-item-price">${price} TON</div>
          </div>
          <div class="inventory-item-name">${item.name}</div>
          <div class="inventory-item-actions">
            <button class="inventory-btn inv-sell">Продать</button>
            <button class="inventory-btn inv-withdraw">Вывести</button>
          </div>
        </div>
      `
    })
    .join('')
}

function findSectorIndexForPrize(prize) {
  const matches = []
  for (let i = 0; i < wheelSectors.length; i++) {
    if (wheelSectors[i].name === prize.name) matches.push(i)
  }
  if (matches.length === 0) return 0
  return matches[Math.floor(Math.random() * matches.length)]
}

function computeSectorBaseAngles() {
  const prevTransition = wheel.style.transition
  const prevTransform = wheel.style.transform

  wheel.style.transition = 'none'
  wheel.style.transform = 'rotate(0deg)'
  wheel.offsetHeight

  const wheelRect = wheel.getBoundingClientRect()
  const cx = wheelRect.left + wheelRect.width / 2
  const cy = wheelRect.top + wheelRect.height / 2

  sectorBaseAngles = []
  const nodes = wheel.querySelectorAll('.sector')
  nodes.forEach((node, i) => {
    const r = node.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    let deg = Math.atan2(y - cy, x - cx) * (180 / Math.PI)
    deg = (deg + 360) % 360
    sectorBaseAngles[i] = deg
  })

  wheel.style.transform = prevTransform || 'rotate(0deg)'
  wheel.offsetHeight
  wheel.style.transition = prevTransition || ''
}

// ===== TELEGRAM UI UPDATE =====
function updateTelegramUserUI() {
  if (!telegramUser) return

  const userName = telegramUser.first_name || 'User'
  const userNameElements = document.querySelectorAll('.user-name, .profile-name')
  userNameElements.forEach(el => {
    el.textContent = userName
  })

  const userIdElement = document.querySelector('.profile-id')
  if (userIdElement) userIdElement.textContent = `ID: ${TELEGRAM_ID}`

  if (telegramUser.photo_url) {
    const avatars = document.querySelectorAll('.avatar, .profile-avatar')
    avatars.forEach(avatar => {
      avatar.style.backgroundImage = `url(${telegramUser.photo_url})`
      avatar.style.backgroundSize = 'cover'
      avatar.style.backgroundPosition = 'center'
    })
  }

  console.log('✅ UI обновлён с данными Telegram пользователя')
}

// ===== NAV =====
function setScreen(name) {
  Object.keys(screens).forEach(key => {
    screens[key].classList.toggle('active', key === name)
  })
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === name)
  })
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setScreen(btn.dataset.target)
    if (btn.dataset.target === 'crash') {
      setTimeout(() => {
        initCrashCanvas()
        drawCrashGraph()
      }, 50)
    }
  })
})

// ===== SPIN =====
spinButton.addEventListener('click', async e => {
  e.preventDefault()
  e.stopPropagation()

  if (isSpinning) return
  if (prizeModal.classList.contains('active')) return

  if (balance < SPIN_PRICE) {
    alert('Недостаточно TON для прокрутки (нужно 1 TON).')
    return
  }

  if (!sectorBaseAngles) computeSectorBaseAngles()

  isSpinning = true
  spinButton.disabled = true

  const prizeData = await spinWheel()
  if (!prizeData) {
    isSpinning = false
    spinButton.disabled = false
    return
  }

  currentPrize = prizeData.prize
  balance -= SPIN_PRICE
  updateBalanceUI()

  const sectorIndex = findSectorIndexForPrize(currentPrize)
  const desiredAngle = 270
  const current = ((currentRotation % 360) + 360) % 360
  const base = sectorBaseAngles[sectorIndex]
  const delta = (desiredAngle - (base + current) + 3600) % 360

  currentRotation += FULL_ROUNDS * 360 + delta
  wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
})

// ===== FINISH SPIN =====
wheel.addEventListener('transitionend', e => {
  if (e.propertyName !== 'transform') return
  if (!isSpinning) return

  currentRotation = ((currentRotation % 360) + 360) % 360

  wheel.style.transition = 'none'
  wheel.style.transform = `rotate(${currentRotation.toFixed(3)}deg)`
  wheel.offsetHeight
  wheel.style.transition = ''

  setLastPrizeText(currentPrize)
  openModal(currentPrize)

  isSpinning = false
})

// ===== MODAL ACTIONS =====
modalSellBtn.addEventListener('click', async () => {
  if (!currentPrize) return
  await sellPrize(currentPrize)
  currentPrize = null
  closeModal()
  spinButton.disabled = false
})

modalKeepBtn.addEventListener('click', async () => {
  if (!currentPrize) return
  await keepPrize(currentPrize)
  currentPrize = null
  closeModal()
  spinButton.disabled = false
})

// ===== INVENTORY BUTTONS =====
if (inventoryList) {
  inventoryList.addEventListener('click', e => {
    const card = e.target.closest('.inventory-item')
    if (!card) return
    const idx = Number(card.dataset.idx)
    const item = inventory[idx]
    if (!item) return

    if (e.target.classList.contains('inv-sell')) {
      alert('Функция продажи из инвентаря скоро будет добавлена')
    }
    if (e.target.classList.contains('inv-withdraw')) {
      alert('Функция вывода подарка скоро будет добавлена')
    }
  })
}

// ===== PROMO =====
promoApplyBtn.addEventListener('click', async () => {
  const code = promoInput.value.trim()
  if (!code) {
    alert('Введите промокод')
    return
  }

  try {
    const res = await fetch(`${API_URL}/promo/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: TELEGRAM_ID, code }),
    })

    const data = await res.json()
    if (res.ok) {
      balance = data.newBalance
      updateBalanceUI()
      promoInput.value = ''
      alert(`✅ Промокод применён! +${data.amount} TON`)
    } else {
      alert(data.error || 'Ошибка применения промокода')
    }
  } catch (error) {
    console.error('Error applying promo:', error)
    alert('Ошибка подключения к серверу')
  }
})

// ===== CRASH GAME =====
const crashCanvas = document.getElementById('crash-canvas')
const crashCtx = crashCanvas ? crashCanvas.getContext('2d') : null

const crashMultiplierEl = document.getElementById('crash-multiplier')
const crashStatusEl = document.getElementById('crash-status')
const crashBetInput = document.getElementById('crash-bet-input')
const crashPlayBtn = document.getElementById('crash-play-btn')
const crashCashoutBtn = document.getElementById('crash-cashout-btn')
const crashCurrentBetEl = document.getElementById('crash-current-bet')
const crashPotentialWinEl = document.getElementById('crash-potential-win')

let crashState = 'idle'
let crashMultiplier = 1.0
let crashPoint = null
let crashBetAmount = 0
let crashAnimFrame = null
let crashStartTime = null

function initCrashCanvas() {
  if (!crashCanvas) return
  const dpr = window.devicePixelRatio || 1
  const rect = crashCanvas.getBoundingClientRect()
  crashCanvas.width = rect.width * dpr
  crashCanvas.height = rect.height * dpr
  crashCtx.scale(dpr, dpr)
  crashCanvas.style.width = rect.width + 'px'
  crashCanvas.style.height = rect.height + 'px'
}

function generateCrashPoint() {
  const rand = Math.random() * 100
  if (rand < 99) return 1.01 + Math.random() * 0.4
  if (rand < 99.9) return 1.41 + Math.random() * 1.59
  return 3.0 + Math.random() * 7.0
}

function drawCrashGraph() {
  if (!crashCtx || !crashCanvas) return
  const rect = crashCanvas.getBoundingClientRect()
  const w = rect.width
  const h = rect.height

  crashCtx.clearRect(0, 0, w, h)

  const gradient = crashCtx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.05)')
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)')
  crashCtx.fillStyle = gradient
  crashCtx.fillRect(0, 0, w, h)

  crashCtx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
  crashCtx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const y = (h / 5) * i
    crashCtx.beginPath()
    crashCtx.moveTo(0, y)
    crashCtx.lineTo(w, y)
    crashCtx.stroke()
  }

  if (crashState === 'playing' || crashState === 'crashed') {
    const progress = Math.min(
      (crashMultiplier - 1) / Math.max((crashPoint || 10) - 1, 1),
      1
    )

    crashCtx.strokeStyle = crashState === 'crashed' ? '#ef4444' : '#38bdf8'
    crashCtx.lineWidth = 3
    crashCtx.beginPath()
    crashCtx.moveTo(0, h)

    for (let i = 0; i <= progress * 100; i++) {
      const x = (i / 100) * w
      const t = i / 100
      const mult = 1 + t * (crashMultiplier - 1)
      const y = h - (mult - 1) * (h / Math.max(crashPoint || 10, 2))
      if (i === 0) crashCtx.moveTo(x, y)
      else crashCtx.lineTo(x, y)
    }

    crashCtx.stroke()
    if (crashState === 'playing') {
      crashCtx.shadowBlur = 20
      crashCtx.shadowColor = '#38bdf8'
      crashCtx.stroke()
      crashCtx.shadowBlur = 0
    }
  }
}

function updateCrashMultiplier() {
  if (!crashMultiplierEl) return
  crashMultiplierEl.textContent = crashMultiplier.toFixed(2) + 'x'

  if (crashBetAmount > 0 && crashPotentialWinEl) {
    const potential = (crashBetAmount * crashMultiplier).toFixed(2)
    crashPotentialWinEl.textContent = potential + ' TON'
  }
}

function startCrash() {
  if (crashState !== 'idle') return

  crashBetAmount = parseFloat(crashBetInput.value)
  if (isNaN(crashBetAmount) || crashBetAmount < 0.1) {
    alert('Минимальная ставка: 0.1 TON')
    return
  }
  if (balance < crashBetAmount) {
    alert('Недостаточно TON для ставки.')
    return
  }

  balance -= crashBetAmount
  updateBalanceUI()

  crashPoint = generateCrashPoint()
  crashMultiplier = 1.0
  crashState = 'playing'
  crashStartTime = Date.now()

  crashStatusEl.textContent = 'Летим! 🚀'
  crashPlayBtn.disabled = true
  crashCashoutBtn.disabled = false
  crashMultiplierEl.classList.remove('crashed')
  crashCurrentBetEl.textContent = crashBetAmount.toFixed(2) + ' TON'

  animateCrash()
}

function animateCrash() {
  if (crashState !== 'playing') return

  const elapsed = (Date.now() - crashStartTime) / 1000
  crashMultiplier = 1 + elapsed * 0.2

  if (crashMultiplier >= crashPoint) {
    crashMultiplier = crashPoint
    endCrash(false)
    return
  }

  updateCrashMultiplier()
  drawCrashGraph()
  crashAnimFrame = requestAnimationFrame(animateCrash)
}

function cashoutCrash() {
  if (crashState !== 'playing') return
  const winAmount = crashBetAmount * crashMultiplier
  balance += winAmount
  updateBalanceUI()
  endCrash(true)
}

function endCrash(cashedOut) {
  crashState = 'crashed'
  if (crashAnimFrame) {
    cancelAnimationFrame(crashAnimFrame)
    crashAnimFrame = null
  }

  crashPlayBtn.disabled = false
  crashCashoutBtn.disabled = true

  if (cashedOut) {
    crashStatusEl.textContent = '✅ Выведено!'
    crashStatusEl.style.color = '#10b981'
  } else {
    crashStatusEl.textContent = '💥 Крах!'
    crashStatusEl.style.color = '#ef4444'
    crashMultiplierEl.classList.add('crashed')
  }

  updateCrashMultiplier()
  drawCrashGraph()

  setTimeout(() => {
    crashState = 'idle'
    crashMultiplier = 1.0
    crashBetAmount = 0
    crashPoint = null

    crashStatusEl.textContent = 'Ожидание...'
    crashStatusEl.style.color = '#94a3b8'
    crashMultiplierEl.textContent = '1.00x'
    crashMultiplierEl.classList.remove('crashed')
    crashCurrentBetEl.textContent = '—'
    crashPotentialWinEl.textContent = '—'
    drawCrashGraph()
  }, 2000)
}

if (crashPlayBtn) crashPlayBtn.addEventListener('click', startCrash)
if (crashCashoutBtn) crashCashoutBtn.addEventListener('click', cashoutCrash)

window.addEventListener('resize', () => {
  if (crashCanvas) {
    initCrashCanvas()
    drawCrashGraph()
  }
})

// ===== INIT =====
async function init() {
  updateTelegramUserUI()
  await fetchUserData()

  setLastPrizeText(null)
  renderWheel()
  renderInventory()
  setScreen('wheel')

  computeSectorBaseAngles()

  if (crashCanvas) {
    initCrashCanvas()
    drawCrashGraph()
  }

  console.log('✅ Приложение инициализировано')
}

window.addEventListener('resize', () => computeSectorBaseAngles())
init()

// =======================
// TON CONNECT + DEPOSIT UI (FIXED)
// =======================

let tonConnectUI = null

function toNano(ton) {
  const v = Number(ton)
  if (!Number.isFinite(v) || v <= 0) return null
  return String(Math.round(v * 1e9))
}


function setDepositStatus(text, type = '') {
  if (!depositStatus) return
  depositStatus.textContent = text || ''
  depositStatus.classList.remove('ok', 'err')
  if (type) depositStatus.classList.add(type)
}

function openDepositModal() {
  if (!depositModal) return
  depositModal.classList.remove('hidden')
  depositModal.classList.add('active')
  setDepositStatus('')
  setTimeout(() => depositAmountInput?.focus(), 50)
}

function closeDepositModal() {
  if (!depositModal) return
  depositModal.classList.remove('active')
  depositModal.classList.add('hidden')
  setDepositStatus('')
}

async function createDepositBackend() {
  const res = await fetch(`${API_URL}/ton/deposit/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: TELEGRAM_ID }),
  })

  const raw = await res.text()
  let data = null
  try {
    data = JSON.parse(raw)
  } catch (_) {}

  if (!res.ok) {
    throw new Error((data && data.error) ? data.error : (raw || 'Ошибка создания депозита'))
  }
  return data
}

async function checkDepositBackend(depositId) {
  const res = await fetch(`${API_URL}/ton/deposit/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositId }),
  })

  const raw = await res.text()
  let data = null
  try {
    data = JSON.parse(raw)
  } catch (_) {}

  if (!res.ok) throw new Error((data && data.error) ? data.error : (raw || 'Ошибка проверки депозита'))
  return data
}

async function pollDeposit(depositId, timeoutMs = 90000, intervalMs = 2500) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const r = await checkDepositBackend(depositId)
    if (r?.status === 'completed') return r
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error('Долго нет подтверждения. Проверь позже.')
}

async function initTONConnect() {
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://wheelsgifts1.netlify.app/tonconnect-manifest.json',
    buttonRootId: 'tonconnect-button',
  })
  tonConnectUI.uiOptions = { language: 'ru' }
}

async function handleDepositClick(e) {
  e?.preventDefault?.()

  if (!tg) {
    alert('Откройте мини-апп внутри Telegram.')
    return
  }

  if (!tonConnectUI) {
    alert('TonConnect ещё не инициализирован')
    return
  }

  if (!tonConnectUI.connected) {
    await tonConnectUI.openModal()
    if (!tonConnectUI.connected) return
  }

  openDepositModal()
}

depositCancelBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  closeDepositModal()
})

depositModal?.addEventListener('click', (e) => {
  if (e.target === depositModal) closeDepositModal()
})

depositConfirmBtn?.addEventListener('click', async (e) => {
  e.preventDefault()

  try {
    const amountTon = depositAmountInput?.value
    const amountNano = toNano(amountTon)
    if (!amountNano) {
      setDepositStatus('Введите корректную сумму TON', 'err')
      return
    }

    setDepositStatus('Создаём депозит...', '')
    const dep = await createDepositBackend()

    const address = dep.address
    const depositId = dep.depositId || dep.comment
    const payload = dep.payload

    if (!address || !depositId || !payload) {
      throw new Error('Backend не вернул address/depositId/payload')
    }

    setDepositStatus('Подтвердите транзакцию в кошельке...', '')
    await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [{ address, amount: amountNano, payload }],
    })

    setDepositStatus('Ждём подтверждение...', '')
    await pollDeposit(depositId)

    setDepositStatus('✅ Зачислено!', 'ok')
    await fetchUserData()
    setTimeout(closeDepositModal, 900)
  } catch (err) {
    setDepositStatus(String(err?.message || 'Ошибка депозита').slice(0, 200), 'err')
  }
})

depositBtn?.addEventListener('click', handleDepositClick)
withdrawBtn?.addEventListener('click', () => alert('Вывод будет добавлен на следующем этапе'))

document.addEventListener('DOMContentLoaded', () => {
  initTONConnect()
})


