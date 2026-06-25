import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && <label className="font-mono text-xs text-on-surface-variant uppercase tracking-wider">{label}</label>}
        <input
          ref={ref}
          className={`bg-transparent border-b-2 border-outline/30 px-0 py-2 font-body text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:font-serif placeholder:italic ${
            error ? 'border-error focus:border-error' : ''
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-error font-body">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
