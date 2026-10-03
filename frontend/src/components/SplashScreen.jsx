import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

/**
 * Smooth Rotating Attendance Logo Startup Animation
 * 
 * - Clean white / off-white background
 * - Existing Attendance logo (/logo.png) centered in rounded white card container
 * - 0.0s: Starts small (80%) and transparent
 * - 0.3s–1.3s: Smooth 360° rotation + fade/scale in (80% -> 100%)
 * - 1.3s–1.6s: Short hold, logo centered & upright
 * - 1.6s–2.4s: Second smooth 360° rotation at a slower speed
 * - 2.4s–2.8s: Soft mint/green glow & pulse
 * - 2.8s: Smooth transition to existing Login page
 * - Respects prefers-reduced-motion
 */
export default function SplashScreen({ onFinish }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Sequence timing:
    // 2.8s: Full rotation sequence and soft glow complete -> initiate smooth transition
    // 3.15s: Complete unmount, smoothly revealing the Login page
    const exitDelay = prefersReducedMotion ? 1000 : 2800;
    const finishDelay = prefersReducedMotion ? 1350 : 3150;

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
    }, 250);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#ffffff] transition-opacity duration-350 ease-out select-none cursor-default ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Application Startup"
      role="dialog"
      aria-modal="true"
    >
      {/* Soft Mint/Green Ambient Glow centered behind the logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none -z-10 logo-ambient-glow" />

      {/* Rounded-Square White Card Container with Rotating Centered Logo */}
      <div className="relative flex items-center justify-center">
        <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[28px] sm:rounded-[32px] bg-white p-3.5 sm:p-4 border border-zinc-100/90 flex items-center justify-center overflow-hidden logo-splash-card">
          <img
            src="/logo.png"
            alt="Attendance Management System Logo"
            className="w-full h-full object-contain select-none pointer-events-none logo-rotate-element"
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}
