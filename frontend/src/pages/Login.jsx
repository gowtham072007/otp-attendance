import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Smartphone, 
  Lock, 
  Mail, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Laptop, 
  HelpCircle,
  KeyRound,
  Sparkles
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const { login, loginGoogle, user, deviceInfo } = useAuth();
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'direct' | 'google'
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'DEVICE_MISMATCH' | 'INVALID_CREDENTIALS' | 'DISABLED' | 'GENERAL'
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    name: '',
    email: ''
  });
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!formData.identifier) {
      setError("Please enter your Username or Gmail address.");
      setErrorType('GENERAL');
      return;
    }
    if (!formData.password) {
      setError("Please enter your Password.");
      setErrorType('GENERAL');
      return;
    }
    
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      await login(formData.identifier, formData.password, formData.name);
    } catch (err) {
      const detail = err.response?.data?.detail || "Authentication failed. Please check your credentials.";
      setError(detail);
      
      if (detail.includes("already linked to another device")) {
        setErrorType('DEVICE_MISMATCH');
      } else if (detail.includes("Invalid credentials")) {
        setErrorType('INVALID_CREDENTIALS');
      } else if (detail.includes("disabled")) {
        setErrorType('DISABLED');
      } else {
        setErrorType('GENERAL');
      }
      setLoading(false);
    }
  };

  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      setError("Please enter your registered Gmail/Email ID.");
      setErrorType('GENERAL');
      return;
    }
    if (!formData.name) {
      setError("Please enter your Full Name.");
      setErrorType('GENERAL');
      return;
    }
    
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      await login(formData.email, null, formData.name);
    } catch (err) {
      const detail = err.response?.data?.detail || "Direct login failed. Please contact administrator.";
      setError(detail);
      
      if (detail.includes("already linked to another device")) {
        setErrorType('DEVICE_MISMATCH');
      } else if (detail.includes("disabled")) {
        setErrorType('DISABLED');
      } else {
        setErrorType('GENERAL');
      }
      setLoading(false);
    }
  };

  const handleMockGoogleLogin = async () => {
    const promptEmail = prompt("Enter your Google / Gmail ID for Sign-In:", formData.identifier || "student@college.edu");
    if (!promptEmail) return;
    
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      await loginGoogle(promptEmail, promptEmail.split('@')[0].toUpperCase());
    } catch (err) {
      const detail = err.response?.data?.detail || "Google Sign-In failed.";
      setError(detail);
      if (detail.includes("already linked to another device")) {
        setErrorType('DEVICE_MISMATCH');
      } else {
        setErrorType('GENERAL');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern flex flex-col items-center justify-center p-4 relative overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-6 right-6 z-20 flex items-center space-x-2">
        <ThemeToggle />
      </div>

      {/* Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-zinc-200/50 to-zinc-100/30 dark:from-zinc-800/30 dark:to-zinc-900/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10">
        
        {/* Left Side: App Hero & Device Policy Info */}
        <div className="hidden md:flex flex-col space-y-8 pr-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-mono tracking-wider uppercase rounded-full w-fit shadow-xs">
                <span>● Attendance OS 2.0</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium rounded-full">
                <ShieldCheck size={14} />
                <span>Device Binding Protected</span>
              </div>
            </div>
            
            <h1 className="text-5xl font-black text-black dark:text-white tracking-tight leading-tight">
              One Device, <br /><span className="gradient-text">Zero Proxy</span> Attendance.
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every student account is uniquely locked to their registered device. High-precision geofencing and dynamic OTPs guarantee authentic attendance.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                <Smartphone size={22} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">1 Account = 1 Device</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Strict hardware fingerprint binding</p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700">
                <Clock size={22} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">30s Rolling OTPs</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Automatic expiry protection</p>
              </div>
            </div>
          </div>

          {/* Current Device Preview */}
          {deviceInfo && (
            <div className="flex items-center space-x-3 bg-zinc-100/80 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <Laptop size={16} className="text-zinc-500 shrink-0" />
              <div className="flex-1 truncate">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">Current Device: </span>
                <span>{deviceInfo.deviceName}</span>
                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 ml-2">({deviceInfo.deviceId.substring(0, 10)}...)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Login Card */}
        <div className="glass-panel p-8 md:p-10 rounded-3xl w-full max-w-md mx-auto border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/85 shadow-2xl">
          
          <div className="flex flex-col items-center mb-6 text-center">
            <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">Portal Login</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Sign in with your registered account</p>
          </div>

          {/* Auth Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl mb-6 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                authMode === 'password'
                  ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <KeyRound size={14} />
              <span>Password Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('direct'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                authMode === 'direct'
                  ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Mail size={14} />
              <span>Direct Whitelist</span>
            </button>
          </div>

          {/* Device Mismatch Error Callout */}
          {error && errorType === 'DEVICE_MISMATCH' && (
            <div className="bg-red-500/10 border-2 border-red-500/40 dark:border-red-500/50 text-red-700 dark:text-red-300 p-4 rounded-2xl mb-6 text-xs animate-shake">
              <div className="flex items-start space-x-3">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <div className="font-bold text-sm text-red-800 dark:text-red-200">Device Mismatch Detected</div>
                  <p className="leading-relaxed">{error}</p>
                  <div className="pt-2 border-t border-red-500/20 mt-2 text-[11px] text-red-600/90 dark:text-red-400/90">
                    💡 <strong>Need to change device?</strong> Request an <strong>Admin Device Reset</strong> from your instructor or department coordinator.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General / Invalid Credential Error */}
          {error && errorType !== 'DEVICE_MISMATCH' && (
            <div className="bg-red-500/10 border border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-6 text-sm text-center font-medium">
              {error}
            </div>
          )}

          {/* Form: Password Login Mode */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Username or Gmail ID
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="e.g. gowtham@college.edu or admin@example.com"
                    value={formData.identifier}
                    onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                  />
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-lg disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                <span>{loading ? 'Authenticating & Verifying Device...' : 'Sign In with Device'}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {/* Form: Direct Email Mode */}
          {authMode === 'direct' && (
            <form onSubmit={handleDirectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Authorized Gmail / Email Address
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                    placeholder="username@francisxavier.ac.in"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-lg disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                <span>{loading ? 'Verifying Authorization...' : 'Continue to Dashboard'}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {/* Google Sign-in Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>
            <span className="relative px-3 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Or Sign In With
            </span>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleMockGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white hover:bg-zinc-50 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-sm transition shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google / Gmail Account</span>
          </button>
          
          {/* Security & Device Disclaimer */}
          <div className="mt-6 pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center space-x-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Strict One-Device Policy Enforced on Backend</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;

