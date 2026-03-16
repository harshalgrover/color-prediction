import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload: any = { username, email, password };
      if (referralCode.trim()) {
        payload.referralCode = referralCode.trim().toUpperCase();
      }
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/register`, payload);
      login(data);
      toast.success('Account created! ₹100,000 bonus added!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: '2px solid #eee', background: '#fafafa', fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#f85c5c', paddingBottom: 50 }}>
      <div style={{ textAlign: 'center', padding: '36px 0 46px' }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: '-1px', textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>🎰 color69</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 8, fontWeight: 500 }}>Join now & get ₹100,000 welcome bonus!</div>
      </div>
      <div style={{ margin: '0 auto', width: '88%', maxWidth: 400, background: '#fff', borderRadius: 20, padding: '32px 24px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#333', marginBottom: 4 }}>Create Account</h2>
        <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginBottom: 28 }}>Start your winning journey</p>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Username</label>
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" style={inp} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" style={inp} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Create password"
              style={{ ...inp, marginBottom: 0, paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: 0 }}>
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6 }}>Referral Code (Optional)</label>
          <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)} placeholder="Got an invite code?" style={{ ...inp, textTransform: 'uppercase' }} />
          <button type="submit" disabled={isLoading}
            style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f85c5c,#ff6b6b)', color: '#fff', fontSize: 16, fontWeight: 800, boxShadow: '0 6px 18px rgba(248,92,92,0.3)', opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Creating...' : 'Sign Up & Claim Bonus →'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#888' }}>
          Already have an account? <Link to="/login" style={{ color: '#f85c5c', fontWeight: 700 }}>Log In</Link>
        </p>
      </div>
    </div>
  );
}
