import { Request, Response } from 'express';
import { db } from '../config/firebase';

export const getPendingWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const txSnapshot = await db.collection('transactions')
      .where('type', '==', 'withdraw')
      .where('status', '==', 'pending')
      .get();

    const transactions = [];
    for (const doc of txSnapshot.docs) {
      const txData = doc.data();
      // manually fetch user specific to each transaction to emulate populate()
      const userDoc = await db.collection('users').doc(txData.user_id).get();
      const userData = userDoc.data() || {};
      
      transactions.push({
        _id: doc.id,
        ...txData,
        user_id: {
          _id: userDoc.id,
          username: userData.username,
          email: userData.email
        }
      });
    }

    // Sort descending by createdAt manually since we can't chain orderBy with two inequality filters easily without index
    transactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const handleWithdrawal = async (req: Request, res: Response): Promise<void> => {
  const { status } = req.body; // 'success' or 'rejected'
  try {
    const txRef = db.collection('transactions').doc(req.params.id as string);
    const txDoc = await txRef.get();
    
    if (!txDoc.exists) {
      res.status(404).json({ message: 'Withdrawal not found' });
      return;
    }

    const txData = txDoc.data();
    if (txData?.type !== 'withdraw') {
       res.status(400).json({ message: 'Invalid transaction type' }); return;
    }

    await txRef.update({ status });

    // If rejected, refund the coins
    if (status === 'rejected') {
      const userRef = db.collection('users').doc(txData.user_id);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        await userRef.update({ coin_balance: (uData?.coin_balance || 0) + txData.amount });
      }
    }

    res.json({ _id: txDoc.id, ...txData, status });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getPlatformMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    // Firestore lacks simple native COUNT without costs. We'll execute size on snapshots for accurate numbers.
    const usersSnap = await db.collection('users').get();
    const roundsSnap = await db.collection('rounds').get();
    
    // Aggregate deposits & withdraws
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    const txSnap = await db.collection('transactions').where('status', '==', 'success').get();
    txSnap.forEach(doc => {
       const data = doc.data();
       if (data.type === 'deposit') totalDeposits += data.amount;
       if (data.type === 'withdraw') totalWithdrawals += data.amount;
    });

    res.json({
      totalUsers: usersSnap.size,
      totalRounds: roundsSnap.size,
      totalDeposits,
      totalWithdrawals,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
