import { Request, Response } from 'express';
import { db } from '../config/firebase';

const getPayoutMultiplier = (betType: string): number => {
  switch (betType) {
    case 'red': case 'green': case 'big': case 'small': return 2;
    case 'violet': return 4.5;
    default:
      const num = parseInt(betType);
      if (!isNaN(num)) return 9;
      return 2;
  }
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'today';

    // Calculate the start date for filtering
    const now = new Date();
    let startDate: Date;
    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const startISO = startDate.toISOString();

    // Get all winning bets from the period
    const betsQuery = await db.collection('bets')
      .where('status', '==', 'won')
      .where('createdAt', '>=', startISO)
      .get();

    if (betsQuery.empty) {
      res.json([]);
      return;
    }

    // Aggregate winnings by user
    const userWinnings: Record<string, { totalWon: number; winCount: number }> = {};

    for (const doc of betsQuery.docs) {
      const bet = doc.data();
      const userId = bet.user_id;
      const winAmount = bet.amount * getPayoutMultiplier(bet.bet_type);

      if (!userWinnings[userId]) {
        userWinnings[userId] = { totalWon: 0, winCount: 0 };
      }
      userWinnings[userId].totalWon += winAmount;
      userWinnings[userId].winCount += 1;
    }

    // Sort by total winnings
    const sorted = Object.entries(userWinnings)
      .sort(([, a], [, b]) => b.totalWon - a.totalWon)
      .slice(0, 50);

    // Fetch usernames
    const leaderboard = await Promise.all(
      sorted.map(async ([userId, stats], index) => {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          const username = userDoc.exists ? (userDoc.data()?.username || 'Player') : 'Player';
          return {
            rank: index + 1,
            userId,
            username,
            totalWon: Math.round(stats.totalWon * 100) / 100,
            winCount: stats.winCount,
          };
        } catch {
          return {
            rank: index + 1,
            userId,
            username: 'Player',
            totalWon: Math.round(stats.totalWon * 100) / 100,
            winCount: stats.winCount,
          };
        }
      })
    );

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};
