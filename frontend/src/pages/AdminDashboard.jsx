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
  Calendar,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  History,
  RotateCcw,
  Lock,
  Unlock,
  AlertTriangle,
  SmartphoneNfc
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

  // Device Management state
  const [devicesList, setDevicesList] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceStats, setDeviceStats] = useState({
    total_users: 0,
    linked_devices: 0,
    unlinked_users: 0,
    total_resets: 0,
    blocked_attempts: 0
  });
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState('ALL'); // 'ALL' | 'LINKED' | 'UNLINKED' | 'DISABLED'
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [resetReason, setResetReason] = useState('');
  const [resettingDevice, setResettingDevice] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState('ALL');
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [deviceSuccessMsg, setDeviceSuccessMsg] = useState('');
  const [deviceErrorMsg, setDeviceErrorMsg] = useState('');

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

  const handleDeleteSingleRecord = async (recordId, studentName) => {
    if (!recordId) return;
    if (!window.confirm(`Are you sure you want to delete the attendance record for '${studentName}'?`)) {
      return;
    }
    try {
      await api.delete(`/admin/attendance/record/${recordId}`);
      await fetchAttendance(selectedSessionId);
      await fetchCurrentSession();
    } catch (err) {
      alert("Failed to delete record: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteSelectedSession = async () => {
    const targetId = selectedSessionId || (attendanceReport.session && attendanceReport.session.id);
    if (!targetId) return;
    if (!window.confirm(`⚠️ Are you sure you want to delete Session #${targetId} and all its attendance records?`)) {
      return;
    }
    try {
      await api.delete(`/admin/session/${targetId}`);
      setSelectedSessionId(null);
      await Promise.all([
        fetchCurrentSession(),
        fetchAttendance(),
        fetchAllSessions()
      ]);
    } catch (err) {
      alert("Failed to delete session: " + (err.response?.data?.detail || err.message));
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

  // --- Device Management Fetchers & Handlers ---

  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const [devRes, statsRes] = await Promise.all([
        api.get('/admin/devices'),
        api.get('/admin/device-stats')
      ]);
      setDevicesList(devRes.data);
      setDeviceStats(statsRes.data);
    } catch (err) {
      console.error("Failed to load devices", err);
      setDeviceErrorMsg(err.response?.data?.detail || "Failed to load device list.");
    } finally {
      setDevicesLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const res = await api.get('/admin/device-audit-logs');
      setAuditLogs(res.data);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'devices') {
      fetchDevices();
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleConfirmDeviceReset = async () => {
    if (!selectedUserForReset) return;
    setResettingDevice(true);
    setDeviceErrorMsg('');
    setDeviceSuccessMsg('');

    try {
      const res = await api.post(`/admin/devices/${selectedUserForReset.user_id}/reset`, {
        reason: resetReason || "Admin initiated device reset."
      });
      setDeviceSuccessMsg(res.data.message || `Device unlinked for ${selectedUserForReset.full_name}.`);
      setSelectedUserForReset(null);
      setResetReason('');
      fetchDevices();
      fetchAuditLogs();
      setTimeout(() => setDeviceSuccessMsg(''), 6000);
    } catch (err) {
      setDeviceErrorMsg(err.response?.data?.detail || "Failed to reset device.");
    } finally {
      setResettingDevice(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentActive, userName) => {
    try {
      const res = await api.post(`/admin/users/${userId}/toggle-status`);
      setDeviceSuccessMsg(res.data.message || `Account status updated for ${userName}.`);
      fetchDevices();
      fetchAuditLogs();
      setTimeout(() => setDeviceSuccessMsg(''), 5000);
    } catch (err) {
      setDeviceErrorMsg(err.response?.data?.detail || "Failed to update account status.");
    }
  };

  const handleSetUserPassword = async (e) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordInput) return;
    if (newPasswordInput.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      await api.post(`/admin/users/${passwordModalUser.user_id}/set-password`, {
        password: newPasswordInput
      });
      setDeviceSuccessMsg(`Password set successfully for ${passwordModalUser.full_name}.`);
      setPasswordModalUser(null);
      setNewPasswordInput('');
      setTimeout(() => setDeviceSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update password.");
    }
  };

  // Filtered Devices List
  const filteredDevicesList = devicesList.filter((dev) => {
    if (deviceStatusFilter === 'LINKED' && !dev.is_linked) return false;
    if (deviceStatusFilter === 'UNLINKED' && dev.is_linked) return false;
    if (deviceStatusFilter === 'DISABLED' && dev.is_active) return false;

    if (deviceSearch.trim()) {
      const q = deviceSearch.toLowerCase();
      return (
        dev.full_name.toLowerCase().includes(q) ||
        dev.email.toLowerCase().includes(q) ||
        (dev.device_name && dev.device_name.toLowerCase().includes(q)) ||
        (dev.device_id && dev.device_id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditFilterAction !== 'ALL' && log.action !== auditFilterAction) return false;
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
            onClick={() => setActiveTab('devices')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Smartphone size={14} />
            <span>Device Management</span>
            {deviceStats.blocked_attempts > 0 && (
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold border border-red-200 dark:border-red-800">
                {deviceStats.blocked_attempts}
              </span>
            )}
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
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border ${
            activeTab === 'session'
              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <Radio size={14} />
          <span>Sessions</span>
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border ${
            activeTab === 'devices'
              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <Smartphone size={14} />
          <span>Devices</span>
        </button>
        <button
          onClick={() => setActiveTab('whitelist')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border ${
            activeTab === 'whitelist'
              ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <Mail size={14} />
          <span>Emails</span>
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
                            {student.record_id && (
                              <button
                                onClick={() => handleDeleteSingleRecord(student.record_id, student.name)}
                                title="Delete attendance for this student"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
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

                      <button 
                        onClick={handleDeleteAllAttendance}
                        className="w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 px-4 py-2.5 rounded-xl font-bold text-xs font-mono uppercase tracking-wider transition shadow-xs mt-3"
                        title="Clear today's attendance records to restart a new session"
                      >
                        <Trash2 size={14} />
                        <span>Reset & Clear Attendance</span>
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
                        One session can be generated today. Students will use the 30-second OTP to mark attendance.
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

                    {selectedSessionId && (
                      <button 
                        onClick={handleDeleteSelectedSession}
                        className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/80 px-3.5 py-2 rounded-xl shadow-xs transition-all font-mono font-bold text-xs uppercase tracking-wider"
                        title={`Delete Session #${selectedSessionId}`}
                      >
                        <Trash2 size={14} />
                        <span>Delete Session #{selectedSessionId}</span>
                      </button>
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
                      className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white px-4 py-2 rounded-xl shadow-xs transition-all font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-50"
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
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                      {filteredAttendanceRecords.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-zinc-400 dark:text-zinc-600 font-mono text-xs">
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
                            <td className="p-4">
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
                            <td className="p-4 text-right pr-6">
                              {record.status === 'Present' && record.record_id ? (
                                <button
                                  onClick={() => handleDeleteSingleRecord(record.record_id, record.name)}
                                  title="Delete this student's attendance record"
                                  className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 text-xs font-mono pr-2">—</span>
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
                      placeholder="username@francisxavier.ac.in"
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
                      placeholder={`student1@francisxavier.ac.in\nstudent2@francisxavier.ac.in\nstudent3@francisxavier.ac.in`}
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

        {/* TAB 3: Device Management & Audit Logs */}
        {activeTab === 'devices' && (
          <div className="space-y-8">
            
            {/* Feedback Alerts */}
            {deviceSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-5 py-3.5 rounded-2xl flex items-center justify-between text-sm shadow-xs font-medium">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{deviceSuccessMsg}</span>
                </div>
                <button onClick={() => setDeviceSuccessMsg('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  <XCircle size={16} />
                </button>
              </div>
            )}

            {deviceErrorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 px-5 py-3.5 rounded-2xl flex items-center justify-between text-sm shadow-xs font-medium">
                <div className="flex items-center space-x-2.5">
                  <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                  <span>{deviceErrorMsg}</span>
                </div>
                <button onClick={() => setDeviceErrorMsg('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  <XCircle size={16} />
                </button>
              </div>
            )}

            {/* 4 Stat Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-black dark:text-white">
                  <Users size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Total Students</p>
                  <p className="text-2xl font-black text-black dark:text-white font-mono mt-0.5">{deviceStats.total_users}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                  <Smartphone size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Linked Devices</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{deviceStats.linked_devices}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-4">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Devices Reset</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{deviceStats.total_resets}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-4">
                <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Blocked Proxy</p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono mt-0.5">{deviceStats.blocked_attempts}</p>
                </div>
              </div>
            </div>

            {/* Main Devices Table Card */}
            <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              
              {/* Table Header Bar */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Registered Student Devices</h2>
                    <span className="text-xs font-mono px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded-full font-bold">
                      {filteredDevicesList.length}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Strict 1 user account per device policy. Use "Reset Device" to allow student login from a new hardware.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Filters */}
                  <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={() => setDeviceStatusFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        deviceStatusFilter === 'ALL' ? 'bg-white dark:bg-zinc-800 shadow-xs text-black dark:text-white' : 'text-zinc-500'
                      }`}
                    >
                      All ({devicesList.length})
                    </button>
                    <button
                      onClick={() => setDeviceStatusFilter('LINKED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        deviceStatusFilter === 'LINKED' ? 'bg-white dark:bg-zinc-800 shadow-xs text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      Linked ({deviceStats.linked_devices})
                    </button>
                    <button
                      onClick={() => setDeviceStatusFilter('UNLINKED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        deviceStatusFilter === 'UNLINKED' ? 'bg-white dark:bg-zinc-800 shadow-xs text-amber-600 dark:text-amber-400' : 'text-zinc-500'
                      }`}
                    >
                      Unlinked ({deviceStats.unlinked_users})
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search student, email, device..."
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-black dark:focus:border-white transition"
                    />
                  </div>

                  <button
                    onClick={() => { fetchDevices(); fetchAuditLogs(); }}
                    className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-300"
                    title="Refresh device records"
                  >
                    <RefreshCw size={14} className={devicesLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                      <th className="p-4 pl-6">Student Info</th>
                      <th className="p-4">Linked Device</th>
                      <th className="p-4">Device ID Fingerprint</th>
                      <th className="p-4">First Linked (IST)</th>
                      <th className="p-4">Last Active (IST)</th>
                      <th className="p-4">Binding Status</th>
                      <th className="p-4 text-right pr-6">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                    {filteredDevicesList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-zinc-400 dark:text-zinc-500 font-mono text-xs">
                          {deviceSearch ? "No students matching your search." : "No registered student devices found."}
                        </td>
                      </tr>
                    ) : (
                      filteredDevicesList.map((dev) => (
                        <tr key={dev.user_id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{dev.full_name}</div>
                            <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{dev.email}</div>
                            {dev.username && dev.username !== dev.email.split('@')[0] && (
                              <div className="text-[11px] font-mono text-zinc-400">@{dev.username}</div>
                            )}
                          </td>

                          <td className="p-4">
                            {dev.is_linked && dev.device_name ? (
                              <div className="flex items-center space-x-2">
                                <Smartphone size={16} className="text-zinc-400 shrink-0" />
                                <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200">
                                  {dev.device_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">No Device Linked</span>
                            )}
                          </td>

                          <td className="p-4">
                            {dev.is_linked && dev.device_id ? (
                              <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                                {dev.device_id}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>

                          <td className="p-4 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                            {dev.first_linked_formatted}
                          </td>

                          <td className="p-4 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                            {dev.last_active_formatted}
                          </td>

                          <td className="p-4">
                            {!dev.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800">
                                Disabled
                              </span>
                            ) : dev.is_linked ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                ● Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                ○ Unlinked
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-right pr-6">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Reset Device Button */}
                              {dev.is_linked && dev.role !== 'ADMIN' && (
                                <button
                                  onClick={() => {
                                    setSelectedUserForReset(dev);
                                    setResetReason('');
                                  }}
                                  title="Unlink and reset registered device"
                                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>Reset Device</span>
                                </button>
                              )}

                              {/* Toggle Active Button */}
                              {dev.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleToggleUserStatus(dev.user_id, dev.is_active, dev.full_name)}
                                  title={dev.is_active ? "Disable account" : "Enable account"}
                                  className={`p-1.5 rounded-xl border transition ${
                                    dev.is_active
                                      ? "text-zinc-500 hover:text-red-600 border-zinc-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                      : "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                                  }`}
                                >
                                  {dev.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                              )}

                              {/* Set Password Button */}
                              <button
                                onClick={() => {
                                  setPasswordModalUser(dev);
                                  setNewPasswordInput('');
                                }}
                                title="Set or reset student password"
                                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                              >
                                <KeyRound size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Log Trail Section */}
            <div className="bg-white dark:bg-zinc-900/90 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <div className="flex items-center space-x-2">
                    <History size={18} className="text-zinc-500" />
                    <h2 className="text-base font-black uppercase tracking-wider text-black dark:text-white">Device Audit Log Trail</h2>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Immutable security log of device registrations, admin resets, and blocked mismatch attempts
                  </p>
                </div>

                {/* Audit Action Filter */}
                <div className="flex items-center space-x-2">
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-none"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="DEVICE_REGISTERED">Device Registered</option>
                    <option value="DEVICE_RESET_BY_ADMIN">Admin Reset</option>
                    <option value="LOGIN_BLOCKED_MISMATCH">Blocked Mismatches</option>
                    <option value="LOGIN_SUCCESS">Login Success</option>
                    <option value="ACCOUNT_STATUS_CHANGED">Status Changed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                      <th className="p-4 pl-6">Timestamp (IST)</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Target Student</th>
                      <th className="p-4">Device Info</th>
                      <th className="p-4 pr-6">Audit Details & Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs font-mono">
                    {filteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-zinc-400 dark:text-zinc-500">
                          No audit entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      filteredAuditLogs.map((log) => {
                        let badgeClass = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
                        if (log.action === "DEVICE_REGISTERED") {
                          badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800";
                        } else if (log.action === "DEVICE_RESET_BY_ADMIN") {
                          badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800";
                        } else if (log.action === "LOGIN_BLOCKED_MISMATCH") {
                          badgeClass = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800 font-black";
                        } else if (log.action === "LOGIN_SUCCESS") {
                          badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800";
                        }

                        return (
                          <tr key={log.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                            <td className="p-4 pl-6 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                              {log.formatted_time}
                            </td>
                            <td className="p-4">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 font-sans font-medium text-zinc-900 dark:text-zinc-200">
                              {log.user_name} <span className="text-zinc-400 text-xs font-mono">({log.user_email})</span>
                            </td>
                            <td className="p-4 text-zinc-700 dark:text-zinc-300">
                              {log.device_name || log.device_id || "—"}
                            </td>
                            <td className="p-4 pr-6 text-zinc-600 dark:text-zinc-400 font-sans">
                              <div>{log.details}</div>
                              {log.admin_name && (
                                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                  Action by Admin: {log.admin_name}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* MODAL 1: Confirm Device Reset */}
        {selectedUserForReset && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
              <div className="flex items-start space-x-3.5">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-black dark:text-white tracking-tight">Confirm Device Reset</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    This will unlink the student's registered device. On their next login, their new device will be automatically linked to their account.
                  </p>
                </div>
              </div>

              {/* Target User Details Box */}
              <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Student Name:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedUserForReset.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Email:</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{selectedUserForReset.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Currently Linked Device:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{selectedUserForReset.device_name || "Unknown Device"}</span>
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Reset Reason / Justification (Recorded in Audit Log)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Student replaced phone / laptop, lost device, etc."
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForReset(null)}
                  disabled={resettingDevice}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeviceReset}
                  disabled={resettingDevice}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} className={resettingDevice ? "animate-spin" : ""} />
                  <span>{resettingDevice ? "Resetting..." : "Confirm & Unlink Device"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Set Student Password */}
        {passwordModalUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
              <div className="flex items-start space-x-3.5">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-black dark:text-white">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-black dark:text-white tracking-tight">Set Student Password</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Assign a secure password for <strong>{passwordModalUser.full_name}</strong>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSetUserPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                    New Password (Min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black text-white dark:bg-white dark:text-black shadow-lg transition"
                  >
                    Save Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;


