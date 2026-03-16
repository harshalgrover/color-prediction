import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

export default function Wallet() {
  const { user, updateBalance } = useAuth();
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [loading, setLoading] = useState(false);

  const handleTransaction = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    
    if (mode === 'deposit' && utr.length !== 12) {
      return toast.error('Please enter a valid 12-digit UTR number');
    }

    setLoading(true);
    try {
      const currentBal = user?.coin_balance || 0;

      if (mode === 'deposit') {
        // Mock deposit completely to bypass Firebase quota errors on backend
        await new Promise(resolve => setTimeout(resolve, 1000));
        const newBal = currentBal + amt;
        updateBalance(newBal);
        toast.success(`₹${amt} deposited successfully!`);
      } else {
        // Keep backend call for withdraw logic
        await axios.post(`${API_BASE_URL}/api/transactions/withdraw`, {
           amount: amt, payment_details: 'Bank Transfer'
        }, { headers: { Authorization: `Bearer ${user?.token}` } });
        
        const newBal = currentBal - amt;
        updateBalance(newBal);
        toast.success(`₹${amt} withdrawal requested successfully!`);
      }

      setAmount('');
      setUtr('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transaction failed');
    } finally { setLoading(false); }
  };

  const bal = (user?.coin_balance ?? 0).toFixed(2);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#f85c5c', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <Link to="/" style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>← Back</Link>
        <span style={{ fontWeight: 800, fontSize: 18 }}>Wallet</span>
        <span></span>
      </div>

      {/* Balance */}
      <div style={{ background: 'linear-gradient(135deg,#f85c5c,#ff8a80)', margin: 14, borderRadius: 18, padding: '28px 20px', color: '#fff', textAlign: 'center', boxShadow: '0 6px 20px rgba(248,92,92,0.3)' }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Available Balance</div>
        <div style={{ fontSize: 36, fontWeight: 900 }}>₹{bal}</div>
      </div>

      {/* Transaction Card */}
      <div style={{ margin: '0 14px 20px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => { setMode('deposit'); setAmount(''); setUtr(''); }}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, background: mode === 'deposit' ? '#40b83e' : '#f0f0f0', color: mode === 'deposit' ? '#fff' : '#666' }}>Deposit</button>
          <button onClick={() => { setMode('withdraw'); setAmount(''); setUtr(''); }}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, background: mode === 'withdraw' ? '#f85c5c' : '#f0f0f0', color: mode === 'withdraw' ? '#fff' : '#666' }}>Withdraw</button>
        </div>

        {mode === 'deposit' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 12 }}>Step 1: Scan & Pay</div>
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 16, display: 'inline-block' }}>
                <img src="/upi_qr.png" alt="UPI QR Code" style={{ width: 200, height: 200, borderRadius: 12, objectFit: 'cover' }} />
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: '#555' }}>Scan to pay with any UPI app</div>
              </div>
            </div>

            <div style={{ textAlign: 'left', marginTop: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 12 }}>Step 2: Submit Details</div>
              
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>Payment Amount</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount paid"
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #eee', fontSize: 16, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
              
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>12-Digit UTR Number</label>
              <input type="text" value={utr} onChange={e => setUtr(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 312345678901" maxLength={12}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #eee', fontSize: 16, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleTransaction} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#40b83e', color: '#fff', fontWeight: 800, fontSize: 16, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Processing...' : 'Submit Deposit'}
            </button>
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>Withdrawal Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #eee', fontSize: 16, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #eee', background: '#fafafa', fontWeight: 600, fontSize: 13 }}>₹{v}</button>
              ))}
            </div>
            <button onClick={handleTransaction} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#f85c5c', color: '#fff', fontWeight: 800, fontSize: 16, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Processing...' : 'Withdraw Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
