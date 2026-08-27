import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  ShieldAlert, 
  AlertCircle, 
  Smartphone, 
  Lock, 
  User, 
  Mail, 
  Key, 
  Eye, 
  EyeOff, 
  UserPlus, 
  LogIn, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const { login, adminLogin, adminRegister, user } = useAuth();
  const [authMode, setAuthMode] = useState('STUDENT'); // 'STUDENT' | 'ADMIN'
  const [adminSubMode, setAdminSubMode] = useState('LOGIN'); // 'LOGIN' | 'REGISTER'
  
  // Form states
  const [studentForm, setStudentForm] = useState({ name: '', email: '' });
  const [adminForm, setAdminForm] = useState({ 
    fullName: '', 
    email: '', 
    password: '', 
    secretKey: '' 
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  // Reset errors when switching modes
  const handleSwitchMode = (mode) => {
    setAuthMode(mode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSwitchAdminSubMode = (subMode) => {
    setAdminSubMode(subMode);
    setError(null);
    setSuccessMsg(null);
  };

  // Student Login Submit
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.email.trim()) {
      setError("Please enter both Name and Email.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await login(studentForm.email.trim(), studentForm.name.trim());
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed. Please check your registered email or contact Admin.");
      setLoading(false);
    }
  };

  // Admin Login Submit
  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    if (!adminForm.email.trim() || !adminForm.password) {
      setError("Please enter both Admin Email and Password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminLogin(adminForm.email.trim(), adminForm.password);
    } catch (err) {
      setError(err.response?.data?.detail || "Admin authentication failed. Please verify your email and password.");
      setLoading(false);
    }
  };

  // Admin Register Submit
  const handleAdminRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!adminForm.fullName.trim() || !adminForm.email.trim() || !adminForm.password || !adminForm.secretKey.trim()) {
      setError("Please fill in all fields including the Admin Secret Passkey.");
      return;
    }

    if (adminForm.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await adminRegister(
        adminForm.fullName.trim(),
        adminForm.email.trim(),
        adminForm.password,
        adminForm.secretKey.trim()
      );
      if (res && !res.is_approved) {
        setSuccessMsg("Registration Submitted! Your administrator account has been created and is awaiting approval from the Master Administrator (admin@francisxavier.ac.in). You will be able to sign in once approved.");
        setAdminSubMode('LOGIN');
        setAdminForm({ email: adminForm.email.trim(), password: '', fullName: '', secretKey: '' });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Admin account creation failed. Please check the Admin Secret Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern flex flex-col items-center justify-center p-4 relative overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-6 right-6 z-20 flex items-center space-x-2">
        <ThemeToggle />
      </div>

      {/* Decorative Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-zinc-200/50 via-zinc-100/30 to-emerald-50/20 dark:from-zinc-800/30 dark:via-zinc-900/20 dark:to-emerald-950/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10 py-6">
        
        {/* Left Column: Branding and System Highlights */}
        <div className="hidden md:flex flex-col space-y-8 pr-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-mono tracking-wider uppercase rounded-full w-fit shadow-xs">
                <span>● Attendance OS</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono rounded-full">
                <Smartphone size={12} />
                <span>1 Device = 1 User</span>
              </div>
            </div>
            
            <h1 className="text-5xl font-black text-black dark:text-white tracking-tight leading-tight">
              Modern <span className="gradient-text">OTP-Based</span> Attendance
            </h1>
            
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Automated high-accuracy geofenced attendance tracking with live dynamic OTPs, strict device binding, and dedicated administrative controls.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Dynamic Passcodes</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">30s live rotated OTPs</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Geofence Verified</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">GPS location boundary</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Unified Auth Panel */}
        <div className="glass-panel p-6 sm:p-8 md:p-10 rounded-3xl w-full max-w-md mx-auto border border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-2xl backdrop-blur-md">
          
          {/* Main Role Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl mb-6 border border-zinc-200 dark:border-zinc-700/80">
            <button
              type="button"
              onClick={() => handleSwitchMode('STUDENT')}
              className={`py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                authMode === 'STUDENT'
                  ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm border border-zinc-200/60 dark:border-zinc-700'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Smartphone size={14} />
              <span>Student</span>
            </button>
            
            <button
              type="button"
              onClick={() => handleSwitchMode('ADMIN')}
              className={`py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                authMode === 'ADMIN'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Lock size={14} />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Form Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            {authMode === 'STUDENT' ? (
              <>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">Student Check-in</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Enter your details to access today's attendance session.</p>
              </>
            ) : adminSubMode === 'LOGIN' ? (
              <>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold uppercase rounded-md mb-2">
                  <ShieldCheck size={11} className="text-black dark:text-white" />
                  <span>Admin Authentication</span>
                </div>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">Admin Sign In</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Sign in with your administrator email and password.</p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase rounded-md mb-2 border border-emerald-200 dark:border-emerald-800">
                  <UserPlus size={11} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Admin Provisioning</span>
                </div>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">Create Admin Account</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Register a new administrator with the Secret Passkey.</p>
              </>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className={`p-3.5 rounded-2xl mb-5 text-xs flex items-start space-x-3 text-left ${
              error.includes('Device')
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
            }`}>
              {error.includes('Device') ? (
                <ShieldAlert className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" size={16} />
              ) : (
                <AlertCircle className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" size={16} />
              )}
              <div className="flex-1">
                <p className="font-semibold leading-relaxed">{error}</p>
                {error.includes('Device') && (
                  <p className="mt-1 text-[10px] text-rose-700 dark:text-rose-300 font-mono">
                    Policy: Strictly 1 student account per physical device.
                  </p>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl mb-5 text-xs flex items-start space-x-3 text-left bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" size={16} />
              <p className="font-semibold">{successMsg}</p>
            </div>
          )}

          {/* MODE 1: STUDENT LOGIN FORM */}
          {authMode === 'STUDENT' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="e.g. John Doe"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="email" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="student@francisxavier.ac.in"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold font-mono uppercase tracking-wider text-xs transition shadow-md disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                <span>{loading ? 'Verifying Device...' : 'Continue to Dashboard'}</span>
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          {/* MODE 2: ADMIN PORTAL (LOGIN OR REGISTER) */}
          {authMode === 'ADMIN' && adminSubMode === 'LOGIN' && (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="email" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="admin@francisxavier.ac.in"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="••••••••"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold font-mono uppercase tracking-wider text-xs transition shadow-md disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                <LogIn size={16} />
                <span>{loading ? 'Authenticating Admin...' : 'Sign In as Admin'}</span>
              </button>

              {/* Toggle to Register */}
              <div className="pt-3 text-center border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleSwitchAdminSubMode('REGISTER')}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white font-medium inline-flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <span>Need to create an admin account?</span>
                  <strong className="underline decoration-zinc-400">Register here</strong>
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: ADMIN REGISTRATION FORM */}
          {authMode === 'ADMIN' && adminSubMode === 'REGISTER' && (
            <form onSubmit={handleAdminRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="Admin Name"
                    value={adminForm.fullName}
                    onChange={(e) => setAdminForm({...adminForm, fullName: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="email" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="admin@francisxavier.ac.in"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  New Password (min 6 chars)
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="••••••••"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Admin Secret Passkey
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Default: admin123</span>
                </div>
                <div className="relative">
                  <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type={showSecretKey ? "text" : "password"} 
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-mono text-sm"
                    placeholder="Enter admin passkey"
                    value={adminForm.secretKey}
                    onChange={(e) => setAdminForm({...adminForm, secretKey: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                  >
                    {showSecretKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold font-mono uppercase tracking-wider text-xs transition shadow-md disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                <UserPlus size={16} />
                <span>{loading ? 'Registering Account...' : 'Create Admin Account'}</span>
              </button>

              {/* Toggle to Login */}
              <div className="pt-2.5 text-center border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleSwitchAdminSubMode('LOGIN')}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white font-medium inline-flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <span>Already have an admin account?</span>
                  <strong className="underline decoration-zinc-400">Sign in here</strong>
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            Secure Attendance Verification Platform
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
