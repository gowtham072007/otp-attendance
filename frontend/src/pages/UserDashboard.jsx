import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { LogOut, CheckCircle, AlertCircle, History, Clock, Lock, Radio, UserCheck, UserX } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import InstallAppButton from '../components/InstallAppButton';

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sessionStatus, setSessionStatus] = useState({
    loading: true,
    active_session: null,
    today_session: null,
    already_marked: false,
    my_record: null
  });
  const inputRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  const fetchSessionStatus = async () => {
    try {
      const res = await api.get('/attendance/session/status');
      setSessionStatus({
        loading: false,
        active_session: res.data.active_session,
        today_session: res.data.today_session,
        already_marked: res.data.already_marked,
        my_record: res.data.my_record
      });
    } catch (err) {
      console.error("Failed to fetch session status", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance/my-history');
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  useEffect(() => {
    fetchSessionStatus();
    fetchHistory();

    // Poll session status every 3 seconds for live transitions
    const timer = setInterval(() => {
      fetchSessionStatus();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

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
      setStatus({ type: 'error', message: 'Please enter the full 6-digit OTP.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });
    
    try {
      const res = await api.post('/attendance/mark', { otp_code: otpCode });
      setStatus({ type: 'success', message: res.data.message });
      setOtp(['', '', '', '', '', '']);
      await fetchSessionStatus();
      await fetchHistory();
    } catch (err) {
      setStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to mark attendance.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isActiveSession = Boolean(sessionStatus.active_session);
  const isAlreadyMarked = sessionStatus.already_marked;
  const isTodayCompleted = !isActiveSession && Boolean(sessionStatus.today_session && sessionStatus.today_session.status === 'CLOSED');
  const isNoSession = !isActiveSession && !sessionStatus.today_session;


  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      <nav className="bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center shrink-0">
            <img src="/logo-transparent.png" alt="Attendance OS" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-black text-black dark:text-white tracking-tight">Hello, {user.full_name}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <InstallAppButton />
          <ThemeToggle />
          <button onClick={logout} className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-xs">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 p-4 w-full grid gap-8 md:grid-cols-5 flex-1">
        
        {/* Left Column - Attendance Status & OTP Check-in */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white dark:bg-zinc-900/90 p-8 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            
            {/* Status alerts */}
            {status.message && (
              <div className={`p-4 rounded-2xl mb-6 flex items-start space-x-3 text-sm font-medium ${
                status.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/60' 
                  : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50'
              }`}>
                {status.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" size={18} /> : <AlertCircle className="shrink-0 mt-0.5" size={18} />}
                <p>{status.message}</p>
              </div>
            )}

            {/* CASE 1: Active Session & User has NOT marked attendance -> SHOW OTP INPUTS */}
            {isActiveSession && !isAlreadyMarked && (
              <div>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono uppercase tracking-wider rounded-full mb-3">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span>Session #{sessionStatus.active_session.id} Active</span>
                </div>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-1">Enter Active OTP</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">Enter the 6-digit dynamic passcode displayed on the screen.</p>

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
                      className="w-12 h-14 sm:w-14 sm:h-18 text-center text-2xl sm:text-3xl font-black font-mono rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 transition-all outline-none"
                    />
                  ))}
                </div>

                <button
                  onClick={submitAttendance}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-bold text-sm tracking-wider uppercase font-mono shadow-md transition-all active:scale-[0.99] bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Verifying OTP...' : 'Submit Attendance'}
                </button>
              </div>
            )}

            {/* CASE 2: Active Session & User ALREADY marked attendance -> DO NOT SHOW OTP */}
            {isActiveSession && isAlreadyMarked && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-bold uppercase tracking-wider rounded-full mb-5">
                  <CheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Attendance Recorded</span>
                </div>

                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
                  <UserCheck size={32} />
                </div>

                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-2">
                  You're Marked Present!
                </h2>
                <p className="text-zinc-600 dark:text-zinc-300 text-sm max-w-sm mb-4">
                  Your attendance for <strong className="text-black dark:text-white font-mono">Session #{sessionStatus.active_session.id}</strong> was verified successfully.
                </p>

                {sessionStatus.my_record && (
                  <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-2xl font-mono text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                    <p><span className="text-zinc-400">Time (IST):</span> <strong>{sessionStatus.my_record.time}</strong></p>
                    <p><span className="text-zinc-400">Date (IST):</span> <strong>{sessionStatus.my_record.date}</strong></p>
                  </div>
                )}
              </div>
            )}

            {/* CASE 3: Session Concluded / Ended for today -> DO NOT SHOW OTP */}
            {isTodayCompleted && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono font-bold uppercase tracking-wider rounded-full mb-5">
                  <Lock size={12} />
                  <span>Session Concluded</span>
                </div>

                {isAlreadyMarked ? (
                  <>
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
                      <UserCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-2">
                      Attendance Session Ended
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm max-w-sm mb-4">
                      Today's session is closed. You were marked <strong className="text-emerald-600 dark:text-emerald-400">Present</strong> at {sessionStatus.my_record?.time || 'check-in'}.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
                      <UserX size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-2">
                      Attendance Session Closed
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm max-w-sm mb-2">
                      Today's attendance session has ended. You did not submit the OTP and are recorded as <strong className="text-rose-600 dark:text-rose-400">Absent</strong>.
                    </p>
                    <p className="text-zinc-400 dark:text-zinc-500 text-xs font-mono">
                      Policy: Maximum 1 session per day.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* CASE 4: No Session Started Yet Today -> DO NOT SHOW OTP */}
            {isNoSession && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-mono font-bold uppercase tracking-wider rounded-full mb-5">
                  <Clock size={12} />
                  <span>No Active Session</span>
                </div>

                <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800/80 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4">
                  <Radio size={28} className="animate-pulse" />
                </div>

                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-2">
                  Waiting for Session to Start
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm">
                  The admin has not started today's attendance session yet. When the session goes live, the OTP passcode box will appear here automatically.
                </p>
              </div>
            )}

          </div>
        </div>


        {/* Right Column - History */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-full flex flex-col overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center space-x-2">
              <History className="text-zinc-600 dark:text-zinc-400" size={18} />
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-black dark:text-white">My Check-in Log</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-600 text-xs font-mono">
                  No attendance records found yet.
                </div>
              ) : (
                history.map((record, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-zinc-50/70 dark:bg-zinc-950/50 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs font-mono">{record.date}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{record.session}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-white dark:bg-white dark:text-black mb-1">
                        {record.status}
                      </span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{record.time}</p>
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

