import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from '../config/firebase';

/* ── Game Mode Definitions ─── */
const GAME_MODES = [
  { key: '30s',   label: '30sec', duration: 30,  lockDuration: 5  },
  { key: '1min',  label: '1 Min', duration: 60,  lockDuration: 10 },
  { key: '3min',  label: '3 Min', duration: 180, lockDuration: 15 },
  { key: '5min',  label: '5 Min', duration: 300, lockDuration: 20 },
] as const;

type ModeKey = typeof GAME_MODES[number]['key'];

/* ── Types ─── */
interface GameState { remainingSeconds: number; status: 'betting' | 'locked'; }
interface BetRecord { user_id: string; bet_type: string; amount: number; }

/* ── Per-mode state ─── */
interface ModeState {
  roundId: string;
  gameState: GameState;
  bets: BetRecord[];
  cachedHistory: any[] | null;
  lastHistoryFetch: number;
  processing: boolean;
}

const modeStates: Record<string, ModeState> = {};

/* ── Shared state ─── */
let activeSockets: { [userId: string]: Socket } = {};
let userBetsCache: { [userId: string]: any[] } = {};

/* ── Helpers (shared) ─── */
const getNumberColor = (n: number): 'red' | 'green' => n % 2 === 0 ? 'red' : 'green';
const isViolet = (n: number): boolean => n === 0 || n === 5;

const doesBetWin = (betType: string, resultNumber: number): boolean => {
  const color = getNumberColor(resultNumber);
  switch (betType) {
    case 'red': return color === 'red';
    case 'green': return color === 'green';
    case 'violet': return isViolet(resultNumber);
    case 'big': return resultNumber >= 5;
    case 'small': return resultNumber < 5;
    default:
      const num = parseInt(betType);
      if (!isNaN(num)) return resultNumber === num;
      return false;
  }
};

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

const calculateHouseEdgeNumber = (bets: BetRecord[]): number => {
  if (bets.length === 0) return Math.floor(Math.random() * 10);
  let bestNumber = 0;
  let maxProfit = -Infinity;
  for (let candidate = 0; candidate <= 9; candidate++) {
    let houseProfit = 0;
    for (const bet of bets) {
      if (doesBetWin(bet.bet_type, candidate)) {
        houseProfit -= (bet.amount * getPayoutMultiplier(bet.bet_type) - bet.amount);
      } else {
        houseProfit += bet.amount;
      }
    }
    houseProfit += (Math.random() - 0.5) * 10;
    if (houseProfit > maxProfit) { maxProfit = houseProfit; bestNumber = candidate; }
  }
  return bestNumber;
};

/* ── Period calculation per mode ─── */
const getPeriodInfo = (duration: number) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const secSinceMidnight = Math.floor((now.getTime() - startOfDay.getTime()) / 1000);
  const intervalNum = Math.floor(secSinceMidnight / duration) + 1;
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const intervalStr = String(intervalNum).padStart(5, '0');
  const periodId = `${yyyy}${mm}${dd}${intervalStr}`;
  const elapsed = secSinceMidnight % duration;
  const remainingSeconds = duration - elapsed;
  return { periodId, remainingSeconds };
};

/* ── Fetch history per mode (cached) ─── */
const fetchHistory = async (modeKey: string, ms: ModeState) => {
  if (ms.cachedHistory && (Date.now() - ms.lastHistoryFetch < 300000)) return ms.cachedHistory;
  try {
    const snap = await db.collection(`rounds_${modeKey}`)
      .orderBy('round_id', 'desc').limit(50).get();
    if (snap.empty) return [];
    const recent = snap.docs.map(d => {
      const data = d.data();
      return { period: data.round_id||'', number: data.result_number??0, color: data.result_color||'red', size: data.result_size||'small', violet: data.result_violet||false };
    });
    ms.cachedHistory = recent;
    ms.lastHistoryFetch = Date.now();
    return recent;
  } catch { return ms.cachedHistory || []; }
};

/* ── Payouts ─── */
const calculatePayouts = async (modeKey: string, roundId: string, winningNumber: number) => {
  try {
    const betsQuery = await db.collection('bets')
      .where('round_id', '==', roundId).where('status', '==', 'pending').get();
    if (betsQuery.empty) return;
    const batch = db.batch();
    for (const doc of betsQuery.docs) {
      const betData = doc.data();
      const isWin = doesBetWin(betData.bet_type, winningNumber);
      const finalStatus = isWin ? 'won' : 'lost';
      batch.update(doc.ref, { status: finalStatus });
      if (userBetsCache[betData.user_id]) {
        const cached = userBetsCache[betData.user_id].find(b => b.id === doc.id);
        if (cached) cached.status = finalStatus;
      }
      if (isWin) {
        const winAmount = betData.amount * getPayoutMultiplier(betData.bet_type);
        const userRef = db.collection('users').doc(betData.user_id);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const newBal = (userDoc.data()?.coin_balance || 0) + winAmount;
          batch.update(userRef, { coin_balance: newBal });
          if (activeSockets[betData.user_id]) {
            activeSockets[betData.user_id].emit('server:balance_update', { balance: newBal });
          }
        }
      }
    }
    await batch.commit();
  } catch (e) { console.error(`Payout error [${modeKey}]:`, e); }
};

/* ── INIT ─── */
export const initGameEngine = (io: Server) => {
  console.log('Game Engine Initialized — 4 modes');

  // Initialize per-mode state
  for (const mode of GAME_MODES) {
    const { periodId, remainingSeconds } = getPeriodInfo(mode.duration);
    modeStates[mode.key] = {
      roundId: periodId,
      gameState: { remainingSeconds, status: remainingSeconds <= mode.lockDuration ? 'locked' : 'betting' },
      bets: [],
      cachedHistory: null,
      lastHistoryFetch: 0,
      processing: false
    };
  }

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      (socket as any).userId = decoded.id;
      next();
    } catch { return next(new Error('Authentication error')); }
  });

  // Connection handler
  io.on('connection', async (socket) => {
    const userId = (socket as any).userId;
    console.log(`User connected: ${userId} (${socket.id})`);
    activeSockets[userId] = socket;

    // Send initial state for ALL modes
    for (const mode of GAME_MODES) {
      const ms = modeStates[mode.key];
      const history = await fetchHistory(mode.key, ms);
      socket.emit(`server:history:${mode.key}`, history);
      socket.emit(`server:tick:${mode.key}`, { ...ms.gameState, currentPeriod: ms.roundId });
    }

    // Place bet (mode-aware)
    socket.on('client:place_bet', async (data) => {
      const { amount, bet_type, color, mode } = data;
      const modeKey: string = mode || '30s';
      const type = bet_type || color || 'red';
      const ms = modeStates[modeKey];

      if (!ms) { socket.emit('server:error', { message: 'Invalid game mode' }); return; }

      try {
        if (ms.gameState.status !== 'betting') {
          socket.emit('server:error', { message: 'Betting is locked for this round!' }); return;
        }
        const validTypes = ['red','green','violet','big','small','0','1','2','3','4','5','6','7','8','9'];
        if (!validTypes.includes(type)) { socket.emit('server:error', { message: 'Invalid bet type' }); return; }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User not found');
        const userData = userDoc.data();
        if ((userData?.coin_balance || 0) < amount) { socket.emit('server:error', { message: 'Insufficient balance' }); return; }

        const newBalance = userData!.coin_balance - amount;
        await userRef.update({ coin_balance: newBalance });

        const newBetData = { user_id: userId, round_id: ms.roundId, bet_type: type, amount, status: 'pending', mode: modeKey, createdAt: new Date().toISOString() };
        const docRef = await db.collection('bets').add(newBetData);

        if (!userBetsCache[userId]) userBetsCache[userId] = [];
        userBetsCache[userId] = [{ id: docRef.id, ...newBetData }, ...userBetsCache[userId]].slice(0, 50);

        ms.bets.push({ user_id: userId, bet_type: type, amount });

        socket.emit('server:bet_success', { amount, color: type, newBalance, mode: modeKey });
        socket.emit('server:balance_update', { balance: newBalance });
      } catch (error) {
        console.error('Bet Error:', error);
        socket.emit('server:error', { message: (error as Error).message });
      }
    });

    // Fetch my bets
    socket.on('client:fetch_my_bets', async () => {
      try {
        if (!userBetsCache[userId]) {
          const betsQuery = await db.collection('bets').where('user_id', '==', userId).get();
          const bets = betsQuery.docs.map(d => ({ id: d.id, ...d.data() }));
          bets.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          userBetsCache[userId] = bets.slice(0, 50);
        }
        socket.emit('server:my_bets', userBetsCache[userId].slice(0, 30));
      } catch (e) { console.error('Fetch bets error:', e); }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      delete activeSockets[userId];
    });
  });

  /* ── Game loops — one per mode ─── */
  for (const mode of GAME_MODES) {
    setInterval(async () => {
      const ms = modeStates[mode.key];
      try {
        if (ms.processing) return;
        const { periodId, remainingSeconds } = getPeriodInfo(mode.duration);

        if (periodId !== ms.roundId) {
          ms.processing = true;
          const winNum = calculateHouseEdgeNumber(ms.bets);
          const winColor = getNumberColor(winNum);
          const winSize = winNum >= 5 ? 'big' : 'small';
          const winViolet = isViolet(winNum);

          io.emit(`server:result:${mode.key}`, {
            period: ms.roundId, winner: winColor, number: winNum, size: winSize, violet: winViolet
          });

          try {
            await db.collection(`rounds_${mode.key}`).add({
              round_id: ms.roundId, start_time: new Date().toISOString(),
              result_number: winNum, result_color: winColor, result_size: winSize, result_violet: winViolet,
              status: 'completed', total_bets: ms.bets.length
            });

            const entry = { period: ms.roundId, number: winNum, color: winColor, size: winSize, violet: winViolet };
            ms.cachedHistory = ms.cachedHistory ? [entry, ...ms.cachedHistory].slice(0, 50) : [entry];
            ms.lastHistoryFetch = Date.now();

            await calculatePayouts(mode.key, ms.roundId, winNum);
          } catch (e) { console.error(`DB error [${mode.key}]:`, e); }

          ms.roundId = periodId;
          ms.bets = [];
          ms.gameState = { remainingSeconds, status: remainingSeconds <= mode.lockDuration ? 'locked' : 'betting' };
          ms.processing = false;
        } else {
          ms.gameState = { remainingSeconds, status: remainingSeconds <= mode.lockDuration ? 'locked' : 'betting' };
        }

        io.emit(`server:tick:${mode.key}`, { ...ms.gameState, currentPeriod: ms.roundId });
      } catch (e) {
        console.error(`Loop error [${mode.key}]:`, (e as Error).message);
        ms.processing = false;
      }
    }, 1000);
  }
};
