// API routes for Solana interactions
const express = require('express');
const router = express.Router();
const solanaInteractions = require('./solana-interactions');

// Create a new wallet
router.post('/create-wallet', async (req, res) => {
  try {
    const wallet = await solanaInteractions.createWallet();
    res.json({
      success: true,
      userId: wallet.userId,
      publicKey: wallet.publicKey
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get wallet information
router.get('/get-wallet/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const wallet = await solanaInteractions.getWallet(userId);
    res.json({
      success: true,
      userId: wallet.userId,
      publicKey: wallet.publicKey,
      balance: wallet.balance
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process a deposit
router.post('/deposit', async (req, res) => {
  try {
    const { userId, amount, txSignature } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = await solanaInteractions.processDeposit(
      parseInt(userId),
      parseFloat(amount),
      txSignature
    );
    
    res.json({
      success: true,
      userId: result.userId,
      amount: result.amount,
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process a withdrawal
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount, destinationAddress } = req.body;
    
    if (!userId || !amount || !destinationAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = await solanaInteractions.processWithdrawal(
      parseInt(userId),
      parseFloat(amount),
      destinationAddress
    );
    
    res.json({
      success: true,
      userId: result.userId,
      requestedAmount: result.requestedAmount,
      withdrawalAmount: result.withdrawalAmount,
      fee: result.fee,
      destinationAddress: result.destinationAddress,
      txSignature: result.txSignature,
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction history
router.get('/transactions/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const transactions = await solanaInteractions.getTransactionHistory(userId);
    res.json({
      success: true,
      userId,
      transactions
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
