import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-surface-container rounded-md p-6 shadow-ambient border border-outline/20 relative ${className}`}
      {...props}
    >
      <div className="absolute inset-1 border border-primary/20 pointer-events-none rounded-sm" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
