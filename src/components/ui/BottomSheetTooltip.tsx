'use client';

import React, { useState, useEffect, useRef } from 'react';

type BottomSheetTooltipProps = {
  text: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
};

export default function BottomSheetTooltip({ text, children, iconOnly = false }: BottomSheetTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the bottom sheet
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default click events if it wraps a link, but only when opening the sheet
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const triggerContent = iconOnly || !children ? (
    <span 
      className="inline-flex items-center justify-center text-on-surface-variant/70 hover:text-primary transition-colors cursor-help md:cursor-default"
      onClick={handleToggle}
      onTouchEnd={handleToggle}
    >
      <span className="material-symbols-outlined text-[16px]">info</span>
    </span>
  ) : (
    <div className="relative inline-flex items-center group/inner">
      <div 
        className=""
        // Don't intercept clicks on desktop or if it's already a functional button
      >
        {children}
      </div>
      {/* Subtle Info Icon next to children on mobile to indicate tapability for tooltip */}
      <div 
        className="md:hidden ml-1.5 text-on-surface-variant/50 cursor-pointer p-1.5 -m-1.5"
        onClick={handleToggle}
      >
        <span className="material-symbols-outlined text-[16px] text-primary">info</span>
      </div>
    </div>
  );

  return (
    <div className="relative inline-block group/tooltip align-middle">
      {/* Trigger */}
      {triggerContent}

      {/* Desktop Tooltip (Hidden on mobile) */}
      <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-container-highest text-on-surface text-xs font-mono font-bold rounded shadow-[0_4px_20px_rgba(88,28,135,0.08)] whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none border border-outline-variant">
        {text}
        {/* Tooltip Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-outline-variant"></div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-highest -mt-[1px]"></div>
      </div>

      {/* Mobile Bottom Sheet Overlay (Hidden on desktop) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Sheet */}
          <div 
            ref={sheetRef}
            className="relative bg-surface border-t-2 border-outline-variant rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-6 pt-3 animate-in slide-in-from-bottom duration-300"
          >
            {/* Handle/Pill */}
            <div className="w-12 h-1.5 bg-outline-variant/40 rounded-full mx-auto mb-6"></div>
            
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 border border-secondary/20">
                <span className="material-symbols-outlined text-2xl">info</span>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="font-display text-xl font-bold text-primary mb-2">Information</h3>
                <p className="font-body text-base text-on-surface-variant leading-relaxed">
                  {text}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="w-full mt-4 py-4 bg-primary-container text-on-primary-container rounded-xl font-bold font-mono tracking-widest text-sm uppercase hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
