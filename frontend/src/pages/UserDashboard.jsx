import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { 
  LogOut, 
  CheckCircle, 
  AlertCircle, 
  History, 
  Clock, 
  Lock, 
  Radio, 
  UserCheck, 
  UserX, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  LocateFixed,
  Smartphone,
  Mail,
  Zap,
  Sparkles
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const DEFAULT_TARGET_LAT = 8.732309;
const DEFAULT_TARGET_LNG = 77.723764;
const DEFAULT_GEOFENCE_RADIUS = 500; // in meters

// Haversine distance formula to calculate distance in meters
const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [currentISTTime, setCurrentISTTime] = useState('');
  const [sessionStatus, setSessionStatus] = useState({
    loading: true,
    active_session: null,
    today_session: null,
    already_marked: false,
    my_record: null,
    target_location: {
      latitude: DEFAULT_TARGET_LAT,
      longitude: DEFAULT_TARGET_LNG,
      radius_meters: DEFAULT_GEOFENCE_RADIUS
    }
  });

  // Auto-OTP States
  const [autoOtpLoading, setAutoOtpLoading] = useState(false);
  const [autoOtpSent, setAutoOtpSent] = useState(false);
  const [autoOtpMessage, setAutoOtpMessage] = useState('');
  const [autoOtpDetails, setAutoOtpDetails] = useState(null);
  const otpRequestedSessionRef = useRef(null);

  // Geolocation States
  const [coords, setCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locState, setLocState] = useState('IDLE'); // 'IDLE' | 'ACQUIRING' | 'INSIDE' | 'OUTSIDE' | 'DENIED' | 'UNAVAILABLE' | 'ERROR'
  const [locError, setLocError] = useState('');
  const [refreshingLoc, setRefreshingLoc] = useState(false);

  const inputRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  const targetLat = sessionStatus.target_location?.latitude ?? DEFAULT_TARGET_LAT;
  const targetLng = sessionStatus.target_location?.longitude ?? DEFAULT_TARGET_LNG;
  const targetRadius = sessionStatus.target_location?.radius_meters ?? DEFAULT_GEOFENCE_RADIUS;
  const venueName = sessionStatus.target_location?.venue_name || 'Francis Xavier Engineering College';

  const isActiveSession = Boolean(sessionStatus.active_session);
  const isAlreadyMarked = sessionStatus.already_marked;
  const isTodayCompleted = !isActiveSession && Boolean(sessionStatus.today_session && sessionStatus.today_session.status === 'CLOSED');
  const isNoSession = !isActiveSession && !sessionStatus.today_session;

  const isInside = locState === 'INSIDE';

  // Request high-accuracy GPS coordinates
  const checkLocation = useCallback((isManual = false) => {
    if (!navigator.geolocation) {
      setLocState('UNAVAILABLE');
      setLocError('Geolocation is not supported by your browser.');
      return;
    }

    if (isManual) {
      setRefreshingLoc(true);
    } else {
      setLocState((prev) => (prev === 'IDLE' ? 'ACQUIRING' : prev));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        setCoords({ latitude: userLat, longitude: userLng, accuracy });

        const dist = calculateDistanceInMeters(userLat, userLng, targetLat, targetLng);
        setDistance(dist);

        if (dist <= targetRadius) {
          setLocState('INSIDE');
          setLocError('');
        } else {
          setLocState('OUTSIDE');
          setLocError(`You are ~${Math.round(dist)}m away from the venue. Please move inside to enter the OTP.`);
        }
        setRefreshingLoc(false);
      },
      (error) => {
        setRefreshingLoc(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocState('DENIED');
          setLocError('Location permission denied. Please enable GPS permissions in your browser settings to verify attendance.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocState('UNAVAILABLE');
          setLocError('Location signal unavailable. Please ensure your device GPS is turned on.');
        } else if (error.code === error.TIMEOUT) {
          setLocState('ERROR');
          setLocError('Location request timed out. Please click "Refresh Location" to try again.');
        } else {
          setLocState('ERROR');
          setLocError(error.message || 'Unable to retrieve your location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [targetLat, targetLng, targetRadius]);

  const fetchSessionStatus = async () => {
    try {
      const res = await api.get('/attendance/session/status');
      setSessionStatus({
        loading: false,
        active_session: res.data.active_session,
        today_session: res.data.today_session,
        already_marked: res.data.already_marked,
        my_record: res.data.my_record,
        target_location: res.data.target_location || {
          latitude: DEFAULT_TARGET_LAT,
          longitude: DEFAULT_TARGET_LNG,
          radius_meters: DEFAULT_GEOFENCE_RADIUS
        }
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

  useEffect(() => {
    fetchSessionStatus();
    fetchHistory();

    // Poll session status every 3 seconds for live transitions
    const timer = setInterval(() => {
      fetchSessionStatus();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const requestAutoOtp = useCallback(async (isManual = false) => {
    if (!coords?.latitude || !coords?.longitude) {
      if (isManual) {
        setStatus({ type: 'error', message: 'Location not acquired yet. Please ensure GPS is enabled.' });
      }
      return;
    }
    if (!isActiveSession || isAlreadyMarked) return;
    if (locState !== 'INSIDE') {
      if (isManual) {
        setStatus({ type: 'error', message: 'You must be inside the venue to request the OTP.' });
      }
      return;
    }

    setAutoOtpLoading(true);
    if (isManual) {
      setStatus({ type: '', message: '' });
    }

    try {
      const res = await api.post('/attendance/auto-otp', {
        latitude: coords.latitude,
        longitude: coords.longitude
      });

      if (res.data?.otp_code) {
        const codeDigits = res.data.otp_code.split('');
        setOtp(codeDigits);
        setAutoOtpSent(true);
        setAutoOtpDetails({
          otp_code: res.data.otp_code,
          student_email: res.data.student_email,
          expires_at: res.data.expires_at,
          venue_name: res.data.venue_name,
          distance_meters: res.data.distance_meters,
          email_sent: res.data.email_sent
        });
        setAutoOtpMessage(res.data.message || 'OTP automatically dispatched to your email and device!');
      }
    } catch (err) {
      console.error("Auto OTP dispatch error", err);
      if (isManual) {
        setStatus({ 
          type: 'error', 
          message: err.response?.data?.detail || 'Failed to dispatch OTP.' 
        });
      }
    } finally {
      setAutoOtpLoading(false);
    }
  }, [coords, isActiveSession, isAlreadyMarked, locState]);

  // Proactively check location when there is an active session and attendance isn't marked
  useEffect(() => {
    if (isActiveSession && !isAlreadyMarked) {
      checkLocation();
    }
  }, [isActiveSession, isAlreadyMarked, checkLocation]);

  // Automatically request OTP as soon as student GPS location is verified INSIDE venue
  useEffect(() => {
    const activeSessionId = sessionStatus.active_session?.id;
    if (!activeSessionId) {
      otpRequestedSessionRef.current = null;
      setAutoOtpSent(false);
      setAutoOtpDetails(null);
      return;
    }

    if (isActiveSession && !isAlreadyMarked && isInside && coords?.latitude && coords?.longitude) {
      if (otpRequestedSessionRef.current !== activeSessionId && !autoOtpLoading && !autoOtpSent) {
        otpRequestedSessionRef.current = activeSessionId;
        requestAutoOtp(false);
      }
    }
  }, [isActiveSession, isAlreadyMarked, isInside, coords, sessionStatus.active_session, autoOtpLoading, autoOtpSent, requestAutoOtp]);

  const handleChange = (index, e) => {
    if (!isInside) return;

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
    if (!isInside) return;
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const submitAttendance = async () => {
    if (!isInside) {
      setStatus({ type: 'error', message: 'You must be inside the attendance venue to submit attendance.' });
      return;
    }

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setStatus({ type: 'error', message: 'Please enter the full 6-digit OTP.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });
    
    try {
      const res = await api.post('/attendance/mark', { 
        otp_code: otpCode,
        latitude: coords?.latitude,
        longitude: coords?.longitude
      });
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

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      <nav className="bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white p-0.5 shadow-xs flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Attendance Logo" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-black dark:text-white tracking-tight">Hello, {user.full_name}</h1>
              {user.device && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono rounded-md shadow-2xs" title={`Bound device: ${user.device.device_name}`}>
                  <Smartphone size={11} className="text-zinc-500" />
                  <span>{user.device.device_name || 'Linked Device'}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{user.email}</p>
          </div>
        </div>

        {/* Live IST Clock Header */}
        <div className="hidden sm:flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <Clock size={14} className="text-zinc-500" />
          <span className="font-bold">{currentISTTime}</span>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <button onClick={logout} className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-xs cursor-pointer">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 p-4 w-full grid gap-8 md:grid-cols-5 flex-1">
        
        {/* Mobile Live IST Clock Banner */}
        <div className="sm:hidden md:hidden col-span-full flex items-center justify-center space-x-2 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <Clock size={14} className="text-zinc-500" />
          <span className="font-bold">{currentISTTime}</span>
        </div>
        
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

            {/* CASE 1: Active Session & User has NOT marked attendance -> SHOW OTP INPUTS GATED BY LOCATION */}
            {isActiveSession && !isAlreadyMarked && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono uppercase tracking-wider rounded-full">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>Session #{sessionStatus.active_session.id} Active</span>
                  </div>

                  {/* Geofence Status Pill */}
                  {isInside ? (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold rounded-full shadow-2xs">
                      <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Inside Venue ({distance !== null ? `~${Math.round(distance)}m` : 'Verified'})</span>
                    </div>
                  ) : locState === 'ACQUIRING' ? (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 text-[11px] font-mono rounded-full">
                      <LocateFixed size={13} className="animate-spin text-sky-600 dark:text-sky-400" />
                      <span>Locating GPS...</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-[11px] font-mono font-semibold rounded-full">
                      <ShieldAlert size={13} className="text-rose-600 dark:text-rose-400" />
                      <span>Location Locked</span>
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight mb-1">Attendance Verification</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                  {isInside 
                    ? 'Your physical location is verified. The OTP is automatically sent and filled.' 
                    : 'Move inside the attendance zone to automatically receive and unlock the OTP.'}
                </p>

                {/* Location Status Banners & Warnings */}
                {!isInside && (
                  <div className="mb-6 p-4 rounded-2xl border bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
                    <div className="flex items-start space-x-3">
                      {locState === 'DENIED' || locState === 'UNAVAILABLE' || locState === 'ERROR' ? (
                        <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      ) : (
                        <Navigation size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      )}
                      
                      <div className="flex-1 space-y-1">
                        <p className="font-bold text-[13px] tracking-tight">
                          {locState === 'DENIED'
                            ? 'Location Permission Required'
                            : locState === 'OUTSIDE'
                            ? 'You are Outside the Attendance Venue'
                            : locState === 'ACQUIRING'
                            ? 'Verifying Your Physical Location...'
                            : 'Location Check Required'}
                        </p>
                        
                        <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-sans">
                          {locState === 'DENIED'
                            ? 'Please enable browser GPS / location permission to verify your presence at the venue.'
                            : locState === 'OUTSIDE'
                            ? `You are currently ~${distance ? Math.round(distance) : '?'} meters away. You must be physically inside the venue (within ${targetRadius}m) to unlock the OTP entry.`
                            : locState === 'ACQUIRING'
                            ? `Checking your distance to ${venueName} (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})...`
                            : (locError || 'Checking location status...')}
                        </p>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => checkLocation(true)}
                            disabled={refreshingLoc}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-900/70 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono font-bold text-[11px] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={refreshingLoc ? 'animate-spin' : ''} />
                            <span>{refreshingLoc ? 'Checking GPS...' : 'Refresh Location'}</span>
                          </button>

                          <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
                            Target: {targetLat.toFixed(6)}, {targetLng.toFixed(6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Location Success & Auto-OTP Delivery Pill */}
                {isInside && (
                  <div className="space-y-3 mb-6">
                    {/* Location Badge */}
                    <div className="p-3 rounded-2xl border bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <MapPin size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-medium">
                          Venue: <strong className="text-black dark:text-white">{venueName}</strong> (~{distance !== null ? `${Math.round(distance)}m` : '0m'} from center)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkLocation(true)}
                        disabled={refreshingLoc}
                        title="Re-verify GPS"
                        className="p-1 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <RefreshCw size={13} className={refreshingLoc ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    {/* Auto-OTP Loading Banner */}
                    {autoOtpLoading && (
                      <div className="p-4 rounded-2xl border bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Zap size={18} className="animate-pulse text-sky-600 dark:text-sky-400" />
                          <div>
                            <p className="font-bold text-xs">Inside Venue Verified! Automatically generating & dispatching OTP...</p>
                            <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">Delivering code to your screen and sending email to {user.email}</p>
                          </div>
                        </div>
                        <RefreshCw size={15} className="animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
                      </div>
                    )}

                    {/* Auto-OTP Dispatched Success Card */}
                    {autoOtpSent && (
                      <div className="p-4 rounded-2xl border-2 bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-xl shrink-0 mt-0.5">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-black text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                                ⚡ OTP Automatically Sent!
                              </p>
                              <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 text-[10px] font-mono px-2 py-0.2 rounded-full font-bold">
                                Pre-filled
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-0.5 font-sans">
                              Dispatched to <strong className="font-mono">{user.email}</strong> and loaded into the boxes below.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => requestAutoOtp(true)}
                          disabled={autoOtpLoading}
                          className="self-start sm:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <RefreshCw size={11} className={autoOtpLoading ? 'animate-spin' : ''} />
                          <span>Resend OTP</span>
                        </button>
                      </div>
                    )}

                    {/* Fallback button if OTP wasn't auto-requested */}
                    {!autoOtpSent && !autoOtpLoading && (
                      <div className="p-3.5 rounded-2xl border bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Mail size={15} className="text-zinc-500" />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                            Ready to receive dynamic passcode for Session #{sessionStatus.active_session.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestAutoOtp(true)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-[11px] rounded-xl transition cursor-pointer"
                        >
                          <Zap size={12} />
                          <span>Send OTP</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* OTP Input Fields */}
                <div className="relative">
                  <div className={`flex justify-center gap-2 sm:gap-3.5 mb-8 transition-opacity duration-200 ${!isInside ? 'opacity-40 cursor-not-allowed select-none' : ''}`}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={inputRefs[index]}
                        type="text"
                        maxLength={6}
                        value={digit}
                        disabled={!isInside || submitting}
                        onChange={(e) => handleChange(index, e)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        placeholder={!isInside ? '•' : ''}
                        className={`w-12 h-14 sm:w-14 sm:h-18 text-center text-2xl sm:text-3xl font-black font-mono rounded-2xl border-2 transition-all outline-none ${
                          isInside
                            ? autoOtpSent
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 focus:bg-white dark:focus:bg-zinc-900 focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-950/50'
                              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/30 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                        }`}
                      />
                    ))}
                  </div>

                  {!isInside && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-zinc-900/80 dark:bg-zinc-100/90 text-white dark:text-black text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-xs flex items-center space-x-1.5">
                        <Lock size={12} />
                        <span>Move inside venue to unlock OTP</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={submitAttendance}
                  disabled={!isInside || submitting || otp.join('').length !== 6}
                  className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wider uppercase font-mono shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed ${
                    isInside && otp.join('').length === 6
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 shadow-lg ring-2 ring-emerald-500/50'
                      : 'bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-white disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600'
                  }`}
                >
                  {submitting 
                    ? 'Verifying OTP & Submitting...' 
                    : !isInside 
                    ? 'Locked (Outside Venue)' 
                    : autoOtpSent 
                    ? '✓ Submit Verified Attendance' 
                    : 'Submit Attendance'}
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
                    <p><span className="text-zinc-400">Time (IST):</span> <strong>{sessionStatus.my_record.time} IST</strong></p>
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
                      Today's session is closed. You were marked <strong className="text-emerald-600 dark:text-emerald-400">Present</strong> at {sessionStatus.my_record?.time ? `${sessionStatus.my_record.time} IST` : 'check-in'}.
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
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-black dark:text-white">My Check-in Log (IST)</h3>
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{record.time} IST</p>
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
