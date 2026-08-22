import React, { useState, useEffect } from 'react';
import { Download, Check, Smartphone } from 'lucide-react';

const InstallAppButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If native prompt not ready, alert user how to add to home screen
      alert("To install Attendance OS on your device, tap your browser menu (⋮ or Share) and select 'Add to Home screen' or 'Install App'.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstallClick}
      title="Install Attendance OS on your device"
      className="flex items-center space-x-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all shadow-xs active:scale-95 group"
    >
      <img 
        src="/favicon.svg" 
        alt="Logo" 
        className="w-4 h-4 object-contain group-hover:scale-110 transition-transform" 
      />
      <span className="hidden sm:inline">Install App</span>
      <Download size={13} className="text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors" />
    </button>
  );
};

export default InstallAppButton;
