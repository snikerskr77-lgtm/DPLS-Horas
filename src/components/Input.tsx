'use client';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono',
              'focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20',
              'placeholder:text-gray-600 transition-all duration-200',
              icon ? 'pl-10' : '',
              error && 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
