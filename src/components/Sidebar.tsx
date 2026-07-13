'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  FileBarChart, 
  Menu,
  X,
  MessageSquare,
  Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn, PT_TIMEZONE } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/time-entries', label: 'Picagem de Ponto', icon: Clock },
  { href: '/employees', label: 'Funcionários', icon: Users },
  { href: '/reports', label: 'Relatórios', icon: FileBarChart },
  { href: '/discord', label: 'Discord Sync', icon: MessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [time, setTime] = useState('');

  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: PT_TIMEZONE }));
      setDateStr(now.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', timeZone: PT_TIMEZONE }));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900/90 backdrop-blur text-white rounded-lg border border-white/10"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-950/90 backdrop-blur-md border-r border-white/5 transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-900 border border-blue-500/30">
                <Shield className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-extrabold tracking-widest font-mono uppercase">
                    TimeTrack
                  </h1>
                  <span className="animate-ping w-2 h-2 rounded-full bg-red-500" />
                </div>
                <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                  SISTEMA DE PONTO
                  <span className="text-gray-600">•</span>
                  <span className="text-amber-400/90 font-bold">PRO</span>
                </p>
              </div>
            </div>
          </div>

          {/* Clock - Portugal timezone */}
          <div className="px-5 py-3 border-b border-white/5">
            <div className="bg-neutral-900/80 border border-white/10 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-mono font-bold tracking-wider text-gray-300">{time}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                <span className="text-[10px] text-gray-600">•</span>
                <span className="text-[10px] text-amber-500/80 font-bold font-mono">PT 🇵🇹</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">
              Navegação
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200",
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 neon-blue"
                      : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-neutral-900/80 border border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <div>
                <p className="text-xs font-bold">Admin</p>
                <p className="text-[10px] text-gray-500 font-mono">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
