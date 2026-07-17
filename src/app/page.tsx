'use client';

import { useEffect, useState } from 'react';
import { Clock, Users, TrendingUp, Activity, Zap, Trash2 } from 'lucide-react';

interface DashboardData {
  stats: {
    totalEmployees: number;
    thisWeekHours: string;
    thisWeekMinutes: number;
    percentChange: number;
    todayEntries: number;
    allTimeEntries: number;
    allTimeMinutes: number;
  };
  todayActivity: Array<{
    employeeId: string;
    employeeName: string | null;
    entryTime: string;
    exitTime: string | null;
    totalMinutes: number | null;
    totalFormatted: string;
    breakTimesArr: string[];
  }>;
  chartData: Array<{ day: string; date: string; hours: number }>;
  topEmployees: Array<{ name: string | null; hours: string; minutes: number }>;
  weekRange: string;
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(m: number) { const nm = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(nm / 60)).padStart(2, '0')}:${String(nm % 60).padStart(2, '0')}`; }

function allTimesExt(entryTime: string, breakTimes: string[], exitTime: string | null): string[] {
  let prev = toMin(entryTime);
  const breaks: string[] = [];
  for (const bt of breakTimes) {
    let m = toMin(bt);
    while (m < prev) m += 1440;
    breaks.push(fromMin(m));
    prev = m;
  }
  let exitF: string | null = null;
  if (exitTime) { let m = toMin(exitTime); while (m < prev) m += 1440; exitF = fromMin(m); }
  const cleanBreaks = [...breaks];
  if (exitF && cleanBreaks[cleanBreaks.length - 1] === exitF) cleanBreaks.pop();
  const all = [entryTime, ...cleanBreaks, ...(exitF ? [exitF] : [])];
  return all.filter((t, i) => i === 0 || t !== all[i - 1]);
}

function timePairs(times: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < times.length; i += 2) {
    if (i + 1 < times.length) pairs.push([times[i], times[i + 1]]);
  }
  return pairs;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ message: string; stats?: Record<string, number> } | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    await fetch('/api/seed', { method: 'POST' });
    fetchData();
    setSeeding(false);
  };

  const handleClear = async () => {
    setClearing(true);
    const res = await fetch('/api/clear-all', { method: 'DELETE' });
    const result = await res.json();
    setClearResult(result);
    setClearing(false);
    fetchData();
  };

  const maxHours = Math.max(...(data?.chartData?.map(d => d.hours) || [1]), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-1">Visão geral do sistema · {data?.weekRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-600/30 transition-all disabled:opacity-50"
          >
            <Zap className="w-3 h-3 inline mr-1" />
            {seeding ? 'A popular...' : 'Dados Demo'}
          </button>
          <button
            onClick={() => { setShowClearModal(true); setClearResult(null); setConfirmText(''); }}
            className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-600/30 transition-all"
          >
            <Trash2 className="w-3 h-3 inline mr-1" />
            Limpar
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-5 neon-blue">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="w-5 h-5 text-blue-400" /></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Funcionários</span>
          </div>
          <p className="text-3xl font-bold">{data?.stats?.totalEmployees || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Ativos no sistema</p>
        </div>
        <div className="glass-card rounded-2xl p-5 neon-amber">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="w-5 h-5 text-amber-400" /></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Horas Semana</span>
          </div>
          <p className="text-3xl font-bold">{data?.stats?.thisWeekHours || '0h00m'}</p>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            {data?.stats?.percentChange !== undefined && data.stats.percentChange !== 0 && (
              <span className={data.stats.percentChange > 0 ? 'text-green-400' : 'text-red-400'}>
                {data.stats.percentChange > 0 ? '↑' : '↓'} {Math.abs(data.stats.percentChange)}%
              </span>
            )}
            vs semana anterior
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5 neon-green">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-400" /></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Registos Hoje</span>
          </div>
          <p className="text-3xl font-bold">{data?.stats?.todayEntries || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Picagens de ponto</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Activity className="w-5 h-5 text-purple-400" /></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total Registos</span>
          </div>
          <p className="text-3xl font-bold">{data?.stats?.allTimeEntries || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Desde sempre</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Hours Chart */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Horas por Dia</h3>
          <div className="flex items-end gap-2 h-40">
            {data?.chartData?.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 font-mono">{item.hours}h</span>
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all"
                  style={{ height: `${Math.max((item.hours / maxHours) * 100, 4)}%`, minHeight: item.hours > 0 ? '6px' : '0' }}
                />
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 font-mono">{item.day}</p>
                  <p className="text-[9px] text-gray-600">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Employees */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top Funcionários</h3>
          <div className="space-y-3">
            {!data?.topEmployees?.length ? (
              <p className="text-sm text-gray-600">Sem dados esta semana</p>
            ) : (
              data.topEmployees.map((emp, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-300 truncate">{emp.name}</span>
                  <span className="text-sm font-mono text-amber-400">{emp.hours}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today Activity */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Atividade de Hoje</h3>
          <span className="text-[10px] text-gray-600 font-mono">{data?.todayActivity?.length || 0} REGISTOS</span>
        </div>
        {!data?.todayActivity?.length ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum registo de ponto hoje</p>
            <p className="text-gray-600 text-xs mt-1">Os registos aparecerão aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Funcionário</th>
                  <th className="text-left py-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Períodos de Trabalho</th>
                  <th className="text-left py-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total</th>
                  <th className="text-left py-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.todayActivity.map((entry, i) => {
                  const bt = entry.breakTimesArr || [];
                  const times = allTimesExt(entry.entryTime, bt, entry.exitTime);
                  const pairs = timePairs(times);

                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[10px] font-bold">
                            {entry.employeeName?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-gray-300">{entry.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {pairs.map((p, pi) => (
                            <span key={pi} className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 overflow-hidden">
                              <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-blue-200">{p[0]}</span>
                              <span className="text-blue-500/50 text-[9px] px-0.5">→</span>
                              <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-blue-200">{p[1]}</span>
                            </span>
                          ))}
                          {pairs.length === 0 && (
                            <span className="text-sm font-mono text-green-400">{entry.entryTime}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-sm font-mono text-amber-400 font-bold">{entry.totalFormatted}</td>
                      <td className="py-3">
                        {entry.exitTime ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20">COMPLETO</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">EM CURSO</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowClearModal(false)} />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Limpar Todos os Dados
              </h3>
              <p className="text-xs text-gray-500 mt-1">Esta ação é irreversível</p>
            </div>
            {clearResult ? (
              <div className="text-center py-4">
                <p className="text-green-400 mb-3">{clearResult.message}</p>
                {clearResult.stats && (
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(clearResult.stats).map(([key, val]) => (
                      <div key={key} className="bg-white/5 rounded-lg p-2">
                        <p className="text-lg font-bold text-white">{val}</p>
                        <p className="text-[10px] text-gray-500">{key}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowClearModal(false)} className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20 transition-all">Fechar</button>
              </div>
            ) : (
              <>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-300 font-bold mb-1">ATENÇÃO: Isto vai eliminar permanentemente:</p>
                  <ul className="text-xs text-red-300/80 space-y-0.5 ml-2">
                    <li>• Todos os registos de picagem de ponto</li>
                    <li>• Todas as faltas registadas</li>
                    <li>• Todos os funcionários</li>
                  </ul>
                  <p className="text-xs text-red-400 font-bold mt-2">Esta ação NÃO pode ser desfeita.</p>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Escreva ELIMINAR para confirmar</label>
                  <input
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="ELIMINAR"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono uppercase focus:outline-none focus:border-red-500/50 placeholder:text-gray-700"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowClearModal(false)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-all">Cancelar</button>
                  <button
                    onClick={handleClear}
                    disabled={confirmText !== 'ELIMINAR' || clearing}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {clearing ? 'A eliminar...' : 'Eliminar Tudo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
