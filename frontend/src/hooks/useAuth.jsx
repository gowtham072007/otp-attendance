import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getDeviceId, getDeviceName } from '../utils/device';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
        } catch (error) {
          console.error("Failed to fetch user", error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (email, fullName) => {
    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();
      const response = await api.post('/auth/login', { 
        email, 
        full_name: fullName,
        device_id: deviceId,
        device_name: deviceName
      });
      localStorage.setItem('token', response.data.access_token);
      
      const userData = response.data.user;
      setUser(userData);
      
      if (userData && userData.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };


  const adminLogin = async (email, password) => {
    try {
      const response = await api.post('/auth/admin/login', { 
        email, 
        password
      });
      localStorage.setItem('token', response.data.access_token);
      
      const userData = response.data.user;
      setUser(userData);
      navigate('/admin');
      return userData;
    } catch (error) {
      console.error("Admin Login failed", error);
      throw error;
    }
  };

  const adminRegister = async (fullName, email, password, adminSecretKey) => {
    try {
      const response = await api.post('/auth/admin/register', { 
        full_name: fullName,
        email, 
        password,
        admin_secret_key: adminSecretKey
      });
      
      if (response.data.is_approved && response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        const userData = response.data.user;
        setUser(userData);
        navigate('/admin');
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      console.error("Admin Registration failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, adminRegister, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
