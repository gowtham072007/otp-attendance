import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, CalendarCheck, Clock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#fafafa] bg-grid-pattern flex flex-col items-center justify-center p-4 relative overflow-hidden text-zinc-900">
      {/* Decorative Monochrome Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-zinc-200/50 to-zinc-100/30 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10">
        <div className="hidden md:flex flex-col space-y-8 pr-8">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-black text-white text-xs font-mono tracking-wider uppercase rounded-full w-fit">
              <span>● Attendance OS</span>
            </div>
            <h1 className="text-5xl font-black text-black tracking-tight leading-tight">
              Modern <span className="gradient-text">OTP-Based</span> Attendance
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Secure, fast, and reliable attendance tracking for modern classrooms and organizations.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start space-x-3.5 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm transition-all hover:border-zinc-400">
              <div className="bg-zinc-100 p-2.5 rounded-xl text-black border border-zinc-200"><Clock size={22} /></div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Time Limited</h3>
                <p className="text-xs text-zinc-500 mt-0.5">OTPs expire automatically</p>
              </div>
            </div>
            <div className="flex items-start space-x-3.5 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm transition-all hover:border-zinc-400">
              <div className="bg-zinc-100 p-2.5 rounded-xl text-black border border-zinc-200"><ShieldCheck size={22} /></div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Instant Access</h3>
                <p className="text-xs text-zinc-500 mt-0.5">No passwords required</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 md:p-10 rounded-3xl w-full max-w-md mx-auto border border-zinc-200/80 bg-white/90 shadow-2xl">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-black p-4 rounded-2xl shadow-md mb-5 text-white">
              <CalendarCheck size={36} />
            </div>
            <h2 className="text-2xl font-black text-black tracking-tight">Welcome Back</h2>
            <p className="text-zinc-500 text-sm mt-1">Enter your details to continue.</p>
          </div>

          {error && (
            <div className="bg-zinc-100 border border-zinc-300 text-zinc-900 px-4 py-3 rounded-xl mb-6 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">Full Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-zinc-50/50 text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-black focus:ring-4 focus:ring-zinc-100 outline-none transition font-medium text-sm"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-zinc-50/50 text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-black focus:ring-4 focus:ring-zinc-100 outline-none transition font-medium text-sm"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-lg disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              <span>{loading ? 'Logging in...' : 'Continue'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-zinc-400">
            By signing in, you agree to our Terms of Service.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
