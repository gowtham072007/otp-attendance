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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center z-10">
        <div className="hidden md:flex flex-col space-y-8 pr-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Modern <span className="gradient-text">OTP-Based</span> Attendance
            </h1>
            <p className="text-xl text-gray-600">
              Secure, fast, and reliable attendance tracking for modern classrooms and organizations.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start space-x-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Clock size={24} /></div>
              <div>
                <h3 className="font-semibold text-gray-800">Time Limited</h3>
                <p className="text-sm text-gray-500">OTPs expire automatically</p>
              </div>
            </div>
            <div className="flex items-start space-x-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
              <div className="bg-green-100 p-2 rounded-lg text-green-600"><ShieldCheck size={24} /></div>
              <div>
                <h3 className="font-semibold text-gray-800">Instant Access</h3>
                <p className="text-sm text-gray-500">No passwords required</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg mb-6">
              <CalendarCheck size={40} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-500 text-center">Enter your details to continue.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition shadow-md disabled:bg-blue-400"
            >
              <span>{loading ? 'Logging in...' : 'Continue'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
