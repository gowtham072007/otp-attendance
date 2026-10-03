import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

/**
 * Logo-Focused Startup / Splash Animation
 * 
 * - Focused strictly on the original Attendance logo
 * - Clean white / off-white background with soft mint/green ambient glow
 * - Rounded-square white card with soft shadow and subtle green glow
 * - Sequence: Smooth scale-up reveal -> soft glow -> 2 gentle pulses -> hold -> smooth fade to Login
 * - Respects prefers-reduced-motion
 */
export default function SplashScreen({ onFinish }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Timing:
    // Regular: 2.35s logo animation & hold -> 2.4s fade-out starts -> 2.8s complete unmount
    // Reduced motion: 1.0s simple hold -> 1.4s complete unmount
    const exitDelay = prefersReducedMotion ? 1000 : 2350;
    const finishDelay = prefersReducedMotion ? 1400 : 2800;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, exitDelay);

    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, finishDelay);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 300);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#ffffff] transition-opacity duration-450 ease-out select-none cursor-default ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Application Startup"
      role="dialog"
      aria-modal="true"
    >
      {/* Soft Mint/Green Ambient Glow centered behind the logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none -z-10 logo-ambient-glow" />

      {/* Rounded-Square White Card with Centered Original Logo */}
      <div className="relative flex items-center justify-center">
        <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[28px] sm:rounded-[32px] bg-white p-3.5 sm:p-4 border border-zinc-100/90 flex items-center justify-center overflow-hidden logo-splash-card">
          <img
            src="/logo.png"
            alt="Attendance Management System Logo"
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}
