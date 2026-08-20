import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { LogOut, Play, Square, RefreshCw, Download, Users, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const parseExpiryTime = (dateStr) => {
  if (!dateStr) return 0;
  if (typeof dateStr !== 'string') return new Date(dateStr).getTime();
  if (dateStr.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
    return new Date(dateStr).getTime();
  }
  return new Date(dateStr + 'Z').getTime();
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [session, setSession] = useState(null);
  const [otp, setOtp] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCurrentSession = async () => {
    try {
      const res = await api.get('/admin/session/current');
      if (res.data.session) {
        setSession(res.data.session);
        if (res.data.otp && res.data.otp.status === 'ACTIVE') {
          setOtp(res.data.otp);
          const expiresAt = parseExpiryTime(res.data.otp.expires_at);
          const now = new Date().getTime();
          setCountdown(Math.max(0, Math.floor((expiresAt - now) / 1000)));
        } else {
          setOtp(null);
        }
      } else {
        setSession(null);
        setOtp(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/admin/session/attendance');
      setAttendance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCurrentSession();
    fetchAttendance();
    setLoading(false);
    
    const interval = setInterval(() => {
      fetchAttendance(); // refresh attendance every 10s
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otp && countdown === 0) {
      fetchCurrentSession(); // refresh session if OTP expires
    }
  }, [countdown, otp]);

  const startSession = async () => {
    try {
      await api.post('/admin/session/start');
      fetchCurrentSession();
    } catch (err) {
      alert("Error starting session: " + (err.response?.data?.detail || err.message));
    }
  };

  const endSession = async () => {
    try {
      await api.post('/admin/session/end');
      setSession(null);
      setOtp(null);
      setCountdown(0);
    } catch (err) {
      console.error(err);
    }
  };

  const generateOtp = async () => {
    try {
      const res = await api.post('/admin/session/generate-otp');
      setOtp({
        code: res.data.otp_code,
        expires_at: res.data.expires_at,
        status: res.data.status
      });
      const expiresAt = parseExpiryTime(res.data.expires_at);
      const now = new Date().getTime();
      setCountdown(Math.max(0, Math.floor((expiresAt - now) / 1000)));
    } catch (err) {
      alert("Error generating OTP: " + (err.response?.data?.detail || err.message));
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/session/attendance/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] bg-grid-pattern flex flex-col text-zinc-900 font-sans">
      <nav className="bg-white/90 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-mono font-black text-lg shadow-sm border border-zinc-800">
            A
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-black tracking-tight">Admin Dashboard</h1>
              <span className="bg-zinc-100 text-zinc-700 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-zinc-200">PRO</span>
            </div>
            <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center space-x-2 text-zinc-700 hover:text-black hover:bg-zinc-100 transition-all bg-white border border-zinc-200 px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-xs">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </nav>

      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Controls & OTP */}
        <div className="space-y-6 lg:col-span-1">
          {/* Status Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 flex flex-col relative overflow-hidden">
            <h2 className="text-base font-black uppercase tracking-wider text-black mb-4">Session Control</h2>
            
            {!session ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-zinc-100 border border-zinc-200 p-4 rounded-2xl mb-4 text-zinc-400">
                  <Square size={28} />
                </div>
                <p className="text-zinc-500 text-sm mb-6">No active attendance session.</p>
                <button onClick={startSession} className="w-full flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 active:scale-[0.99] text-white px-6 py-3.5 rounded-xl shadow-md transition-all font-bold text-sm">
                  <Play size={18} />
                  <span>Start New Session</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <span className="px-3 py-1 bg-black text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded-full flex items-center shadow-xs">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                    ACTIVE
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200">Session #{session}</span>
                </div>

                {!otp ? (
                  <button onClick={generateOtp} className="w-full bg-black hover:bg-zinc-800 active:scale-[0.99] text-white px-6 py-4 rounded-xl shadow-lg transition-all font-bold flex items-center justify-center space-x-2 mb-4">
                    <RefreshCw size={18} />
                    <span>Generate OTP</span>
                  </button>
                ) : (
                  <div className="bg-black rounded-2xl p-6 text-center text-white mb-4 shadow-2xl border border-zinc-800 transform transition">
                    <p className="text-zinc-400 text-xs font-mono uppercase tracking-[0.2em] mb-2 font-semibold">Active Passcode</p>
                    <h1 className="text-6xl font-black font-mono tracking-[0.2em] mb-4 text-white">{otp.code}</h1>
                    <div className="flex items-center justify-center space-x-2 bg-zinc-900/90 border border-zinc-700/80 py-2 px-4 rounded-xl backdrop-blur-md w-fit mx-auto text-zinc-200">
                      <Clock size={16} className="text-zinc-400" />
                      <span className="font-mono text-base font-bold tracking-wider">{formatTime(countdown)}</span>
                    </div>
                    {countdown === 0 && (
                      <p className="text-red-300 bg-red-950/70 border border-red-800/60 mt-3 font-mono font-bold py-1 px-3 rounded-lg text-xs uppercase tracking-wider">OTP EXPIRED</p>
                    )}
                  </div>
                )}
                
                {otp && (
                  <button onClick={generateOtp} className="w-full bg-white border-2 border-black text-black hover:bg-zinc-100 px-6 py-3 rounded-xl transition-all font-bold text-sm mb-3">
                    Generate New OTP
                  </button>
                )}

                <button onClick={endSession} className="w-full flex items-center justify-center space-x-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 px-6 py-3 rounded-xl transition-all font-bold text-sm">
                  <Square size={16} />
                  <span>End Session</span>
                </button>
              </div>
            )}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 flex flex-col items-center text-center">
              <div className="bg-zinc-100 p-2.5 rounded-xl text-black border border-zinc-200 mb-2.5"><Users size={20} /></div>
              <p className="text-3xl font-black font-mono text-black">{attendance.length}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">Present Today</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 flex flex-col items-center text-center">
              <div className="bg-zinc-100 p-2.5 rounded-xl text-black border border-zinc-200 mb-2.5"><CheckCircle size={20} /></div>
              <p className="text-3xl font-black font-mono text-black">
                {attendance.length > 0 ? "100%" : "0%"}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">Success Rate</p>
            </div>
          </div>
        </div>

        {/* Right Column - Attendance Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 flex flex-col lg:col-span-2 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-black">Attendance Records</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Live feed of verified participants</p>
            </div>
            <button onClick={handleExport} className="flex items-center space-x-2 bg-black hover:bg-zinc-800 text-white px-4 py-2 rounded-xl shadow-xs transition-all font-mono font-bold text-xs uppercase tracking-wider">
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[11px] font-mono uppercase tracking-wider text-zinc-600 font-bold">
                  <th className="p-4 pl-6">Student</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Session</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-zinc-400 font-mono text-xs">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  attendance.map((record, index) => (
                    <tr key={index} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-zinc-900">{record.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{record.email}</div>
                      </td>
                      <td className="p-4 text-xs text-zinc-600 font-mono">{record.date}</td>
                      <td className="p-4 text-xs font-mono font-semibold text-zinc-700">{record.time}</td>
                      <td className="p-4 text-xs">
                        <span className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded font-mono font-medium">{record.session}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-white">
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
