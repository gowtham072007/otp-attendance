import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, CalendarCheck, Clock, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const { login, user } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      setError("Please enter both Name and Email.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await login(formData.email, formData.name);
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern flex flex-col items-center justify-center p-4 relative overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Decorative Monochrome Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-zinc-200/50 to-zinc-100/30 dark:from-zinc-800/30 dark:to-zinc-900/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10">
        <div className="hidden md:flex flex-col space-y-8 pr-8">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-black text-white dark:bg-white dark:text-black text-xs font-mono tracking-wider uppercase rounded-full w-fit shadow-xs">
              <span>● Attendance OS</span>
            </div>
            <h1 className="text-5xl font-black text-black dark:text-white tracking-tight leading-tight">
              Modern <span className="gradient-text">OTP-Based</span> Attendance
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Secure, fast, and reliable attendance tracking for modern classrooms and organizations.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700"><Clock size={22} /></div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Time Limited</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">OTPs expire automatically</p>
              </div>
            </div>
            <div className="flex items-start space-x-3.5 bg-white dark:bg-zinc-900/90 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:border-zinc-400 dark:hover:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-xl text-black dark:text-white border border-zinc-200 dark:border-zinc-700"><ShieldCheck size={22} /></div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Instant Access</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">No passwords required</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 md:p-10 rounded-3xl w-full max-w-md mx-auto border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/85 shadow-2xl">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-black text-white dark:bg-white dark:text-black p-4 rounded-2xl shadow-md mb-5">
              <CalendarCheck size={36} />
            </div>
            <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">Welcome Back</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Enter your details to continue.</p>
          </div>

          {error && (
            <div className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-xl mb-6 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-black dark:focus:border-white focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 outline-none transition font-medium text-sm"
                placeholder="username@francisxavier.ac.in"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-lg disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <span>{loading ? 'Logging in...' : 'Continue'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            By signing in, you agree to our Terms of Service.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
