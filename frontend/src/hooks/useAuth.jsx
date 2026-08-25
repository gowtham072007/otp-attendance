import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getDeviceId, getDeviceName, getDeviceInfo } from '../utils/device';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);

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

  const login = async (identifier, password = null, fullName = null) => {
    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

      const response = await api.post('/auth/login', {
        identifier: identifier.trim(),
        password: password ? password.trim() : null,
        full_name: fullName ? fullName.trim() : null,
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
      return response.data;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const loginGoogle = async (email, fullName = '', googleId = '', picture = '') => {
    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

      const response = await api.post('/auth/google', {
        email: email.trim(),
        full_name: fullName.trim(),
        google_id: googleId,
        picture: picture,
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
      return response.data;
    } catch (error) {
      console.error("Google login failed", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      navigate('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginGoogle, logout, deviceInfo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

