import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

/**
 * Startup / Splash Screen for Attendance Management System
 * 
 * Features:
 * - Perfectly centered existing logo (/logo.png) without modifying colors or dimensions
 * - Two-cycle smooth fade in / glow / fade out logo animation
 * - Final fade in with momentary hold before seamless dissolve to Login page
 * - Modern, minimal progress loader and branding typography
 * - Responsive layout across mobile, tablet, laptop, and desktop
 * - Zero layout shifts with fixed overlay and smooth crossfade
 */
export default function SplashScreen({ onFinish }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Total splash sequence timing:
    // 0.0s - 3.45s: Logo blink cycles & hold sequence + loading progress bar
    // 3.45s: Initiate smooth crossfade out of the splash overlay
    // 3.95s: Complete splash screen unmount, revealing login page seamlessly
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3450);

    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3950);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 350);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 bg-[#fafafa] dark:bg-[#09090b] bg-grid-pattern transition-opacity duration-500 ease-in-out select-none cursor-default ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Attendance Management System Startup Screen"
      role="dialog"
      aria-modal="true"
    >
      {/* Ambient background glow matching application theme */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[560px] h-[420px] sm:h-[560px] bg-gradient-to-tr from-emerald-500/10 via-zinc-200/20 to-teal-500/10 dark:from-emerald-950/20 dark:via-zinc-900/30 dark:to-teal-950/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Centered Content */}
      <div className="flex flex-col items-center justify-center text-center max-w-sm sm:max-w-md w-full px-4">
        
        {/* Logo Container with Halo and Blink Animation */}
        <div className="relative flex items-center justify-center">
          {/* Subtle Ambient Halo Glow pulsing behind the logo */}
          <div className="absolute -inset-6 sm:-inset-8 rounded-full bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-red-500/20 blur-2xl pointer-events-none splash-halo-animated" />

          {/* Sharp, Pristine Logo Frame */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-3xl bg-white p-3 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xl flex items-center justify-center overflow-hidden splash-logo-animated">
            <img
              src="/logo.png"
              alt="Attendance Management System Logo"
              className="w-full h-full object-contain rounded-2xl select-none"
              draggable="false"
            />
          </div>
        </div>

        {/* Text and Subtle Loading Effect */}
        <div className="mt-7 sm:mt-8 flex flex-col items-center splash-content-fade">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Attendance Management System
          </h1>
          
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase mt-2">
            Secure Attendance Verification Platform
          </p>

          {/* Subtle Professional Loading Bar */}
          <div className="w-48 sm:w-56 h-1.5 bg-zinc-200/90 dark:bg-zinc-800 rounded-full overflow-hidden mt-6 relative shadow-inner">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-full splash-progress-bar relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent splash-shimmer" />
            </div>
          </div>

          {/* Status Indicator */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-full mt-4 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>SECURE INITIALIZATION</span>
          </div>
        </div>
      </div>
    </div>
  );
}
