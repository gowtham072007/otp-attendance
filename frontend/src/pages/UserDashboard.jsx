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
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          {user.picture ? (
            <img src={user.picture} alt="Profile" className="w-10 h-10 rounded-full border-2 border-blue-100 shadow-sm" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-md">
              {user.full_name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-800">Hello, {user.full_name}</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors bg-gray-100 hover:bg-red-50 px-4 py-2 rounded-lg font-medium">
          <LogOut size={18} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 p-4 grid gap-8 md:grid-cols-5">
        
        {/* Left Column - Mark Attendance */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Mark Attendance</h2>
            <p className="text-gray-500 mb-8">Enter the 6-digit OTP displayed by your admin on the screen.</p>
            
            {status.message && (
              <div className={`p-4 rounded-xl mb-8 flex items-start space-x-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {status.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <p className="font-medium text-sm">{status.message}</p>
              </div>
            )}

            <div className="flex justify-center gap-2 sm:gap-4 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 sm:w-16 sm:h-20 text-center text-2xl sm:text-4xl font-bold rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                />
              ))}
            </div>

            <button
              onClick={submitAttendance}
              disabled={submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all ${
                submitting 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
              }`}
            >
              {submitting ? 'Verifying...' : 'Submit Attendance'}
            </button>
          </div>
        </div>

        {/* Right Column - History */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center space-x-2">
              <History className="text-gray-400" size={20} />
              <h3 className="font-bold text-gray-800">My History</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No attendance records found yet.
                </div>
              ) : (
                history.map((record, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-blue-50/30 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{record.date}</p>
                      <p className="text-xs text-gray-500 mt-1">{record.session}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                        {record.status}
                      </span>
                      <p className="text-xs text-gray-500 font-mono">{record.time}</p>
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
