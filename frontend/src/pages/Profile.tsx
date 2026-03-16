import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [saving, setSaving] = useState(false);

  // Password state
  const [showPassSection, setShowPassSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Referral
  const referralCode = (user as any)?.referralCode || '';
  const referralCount = (user as any)?.referralCount || 0;
  const referralEarnings = (user as any)?.referralEarnings || 0;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API_BASE_URL}/api/profile/update`,
        { username, phone },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      // Update local user
      const updated = { ...user!, username: data.username || user!.username, phone: data.phone || phone };
      setUser(updated);
      localStorage.setItem('userInfo', JSON.stringify(updated));
      toast.success('Profile updated!');
      setEditMode(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords don\'t match');
    }
    if (newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setChangingPass(true);
    try {
      await axios.put(`${API_BASE_URL}/api/profile/password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      toast.success('Password changed!');
      setShowPassSection(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setChangingPass(false);
    }
  };

  const handleShare = async () => {
    const shareText = `🎰 Join color69 and get ₹100,500 welcome bonus! Use my referral code: ${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'color69 — Color Prediction', text: shareText });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(referralCode);
      toast.success('Referral code copied!');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode);
    toast.success('Code copied to clipboard!');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Avatar from initials
  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '2px solid #eee', fontSize: 14, outline: 'none',
    background: '#fafafa', boxSizing: 'border-box', marginBottom: 12,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f85c5c, #ff8a80)',
        padding: '16px 16px 40px', textAlign: 'center', color: '#fff',
        borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Link to="/" style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>← Back</Link>
          <span style={{ fontWeight: 900, fontSize: 18 }}>My Profile</span>
          <span />
        </div>

        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px', fontSize: 28, fontWeight: 900, color: '#fff',
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.username}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{user?.email}</div>
      </div>

      {/* Balance Card */}
      <div style={{
        margin: '-20px 14px 14px', background: '#fff', borderRadius: 16,
        padding: '18px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-around', textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#333' }}>₹{(user?.coin_balance ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>Balance</div>
        </div>
        <div style={{ width: 1, background: '#eee' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#40b83e' }}>{referralCount}</div>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>Referrals</div>
        </div>
        <div style={{ width: 1, background: '#eee' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f85c5c' }}>₹{referralEarnings}</div>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>Ref. Earned</div>
        </div>
      </div>

      {/* Profile Info / Edit */}
      <div style={{ margin: '0 14px 14px', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#333' }}>👤 Account Info</span>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none',
              background: editMode ? '#eee' : '#f85c5c', color: editMode ? '#666' : '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            {editMode ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editMode ? (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 4, display: 'block' }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 4, display: 'block' }}>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" style={inputStyle} />
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                width: '100%', padding: 13, borderRadius: 12, border: 'none',
                background: '#40b83e', color: '#fff', fontWeight: 800, fontSize: 14,
                opacity: saving ? 0.7 : 1, cursor: 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Username</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{user?.username}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Email</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Phone</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{phone || 'Not set'}</span>
            </div>
          </>
        )}
      </div>

      {/* Referral Section */}
      <div style={{ margin: '0 14px 14px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 16, padding: 20, color: '#fff', boxShadow: '0 4px 16px rgba(102,126,234,0.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>🎁 Refer & Earn ₹500</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 14, lineHeight: 1.5 }}>
          Share your code below. When a friend signs up with it, you both get ₹500 bonus!
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>{referralCode}</span>
          <button
            onClick={handleCopy}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.5)',
              background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12,
              cursor: 'pointer',
            }}
          >
            📋 Copy
          </button>
        </div>

        <button
          onClick={handleShare}
          style={{
            width: '100%', padding: 13, borderRadius: 12, border: 'none',
            background: '#fff', color: '#764ba2', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          📤 Share Invite Link
        </button>
      </div>

      {/* Password Section */}
      <div style={{ margin: '0 14px 14px', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <button
          onClick={() => setShowPassSection(!showPassSection)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#333' }}>🔒 Change Password</span>
          <span style={{ fontSize: 18, color: '#999' }}>{showPassSection ? '▲' : '▼'}</span>
        </button>

        {showPassSection && (
          <div style={{ marginTop: 16 }}>
            <input
              type="password" value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              style={inputStyle}
            />
            <input
              type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              style={inputStyle}
            />
            <input
              type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={inputStyle}
            />
            <button
              onClick={handleChangePassword}
              disabled={changingPass}
              style={{
                width: '100%', padding: 13, borderRadius: 12, border: 'none',
                background: '#f85c5c', color: '#fff', fontWeight: 800, fontSize: 14,
                opacity: changingPass ? 0.7 : 1, cursor: 'pointer',
              }}
            >
              {changingPass ? 'Changing...' : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Logout */}
      <div style={{ margin: '0 14px 20px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: '2px solid #eee',
            background: '#fff', color: '#d32f2f', fontWeight: 800, fontSize: 15,
            cursor: 'pointer',
          }}
        >
          🚪 Log Out
        </button>
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
        <Link to="/leaderboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#888', background: 'none', border: 'none' }}>🏆<span>Ranking</span></Link>
        <Link to="/profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#f85c5c', background: 'none', border: 'none' }}>👤<span>Profile</span></Link>
      </nav>
    </div>
  );
}
