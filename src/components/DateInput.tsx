'use client';

import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { forwardRef, useRef } from 'react';

interface DateInputProps {
  label?: string;
  value: string;         // formato interno: yyyy-MM-dd
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

// Converte yyyy-MM-dd para dd/MM/yyyy para exibição
function toDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Converte dd/MM/yyyy para yyyy-MM-dd para guardar
function toISO(displayDate: string): string {
  const parts = displayDate.split('/');
  if (parts.length !== 3) return displayDate;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, value, onChange, required, disabled }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    const displayValue = toDisplay(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/[^\d/]/g, '');

      // Auto-format: add slash after dd and after mm
      const digits = v.replace(/\//g, '');
      if (digits.length >= 2 && v.length <= 2) {
        v = digits.slice(0, 2) + '/';
      } else if (digits.length >= 4 && v.split('/').length <= 2) {
        v = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/';
      }

      // Limit to dd/mm/yyyy
      if (v.length > 10) {
        v = v.slice(0, 10);
      }

      // If fully typed, convert to ISO for storage
      if (v.length === 10 && v.split('/').length === 3) {
        onChange(toISO(v));
      } else {
        // Store raw display value temporarily — won't be valid ISO until complete
        // We use a data attribute trick: store display as-is and convert on blur
        if (inputRef.current) {
          inputRef.current.dataset.rawDisplay = v;
        }
      }
    };

    const handleBlur = () => {
      const raw = inputRef.current?.dataset.rawDisplay;
      if (raw && raw.length === 10) {
        onChange(toISO(raw));
        if (inputRef.current) {
          inputRef.current.dataset.rawDisplay = '';
        }
      }
    };

    // For the display, use data-rawDisplay if actively editing, otherwise displayValue
    const shownValue = inputRef.current?.dataset.rawDisplay || displayValue;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {label}
          </label>
        )}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            defaultValue={displayValue}
            key={value} // re-render when value changes from parent
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="dd/mm/aaaa"
            required={required}
            disabled={disabled}
            maxLength={10}
            className={cn(
              'w-full px-3 py-2 pl-10 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono',
              'focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20',
              'placeholder:text-gray-600 transition-all duration-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
            PT
          </span>
        </div>
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';

export default DateInput;
