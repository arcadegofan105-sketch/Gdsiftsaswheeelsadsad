import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pkg from '@prisma/client'
import TelegramBot from 'node-telegram-bot-api'
import TONService from './ton-service.js'

const { PrismaClient } = pkg

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// ===== TELEGRAM BOT =====
const BOT_TOKEN =
	process.env.BOT_TOKEN || '8204738952:AAE5tWIrypF630TPMDugC4_68Wgog3aurlI'
const WEB_APP_URL =
  process.env.WEB_APP_URL || 'https://wheelsgifts1.netlify.app/'
const bot = new TelegramBot(BOT_TOKEN, { polling: true })

console.log('✅ Telegram Bot запущен!')

// Обработчик команды /start
bot.onText(/\/start/, async msg => {
	const chatId = msg.chat.id
	const userId = msg.from.id
	const firstName = msg.from.first_name || 'User'

	console.log(`📩 Команда /start от пользователя ${userId} (${firstName})`)

	// Создать или обновить пользователя в БД
	try {
		let user = await prisma.user.findUnique({
			where: { telegramId: String(userId) },
		})

		if (!user) {
			user = await prisma.user.create({
				data: {
					telegramId: String(userId),
					username: msg.from.username || `User_${userId}`,
					balance: 5.0,
				},
			})
			console.log(`✅ Создан новый пользователь: ${userId}`)
		}
	} catch (error) {
		console.error('Ошибка при создании пользователя:', error)
	}

	// Отправить приветственное сообщение с кнопкой запуска Mini App
	const welcomeMessage = `🎰 Добро пожаловать в Gifts Wheel, ${firstName}!

🎁 Крути колесо фортуны и выигрывай призы!
🚀 Играй в краш-игру и умножай свой баланс!
💰 Получи 5 TON при старте!

Нажми кнопку ниже, чтобы начать игру! 👇`

	bot.sendMessage(chatId, welcomeMessage, {
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: '🎮 Играть',
						web_app: { url: WEB_APP_URL },
					},
				],
				[
					{
						text: '💎 Мой профиль',
						callback_data: 'profile',
					},
					{
						text: '📊 Статистика',
						callback_data: 'stats',
					},
				],
			],
		},
	})
})

// Обработчик команды /balance
bot.onText(/\/balance/, async msg => {
	const chatId = msg.chat.id
	const userId = msg.from.id

	try {
		const user = await prisma.user.findUnique({
			where: { telegramId: String(userId) },
		})

		if (!user) {
			return bot.sendMessage(
				chatId,
				'❌ Пользователь не найден. Используйте /start'
			)
		}

		bot.sendMessage(chatId, `💰 Ваш баланс: ${user.balance.toFixed(2)} TON`)
	} catch (error) {
		console.error('Ошибка при получении баланса:', error)
		bot.sendMessage(chatId, '❌ Произошла ошибка при получении баланса')
	}
})

// Обработчик callback-кнопок
bot.on('callback_query', async query => {
	const chatId = query.message.chat.id
	const userId = query.from.id
	const data = query.data

	if (data === 'profile') {
		try {
			const user = await prisma.user.findUnique({
				where: { telegramId: String(userId) },
				include: {
					inventory: true,
				},
			})

			if (!user) {
				return bot.answerCallbackQuery(query.id, {
					text: '❌ Пользователь не найден',
				})
			}

			const profileMessage = `👤 Ваш профиль:

🆔 ID: ${user.telegramId}
👤 Username: ${user.username}
💰 Баланс: ${user.balance.toFixed(2)} TON
🎁 Подарков в инвентаре: ${user.inventory.length}`

			bot.sendMessage(chatId, profileMessage)
			bot.answerCallbackQuery(query.id)
		} catch (error) {
			console.error('Ошибка при получении профиля:', error)
			bot.answerCallbackQuery(query.id, {
				text: '❌ Произошла ошибка',
			})
		}
	}

	if (data === 'stats') {
		try {
			const user = await prisma.user.findUnique({
				where: { telegramId: String(userId) },
			})

			if (!user) {
				return bot.answerCallbackQuery(query.id, {
					text: '❌ Пользователь не найден',
				})
			}

			const games = await prisma.game.findMany({
				where: { userId: user.id },
			})

			const totalGames = games.length
			const wheelGames = games.filter(g => g.type === 'wheel').length
			const crashGames = games.filter(g => g.type === 'crash').length

			const statsMessage = `📊 Ваша статистика:

🎮 Всего игр: ${totalGames}
🎰 Игр в колесо: ${wheelGames}
🚀 Игр в краш: ${crashGames}`

			bot.sendMessage(chatId, statsMessage)
			bot.answerCallbackQuery(query.id)
		} catch (error) {
			console.error('Ошибка при получении статистики:', error)
			bot.answerCallbackQuery(query.id, {
				text: '❌ Произошла ошибка',
			})
		}
	}
})

// Обработчик всех остальных сообщений
bot.on('message', msg => {
	if (msg.text && !msg.text.startsWith('/')) {
		bot.sendMessage(msg.chat.id, '👋 Используйте /start для запуска игры!')
	}
})

// Middleware
app.use(cors())
app.use(express.json())

// ===== ROUTES =====

// Проверка сервера
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', message: 'Backend is running' })
})

// Получить профиль пользователя
app.get('/api/me', async (req, res) => {
	try {
		const { telegramId } = req.query

		if (!telegramId) {
			return res.status(400).json({ error: 'telegramId required' })
		}

		// Найти или создать пользователя
		let user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
			include: {
				inventory: true,
			},
		})

		if (!user) {
			user = await prisma.user.create({
				data: {
					telegramId: String(telegramId),
					username: 'User_' + telegramId,
					balance: 5.0,
				},
				include: {
					inventory: true,
				},
			})
		}

		res.json(user)
	} catch (error) {
		console.error('Error fetching user:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// Крутить колесо
app.post('/api/spin', async (req, res) => {
	try {
		const { telegramId } = req.body

		if (!telegramId) {
			return res.status(400).json({ error: 'telegramId required' })
		}

		const user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
		})

		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		if (user.balance < 1) {
			return res.status(400).json({ error: 'Insufficient balance' })
		}

		// Логика выбора приза
		const prizes = [
			{ emoji: '🧸', name: 'Мишка', price: 0.1, chance: 99.9 },
			{ emoji: '🐸', name: 'Пепе', price: 0, chance: 0 },
			{ emoji: '💋', name: 'Губы', price: 0, chance: 0 },
			{ emoji: '📅', name: 'Календарь', price: 1.5, chance: 0.1 },
			{ emoji: '🍀', name: 'Клевер', price: 0, chance: 0 },
			{ emoji: '🍑', name: 'Слива', price: 0, chance: 0 },
		]

		const rand = Math.random() * 100
		let cumulative = 0
		let prize = prizes[0]

		for (let i = 0; i < prizes.length; i++) {
			cumulative += prizes[i].chance
			if (rand < cumulative) {
				prize = prizes[i]
				break
			}
		}

		// Обновить баланс
		await prisma.user.update({
			where: { id: user.id },
			data: { balance: user.balance - 1 },
		})

		// Записать игру
		await prisma.game.create({
			data: {
				userId: user.id,
				type: 'wheel',
				bet: 1.0,
				result: 0,
				prize: JSON.stringify(prize),
			},
		})

		// Транзакция
		await prisma.transaction.create({
			data: {
				userId: user.id,
				type: 'spin',
				amount: -1.0,
				description: 'Spin wheel',
			},
		})

		res.json({ prize, newBalance: user.balance - 1 })
	} catch (error) {
		console.error('Error spinning:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// Оставить приз
app.post('/api/prize/keep', async (req, res) => {
	try {
		const { telegramId, prize } = req.body

		const user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
		})

		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		await prisma.inventoryItem.create({
			data: {
				userId: user.id,
				name: prize.name,
				emoji: prize.emoji,
				price: prize.price,
			},
		})

		res.json({ success: true })
	} catch (error) {
		console.error('Error keeping prize:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// Продать приз
app.post('/api/prize/sell', async (req, res) => {
	try {
		const { telegramId, prize } = req.body

		const user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
		})

		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		await prisma.user.update({
			where: { id: user.id },
			data: { balance: user.balance + prize.price },
		})

		await prisma.transaction.create({
			data: {
				userId: user.id,
				type: 'prize_sell',
				amount: prize.price,
				description: `Sold ${prize.name}`,
			},
		})

		res.json({ success: true, newBalance: user.balance + prize.price })
	} catch (error) {
		console.error('Error selling prize:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// Применить промокод
app.post('/api/promo/apply', async (req, res) => {
	try {
		const { telegramId, code } = req.body

		const user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
		})

		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		// Промокоды
		const promoCodes = {
			FREEEFORADMIN: 100,
			GIFT1: 1,
			GIFT5: 5,
			BONUS: 2,
		}

		const upperCode = code.toUpperCase()

		if (!promoCodes[upperCode]) {
			return res.status(400).json({ error: 'Неверный промокод' })
		}

		// Проверка, использовал ли уже
		const existing = await prisma.promoRedemption.findUnique({
			where: {
				userId_code: {
					userId: user.id,
					code: upperCode,
				},
			},
		})

		if (existing) {
			return res.status(400).json({ error: 'Промокод уже использован' })
		}

		// Начислить бонус
		const amount = promoCodes[upperCode]
		await prisma.user.update({
			where: { id: user.id },
			data: { balance: user.balance + amount },
		})

		// Записать использование
		await prisma.promoRedemption.create({
			data: {
				userId: user.id,
				code: upperCode,
				amount: amount,
			},
		})

		// Транзакция
		await prisma.transaction.create({
			data: {
				userId: user.id,
				type: 'promo',
				amount: amount,
				description: `Promo code: ${upperCode}`,
			},
		})

		res.json({ success: true, amount, newBalance: user.balance + amount })
	} catch (error) {
		console.error('Error applying promo:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// Краш: начать игру
app.post('/api/crash/play', async (req, res) => {
	try {
		const { telegramId, bet, crashPoint, cashoutMultiplier, cashedOut } =
			req.body

		const user = await prisma.user.findUnique({
			where: { telegramId: String(telegramId) },
		})

		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		const result = cashedOut ? bet * cashoutMultiplier : 0
		const profit = result - bet

		// Обновить баланс (вернуть выигрыш)
		await prisma.user.update({
			where: { id: user.id },
			data: { balance: user.balance + result },
		})

		// Записать игру
		await prisma.game.create({
			data: {
				userId: user.id,
				type: 'crash',
				bet: bet,
				result: result,
				multiplier: cashedOut ? cashoutMultiplier : crashPoint,
			},
		})

		// Транзакция
		await prisma.transaction.create({
			data: {
				userId: user.id,
				type: cashedOut ? 'crash_win' : 'crash_bet',
				amount: profit,
				description: cashedOut
					? `Crash win: ${cashoutMultiplier.toFixed(2)}x`
					: `Crash lost at ${crashPoint.toFixed(2)}x`,
			},
		})

		res.json({ success: true, newBalance: user.balance + result, profit })
	} catch (error) {
		console.error('Error crash play:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ===== TON INTEGRATION =====
const tonService = new TONService(false) // false = mainnet, true = testnet
const DEPOSIT_ADDRESS = process.env.TON_DEPOSIT_ADDRESS || 'UQDpJqh-vGhIU88H19N67J_xVkW3P1Zdx3FkMuJXKX5C9Tld'

// Получить баланс TON кошелька
app.get('/api/ton/balance/:address', async (req, res) => {
  try {
    const { address } = req.params
    
    if (!tonService.validateAddress(address)) {
      return res.status(400).json({ error: 'Неверный адрес кошелька' })
    }

    const balance = await tonService.getBalance(address)
    const balanceInTON = tonService.fromNano(balance)

    res.json({ balance: balanceInTON, address })
  } catch (error) {
    console.error('Error getting TON balance:', error)
    res.status(500).json({ error: 'Ошибка получения баланса' })
  }
})

// Создать депозит (получить адрес для пополнения)
app.post('/api/ton/deposit/create', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId обязателен' })
    }

    // Генерируем уникальный комментарий для идентификации платежа
    const depositId = `deposit_${userId}_${Date.now()}`

    // Сохраняем в БД
    await prisma.deposit.create({
      data: {
        userId: userId.toString(),
        depositId,
        address: DEPOSIT_ADDRESS,
        status: 'pending',
        amount: 0
      }
    })

    res.json({
      address: DEPOSIT_ADDRESS,
      comment: depositId,
      message: 'Отправьте TON на этот адрес с указанным комментарием'
    })
  } catch (error) {
    console.error('Error creating deposit:', error)
    res.status(500).json({ error: 'Ошибка создания депозита' })
  }
})

// Проверить статус депозита
app.post('/api/ton/deposit/check', async (req, res) => {
  try {
    const { depositId } = req.body

    if (!depositId) {
      return res.status(400).json({ error: 'depositId обязателен' })
    }

    const deposit = await prisma.deposit.findFirst({
      where: { depositId }
    })

    if (!deposit) {
      return res.status(404).json({ error: 'Депозит не найден' })
    }

    if (deposit.status === 'completed') {
      return res.json({ status: 'completed', amount: deposit.amount })
    }

    // Проверяем транзакции
    const tx = await tonService.checkTransaction(
      DEPOSIT_ADDRESS,
      0, // любая сумма
      depositId
    )

    if (tx.found) {
      const amountInTON = tonService.fromNano(tx.value)

      // Обновляем депозит
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'completed',
          amount: amountInTON,
          txHash: tx.hash
        }
      })

      // Добавляем баланс пользователю
      await prisma.user.update({
        where: { id: parseInt(deposit.userId) },
        data: {
          balance: {
            increment: amountInTON
          }
        }
      })

      return res.json({ status: 'completed', amount: amountInTON })
    }

    res.json({ status: 'pending' })
  } catch (error) {
    console.error('Error checking deposit:', error)
    res.status(500).json({ error: 'Ошибка проверки депозита' })
  }
})

// Вывод средств
app.post('/api/ton/withdraw', async (req, res) => {
  try {
    const { userId, address, amount } = req.body

    if (!userId || !address || !amount) {
      return res.status(400).json({ error: 'Все поля обязательны' })
    }

    if (!tonService.validateAddress(address)) {
      return res.status(400).json({ error: 'Неверный адрес кошелька' })
    }

    // Проверяем баланс пользователя
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    })

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' })
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: 'Недостаточно средств' })
    }

    // Создаем запрос на вывод
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: userId.toString(),
        address,
        amount,
        status: 'pending'
      }
    })

    // Списываем баланс
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        balance: {
          decrement: amount
        }
      }
    })

    res.json({
      success: true,
      withdrawalId: withdrawal.id,
      message: 'Запрос на вывод создан, ожидайте обработки'
    })
  } catch (error) {
    console.error('Error creating withdrawal:', error)
    res.status(500).json({ error: 'Ошибка создания вывода' })
  }
})

// ===== START SERVER =====
app.listen(PORT, () => {
	console.log(`🚀 Backend running on http://localhost:${PORT}`)
	console.log(`🤖 Telegram Bot активен`)
})


