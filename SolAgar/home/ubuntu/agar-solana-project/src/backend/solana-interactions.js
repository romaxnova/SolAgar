// Solana wallet interactions for Agar.io clone with USDC integration
const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

// USDC token mint address (Devnet)
const USDC_MINT = new PublicKey(process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2q6yZH7vjZgASkZ3ZQm4jL5JvhH');

// Encryption key for private key storage
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-encryption-key';

/**
 * Encrypt a private key for secure storage
 * @param {string} privateKey - Private key in base58 format
 * @returns {string} - Encrypted private key
 */
function encryptPrivateKey(privateKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a stored private key
 * @param {string} encryptedPrivateKey - Encrypted private key
 * @returns {string} - Decrypted private key in base58 format
 */
function decryptPrivateKey(encryptedPrivateKey) {
  const parts = encryptedPrivateKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Create a new Solana wallet (keypair)
 * @returns {Promise<Object>} - Object containing userId, public key, and encrypted private key
 */
async function createWallet() {
  try {
    // Generate a new Solana keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);
    
    // Encrypt the private key for secure storage
    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    
    // Store in database
    const result = await pool.query(
      'INSERT INTO users (public_key, private_key, balance) VALUES ($1, $2, $3) RETURNING id',
      [publicKey, encryptedPrivateKey, 0]
    );
    
    const userId = result.rows[0].id;
    
    console.log(`Created wallet for user ${userId}: ${publicKey}`);
    
    return {
      userId,
      publicKey,
      encryptedPrivateKey
    };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw new Error('Failed to create wallet');
  }
}

/**
 * Get wallet information for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Object containing user's wallet information
 */
async function getWallet(userId) {
  try {
    const result = await pool.query(
      'SELECT id, public_key, private_key, balance FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result.rows[0];
    
    return {
      userId: user.id,
      publicKey: user.public_key,
      balance: parseFloat(user.balance)
    };
  } catch (error) {
    console.error('Error getting wallet:', error);
    throw new Error('Failed to get wallet information');
  }
}

/**
 * Process a deposit of USDC
 * @param {number} userId - User ID
 * @param {number} amount - Amount of USDC to deposit
 * @param {string} txSignature - Transaction signature (optional for simulation)
 * @returns {Promise<Object>} - Object containing updated balance
 */
async function processDeposit(userId, amount, txSignature = null) {
  try {
    // In a production environment, we would verify the transaction on-chain
    // For development, we'll simulate the deposit
    
    // Get current user balance
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const currentBalance = parseFloat(userResult.rows[0].balance);
    const newBalance = currentBalance + amount;
    
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );
    
    // Record transaction
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount, status, tx_signature) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'deposit', amount, 'completed', txSignature || `simulated_${Date.now()}`]
    );
    
    console.log(`Processed deposit for user ${userId}: ${amount} USDC, new balance: ${newBalance}`);
    
    return {
      success: true,
      userId,
      amount,
      previousBalance: currentBalance,
      newBalance
    };
  } catch (error) {
    console.error('Error processing deposit:', error);
    throw new Error('Failed to process deposit');
  }
}

/**
 * Calculate withdrawal amount with fee
 * @param {number} amount - Requested withdrawal amount
 * @returns {Object} - Object containing withdrawal amount and fee
 */
function calculateWithdrawalAmount(amount) {
  // Apply 1% fee for withdrawals over 10 USDC
  if (amount > 10) {
    const fee = amount * 0.01;
    return {
      withdrawalAmount: amount - fee,
      fee
    };
  }
  
  // No fee for withdrawals of 10 USDC or less
  return {
    withdrawalAmount: amount,
    fee: 0
  };
}

/**
 * Process a withdrawal of USDC
 * @param {number} userId - User ID
 * @param {number} amount - Amount of USDC to withdraw
 * @param {string} destinationAddress - Destination wallet address
 * @returns {Promise<Object>} - Object containing transaction details
 */
async function processWithdrawal(userId, amount, destinationAddress) {
  try {
    // Check minimum withdrawal amount
    if (amount < 5) {
      throw new Error('Minimum withdrawal amount is 5 USDC');
    }
    
    // Get user information
    const userResult = await pool.query(
      'SELECT balance, private_key FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const currentBalance = parseFloat(userResult.rows[0].balance);
    
    // Check if user has sufficient balance
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // Calculate withdrawal amount with fee
    const { withdrawalAmount, fee } = calculateWithdrawalAmount(amount);
    
    // In a production environment, we would send the USDC on-chain
    // For development, we'll simulate the withdrawal
    
    // Update user balance
    const newBalance = currentBalance - amount;
    await pool.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );
    
    // Record transaction
    const txSignature = `simulated_withdrawal_${Date.now()}`;
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount, status, tx_signature) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'withdrawal', amount, 'completed', txSignature]
    );
    
    console.log(`Processed withdrawal for user ${userId}: ${amount} USDC (fee: ${fee}), new balance: ${newBalance}`);
    
    return {
      success: true,
      userId,
      requestedAmount: amount,
      withdrawalAmount,
      fee,
      destinationAddress,
      txSignature,
      previousBalance: currentBalance,
      newBalance
    };
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    throw new Error(`Failed to process withdrawal: ${error.message}`);
  }
}

/**
 * Get transaction history for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of transaction objects
 */
async function getTransactionHistory(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    throw new Error('Failed to get transaction history');
  }
}

// Export functions
module.exports = {
  createWallet,
  getWallet,
  processDeposit,
  processWithdrawal,
  calculateWithdrawalAmount,
  getTransactionHistory
};
