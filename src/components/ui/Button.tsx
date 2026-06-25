import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-3 font-mono text-sm uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-on-primary ticket-cutout hover:opacity-90",
    secondary: "bg-secondary text-on-secondary ticket-cutout hover:opacity-90",
    outline: "border-2 border-primary/20 text-primary hover:bg-primary/5 rounded-md",
    danger: "bg-error text-on-error ticket-cutout hover:opacity-90"
  };

  const isTicket = variant === 'primary' || variant === 'secondary' || variant === 'danger';

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2 pr-4">
        {children}
      </span>
      {isTicket && (
        <div className="absolute right-4 top-0 bottom-0 w-px border-r-2 border-dashed border-current opacity-30" />
      )}
    </button>
  );
}
