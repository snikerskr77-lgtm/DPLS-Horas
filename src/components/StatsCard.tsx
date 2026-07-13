'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red';
}

const neonClass = {
  blue: 'neon-blue border-blue-500/20',
  green: 'neon-green border-green-500/20',
  amber: 'neon-amber border-amber-500/20',
  red: 'neon-red border-red-500/20',
};

const iconBg = {
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const valueColor = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

export default function StatsCard({
  title,
  value,
  subtitle,
  change,
  icon,
  color = 'blue',
}: StatsCardProps) {
  return (
    <div className={cn(
      'glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]',
      neonClass[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
          <p className={cn('text-3xl font-extrabold mt-2 font-mono', valueColor[color])}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 font-mono">{subtitle}</p>
          )}
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              ) : change < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span
                className={cn(
                  'text-xs font-bold font-mono',
                  change > 0 && 'text-green-400',
                  change < 0 && 'text-red-400',
                  change === 0 && 'text-gray-500'
                )}
              >
                {change > 0 ? '+' : ''}{change}%
              </span>
              <span className="text-[10px] text-gray-500">vs anterior</span>
            </div>
          )}
        </div>
        <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center border', iconBg[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
