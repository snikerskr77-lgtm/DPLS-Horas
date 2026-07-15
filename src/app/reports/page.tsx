'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileChartColumnIncreasing, ChevronLeft, ChevronRight, Search, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';

interface DayHeader { date: string; dayOfWeek: number; dowLabel: string; dayMonth: string; isWeekend: boolean; }
interface DailyEntry { totalMinutes: number; entryTime: string; exitTime: string | null; breakStart: string | null; breakEnd: string | null; breakTimes: string[]; periods: string[]; alerts: string | null; }
interface ReportRow { employeeId: string; employeeName: string; weekRange: string; daysWorked: number; missingDays: number; missingDaysList: string[]; totalMinutes: number; totalFormatted: string; hasUnjustifiedAbsence: boolean; hasAlerts: boolean; dailyEntries: Record<string, DailyEntry>; }
interface ReportData { weekStart: string; weekEnd: string; weekRange: string; weekDays: string[]; dayHeaders: DayHeader[]; prevWeekDate: string; nextWeekDate: string; report: ReportRow[]; }

const dowFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(m: number) { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
function fmtHM(m: number) { if (m <= 0) return '0:00'; return fromMin(m); }

function allTimesExt(entryTime: string, breakTimes: string[], exitTime: string | null): string[] {
  let prev = toMin(entryTime);
  const breaks: string[] = [];
  for (const bt of breakTimes) { let m = toMin(bt); while (m < prev) m += 1440; breaks.push(fromMin(m)); prev = m; }
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

function buildCopyWeek(emp: ReportRow, dh: DayHeader[]) {
  let t = `📋 RELATÓRIO — ${emp.employeeName}\nSemana: ${emp.weekRange}\n${'═'.repeat(40)}\n\n`;
  for (const d of dh) {
    const e = emp.dailyEntries[d.date]; if (!e) continue;
    const pairs = timePairs(allTimesExt(e.entryTime, e.breakTimes, e.exitTime));
    const [y, mo, dd] = d.date.split('-');
    t += `📆 ${dowFull[d.dayOfWeek]} ${dd}/${mo}/${y}\n`;
    t += `   ${pairs.map(p => `${p[0]} ${p[1]}`).join('  |  ')}\n`;
    t += `   Total: ${fmtHM(e.totalMinutes)}\n\n`;
  }
  t += `${'─'.repeat(40)}\nTOTAL SEMANA: ${emp.totalFormatted} (${emp.daysWorked} dias)\n`;
  return t;
}

function Pair({ a, b }: { a: string; b: string }) {
  const [okA, setOkA] = useState(false);
  const [okB, setOkB] = useState(false);
  const [okAll, setOkAll] = useState(false);
  const cpA = async () => { await navigator.clipboard.writeText(a); setOkA(true); setTimeout(() => setOkA(false), 1200); };
  const cpB = async () => { await navigator.clipboard.writeText(b); setOkB(true); setTimeout(() => setOkB(false), 1200); };
  const cpAll = async () => { await navigator.clipboard.writeText(`${a} ${b}`); setOkAll(true); setTimeout(() => setOkAll(false), 1200); };
  return (
    <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 shadow-sm shadow-blue-500/10 overflow-hidden">
      <button onClick={cpA} title={`Copiar: ${a}`} className="group/a px-2 py-1 hover:bg-blue-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5">
        <span className="text-[11px] font-mono font-bold text-blue-200 tracking-wider">{a}</span>
        {okA ? <Check className="w-2 h-2 text-green-400 ml-0.5" /> : <Copy className="w-2 h-2 opacity-0 group-hover/a:opacity-40 transition-opacity ml-0.5" />}
      </button>
      <button onClick={cpAll} title={`Copiar: ${a} ${b}`} className="text-blue-500/50 text-[9px] px-0.5 hover:text-blue-300 transition-colors cursor-pointer">
        {okAll ? <Check className="w-2 h-2 text-green-400" /> : <span>→</span>}
      </button>
      <button onClick={cpB} title={`Copiar: ${b}`} className="group/b px-2 py-1 hover:bg-blue-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5">
        <span className="text-[11px] font-mono font-bold text-blue-200 tracking-wider">{b}</span>
        {okB ? <Check className="w-2 h-2 text-green-400 ml-0.5" /> : <Copy className="w-2 h-2 opacity-0 group-hover/b:opacity-40 transition-opacity ml-0.5" />}
      </button>
    </div>
  );
}

function CpBtn({ text, title: ti }: { text: string; title?: string }) {
  const [ok, setOk] = useState(false);
  const cp = async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); };
  return <button onClick={cp} className="p-1 rounded-lg hover:bg-white/10 transition-all shrink-0" title={ti || 'Copiar'}>{ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-blue-400" />}</button>;
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(todayStr);
  const [agentSearch, setAgentSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: currentDate });
      if (agentSearch) params.set('agent', agentSearch);
      setData(await (await fetch(`/api/reports/weekly?${params}`)).json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [currentDate, agentSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><FileChartColumnIncreasing className="w-6 h-6 text-blue-400" />Relatórios</h2>
          <p className="text-sm text-gray-400 mt-1">Períodos a pares · Clica para copiar · 25:00+ = após meia-noite</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => data && setCurrentDate(data.prevWeekDate)} disabled={!data} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 font-mono text-sm font-bold min-w-[220px] text-center">{data?.weekRange || '...'}</div>
            <button onClick={() => data && setCurrentDate(data.nextWeekDate)} disabled={!data} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={agentSearch} onChange={e => setAgentSearch(e.target.value)} placeholder="Filtrar por nome..." className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>

      {!data?.report?.length ? (
        <div className="glass-card rounded-2xl p-16 text-center"><FileChartColumnIncreasing className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">Sem dados para esta semana</p></div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '1300px' }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider sticky left-0 bg-slate-950/90 z-10 min-w-[200px]">Funcionário</th>
                  {data.dayHeaders.map(dh => (
                    <th key={dh.date} className={`text-center px-2 py-3 min-w-[220px] ${dh.isWeekend ? 'bg-red-900/10' : ''}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${dh.isWeekend ? 'text-red-400/60' : 'text-gray-500'}`}>{dh.dowLabel}</span>
                      <br /><span className={`text-sm font-mono font-bold ${dh.isWeekend ? 'text-red-400/40' : 'text-gray-300'}`}>{dh.dayMonth}</span>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-[10px] text-amber-400 font-bold uppercase tracking-wider bg-amber-900/10 min-w-[90px]">Total</th>
                  <th className="text-center px-3 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider min-w-[50px]">Dias</th>
                  <th className="text-center px-3 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider min-w-[40px]">✓</th>
                </tr>
              </thead>
              <tbody>
                {data.report.map((row, idx) => (
                  <tr key={row.employeeId} className={`border-b border-white/5 hover:bg-blue-950/15 ${idx % 2 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-4 py-3 sticky left-0 bg-slate-950/90 z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">{row.employeeName.charAt(0)}</div>
                        <span className="font-semibold text-sm truncate flex-1">{row.employeeName}</span>
                        {row.daysWorked > 0 && <CpBtn text={buildCopyWeek(row, data.dayHeaders)} title="Copiar semana" />}
                      </div>
                    </td>
                    {data.dayHeaders.map(dh => {
                      const entry = row.dailyEntries[dh.date];
                      if (!entry) return <td key={dh.date} className={`text-center px-2 py-3 ${dh.isWeekend ? 'bg-red-900/5' : ''}`}>{dh.isWeekend ? <span className="text-red-900/30">—</span> : <span className="text-gray-700">·</span>}</td>;

                      const times = allTimesExt(entry.entryTime, entry.breakTimes, entry.exitTime);
                      const pairs = timePairs(times);
                      const totColor = entry.totalMinutes >= 480 ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300';
                      const copyAll = pairs.map(p => `${p[0]} ${p[1]}`).join(' ');

                      return (
                        <td key={dh.date} className={`px-1.5 py-2 align-middle ${dh.isWeekend ? 'bg-red-900/5' : ''}`}>
                          <div className="flex items-center gap-1 flex-wrap">
                            {pairs.map((p, i) => <Pair key={i} a={p[0]} b={p[1]} />)}
                            <div className={`ml-auto px-2 py-1 rounded-full border text-[11px] font-mono font-bold shrink-0 ${totColor}`}>{fmtHM(entry.totalMinutes)}</div>
                            <CpBtn text={copyAll} title="Copiar tudo" />
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-3 bg-amber-900/5 align-middle">
                      <div className="inline-block px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                        <span className="text-amber-300 font-bold text-sm font-mono">{row.totalFormatted}</span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 align-middle"><span className="text-gray-300 font-bold">{row.daysWorked}</span><span className="text-gray-600">/7</span></td>
                    <td className="text-center px-3 py-3 align-middle">
                      {row.hasAlerts ? <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" /> : row.daysWorked > 0 ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" /> : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
