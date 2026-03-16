import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

interface Withdrawal { _id: string; userId: string; amount: number; status: string }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') fetchWithdrawals();
  }, [user]);

  const fetchWithdrawals = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/withdrawals`, { headers: { Authorization: `Bearer ${user?.token}` } });
      setWithdrawals(data || []);
    } catch { /* ignore */ }
  };

  const handle = async (id: string, action: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin/withdrawals/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${user?.token}` } });
      toast.success(`Withdrawal ${action}d`);
      fetchWithdrawals();
    } catch { toast.error('Action failed'); }
  };

  if (user?.role !== 'admin') return <div style={{ padding: 40, textAlign: 'center' }}>Access denied</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#f85c5c', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <Link to="/" style={{ color: '#fff', fontWeight: 700 }}>← Back</Link>
        <span style={{ fontWeight: 800, fontSize: 18 }}>Admin Panel</span>
        <span></span>
      </div>
      <div style={{ padding: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Pending Withdrawals</h3>
        {withdrawals.length === 0 ? (
          <div style={{ background: '#fff', padding: 30, borderRadius: 12, textAlign: 'center', color: '#999' }}>No pending requests</div>
        ) : withdrawals.map(w => (
          <div key={w._id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: 700 }}>₹{w.amount}</div><div style={{ fontSize: 12, color: '#999' }}>{w.userId}</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handle(w._id, 'approve')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#40b83e', color: '#fff', fontWeight: 700, fontSize: 12 }}>Approve</button>
              <button onClick={() => handle(w._id, 'reject')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#d32f2f', color: '#fff', fontWeight: 700, fontSize: 12 }}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
