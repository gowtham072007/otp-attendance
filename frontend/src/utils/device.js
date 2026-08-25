/**
 * Device identification & fingerprinting utility.
 * Generates a persistent, stable Device ID per browser/device and detects
 * friendly device names for UI display and backend device binding.
 */

// Generate random UUID v4
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Returns a persistent Device ID stored in localStorage.
 * If none exists, generates a new one.
 */
export const getDeviceId = () => {
  const STORAGE_KEY = 'attendance_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId || deviceId.trim() === '') {
    deviceId = `dev_${generateUUID().replace(/-/g, '').substring(0, 16)}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
};

/**
 * Detects friendly browser and OS name (e.g. "Chrome on Windows", "Safari on iPhone").
 */
export const getDeviceName = () => {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Detect OS
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) os = 'iPad (iPadOS)';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android Device';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'Chrome OS';

  // Detect Browser
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium|Edg|OPR/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/OPR|Opera\//i.test(ua)) browser = 'Opera';

  return `${browser} on ${os}`;
};

/**
 * Returns complete device metadata.
 */
export const getDeviceInfo = () => {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return {
    deviceId,
    deviceName,
    isMobile,
    userAgent: navigator.userAgent,
    language: navigator.language || 'en'
  };
};
