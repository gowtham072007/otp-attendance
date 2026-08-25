// Device Identification & Fingerprint Utility

const DEVICE_STORAGE_KEY = 'otp_attendance_device_id';

/**
 * Generates a standard RFC4122 v4 UUID string
 */
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Retrieves the persistent unique device ID from localStorage or creates a new UUID.
 */
export const getDeviceId = () => {
  try {
    let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (err) {
    console.warn("Could not access localStorage for device ID", err);
    return 'temp_device_' + Date.now();
  }
};

/**
 * Returns a human-friendly name describing the client browser and operating system.
 * Example: "Chrome on Windows", "Safari on iPhone", "Edge on macOS"
 */
export const getDeviceName = () => {
  if (typeof navigator === 'undefined') return 'Unknown Device';

  const userAgent = navigator.userAgent || '';
  let browser = 'Browser';
  let os = 'Unknown OS';

  // Detect OS
  if (/Windows NT 10.0/i.test(userAgent)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(userAgent)) os = 'Windows';
  else if (/iPhone/i.test(userAgent)) os = 'iPhone';
  else if (/iPad/i.test(userAgent)) os = 'iPad';
  else if (/Macintosh|Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  // Detect Browser
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/Chrome\//i.test(userAgent) && !/Chromium|Edg/i.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//i.test(userAgent) && !/Chrome|Chromium|Edg/i.test(userAgent)) browser = 'Safari';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) browser = 'Opera';

  return `${browser} on ${os}`;
};
