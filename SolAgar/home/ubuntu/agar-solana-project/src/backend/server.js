const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bs58 = require('bs58');
const crypto = require('crypto');
const { Keypair, Connection, PublicKey, Transaction, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize Solana connection
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Encryption functions for private keys
function encrypt(text) {
  const algorithm = 'aes-256-ctr';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  const algorithm = 'aes-256-ctr';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encryptedText] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Load admin wallet for operations
let adminKeypair;
try {
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH;
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8')));
  adminKeypair = Keypair.fromSecretKey(secretKey);
  console.log(`Admin wallet loaded: ${adminKeypair.publicKey.toString()}`);
} catch (error) {
  console.error('Error loading admin keypair:', error);
  // Continue without admin keypair for development
}

// API Endpoints

// Create a new wallet
app.post('/api/create-wallet', async (req, res) => {
  try {
    // Generate a new Solana keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);
    
    // Encrypt the private key before storing
    const encryptedPrivateKey = encrypt(privateKey);
    
    // Store in database
    const result = await pool.query(
      'INSERT INTO users (public_key, private_key, balance) VALUES ($1, $2, $3) RETURNING id',
      [publicKey, encryptedPrivateKey, 0]
    );
    
    res.status(201).json({
      success: true,
      userId: result.rows[0].id,
      publicKey
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ success: false, error: 'Failed to create wallet' });
  }
});

// Get wallet info
app.get('/api/get-wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT id, public_key, balance FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      success: true,
      wallet: {
        userId: result.rows[0].id,
        publicKey: result.rows[0].public_key,
        balance: parseFloat(result.rows[0].balance)
      }
    });
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve wallet' });
  }
});

// Process deposit
app.post('/api/deposit', async (req, res) => {
  try {
    const { userId, amount, txSignature } = req.body;
    
    if (!userId || !amount || !txSignature) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // In a production environment, we would verify the transaction on-chain
    // For development, we'll simulate the verification
    
    // Update user balance
    const updateResult = await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [amount, userId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Record transaction
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount, status, tx_signature) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'deposit', amount, 'completed', txSignature]
    );
    
    res.json({
      success: true,
      newBalance: parseFloat(updateResult.rows[0].balance)
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to process deposit' });
  }
});

// Process withdrawal
app.post('/api/withdraw', async (req, res) => {
  try {
    const { userId, amount, destinationAddress } = req.body;
    
    if (!userId || !amount || !destinationAddress) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Get user info
    const userResult = await pool.query(
      'SELECT balance, private_key FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const currentBalance = parseFloat(userResult.rows[0].balance);
    
    if (currentBalance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient balance' });
    }
    
    // Calculate fee
    let withdrawalAmount = amount;
    let fee = 0;
    
    if (currentBalance > 10) {
      // Apply 1% fee for balances over 10 USDC
      fee = amount * 0.01;
      withdrawalAmount = amount - fee;
    }
    
    // In a production environment, we would execute the on-chain transaction
    // For development, we'll simulate the transaction
    const txSignature = 'simulated_' + Date.now().toString();
    
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, userId]
    );
    
    // Record transaction
    await pool.query(
      'INSERT INTO transactions (user_id, type, amount, status, tx_signature) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'withdrawal', amount, 'completed', txSignature]
    );
    
    res.json({
      success: true,
      withdrawalAmount,
      fee,
      txSignature
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
