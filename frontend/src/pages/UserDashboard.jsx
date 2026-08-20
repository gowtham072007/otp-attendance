import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { LogOut, CheckCircle, AlertCircle, History } from 'lucide-react';

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance/my-history');
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (index, e) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    // Handle pasting
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) newOtp[index + i] = pastedData[i];
      }
      setOtp(newOtp);
      // focus last filled or end
      const focusIndex = Math.min(index + pastedData.length, 5);
      inputRefs[focusIndex].current.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value !== '' && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const submitAttendance = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setStatus({ type: 'error', message: 'Please enter a 6-digit OTP.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });
    
    try {
      const res = await api.post('/attendance/mark', { otp_code: otpCode });
      setStatus({ type: 'success', message: res.data.message });
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current.focus();
      fetchHistory(); // refresh history
    } catch (err) {
      setStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to mark attendance.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] bg-grid-pattern font-sans text-zinc-900 flex flex-col">
      <nav className="bg-white/90 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          {user.picture ? (
            <img src={user.picture} alt="Profile" className="w-10 h-10 rounded-xl border border-zinc-200 shadow-xs object-cover" />
          ) : (
            <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-mono font-black text-lg shadow-sm border border-zinc-800">
              {user.full_name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <h1 className="text-base font-black text-black tracking-tight">Hello, {user.full_name}</h1>
            <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center space-x-2 text-zinc-700 hover:text-black hover:bg-zinc-100 transition-all bg-white border border-zinc-200 px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-xs">
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 p-4 w-full grid gap-8 md:grid-cols-5 flex-1">
        
        {/* Left Column - Mark Attendance */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-mono uppercase tracking-wider rounded-full mb-3">
              <span>● Attendance Check-in</span>
            </div>
            <h2 className="text-2xl font-black text-black tracking-tight mb-1">Enter Active OTP</h2>
            <p className="text-zinc-500 text-sm mb-8">Enter the 6-digit dynamic passcode displayed on the screen.</p>
            
            {status.message && (
              <div className={`p-4 rounded-2xl mb-8 flex items-start space-x-3 text-sm font-medium ${status.type === 'success' ? 'bg-zinc-100 text-zinc-900 border border-zinc-300' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {status.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5 text-black" size={18} /> : <AlertCircle className="shrink-0 mt-0.5" size={18} />}
                <p>{status.message}</p>
              </div>
            )}

            <div className="flex justify-center gap-2 sm:gap-3.5 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 sm:w-14 sm:h-18 text-center text-2xl sm:text-3xl font-black font-mono rounded-2xl border-2 border-zinc-200 bg-zinc-50/70 text-zinc-900 focus:bg-white focus:border-black focus:ring-4 focus:ring-zinc-100 transition-all outline-none"
                />
              ))}
            </div>

            <button
              onClick={submitAttendance}
              disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-sm tracking-wider uppercase font-mono shadow-md transition-all active:scale-[0.99] bg-black hover:bg-zinc-800 text-white disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Verifying OTP...' : 'Submit Attendance'}
            </button>
          </div>
        </div>

        {/* Right Column - History */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 h-full flex flex-col overflow-hidden">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex items-center space-x-2">
              <History className="text-zinc-600" size={18} />
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-black">My Check-in Log</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-mono">
                  No attendance records found yet.
                </div>
              ) : (
                history.map((record, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-zinc-50/70 rounded-2xl border border-zinc-200 hover:bg-zinc-100/70 transition-colors">
                    <div>
                      <p className="font-bold text-zinc-900 text-xs font-mono">{record.date}</p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{record.session}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-white mb-1">
                        {record.status}
                      </span>
                      <p className="text-xs text-zinc-500 font-mono">{record.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default UserDashboard;
