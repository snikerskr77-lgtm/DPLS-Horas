'use client';

import { useEffect, useState } from 'react';
import { Users, Clock, Calendar, TrendingUp, Trash2, AlertTriangle } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import Button from '@/components/Button';
import { formatMinutesToHours } from '@/lib/utils';

interface DashboardData {
  stats: {
    totalEmployees: number;
    thisWeekHours: string;
    thisWeekMinutes: number;
    lastWeekMinutes: number;
    percentChange: number;
    todayEntries: number;
    totalEntries: number;
  };
  todayActivity: Array<{
    employeeId: string;
    employeeName: string;
    entryTime: string;
    exitTime: string | null;
    totalMinutes: number;
    totalFormatted: string;
  }>;
  chartData: Array<{
    day: string;
    date: string;
    hours: number;
  }>;
  topEmployees: Array<{
    name: string;
    hours: string;
    minutes: number;
  }>;
  weekRange: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string; stats?: { registosEliminados: number; faltasEliminadas: number; funcionariosEliminados: number } } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const maxHours = Math.max(...(data?.chartData?.map(d => d.hours) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Dashboard</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Semana {data?.weekRange || ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold font-mono">
            <Calendar className="w-4 h-4" />
            <span>SEMANA ATUAL</span>
          </div>
          <Button variant="danger" size="sm" onClick={() => { setShowClearModal(true); setClearResult(null); setConfirmText(''); }} icon={<Trash2 className="w-3.5 h-3.5" />}>
            Limpar Tudo
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Funcionários"
          value={data?.stats.totalEmployees || 0}
          subtitle={`${data?.stats.totalEmployees || 0} ativos`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="Horas esta Semana"
          value={data?.stats.thisWeekHours || '0h00m'}
          subtitle={`${data?.stats.totalEntries || 0} registos`}
          change={data?.stats.percentChange}
          icon={<Clock className="w-5 h-5" />}
          color="green"
        />
        <StatsCard
          title="Registos Hoje"
          value={data?.stats.todayEntries || 0}
          subtitle="Picagens de ponto"
          icon={<Calendar className="w-5 h-5" />}
          color="amber"
        />
        <StatsCard
          title="Performance"
          value={data?.stats.percentChange ? `${data.stats.percentChange > 0 ? '+' : ''}${data.stats.percentChange}%` : '0%'}
          subtitle="vs semana anterior"
          icon={<TrendingUp className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5 neon-blue">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">
            Horas por Dia
          </h2>
          <div className="flex items-end justify-between gap-3 h-48">
            {data?.chartData?.map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-40">
                  <span className="text-[10px] font-bold font-mono text-gray-500 mb-1">
                    {item.hours}h
                  </span>
                  <div
                    className="w-full max-w-[36px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-500"
                    style={{ height: `${(item.hours / maxHours) * 100}%`, minHeight: item.hours > 0 ? '6px' : '0' }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-300">{item.day}</p>
                  <p className="text-[10px] text-gray-600 font-mono">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Employees */}
        <div className="glass-card rounded-xl p-5 neon-amber">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">
            Top Funcionários
          </h2>
          <div className="space-y-4">
            {data?.topEmployees?.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8 font-mono">
                Sem dados esta semana
              </p>
            ) : (
              data?.topEmployees?.map((emp, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold border ${
                      index === 0 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                      index === 1 ? 'bg-gray-500/20 border-gray-500/30 text-gray-400' :
                      index === 2 ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' :
                      'bg-neutral-800 border-white/10 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-300 truncate">
                      {emp.name}
                    </p>
                    <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-1 rounded-full transition-all duration-500"
                        style={{ width: `${(emp.minutes / (data.topEmployees[0]?.minutes || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-amber-400">{emp.hours}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="glass-card rounded-xl p-5 neon-green">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Atividade de Hoje
          </h2>
          <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-[10px] font-bold font-mono">
            {data?.todayActivity?.length || 0} REGISTOS
          </span>
        </div>
        
        {data?.todayActivity?.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum registo de ponto hoje</p>
            <p className="text-xs text-gray-600 mt-1 font-mono">Os registos aparecerão aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Funcionário</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Entrada</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saída</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data?.todayActivity?.map((entry, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] font-bold">
                          {entry.employeeName?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-bold text-gray-300">{entry.employeeName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-green-400">{entry.entryTime}</td>
                    <td className="py-3 px-4 text-sm font-mono text-red-400">{entry.exitTime || '--:--'}</td>
                    <td className="py-3 px-4 text-sm font-mono font-bold text-amber-400">{entry.totalFormatted}</td>
                    <td className="py-3 px-4">
                      {entry.exitTime ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-[10px] font-bold">
                          COMPLETO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold">
                          EM CURSO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Limpar Tudo */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowClearModal(false)} />
          <div className="relative w-full max-w-md mx-4 glass-card rounded-xl neon-red overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-red-400">Limpar Todos os Dados</h2>
                <p className="text-[10px] text-gray-500 font-mono">Esta ação é irreversível</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {clearResult ? (
                <div className={`p-4 rounded-lg border ${clearResult.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <p className={`text-xs font-bold ${clearResult.success ? 'text-green-400' : 'text-red-400'}`}>{clearResult.message}</p>
                  {clearResult.stats && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="bg-black/30 rounded p-2 text-center border border-white/5">
                        <p className="text-lg font-extrabold font-mono text-red-400">{clearResult.stats.registosEliminados}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Registos</p>
                      </div>
                      <div className="bg-black/30 rounded p-2 text-center border border-white/5">
                        <p className="text-lg font-extrabold font-mono text-red-400">{clearResult.stats.faltasEliminadas}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Faltas</p>
                      </div>
                      <div className="bg-black/30 rounded p-2 text-center border border-white/5">
                        <p className="text-lg font-extrabold font-mono text-red-400">{clearResult.stats.funcionariosEliminados}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Funcionários</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button variant="secondary" onClick={() => { setShowClearModal(false); if (clearResult.success) fetchDashboard(); }}>Fechar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400 font-mono leading-relaxed">
                      <strong>ATENÇÃO:</strong> Isto vai eliminar permanentemente:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-red-400/80 font-mono">
                      <li>• Todos os registos de picagem de ponto</li>
                      <li>• Todas as faltas registadas</li>
                      <li>• Todos os funcionários</li>
                    </ul>
                    <p className="mt-2 text-xs text-red-400/60 font-mono">
                      Esta ação <strong>NÃO pode ser desfeita</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Escreva ELIMINAR para confirmar
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="ELIMINAR"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-red-500/50 placeholder:text-gray-700"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setShowClearModal(false)}>Cancelar</Button>
                    <Button
                      variant="danger"
                      loading={clearing}
                      disabled={confirmText !== 'ELIMINAR'}
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={async () => {
                        setClearing(true);
                        try {
                          const res = await fetch('/api/clear-all', { method: 'DELETE' });
                          const d = await res.json();
                          setClearResult(d);
                        } catch {
                          setClearResult({ success: false, message: 'Erro de conexão' });
                        } finally {
                          setClearing(false);
                        }
                      }}
                    >
                      Eliminar Tudo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
