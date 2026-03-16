import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Request a deposit (Mock payment gateway)
// @route   POST /api/transactions/deposit
// @access  Private
export const requestDeposit = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, payment_method, payment_details } = req.body;
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }
    
    const userRef = db.collection('users').doc(req.user._id);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    
    if (!userDoc.exists || !userData) { res.status(404).json({ message: 'User not found' }); return; }

    const txRef = await db.collection('transactions').add({
      user_id: req.user._id,
      type: 'deposit',
      amount,
      status: 'success', // auto-approving mocked deposits
      payment_method,
      payment_details,
      createdAt: new Date().toISOString()
    });

    const newBalance = (userData.coin_balance || 0) + amount;
    await userRef.update({ coin_balance: newBalance });

    res.status(201).json({ _id: txRef.id, type: 'deposit', amount, status: 'success' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Request a withdrawal
// @route   POST /api/transactions/withdraw
// @access  Private
export const requestWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, payment_details } = req.body;
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const userRef = db.collection('users').doc(req.user._id);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userDoc.exists || !userData || (userData.coin_balance || 0) < amount) {
      res.status(400).json({ message: 'Insufficient balance' });
      return;
    }

    // Deduct instantly, refund if rejected by admin
    const newBalance = userData.coin_balance - amount;
    await userRef.update({ coin_balance: newBalance });

    const txRef = await db.collection('transactions').add({
      user_id: req.user._id,
      type: 'withdraw',
      amount,
      status: 'pending',
      payment_method: 'UPI/Bank',
      payment_details,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ _id: txRef.id, type: 'withdraw', amount, status: 'pending' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Get user's transactions
// @route   GET /api/transactions/my
// @access  Private
export const getMyTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }
    
    const snapshot = await db.collection('transactions')
      .where('user_id', '==', req.user._id)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const transactions = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
