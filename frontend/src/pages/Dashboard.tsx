import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

/* ── helpers ─── */
const numColor = (n: number) => (n % 2 === 0 ? 'red' : 'green');

const BALL_COLORS: Record<string, string> = { red: '#d32f2f', green: '#2e7d32', violet: '#9c27b0' };

/* ── types ─── */
interface Tick { remainingSeconds: number; status: string; currentPeriod?: string }
interface HRow { period: string; number: number; color: string; size: string; violet: boolean }

/* ── component ─── */
export default function Dashboard() {
  const { user, logout, updateBalance } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tick, setTick] = useState<Tick | null>(null);
  const [history, setHistory] = useState<HRow[]>([]);
  const allTicksRef = useRef<Record<string, Tick>>({});
  const allHistoryRef = useRef<Record<string, HRow[]>>({});
  const [locked, setLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const lockedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'history'|'chart'|'mybets'>('history');
  const [myBets, setMyBets] = useState<any[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [gameMode, setGameMode] = useState<string>('30s');
  const gameModeRef = useRef('30s');

  // Modal State
  const [betModal, setBetModal] = useState<{ open: boolean; type: string; color: string } | null>(null);
  const [betBase, setBetBase] = useState<number>(1);
  const [betQty, setBetQty] = useState<number>(1);
  const [betAgreed, setBetAgreed] = useState(true);

  // Result popup state
  const [resultPopup, setResultPopup] = useState<{
    show: boolean;
    won: boolean;
    number: number;
    color: string;
    size: string;
    amount: number;
    period: string;
  } | null>(null);
  const myRoundBetsRef = useRef<{ type: string; amount: number }[]>([]);


  const playTickSound = () => {
    if (!user || document.hidden) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle'; // Richer sound than sine
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Punchy envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02); // Louder (0.3 instead of 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Two rapid, interesting tones per tick
      const now = ctx.currentTime;
      playTone(587.33, now, 0.1);       // D5
      playTone(880.00, now + 0.1, 0.2); // A5 (higher and slightly longer)
    } catch (e) {}
  };

  /* ── socket listeners ─── */
  useEffect(() => {
    if (!socket) return;

    const MODES = ['30s', '1min', '3min', '5min'];

    const tickHandlers: Record<string, (s: Tick) => void> = {};
    const histHandlers: Record<string, (d: any[]) => void> = {};
    const resultHandlers: Record<string, (d: any) => void> = {};

    for (const m of MODES) {
      tickHandlers[m] = (s: Tick) => {
        allTicksRef.current[m] = s;
        if (gameModeRef.current !== m) return;
        setTick(s);
        if (s.remainingSeconds <= 5 && s.remainingSeconds > 0) playTickSound();
        if (s.status === 'locked') {
          setCountdown(s.remainingSeconds);
          if (!lockedRef.current) { lockedRef.current = true; setLocked(true); }
        } else if (lockedRef.current) { lockedRef.current = false; setLocked(false); }
      };

      histHandlers[m] = (d: any[]) => {
        if (!Array.isArray(d)) return;
        const mapped = d.map(h => ({
          period: String(h.period || ''), number: Number(h.number) || 0,
          color: String(h.color || 'red'), size: String(h.size || 'small').toLowerCase(),
          violet: Boolean(h.violet)
        })).slice(0, 10);
        allHistoryRef.current[m] = mapped;
        if (gameModeRef.current !== m) return;
        setHistory(mapped);
      };

      resultHandlers[m] = (d: any) => {
        if (gameModeRef.current !== m) return;
        if (!d) return;
        const row: HRow = {
          period: String(d.period || ''), number: Number(d.number) || 0,
          color: String(d.winner || 'red'), size: String(d.size || 'small').toLowerCase(),
          violet: Boolean(d.violet)
        };
         allHistoryRef.current[m] = [row, ...(allHistoryRef.current[m] || [])].slice(0, 10);
         if (gameModeRef.current === m) setHistory(allHistoryRef.current[m]);
        socket.emit('client:fetch_my_bets');

        const bets = myRoundBetsRef.current;
        if (bets.length > 0) {
          const doesWin = (betType: string, num: number): boolean => {
            const c = num % 2 === 0 ? 'red' : 'green';
            if (betType === 'red') return c === 'red';
            if (betType === 'green') return c === 'green';
            if (betType === 'violet') return num === 0 || num === 5;
            if (betType === 'big') return num >= 5;
            if (betType === 'small') return num < 5;
            const n = parseInt(betType);
            if (!isNaN(n)) return num === n;
            return false;
          };
          const getMultiplier = (t: string) => {
            if (t === 'violet') return 4.5;
            if (!isNaN(parseInt(t))) return 9;
            return 2;
          };
          let totalWin = 0; let totalBet = 0; let anyWin = false;
          for (const b of bets) {
            totalBet += b.amount;
            if (doesWin(b.type, row.number)) { anyWin = true; totalWin += b.amount * getMultiplier(b.type); }
          }
          setResultPopup({ show: true, won: anyWin, number: row.number, color: row.color, size: row.size, amount: anyWin ? totalWin : totalBet, period: row.period });
          myRoundBetsRef.current = [];
        }
      };

      socket.on(`server:tick:${m}`, tickHandlers[m]);
      socket.on(`server:history:${m}`, histHandlers[m]);
      socket.on(`server:result:${m}`, resultHandlers[m]);
    }

    const onBalance = (d: any) => { if (d?.balance != null) updateBalance(d.balance); };
    const onBetOk = (d: any) => { toast.success(`Bet ₹${d?.amount} placed!`); if (d?.newBalance != null) updateBalance(d.newBalance); socket.emit('client:fetch_my_bets'); };
    const onMyBets = (d: any[]) => setMyBets(d);
    const onErr = (d: any) => toast.error(d?.message || 'Error');

    socket.on('server:balance_update', onBalance);
    socket.on('server:bet_success', onBetOk);
    socket.on('server:error', onErr);
    socket.on('server:my_bets', onMyBets);
    socket.emit('client:fetch_my_bets');

    return () => {
      for (const m of MODES) {
        socket.off(`server:tick:${m}`, tickHandlers[m]);
        socket.off(`server:history:${m}`, histHandlers[m]);
        socket.off(`server:result:${m}`, resultHandlers[m]);
      }
      socket.off('server:balance_update', onBalance);
      socket.off('server:bet_success', onBetOk);
      socket.off('server:error', onErr);
      socket.off('server:my_bets', onMyBets);
    };
  }, [socket]); // eslint-disable-line

  /* ── bet ─── */
  const openBetModal = (type: string, themeColor: string) => {
    if (!tick || tick.status === 'locked') return toast.error('Betting locked!');
    setBetModal({ open: true, type, color: themeColor });
    setBetBase(1);
    setBetQty(1);
  };

  const confirmBet = () => {
    if (!betModal) return;
    if (!betAgreed) return toast.error('Please agree to pre-sale rules');
    if (!tick || tick.status === 'locked') {
      setBetModal(null);
      return toast.error('Betting locked!');
    }
    const amt = betBase * betQty;
    socket?.emit('client:place_bet', { bet_type: betModal.type, amount: amt, mode: gameMode });
    myRoundBetsRef.current.push({ type: betModal.type, amount: amt });
    setBetModal(null);
  };

  /* ── timer digits ─── */
  const secs = tick?.remainingSeconds ?? 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const period = tick?.currentPeriod || '--------';

  /* ── styles ─── */
  const S = {
    page: { paddingBottom: 72, background: '#f5f5f5', minHeight: '100vh' } as React.CSSProperties,
    header: { background: '#f85c5c', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', position: 'sticky' as const, top: 0, zIndex: 50 },
    logo: { fontSize: 20, fontWeight: 900 },
    hBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600 } as React.CSSProperties,
    card: { background: '#fff', margin: '14px 14px 0', borderRadius: 18, padding: '22px 16px', textAlign: 'center' as const, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
    bal: { fontSize: 30, fontWeight: 900 },
    balLabel: { color: '#999', fontSize: 13, marginBottom: 16 },
    wBtns: { display: 'flex', gap: 12, justifyContent: 'center' },
    wBtn: (bg: string): React.CSSProperties => ({ flex: 1, maxWidth: 140, padding: '12px 0', borderRadius: 22, border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, background: bg }),
    ticker: { background: '#fff', margin: '10px 14px', padding: '8px 12px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eee', fontSize: 12, color: '#777' },
    tabs: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, margin: '0 14px 10px' },
    tab: (active: boolean): React.CSSProperties => ({ padding: '10px 4px', borderRadius: 10, textAlign: 'center', border: active ? 'none' : '1px solid #eee', background: active ? 'linear-gradient(135deg,#ff7474,#f85c5c)' : '#fff', color: active ? '#fff' : '#888', fontWeight: 700, fontSize: 12 }),
    timer: { display: 'flex', margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#ff7474,#f85c5c)' },
    timerHalf: { flex: 1, padding: 14, color: '#fff' } as React.CSSProperties,
    digitBox: { background: '#fff', color: '#f85c5c', fontSize: 20, fontWeight: 900, width: 24, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, margin: '0 1px' } as React.CSSProperties,
    colon: { fontSize: 18, fontWeight: 900, margin: '0 2px' },
    gameplay: { position: 'relative' as const, background: '#fff', margin: '0 14px 14px', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden' as const },
    colorBtns: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 },
    cBtn: (bg: string): React.CSSProperties => ({ padding: '12px 0', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, background: bg }),
    numGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px 6px', marginBottom: 14, justifyItems: 'center' as const },
    ball: (n: number): React.CSSProperties => {
      const c = numColor(n);
      const base = c === 'red' ? '#d32f2f' : '#2e7d32';
      const isVioletNum = n === 0 || n === 5;
      const bg = isVioletNum ? `linear-gradient(135deg, ${base} 50%, #9c27b0 50%)` : base;
      return { width: 44, height: 44, borderRadius: '50%', border: 'none', background: bg, color: '#fff', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isVioletNum ? '0 3px 8px rgba(156,39,176,0.35)' : `0 3px 8px ${base}55` };
    },
    mulRow: { display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' as const },
    mulChip: (active: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 4, border: active ? 'none' : '1px solid #ddd', background: active ? '#40b83e' : '#f5f5f5', color: active ? '#fff' : '#666', fontWeight: 700, fontSize: 13, flexShrink: 0 }),
    sizeRow: { display: 'flex' },
    sizeBtn: (bg: string, left: boolean): React.CSSProperties => ({ flex: 1, padding: '12px 0', border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, background: bg, borderRadius: left ? '18px 0 0 18px' : '0 18px 18px 0' }),
    histSection: { background: '#fff', margin: '0 14px 14px', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },
    hTabs: { display: 'flex', borderBottom: '1px solid #eee' },
    hTab: (active: boolean): React.CSSProperties => ({ flex: 1, textAlign: 'center', padding: '12px 0', fontWeight: 700, fontSize: 14, color: active ? '#f85c5c' : '#999', borderBottom: active ? '3px solid #f85c5c' : 'none' }),
    hHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 14px', background: '#f85c5c', color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center' as const },
    hRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 13, fontWeight: 600, alignItems: 'center', textAlign: 'center' as const },
    nav: { position: 'fixed' as const, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '10px 0 16px', boxShadow: '0 -4px 12px rgba(0,0,0,0.04)', zIndex: 100 },
    navItem: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#888', background: 'none', border: 'none' },
    overlay: { position: 'absolute' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 },
    lockCard: { background: '#fff', borderRadius: 16, width: 110, height: 150, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' },
    lockNum: { fontSize: 110, fontWeight: 900, color: '#f85c5c', lineHeight: 1, fontFamily: 'sans-serif' },
    modalOverlay: { position: 'fixed' as const, top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end' },
    modalBg: { background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    modalHead: (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', padding: '16px', textAlign: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }),
    mTitle: { fontSize: 13, fontWeight: 600, opacity: 0.9, marginBottom: 8 },
    mSelect: { fontSize: 18, fontWeight: 800 },
    mBody: { padding: '20px 20px', background: '#fff' },
    mRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    mLabel: { fontSize: 15, fontWeight: 600, color: '#333' },
    mChips: { display: 'flex', gap: 8 },
    mChipSq: (act: boolean, bg: string): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 6, background: act ? bg : '#f0f0f0', color: act ? '#fff' : '#333', border: 'none', fontWeight: 700, fontSize: 14 }),
    qtyWrap: { display: 'flex', alignItems: 'center', gap: 2 },
    qtyBtn: (bg: string): React.CSSProperties => ({ width: 36, height: 36, borderRadius: 6, border: 'none', background: bg, color: '#fff', fontSize: 18, fontWeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center' }),
    qtyInp: { width: 60, height: 36, textAlign: 'center' as const, border: 'none', background: '#f5f5f5', fontWeight: 800, fontSize: 16 },
    mMuls: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, justifyContent: 'flex-end' },
    mMul: (act: boolean, bg: string): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 4, background: act ? bg : '#f5f5f5', color: act ? '#fff' : '#666', border: 'none', fontWeight: 700, fontSize: 13 }),
    mAgreeRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 20 },
    mFoot: { display: 'flex' },
    mFootBtn: (bg: string, dark: boolean): React.CSSProperties => ({ flex: 1, padding: 18, border: 'none', background: bg, color: dark ? '#555' : '#fff', fontWeight: 800, fontSize: 15 }),
    // Result popup styles
    rpOverlay: { position: 'fixed' as const, top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    rpWinCard: { width: '85%', borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(180deg, #ffecd2 0%, #fcb69f 50%, #f85c5c 100%)', boxShadow: '0 20px 60px rgba(248,92,92,0.4)', textAlign: 'center' as const, position: 'relative' as const, paddingBottom: 30 },
    rpWinIcon: { fontSize: 60, marginTop: 20 },
    rpWinTitle: { fontSize: 28, fontWeight: 900, color: '#fff', textShadow: '0 3px 10px rgba(0,0,0,0.2)', marginTop: 6 },
    rpWinPills: { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 14 },
    rpPill: (bg: string): React.CSSProperties => ({ padding: '5px 14px', borderRadius: 20, background: bg, color: '#fff', fontWeight: 700, fontSize: 13 }),
    rpWinBonusBox: { background: 'rgba(255,255,255,0.2)', margin: '0 20px', borderRadius: 16, padding: '16px 0' },
    rpWinBonusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 },
    rpWinBonusAmt: { fontSize: 32, fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    rpWinPeriod: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
    rpWinAutoClose: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 14 },
    rpCloseBtn: { position: 'absolute' as const, bottom: -50, left: '50%', transform: 'translateX(-50%)', width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
    rpLoseCard: { width: '85%', borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center' as const, padding: '30px 20px' },
    rpLoseIcon: { fontSize: 48, marginBottom: 8 },
    rpLoseTitle: { fontSize: 22, fontWeight: 800, color: '#555', marginBottom: 14 },
    rpLoseAmt: { fontSize: 24, fontWeight: 900, color: '#d32f2f', marginBottom: 6 },
    rpLoseAutoClose: { fontSize: 12, color: '#aaa', marginTop: 14 }
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🎰 color69</div>
        <button style={S.hBtn} onClick={() => navigate('/wallet')}>💰 Wallet</button>
      </div>

      {/* Balance Card */}
      <div style={S.card}>
        <div><span style={{ fontSize: 18 }}>₹ </span><span style={S.bal}>{(user?.coin_balance ?? 0).toFixed(2)}</span></div>
        <div style={S.balLabel}>Wallet balance</div>
        <div style={S.wBtns}>
          <button style={S.wBtn('#f85c5c')} onClick={() => navigate('/wallet')}>Withdraw</button>
          <button style={S.wBtn('#40b83e')} onClick={() => navigate('/wallet')}>Deposit</button>
        </div>
      </div>

      {/* Ticker */}
      <div style={S.ticker}>🔊 Only deposit through the official color69 website</div>

      {/* Game Tabs */}
      <div style={S.tabs}>
        {([['30s','30sec'],['1min','1 Min'],['3min','3 Min'],['5min','5 Min']] as const).map(([key, label]) => (
           <div key={key} style={S.tab(gameMode === key)} onClick={() => {
             setGameMode(key); gameModeRef.current = key;
             if (allTicksRef.current[key]) setTick(allTicksRef.current[key]);
             if (allHistoryRef.current[key]) setHistory(allHistoryRef.current[key]);
             const t = allTicksRef.current[key];
             if (t) {
               if (t.status === 'locked') { setLocked(true); lockedRef.current = true; setCountdown(t.remainingSeconds); }
               else { setLocked(false); lockedRef.current = false; }
             }
           }}>⏱<br />{label}</div>
        ))}
      </div>

      {/* Timer */}
      <div style={S.timer}>
        <div style={S.timerHalf}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>WinGo {gameMode === '30s' ? '30sec' : gameMode === '1min' ? '1 Min' : gameMode === '3min' ? '3 Min' : '5 Min'}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>📖 How to play</div>
        </div>
        <div style={{ ...S.timerHalf, textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Time remaining</div>
          <div>
            <span style={S.digitBox}>{mm[0]}</span><span style={S.digitBox}>{mm[1]}</span>
            <span style={S.colon}>:</span>
            <span style={S.digitBox}>{ss[0]}</span><span style={S.digitBox}>{ss[1]}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{period}</div>
        </div>
      </div>

      {/* Gameplay */}
      <div style={S.gameplay}>
        <div style={S.colorBtns}>
          <button style={S.cBtn('#40b83e')} onClick={() => openBetModal('green', '#40b83e')}>Green</button>
          <button style={S.cBtn('#9c27b0')} onClick={() => openBetModal('violet', '#9c27b0')}>Violet</button>
          <button style={S.cBtn('#d32f2f')} onClick={() => openBetModal('red', '#d32f2f')}>Red</button>
        </div>
        <div style={S.numGrid}>
          {[0,1,2,3,4,5,6,7,8,9].map(n => {
            const btnBg = numColor(n) === 'red' ? '#d32f2f' : '#2e7d32';
            return <button key={n} style={S.ball(n)} onClick={() => openBetModal(String(n), btnBg)}>{n}</button>
          })}
        </div>
        <div style={S.sizeRow}>
          <button style={S.sizeBtn('#fca048', true)} onClick={() => openBetModal('big', '#fca048')}>Big</button>
          <button style={S.sizeBtn('#5a9dfc', false)} onClick={() => openBetModal('small', '#5a9dfc')}>Small</button>
        </div>

        {/* Lock Overlay scoped to gameplay */}
        {locked && (
          <div style={S.overlay}>
            <div style={S.lockCard}><span style={S.lockNum}>{String(countdown).padStart(2, '0')[0]}</span></div>
            <div style={S.lockCard}><span style={S.lockNum}>{String(countdown).padStart(2, '0')[1]}</span></div>
          </div>
        )}
      </div>

      {/* Bet Modal Overlay */}
      {betModal && (
        <div style={S.modalOverlay} onClick={(e) => { if(e.target === e.currentTarget) setBetModal(null); }}>
          <div style={S.modalBg}>
            <div style={S.modalHead(betModal.color)}>
              <div style={S.mTitle}>WinGo {gameMode === '30s' ? '30sec' : gameMode === '1min' ? '1 Min' : gameMode === '3min' ? '3 Min' : '5 Min'}</div>
              <div style={S.mSelect}>Select {betModal.type.charAt(0).toUpperCase() + betModal.type.slice(1)}</div>
            </div>
            
            <div style={S.mBody}>
              <div style={S.mRow}>
                <div style={S.mLabel}>Balance</div>
                <div style={S.mChips}>
                  {[1, 10, 100, 1000].map(b => (
                    <button key={b} onClick={() => setBetBase(b)} style={S.mChipSq(betBase === b, betModal.color)}>{b}</button>
                  ))}
                </div>
              </div>

              <div style={S.mRow}>
                <div style={S.mLabel}>Quantity</div>
                <div style={S.qtyWrap}>
                  <button onClick={() => setBetQty(Math.max(1, betQty - 1))} style={S.qtyBtn(betModal.color)}>-</button>
                  <input type="number" readOnly value={betQty} style={S.qtyInp} />
                  <button onClick={() => setBetQty(betQty + 1)} style={S.qtyBtn(betModal.color)}>+</button>
                </div>
              </div>

              <div style={{...S.mRow, justifyContent: 'flex-end', marginBottom: 20 }}>
                 <div style={S.mMuls}>
                  {[1, 5, 10, 20, 50, 100].map(x => (
                    <button key={x} onClick={() => setBetQty(x)} style={S.mMul(betQty === x, betModal.color)}>X{x}</button>
                  ))}
                 </div>
              </div>

              <div style={S.mAgreeRow}>
                <input type="checkbox" checked={betAgreed} onChange={(e) => setBetAgreed(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#f85c5c' }} />
                <span style={{ fontSize: 13, color: '#666' }}>I agree</span>
                <span style={{ fontSize: 13, color: '#f85c5c' }}>《Pre-sale rules》</span>
              </div>
            </div>

            <div style={S.mFoot}>
              <button onClick={() => setBetModal(null)} style={S.mFootBtn('#f0f0f0', true)}>Cancel</button>
              <button onClick={confirmBet} style={S.mFootBtn(betModal.color, false)}>Total amount ₹{(betBase * betQty).toFixed(2)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Result Popup */}
      {resultPopup && resultPopup.won && (
        <div style={S.rpOverlay} onClick={() => setResultPopup(null)}>
          <div style={S.rpWinCard} onClick={e => e.stopPropagation()}>
            <div style={S.rpWinIcon}>🚀</div>
            <div style={S.rpWinTitle}>Congratulations</div>
            <div style={S.rpWinPills}>
              <span style={S.rpPill(BALL_COLORS[resultPopup.color] || '#333')}>
                {resultPopup.color.charAt(0).toUpperCase() + resultPopup.color.slice(1)}
              </span>
              <span style={S.rpPill('#555')}>{resultPopup.number}</span>
              <span style={S.rpPill('#5a9dfc')}>
                {resultPopup.size.charAt(0).toUpperCase() + resultPopup.size.slice(1)}
              </span>
            </div>
            <div style={S.rpWinBonusBox}>
              <div style={S.rpWinBonusLabel}>Bonus</div>
              <div style={S.rpWinBonusAmt}>₹{resultPopup.amount.toFixed(2)}</div>
              <div style={S.rpWinPeriod}>Period: {resultPopup.period}</div>
            </div>
            <button style={{ marginTop: 16, background: 'none', border: '2px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: '50%', width: 40, height: 40, fontSize: 18, fontWeight: 700, cursor: 'pointer' }} onClick={() => setResultPopup(null)}>✕</button>
          </div>
        </div>
      )}

      {resultPopup && !resultPopup.won && (
        <div style={S.rpOverlay} onClick={() => setResultPopup(null)}>
          <div style={S.rpLoseCard} onClick={e => e.stopPropagation()}>
            <div style={S.rpLoseIcon}>😔</div>
            <div style={S.rpLoseTitle}>Better Luck Next Time</div>
            <div style={S.rpWinPills}>
              <span style={S.rpPill(BALL_COLORS[resultPopup.color] || '#333')}>
                {resultPopup.color.charAt(0).toUpperCase() + resultPopup.color.slice(1)}
              </span>
              <span style={S.rpPill('#555')}>{resultPopup.number}</span>
              <span style={S.rpPill('#5a9dfc')}>
                {resultPopup.size.charAt(0).toUpperCase() + resultPopup.size.slice(1)}
              </span>
            </div>
            <div style={S.rpLoseAmt}>-₹{resultPopup.amount.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: '#999' }}>Period: {resultPopup.period}</div>
            <button style={{ marginTop: 16, background: 'none', border: '2px solid #ccc', color: '#999', borderRadius: '50%', width: 40, height: 40, fontSize: 18, fontWeight: 700, cursor: 'pointer' }} onClick={() => setResultPopup(null)}>✕</button>
          </div>
        </div>
      )}

      {/* History */}
      <div style={S.histSection}>
        <div style={S.hTabs}>
          <div style={S.hTab(activeTab === 'history')} onClick={() => setActiveTab('history')}>Game history</div>
          <div style={S.hTab(activeTab === 'chart')} onClick={() => setActiveTab('chart')}>Chart</div>
          <div style={S.hTab(activeTab === 'mybets')} onClick={() => { setActiveTab('mybets'); socket?.emit('client:fetch_my_bets'); }}>My bets</div>
        </div>
        
        {activeTab === 'history' && (
          <>
            <div style={S.hHeader}>
              <span style={{ textAlign: 'left' }}>Period</span><span>Number</span><span>Size</span><span>Color</span>
            </div>
             {history.length > 0 ? history.slice(0, 10).map((h, i) => (
              <div key={i} style={S.hRow}>
                <span style={{ textAlign: 'left', color: '#555' }}>{(h.period || '').slice(-4)}</span>
                <span style={{ fontWeight: 900, color: BALL_COLORS[h.color] || '#333' }}>{h.number}</span>
                <span>{(h.size || '').charAt(0).toUpperCase() + (h.size || '').slice(1)}</span>
                <span>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: BALL_COLORS[h.color] || '#ccc' }}></span>
                  {h.violet && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#9c27b0', marginLeft: 3 }}></span>}
                </span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Loading history...</div>
            )}
          </>
        )}

        {activeTab === 'mybets' && (
          <>
            <div style={S.hHeader}>
              <span style={{ textAlign: 'left' }}>Period</span><span>Select</span><span>Amount</span><span>Status</span>
            </div>
            {myBets.length > 0 ? myBets.map((b, i) => (
              <div key={i} style={S.hRow}>
                <span style={{ textAlign: 'left', color: '#555' }}>{String(b.round_id || '').slice(-4)}</span>
                <span style={{ fontWeight: 900, color: BALL_COLORS[b.bet_type] || '#333' }}>{b.bet_type.toUpperCase()}</span>
                <span style={{ color: '#40b83e', fontWeight: 700 }}>₹{b.amount}</span>
                <span style={{ color: b.status === 'won' ? '#40b83e' : b.status === 'lost' ? '#d32f2f' : '#f0ad4e', fontWeight: 800 }}>
                  {b.status.toUpperCase()}
                </span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>No bets found</div>
            )}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <nav style={S.nav}>
        <Link to="/" style={{ ...S.navItem, color: '#f85c5c' }}>🏠<span>Home</span></Link>
        <Link to="/wallet" style={S.navItem}>💰<span>Wallet</span></Link>
        <Link to="/" style={S.navItem}>🎮<span>Games</span></Link>
        <button style={S.navItem} onClick={logout}>👤<span>Logout</span></button>
      </nav>
    </div>
  );
}
