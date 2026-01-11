import { Address, TonClient, WalletContractV4, internal } from '@ton/ton'
import { mnemonicToPrivateKey } from '@ton/crypto'
import axios from 'axios'

const TON_CENTER_API = 'https://toncenter.com/api/v2'
const TON_CENTER_TESTNET_API = 'https://testnet.toncenter.com/api/v2'

class TONService {
  constructor(isTestnet = false) {
    this.client = new TonClient({
      endpoint: isTestnet ? TON_CENTER_TESTNET_API : TON_CENTER_API
    })
    this.isTestnet = isTestnet
  }

  // Проверка баланса по адресу
  async getBalance(address) {
    try {
      const addr = Address.parse(address)
      const balance = await this.client.getBalance(addr)
      return balance.toString()
    } catch (error) {
      console.error('Error getting balance:', error)
      throw error
    }
  }

  // Проверка транзакции
  async checkTransaction(address, amount, comment) {
    try {
      const url = `${this.isTestnet ? TON_CENTER_TESTNET_API : TON_CENTER_API}/getTransactions`
      const response = await axios.get(url, {
        params: {
          address,
          limit: 10
        }
      })

      if (!response.data.ok) {
        throw new Error('Ошибка получения транзакций')
      }

      const transactions = response.data.result
      
      // Ищем транзакцию с нужной суммой и комментарием
      for (const tx of transactions) {
        if (tx.in_msg) {
          const value = parseInt(tx.in_msg.value)
          const message = tx.in_msg.message
          
          if (value >= amount && message && message.includes(comment)) {
            return {
              found: true,
              hash: tx.transaction_id.hash,
              value,
              timestamp: tx.utime
            }
          }
        }
      }

      return { found: false }
    } catch (error) {
      console.error('Error checking transaction:', error)
      throw error
    }
  }

  // Отправка TON (для вывода)
  async sendTON(mnemonic, toAddress, amount, comment = '') {
    try {
      // Получаем ключи из мнемоники
      const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '))
      
      // Создаем кошелек
      const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
      })

      const contract = this.client.open(wallet)
      
      // Отправляем транзакцию
      const seqno = await contract.getSeqno()
      
      await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            value: amount,
            to: toAddress,
            body: comment
          })
        ]
      })

      return { success: true, seqno }
    } catch (error) {
      console.error('Error sending TON:', error)
      throw error
    }
  }

  // Конвертация TON в nanoTON
  toNano(amount) {
    return BigInt(Math.floor(amount * 1e9))
  }

  // Конвертация nanoTON в TON
  fromNano(amount) {
    return Number(amount) / 1e9
  }

  // Валидация адреса
  validateAddress(address) {
    try {
      Address.parse(address)
      return true
    } catch {
      return false
    }
  }
}

export default TONService
