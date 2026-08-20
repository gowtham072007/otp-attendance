import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { 
  LogOut, 
  Play, 
  Square, 
  RefreshCw, 
  Download, 
  Users, 
  CheckCircle, 
  Clock, 
  Mail, 
  UserPlus, 
  Trash2, 
  Search, 
  Plus, 
  Radio, 
  Check, 
  AlertCircle,
  XCircle,
  UserCheck,
  UserX,
  Copy,
  Calendar
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const parseExpiryTime = (dateStr) => {
  if (!dateStr) return 0;
  if (typeof dateStr !== 'string') return new Date(dateStr).getTime();
  if (dateStr.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
    return new Date(dateStr).getTime();
  }
  return new Date(dateStr + 'Z').getTime();
};

const formatISTDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm} IST`;
  } catch {
    return dateStr;
  }
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'whitelist'
  const [session, setSession] = useState(null);
  const [otp, setOtp] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentISTTime, setCurrentISTTime] = useState('');

  // Attendance & Sessions state
  const [attendanceReport, setAttendanceReport] = useState({
    session: null,
    summary: { total: 0, present: 0, absent: 0, rate: '0%' },
    records: [],
    present_list: [],
    absent_list: []
  });
  const [allSessions, setAllSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [attendanceFilter, setAttendanceFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [sessionEndedMessage, setSessionEndedMessage] = useState(null);
  const [copiedAbsent, setCopiedAbsent] = useState(false);

  const [todaySession, setTodaySession] = useState(null);
  const [todayCompleted, setTodayCompleted] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);

  // Whitelist state
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState('');
  const [whitelistError, setWhitelistError] = useState('');

  // Live IST Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      try {
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        setCurrentISTTime(formatter.format(now).replace(',', '') + ' IST');
      } catch {
        setCurrentISTTime(now.toLocaleTimeString() + ' IST');
      }
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const fetchCurrentSession = async () => {
    try {
      const res = await api.get('/admin/session/current');
      if (res.data.today_session) {
        setTodaySession(res.data.today_session);
      } else {
        setTodaySession(null);
      }
      setTodayCompleted(Boolean(res.data.today_completed));

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
      console.error("Failed to fetch current session", err);
    }
  };

  const fetchAttendance = async (sessionId = null) => {
    try {
      const url = sessionId ? `/admin/session/attendance?session_id=${sessionId}` : '/admin/session/attendance';
      const res = await api.get(url);
      if (res.data) {
        setAttendanceReport(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch attendance", err);
    }
  };

  const fetchAllSessions = async () => {
    try {
      const res = await api.get('/admin/sessions');
      setAllSessions(res.data);
    } catch (err) {
      console.error("Failed to fetch sessions list", err);
    }
  };

  const fetchAllowedEmails = async () => {
    try {
      const res = await api.get('/admin/allowed-emails');
      setAllowedEmails(res.data);
    } catch (err) {
      console.error("Failed to fetch allowed emails", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchCurrentSession(), 
        fetchAttendance(), 
        fetchAllSessions(),
        fetchAllowedEmails()
      ]);
      setLoading(false);
    };
    init();

    const interval = setInterval(() => {
      fetchAttendance(selectedSessionId);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otp && countdown === 0) {
      fetchCurrentSession();
    }
  }, [countdown, otp]);

  const startSession = async () => {
    try {
      setSessionEndedMessage(null);
      const res = await api.post('/admin/session/start');
      setSession(res.data.id);
      setSelectedSessionId(res.data.id);
      setAttendanceFilter('ALL');
      await fetchCurrentSession();
      await fetchAttendance(res.data.id);
      await fetchAllSessions();
    } catch (err) {
      alert("Cannot Start Session: " + (err.response?.data?.detail || err.message));
    }
  };

  const endSession = async () => {
    try {
      const res = await api.post('/admin/session/end');
      const endedId = session;
      setSession(null);
      setOtp(null);
      setCountdown(0);
      setTodayCompleted(true);
      
      if (res.data.report) {
        setAttendanceReport(res.data.report);
        setSessionEndedMessage({
          id: endedId,
          present: res.data.report.summary.present,
          absent: res.data.report.summary.absent,
          total: res.data.report.summary.total,
          rate: res.data.report.summary.rate,
          absent_list: res.data.report.absent_list || [],
          present_list: res.data.report.present_list || []
        });
      }
      await fetchCurrentSession();
      await fetchAllSessions();
    } catch (err) {
      console.error("Error ending session", err);
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
      const url = selectedSessionId 
        ? `/admin/session/attendance/export?session_id=${selectedSessionId}` 
        : '/admin/session/attendance/export';
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const sessionLabel = selectedSessionId ? `Session_${selectedSessionId}` : 'Attendance';
      link.setAttribute('download', `attendance_${sessionLabel}_IST.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAllAttendance = async () => {
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to permanently DELETE ALL attendance records and sessions?\n\nThis will clear all past attendance history and allow a new session to be started. This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      const res = await api.delete('/admin/attendance/all');
      alert(res.data.message || "All attendance records deleted successfully.");
      setSession(null);
      setOtp(null);
      setTodayCompleted(false);
      setTodaySession(null);
      setSessionEndedMessage(null);
      setSelectedSessionId(null);
      await Promise.all([
        fetchCurrentSession(),
        fetchAttendance(),
        fetchAllSessions()
      ]);
    } catch (err) {
      alert("Failed to delete attendance records: " + (err.response?.data?.detail || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSelectSession = (e) => {
    const val = e.target.value;
    const id = val ? parseInt(val, 10) : null;
    setSelectedSessionId(id);
    fetchAttendance(id);
  };


  const handleCopyAbsentEmails = () => {
    const absentList = attendanceReport.absent_list || [];
    if (absentList.length === 0) return;
    const emails = absentList.map(s => s.email).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedAbsent(true);
    setTimeout(() => setCopiedAbsent(false), 3000);
  };

  // Whitelist Actions
  const handleAddSingleEmail = async (e) => {
    e.preventDefault();
    setWhitelistError('');
    setWhitelistSuccess('');

    if (!newEmail.trim()) {
      setWhitelistError('Email address is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post('/admin/allowed-emails', {
        email: newEmail.trim(),
        name: newName.trim() || undefined
      });
      setAllowedEmails([res.data, ...allowedEmails]);
      setNewEmail('');
      setNewName('');
      setWhitelistSuccess(`Added ${res.data.email} successfully.`);
      fetchAttendance(selectedSessionId);
      setTimeout(() => setWhitelistSuccess(''), 4000);
    } catch (err) {
      setWhitelistError(err.response?.data?.detail || 'Failed to add email');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBulkEmails = async (e) => {
    e.preventDefault();
    setWhitelistError('');
    setWhitelistSuccess('');

    const emailList = bulkEmails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length === 0) {
      setWhitelistError('Please enter at least one email address.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post('/admin/allowed-emails/bulk', {
        emails: emailList
      });
      setWhitelistSuccess(res.data.message);
      setBulkEmails('');
      setShowBulkInput(false);
      fetchAllowedEmails();
      fetchAttendance(selectedSessionId);
      setTimeout(() => setWhitelistSuccess(''), 5000);
    } catch (err) {
      setWhitelistError(err.response?.data?.detail || 'Failed to bulk add emails');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllowedEmail = async (id, email) => {
    if (!window.confirm(`Are you sure you want to remove '${email}' from authorized logins?`)) {
      return;
    }
    setWhitelistError('');
    setWhitelistSuccess('');

    try {
      await api.delete(`/admin/allowed-emails/${id}`);
      setAllowedEmails(allowedEmails.filter((item) => item.id !== id));
      setWhitelistSuccess(`Removed ${email}`);
      fetchAttendance(selectedSessionId);
      setTimeout(() => setWhitelistSuccess(''), 4000);
    } catch (err) {
      setWhitelistError(err.response?.data?.detail || 'Failed to remove email');
    }
  };

  // Filtered Whitelist Emails
  const filteredWhitelistEmails = allowedEmails.filter((item) => {
    const q = searchQuery.toLowerCase();
    return item.email.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q));
  });

  // Filtered Attendance Records (Present / Absent)
  const filteredAttendanceRecords = attendanceReport.records.filter((rec) => {
    if (attendanceFilter === 'PRESENT' && rec.status !== 'Present') return false;
    if (attendanceFilter === 'ABSENT' && rec.status !== 'Absent') return false;
    
    if (attendanceSearch.trim()) {
      const q = attendanceSearch.toLowerCase();
      return rec.name.toLowerCase().includes(q) || rec.email.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-black dark:border-white border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern flex flex-col text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Top Navigation */}
      <nav className="bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-black text-white dark:bg-white dark:text-black rounded-xl flex items-center justify-center font-mono font-black text-lg shadow-sm border border-zinc-800 dark:border-zinc-200">
            A
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-black dark:text-white tracking-tight">Admin Dashboard</h1>
              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">PRO</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{user.email}</p>
          </div>
        </div>

        {/* Live IST Clock Header */}
        <div className="hidden lg:flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <Clock size={14} className="text-zinc-500" />
          <span className="font-bold">{currentISTTime}</span>
        </div>

        {/* Tab Controls in Header */}
        <div className="hidden sm:flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-x-1">
          <button
            onClick={() => setActiveTab('session')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'session'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Radio size={14} className={session ? "text-emerald-500 animate-pulse" : ""} />
            <span>Attendance & Sessions</span>
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'whitelist'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Mail size={14} />
            <span>Authorized Emails</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
              {allowedEmails.length}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <button 
            onClick={logout} 
            className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-xs"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Mobile Tab Switcher */}
      <div className="sm:hidden px-6 pt-4 flex space-x-2">
        <button
          onClick={() => setActiveTab('session')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border ${
            activeTab === 'session'
              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <Radio size={14} />
          <span>Sessions</span>
        </button>
        <button
          onClick={() => setActiveTab('whitelist')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border ${
            activeTab === 'whitelist'
              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <Mail size={14} />
          <span>Allowed Emails ({allowedEmails.length})</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        
        {/* TAB 1: Attendance & Session Control */}
        {activeTab === 'session' && (
          <div className="space-y-6">
            
            {/* Session Ended Summary Alert Banner */}
            {sessionEndedMessage && (
              <div className="bg-zinc-900 dark:bg-zinc-950 text-white rounded-3xl p-6 shadow-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                    <CheckCircle size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Session #{sessionEndedMessage.id} Ended (IST)</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Session closed. Final Present and Absent lists are displayed below.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 bg-zinc-800/80 px-5 py-3 rounded-2xl border border-zinc-700/60">
                  <div className="text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Present</p>
                    <p className="text-xl font-mono font-black text-emerald-400">{sessionEndedMessage.present}</p>
                  </div>
                  <div className="h-8 w-px bg-zinc-700"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Absent</p>
                    <p className="text-xl font-mono font-black text-rose-400">{sessionEndedMessage.absent}</p>
                  </div>
                  <div className="h-8 w-px bg-zinc-700"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Rate</p>
                    <p className="text-xl font-mono font-black text-white">{sessionEndedMessage.rate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* DEDICATED PRESENT & ABSENT STUDENT BREAKDOWN LISTS */}
            {attendanceReport.records && attendanceReport.records.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. PRESENT STUDENTS CARD */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-300 dark:border-emerald-800">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-black text-emerald-950 dark:text-emerald-200 tracking-tight">
                            Present Students List
                          </h3>
                          <span className="bg-emerald-200 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {attendanceReport.present_list?.length || 0} Present
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                          Verified check-ins for {attendanceReport.session ? `Session #${attendanceReport.session.id}` : 'this session'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setAttendanceFilter('PRESENT')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition border ${
                        attendanceFilter === 'PRESENT'
                          ? 'bg-emerald-800 text-white border-transparent'
                          : 'bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      Filter Table
                    </button>
                  </div>

                  {/* Present Student Chips/List */}
                  <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                    {attendanceReport.present_list && attendanceReport.present_list.length > 0 ? (
                      attendanceReport.present_list.map((student, idx) => (
                        <div 
                          key={idx}
                          className="bg-white dark:bg-zinc-900/90 border border-emerald-200 dark:border-emerald-900/60 p-3 rounded-2xl flex items-center justify-between shadow-xs"
                        >
                          <div className="overflow-hidden mr-2">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{student.name}</p>
                            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">{student.email}</p>
                          </div>
                          <div className="shrink-0 flex items-center space-x-2">
                            <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              {student.time}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-900 text-[10px] font-mono font-bold uppercase flex items-center space-x-1">
                              <Check size={10} className="stroke-[3]" />
                              <span>Present</span>
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs font-mono text-emerald-700/60 dark:text-emerald-400/60">
                        No students have checked in yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ABSENT STUDENTS CARD */}
                <div className="bg-rose-50/60 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-300 dark:border-rose-800">
                        <UserX size={20} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-black text-rose-950 dark:text-rose-200 tracking-tight">
                            Absent Students List
                          </h3>
                          <span className="bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {attendanceReport.absent_list?.length || 0} Absent
                          </span>
                        </div>
                        <p className="text-xs text-rose-700/80 dark:text-rose-400 mt-0.5">
                          Authorized students who did not check in
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCopyAbsentEmails}
                        className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition shadow-xs"
                      >
                        {copiedAbsent ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedAbsent ? 'Copied!' : 'Copy Emails'}</span>
                      </button>
                      <button
                        onClick={() => setAttendanceFilter('ABSENT')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition border ${
                          attendanceFilter === 'ABSENT'
                            ? 'bg-rose-800 text-white border-transparent'
                            : 'bg-white dark:bg-zinc-900 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        }`}
                      >
                        Filter Table
                      </button>
                    </div>
                  </div>

                  {/* Absent Student Chips/List */}
                  <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                    {attendanceReport.absent_list && attendanceReport.absent_list.length > 0 ? (
                      attendanceReport.absent_list.map((student, idx) => (
                        <div 
                          key={idx}
                          className="bg-white dark:bg-zinc-900/90 border border-rose-200 dark:border-rose-900/60 p-3 rounded-2xl flex items-center justify-between shadow-xs"
                        >
                          <div className="overflow-hidden mr-2">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{student.name}</p>
                            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">{student.email}</p>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[10px] font-mono font-bold uppercase flex items-center space-x-1">
                            <XCircle size={10} className="stroke-[2.5]" />
                            <span>Absent</span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs font-mono text-rose-700/60 dark:text-rose-400/60">
                        All authorized students are present! (0 absent)
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Controls & Stats */}
              <div className="space-y-6 lg:col-span-1">
                
                {/* Session Control Card */}
                <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Session Control</h2>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      1 Session / Day
                    </span>
                  </div>
                  
                  {/* CASE 1: No active session & today's session is already completed */}
                  {!session && todayCompleted && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 rounded-2xl mb-4 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle size={32} />
                      </div>
                      <span className="px-3 py-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-mono font-bold uppercase tracking-wider rounded-full mb-2">
                        TODAY'S SESSION COMPLETED
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-300 text-xs font-medium mb-1">
                        {todaySession ? `Session #${todaySession.id} concluded on ${todaySession.date} (IST).` : "Today's attendance session is closed."}
                      </p>
                      <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono mb-4">
                        Policy: Maximum 1 session per day. You can start the next session tomorrow.
                      </p>
                      <button 
                        disabled
                        className="w-full flex items-center justify-center space-x-2 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 px-6 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs font-mono uppercase tracking-wider cursor-not-allowed"
                      >
                        <Calendar size={16} />
                        <span>Completed For Today</span>
                      </button>
                    </div>
                  )}

                  {/* CASE 2: No active session & no session conducted yet today */}
                  {!session && !todayCompleted && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-2xl mb-4 text-zinc-400 dark:text-zinc-500">
                        <Play size={28} />
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 text-sm font-semibold mb-1">
                        Ready to Start Today's Attendance
                      </p>
                      <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-4">
                        One session can be generated today. Students will use the 7-second OTP to mark attendance.
                      </p>
                      <button 
                        onClick={startSession} 
                        className="w-full flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white px-6 py-3.5 rounded-xl shadow-md transition-all font-bold text-sm"
                      >
                        <Play size={18} />
                        <span>Start Today's Session</span>
                      </button>
                    </div>
                  )}

                  {/* CASE 3: Active session currently running */}
                  {session && (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <span className="px-3 py-1 bg-black text-white dark:bg-white dark:text-black text-[11px] font-mono font-bold uppercase tracking-wider rounded-full flex items-center shadow-xs">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                          ACTIVE
                        </span>
                        <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">Session #{session}</span>
                      </div>

                      {!otp ? (
                        <button 
                          onClick={generateOtp} 
                          className="w-full bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white px-6 py-4 rounded-xl shadow-lg transition-all font-bold flex items-center justify-center space-x-2 mb-4"
                        >
                          <RefreshCw size={18} />
                          <span>Generate OTP</span>
                        </button>
                      ) : (
                        <div className="bg-black dark:bg-zinc-950 rounded-2xl p-6 text-center text-white mb-4 shadow-2xl border border-zinc-800 transform transition">
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
                        <button 
                          onClick={generateOtp} 
                          className="w-full bg-white dark:bg-zinc-900 border-2 border-black dark:border-white text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 px-6 py-3 rounded-xl transition-all font-bold text-sm mb-3"
                        >
                          Generate New OTP
                        </button>
                      )}

                      <button 
                        onClick={endSession} 
                        className="w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 px-6 py-3.5 rounded-xl transition-all font-bold text-sm shadow-xs"
                      >
                        <Square size={16} />
                        <span>End Session & View Attendance</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats Summary Cards (Present, Absent, Total) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Present Card */}
                  <div 
                    onClick={() => setAttendanceFilter('PRESENT')}
                    className={`bg-white dark:bg-zinc-900/90 p-5 rounded-2xl shadow-sm border transition cursor-pointer ${
                      attendanceFilter === 'PRESENT' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-zinc-200 dark:border-zinc-800'
                    } flex flex-col items-center text-center`}
                  >
                    <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-2.5">
                      <UserCheck size={20} />
                    </div>
                    <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {attendanceReport.summary.present}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-bold mt-1">Present Students</p>
                  </div>

                  {/* Absent Card */}
                  <div 
                    onClick={() => setAttendanceFilter('ABSENT')}
                    className={`bg-white dark:bg-zinc-900/90 p-5 rounded-2xl shadow-sm border transition cursor-pointer ${
                      attendanceFilter === 'ABSENT' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-zinc-200 dark:border-zinc-800'
                    } flex flex-col items-center text-center`}
                  >
                    <div className="bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 mb-2.5">
                      <UserX size={20} />
                    </div>
                    <p className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                      {attendanceReport.summary.absent}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-bold mt-1">Absent Students</p>
                  </div>
                </div>

                {/* Overall Attendance Rate Card */}
                <div className="bg-white dark:bg-zinc-900/90 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-bold">Attendance Rate</p>
                    <p className="text-2xl font-black font-mono text-black dark:text-white mt-0.5">{attendanceReport.summary.rate}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {attendanceReport.summary.present} of {attendanceReport.summary.total} total students
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-mono font-bold text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                    <CheckCircle size={24} className="text-emerald-500" />
                  </div>
                </div>

              </div>

              {/* Right Column - Attendance Table (Present & Absent Breakdown) */}
              <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:col-span-2 overflow-hidden">

                
                {/* Header & Controls */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Attendance Records (IST)</h2>
                      {attendanceReport.session && (
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          attendanceReport.session.status === 'ACTIVE' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300' 
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {attendanceReport.session.status === 'ACTIVE' ? 'LIVE' : 'CLOSED'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Indian Standard Time (IST) • Present & Absent participants
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Session Selector Dropdown */}
                    {allSessions.length > 1 && (
                      <select
                        value={selectedSessionId || ''}
                        onChange={handleSelectSession}
                        className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded-xl px-3 py-2 font-mono outline-none focus:border-black dark:focus:border-white transition"
                      >
                        <option value="">Latest Session</option>
                        {allSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            Session #{s.id} ({s.status})
                          </option>
                        ))}
                      </select>
                    )}

                    <button 
                      onClick={handleExport} 
                      className="flex items-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white px-4 py-2 rounded-xl shadow-xs transition-all font-mono font-bold text-xs uppercase tracking-wider"
                    >
                      <Download size={14} />
                      <span>Export CSV (IST)</span>
                    </button>

                    <button 
                      onClick={handleDeleteAllAttendance}
                      disabled={deleteLoading}
                      className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/80 px-3.5 py-2 rounded-xl shadow-xs transition-all font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                      title="Permanently delete all attendance records and sessions"
                    >
                      <Trash2 size={14} />
                      <span>{deleteLoading ? 'Deleting...' : 'Delete All Records'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Status Pills */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAttendanceFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
                        attendanceFilter === 'ALL'
                          ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      All ({attendanceReport.summary.total})
                    </button>
                    <button
                      onClick={() => setAttendanceFilter('PRESENT')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition flex items-center space-x-1.5 ${
                        attendanceFilter === 'PRESENT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                      }`}
                    >
                      <span>● Present</span>
                      <span>({attendanceReport.summary.present})</span>
                    </button>
                    <button
                      onClick={() => setAttendanceFilter('ABSENT')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition flex items-center space-x-1.5 ${
                        attendanceFilter === 'ABSENT'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                      }`}
                    >
                      <span>● Absent</span>
                      <span>({attendanceReport.summary.absent})</span>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-56">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search student..."
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-black dark:focus:border-white transition"
                    />
                  </div>
                </div>
                
                {/* Table */}
                <div className="flex-1 overflow-auto p-0 max-h-[550px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                        <th className="p-4 pl-6">Student</th>
                        <th className="p-4">Date (IST)</th>
                        <th className="p-4">Time (IST)</th>
                        <th className="p-4">Session</th>
                        <th className="p-4 text-right pr-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                      {filteredAttendanceRecords.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-zinc-400 dark:text-zinc-600 font-mono text-xs">
                            {attendanceSearch 
                              ? "No students match your search." 
                              : "No attendance records found for this session."}
                          </td>
                        </tr>
                      ) : (
                        filteredAttendanceRecords.map((record, index) => (
                          <tr 
                            key={index} 
                            className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                              record.status === 'Absent' ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                            }`}
                          >
                            <td className="p-4 pl-6">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100">{record.name}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{record.email}</div>
                            </td>
                            <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400 font-mono">{record.date}</td>
                            <td className="p-4 text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                              {record.time}
                            </td>
                            <td className="p-4 text-xs">
                              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded font-mono font-medium">{record.session}</span>
                            </td>
                            <td className="p-4 text-right pr-6">
                              {record.status === 'Present' ? (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <Check size={12} className="stroke-[3]" />
                                  <span>Present</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                  <XCircle size={12} className="stroke-[2.5]" />
                                  <span>Absent</span>
                                </span>
                              )}
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
        )}

        {/* TAB 2: Authorized Student Email Whitelist */}
        {activeTab === 'whitelist' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Add Allowed Email Form */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* Status/Banner alerts */}
              {whitelistSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center space-x-2">
                  <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{whitelistSuccess}</span>
                </div>
              )}
              {whitelistError && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                  <span>{whitelistError}</span>
                </div>
              )}

              {/* Single Add Card */}
              <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Authorize Student</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Only registered emails can sign in</p>
                  </div>
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    <UserPlus size={18} />
                  </div>
                </div>

                <form onSubmit={handleAddSingleEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Student Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Student Name <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex Johnson"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 text-sm"
                  >
                    <Plus size={16} />
                    <span>{actionLoading ? 'Saving...' : 'Save Email ID'}</span>
                  </button>
                </form>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowBulkInput(!showBulkInput)}
                    className="w-full text-center text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition py-2"
                  >
                    {showBulkInput ? "← Hide Bulk Import" : "⚡ Paste Multiple Emails (Bulk Import)"}
                  </button>
                </div>
              </div>

              {/* Bulk Add Card */}
              {showBulkInput && (
                <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-black dark:text-white">Bulk Email Import</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Paste multiple email addresses separated by commas or new lines.</p>
                  </div>
                  <form onSubmit={handleAddBulkEmails} className="space-y-3">
                    <textarea
                      rows={5}
                      placeholder={`student1@college.edu\nstudent2@college.edu\nstudent3@college.edu`}
                      value={bulkEmails}
                      onChange={(e) => setBulkEmails(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-mono text-xs"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition text-xs uppercase font-mono tracking-wider shadow-xs disabled:opacity-50"
                    >
                      <span>Import Emails</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Quick Whitelist Summary */}
              <div className="bg-white dark:bg-zinc-900/90 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Total Whitelisted</p>
                  <p className="text-2xl font-black font-mono text-black dark:text-white mt-0.5">{allowedEmails.length}</p>
                </div>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                  <Mail size={22} />
                </div>
              </div>
            </div>

            {/* Right Column: Whitelisted Emails Table & Search */}
            <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:col-span-2 overflow-hidden">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Authorized Login Whitelist</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Only the emails listed below can log into the portal</p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-black dark:focus:border-white transition"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto p-0 max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                      <th className="p-4 pl-6">Allowed Email & Student</th>
                      <th className="p-4">Added On (IST)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                    {filteredWhitelistEmails.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-12 text-center text-zinc-400 dark:text-zinc-600 font-mono text-xs">
                          {searchQuery ? "No matching emails found." : "No emails saved yet. Add allowed student emails using the form on the left."}
                        </td>
                      </tr>
                    ) : (
                      filteredWhitelistEmails.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm">{item.email}</div>
                            {item.name && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.name}</div>
                            )}
                          </td>
                          <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                            {formatISTDateTime(item.created_at)}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              Authorized
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <button
                              onClick={() => handleDeleteAllowedEmail(item.id, item.email)}
                              title="Remove from allowed list"
                              className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;

