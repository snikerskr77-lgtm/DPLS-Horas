'use client';

import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { forwardRef, useRef } from 'react';

interface TimeInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  ({ label, value, onChange, required, disabled, placeholder = '00:00' }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/[^\d:]/g, '');

      // Auto-format: add colon after 2 digits
      if (v.length === 2 && !v.includes(':')) {
        v = v + ':';
      }

      // Limit to HH:MM format
      if (v.length > 5) {
        v = v.slice(0, 5);
      }

      onChange(v);
    };

    const handleBlur = () => {
      if (!value) return;

      // Validate and fix on blur
      const parts = value.split(':');
      if (parts.length === 2) {
        let hours = parseInt(parts[0], 10);
        let mins = parseInt(parts[1], 10);
        if (isNaN(hours)) hours = 0;
        if (isNaN(mins)) mins = 0;
        if (hours > 23) hours = 23;
        if (mins > 59) mins = 59;
        onChange(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
      } else if (parts.length === 1 && parts[0].length <= 2) {
        let hours = parseInt(parts[0], 10);
        if (isNaN(hours)) hours = 0;
        if (hours > 23) hours = 23;
        onChange(`${String(hours).padStart(2, '0')}:00`);
      }
    };

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {label}
          </label>
        )}
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={5}
            className={cn(
              'w-full px-3 py-2 pl-10 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono',
              'focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20',
              'placeholder:text-gray-600 transition-all duration-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
            24H
          </span>
        </div>
      </div>
    );
  }
);

TimeInput.displayName = 'TimeInput';

export default TimeInput;
