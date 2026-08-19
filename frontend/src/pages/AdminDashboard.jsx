import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { LogOut, Play, Square, RefreshCw, Download, Users, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

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
          const expiresAt = new Date(res.data.otp.expires_at + 'Z').getTime();
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
      const expiresAt = new Date(res.data.expires_at + 'Z').getTime();
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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-md">
            A
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors bg-gray-100 hover:bg-red-50 px-4 py-2 rounded-lg font-medium">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </nav>

      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Controls & OTP */}
        <div className="space-y-6 lg:col-span-1">
          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            
            <h2 className="text-lg font-semibold text-gray-800 mb-4 z-10">Session Control</h2>
            
            {!session ? (
              <div className="flex flex-col items-center justify-center py-6 z-10">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <Square size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500 mb-6 text-center">No active attendance session.</p>
                <button onClick={startSession} className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-md transition-all font-medium">
                  <Play size={20} />
                  <span>Start New Session</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col z-10">
                <div className="flex justify-between items-center mb-6">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    ACTIVE
                  </span>
                  <span className="text-sm font-medium text-gray-500">Session #{session}</span>
                </div>

                {!otp ? (
                  <button onClick={generateOtp} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl shadow-md transition-all font-semibold flex items-center justify-center space-x-2 mb-4">
                    <RefreshCw size={20} />
                    <span>Generate OTP</span>
                  </button>
                ) : (
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-center text-white mb-4 shadow-lg transform transition hover:scale-[1.02]">
                    <p className="text-indigo-100 text-sm font-medium mb-1 uppercase tracking-widest">Current OTP</p>
                    <h1 className="text-6xl font-black tracking-widest mb-4 drop-shadow-md">{otp.code}</h1>
                    <div className="flex items-center justify-center space-x-2 bg-white/20 py-2 px-4 rounded-lg backdrop-blur-sm w-fit mx-auto">
                      <Clock size={16} />
                      <span className="font-mono text-lg font-semibold">{formatTime(countdown)}</span>
                    </div>
                    {countdown === 0 && (
                      <p className="text-red-200 mt-3 font-bold bg-red-900/40 py-1 px-3 rounded-md text-sm">OTP EXPIRED</p>
                    )}
                  </div>
                )}
                
                {otp && (
                  <button onClick={generateOtp} className="w-full bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl transition-all font-medium mb-4">
                    Generate New OTP
                  </button>
                )}

                <button onClick={endSession} className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-3 rounded-xl transition-all font-medium">
                  <Square size={18} />
                  <span>End Session</span>
                </button>
              </div>
            )}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600 mb-3"><Users size={24} /></div>
              <p className="text-3xl font-bold text-gray-800">{attendance.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Present Today</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="bg-green-100 p-3 rounded-xl text-green-600 mb-3"><CheckCircle size={24} /></div>
              <p className="text-3xl font-bold text-gray-800">
                {attendance.length > 0 ? "100%" : "0%"}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Success Rate</p>
            </div>
          </div>
        </div>

        {/* Right Column - Attendance Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:col-span-2 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Attendance Records</h2>
              <p className="text-sm text-gray-500">Live feed of students marking attendance</p>
            </div>
            <button onClick={handleExport} className="flex items-center space-x-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm transition-all font-medium text-sm">
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="p-4 pl-6">Student</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Session</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  attendance.map((record, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-medium text-gray-800">{record.name}</div>
                        <div className="text-xs text-gray-500">{record.email}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{record.date}</td>
                      <td className="p-4 text-sm font-mono text-gray-600">{record.time}</td>
                      <td className="p-4 text-sm text-gray-600">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{record.session}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
