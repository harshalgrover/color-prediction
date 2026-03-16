import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalWon: number;
  winCount: number;
}

const RANK_ICONS = ['👑', '🥈', '🥉'];
const RANK_COLORS = ['linear-gradient(135deg, #FFD700, #FFA500)', 'linear-gradient(135deg, #C0C0C0, #A0A0A0)', 'linear-gradient(135deg, #CD7F32, #A0522D)'];

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/leaderboard?period=${period}`);
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [period]);

  const maskName = (name: string) => {
    if (name.length <= 3) return name + '***';
    return name.slice(0, 3) + '***' + name.slice(-1);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f85c5c, #ff8a80)', padding: '16px', textAlign: 'center', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Link to="/" style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>← Back</Link>
          <span style={{ fontWeight: 900, fontSize: 20 }}>🏆 Leaderboard</span>
          <span />
        </div>

        {/* Period Tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {(['today', 'week'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '10px 28px',
                borderRadius: 24,
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                background: period === p ? '#fff' : 'rgba(255,255,255,0.2)',
                color: period === p ? '#f85c5c' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {p === 'today' ? '📅 Today' : '📆 This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      {!loading && entries.length >= 3 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, padding: '20px 14px 10px' }}>
          {[1, 0, 2].map(idx => {
            const e = entries[idx];
            const isFirst = idx === 0;
            return (
              <div
                key={idx}
                style={{
                  textAlign: 'center',
                  flex: 1,
                  maxWidth: 120,
                }}
              >
                <div style={{
                  width: isFirst ? 64 : 52,
                  height: isFirst ? 64 : 52,
                  borderRadius: '50%',
                  background: RANK_COLORS[idx],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 6px',
                  fontSize: isFirst ? 28 : 22,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.15)`,
                  border: isFirst ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.5)',
                }}>
                  {RANK_ICONS[idx]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 2 }}>
                  {maskName(e.username)}
                </div>
                <div style={{
                  background: RANK_COLORS[idx],
                  color: '#fff',
                  padding: '6px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 900,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  ₹{e.totalWon.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                  {e.winCount} wins
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranking List */}
      <div style={{ margin: '0 14px', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
        {/* Header Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 100px 60px',
          padding: '12px 14px',
          background: '#f85c5c',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
        }}>
          <span>Rank</span>
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Winnings</span>
          <span style={{ textAlign: 'right' }}>Wins</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No winners yet for this period 🎲
          </div>
        ) : (
          entries.map((e, i) => {
            const isCurrentUser = e.userId === user?._id;
            return (
              <div
                key={e.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 100px 60px',
                  padding: '13px 14px',
                  borderBottom: '1px solid #f5f5f5',
                  alignItems: 'center',
                  background: isCurrentUser ? 'rgba(248,92,92,0.06)' : i % 2 === 0 ? '#fff' : '#fafafa',
                  borderLeft: isCurrentUser ? '3px solid #f85c5c' : 'none',
                }}
              >
                <span style={{
                  fontWeight: 900,
                  fontSize: i < 3 ? 20 : 14,
                  color: i < 3 ? '#f85c5c' : '#888',
                }}>
                  {i < 3 ? RANK_ICONS[i] : `#${e.rank}`}
                </span>
                <span style={{
                  fontWeight: isCurrentUser ? 800 : 600,
                  fontSize: 13,
                  color: isCurrentUser ? '#f85c5c' : '#333',
                }}>
                  {maskName(e.username)} {isCurrentUser && <span style={{ fontSize: 10, color: '#f85c5c' }}>(You)</span>}
                </span>
                <span style={{
                  textAlign: 'right',
                  fontWeight: 800,
                  fontSize: 13,
                  color: '#40b83e',
                }}>
                  ₹{e.totalWon.toLocaleString()}
                </span>
                <span style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#888',
                }}>
                  {e.winCount}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: '#fff',
        display: 'flex', justifyContent: 'space-around',
        padding: '10px 0 16px', boxShadow: '0 -4px 12px rgba(0,0,0,0.04)', zIndex: 100,
      }}>
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#888', background: 'none', border: 'none' }}>🏠<span>Home</span></Link>
        <Link to="/wallet" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#888', background: 'none', border: 'none' }}>💰<span>Wallet</span></Link>
        <Link to="/leaderboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#f85c5c', background: 'none', border: 'none' }}>🏆<span>Ranking</span></Link>
        <Link to="/profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#888', background: 'none', border: 'none' }}>👤<span>Profile</span></Link>
      </nav>
    </div>
  );
}
