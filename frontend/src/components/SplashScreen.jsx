import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

/**
 * Single 3D Flip Rotation Attendance Logo Startup Animation
 * 
 * - Horizontal 3D flip effect similar to flipping a card
 * - Clean white / off-white background
 * - Existing Attendance logo (/logo.png) centered in rounded white container
 * - 0.0s: Logo appears small (80%) and slightly transparent
 * - 0.2s: Logo starts the flip
 * - 0.2s–1.2s: Smoothly rotates 180° on Y-axis with realistic 3D perspective
 * - 1.2s–1.6s: Settles into normal front-facing position
 * - 1.6s–2.2s: Subtle mint/green glow blooms around the logo
 * - 2.2s–2.6s: Smooth fade out directly into existing Login page
 * - Only ONE flip, no continuous spinning, respects prefers-reduced-motion
 */
export default function SplashScreen({ onFinish }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Timing Sequence:
    // 2.2s: 3D flip & mint glow sequence complete -> initiate smooth crossfade
    // 2.6s: Splash screen unmounts, revealing the Login page
    const exitDelay = prefersReducedMotion ? 900 : 2200;
    const finishDelay = prefersReducedMotion ? 1250 : 2600;

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
    }, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#ffffff] transition-opacity duration-400 ease-out select-none cursor-default ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Application Startup"
      role="dialog"
      aria-modal="true"
    >
      {/* Soft Mint/Green Ambient Glow centered behind the logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none -z-10 logo-ambient-glow" />

      {/* 3D Perspective Wrapper */}
      <div className="relative flex items-center justify-center logo-perspective-wrapper">
        {/* Single 3D Flip Card Container */}
        <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-[28px] sm:rounded-[32px] logo-flip-card relative">
          
          {/* Front Face: The existing Attendance logo */}
          <div className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[32px] bg-white p-3.5 sm:p-4 border border-zinc-100/90 flex items-center justify-center overflow-hidden card-face card-front shadow-md">
            <img
              src="/logo.png"
              alt="Attendance Management System Logo"
              className="w-full h-full object-contain select-none pointer-events-none"
              draggable="false"
            />
          </div>

          {/* Back Face: Clean matching white card */}
          <div className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[32px] bg-white p-3.5 sm:p-4 border border-zinc-100/90 flex items-center justify-center overflow-hidden card-face card-back shadow-md">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-50/90 border border-zinc-200/60 flex items-center justify-center shadow-inner">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 animate-pulse" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
