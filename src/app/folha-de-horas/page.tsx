'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, ChevronLeft, ChevronRight, AlertTriangle, Download, Copy, Check } from 'lucide-react';

interface DayHeader { date: string; dayOfWeek: number; dayNum: number; monthDay: string; }
interface DailyEntry { entryTime: string; exitTime: string | null; breakTimes: string[]; periods: string[]; totalMinutes: number; totalFormatted: string; hasAlerts: boolean; alertLevel: 'ok' | 'warning' | 'error'; }
interface AbsenceInfo { type: string; reason: string | null; }
interface EmployeeRow { employeeId: string; employeeName: string; department: string | null; position: string | null; dailyData: Record<string, DailyEntry>; totalWeekMinutes: number; totalWeekFormatted: string; daysWorked: number; absences?: Record<string, AbsenceInfo>; }
interface FolhaData { weekStart: string; weekEnd: string; weekRange: string; weekRangeShort: string; prevWeekDate: string; nextWeekDate: string; dayHeaders: DayHeader[]; employees: EmployeeRow[]; dailyTotals: Record<string, number>; grandTotalMinutes: number; grandTotalFormatted: string; totalEmployees: number; }

const dowFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const dowShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(m: number) { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
function fmtHM(m: number) { if (m <= 0) return '0:00'; return fromMin(m); }

// Gera sequência completa ajustada (25:00+), sem duplicados consecutivos
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

  // Remove última pausa se igual à saída
  const cleanBreaks = [...breaks];
  if (exitF && cleanBreaks[cleanBreaks.length - 1] === exitF) cleanBreaks.pop();

  const all = [entryTime, ...cleanBreaks, ...(exitF ? [exitF] : [])];
  return all.filter((t, i) => i === 0 || t !== all[i - 1]);
}

// Agrupa em PARES (períodos de trabalho)
// [11:00, 13:10, 13:30, 20:20, 21:00, 26:25] → [[11:00,13:10],[13:30,20:20],[21:00,26:25]]
function timePairs(times: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < times.length; i += 2) {
    if (i + 1 < times.length) {
      pairs.push([times[i], times[i + 1]]);
    }
  }
  return pairs;
}

function buildCopyDay(dateStr: string, e: DailyEntry) {
  const times = allTimesExt(e.entryTime, e.breakTimes, e.exitTime);
  const pairs = timePairs(times);
  const [y, mo, d] = dateStr.split('-');
  let t = `📆 Data: ${d}/${mo}/${y}\n\n`;
  t += pairs.map(p => `${p[0]} ${p[1]}`).join('\n');
  t += `\n\n⏱️ Total: ${fmtHM(e.totalMinutes)}`;
  return t;
}

function buildCopyWeek(emp: EmployeeRow, dh: DayHeader[]) {
  let t = `📋 FOLHA DE HORAS — ${emp.employeeName}\n${'═'.repeat(40)}\n\n`;
  for (const d of dh) {
    const e = emp.dailyData[d.date]; if (!e) continue;
    const times = allTimesExt(e.entryTime, e.breakTimes, e.exitTime);
    const pairs = timePairs(times);
    const [y, mo, dd] = d.date.split('-');
    t += `📆 ${dowFull[d.dayOfWeek]} ${dd}/${mo}/${y}\n`;
    t += `   ${pairs.map(p => `${p[0]} ${p[1]}`).join('  |  ')}\n`;
    t += `   Total: ${fmtHM(e.totalMinutes)}\n\n`;
  }
  t += `${'─'.repeat(40)}\nTOTAL SEMANA: ${emp.totalWeekFormatted} (${emp.daysWorked} dias)\n`;
  return t;
}

// ── Par de bolões azuis (período de trabalho) ──
function Pair({ a, b }: { a: string; b: string }) {
  const [okA, setOkA] = useState(false);
  const [okB, setOkB] = useState(false);
  const [okAll, setOkAll] = useState(false);
  const cpA = async () => { await navigator.clipboard.writeText(a); setOkA(true); setTimeout(() => setOkA(false), 1200); };
  const cpB = async () => { await navigator.clipboard.writeText(b); setOkB(true); setTimeout(() => setOkB(false), 1200); };
  const cpAll = async () => { await navigator.clipboard.writeText(`${a} ${b}`); setOkAll(true); setTimeout(() => setOkAll(false), 1200); };

  return (
    <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 shadow-sm shadow-blue-500/10 overflow-hidden">
      <button onClick={cpA} title={`Copiar: ${a}`}
        className="group/a px-2.5 py-1.5 hover:bg-blue-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5">
        <span className="text-sm font-mono font-bold text-blue-200 tracking-wider">{a}</span>
        {okA ? <Check className="w-2.5 h-2.5 text-green-400 ml-0.5" /> : <Copy className="w-2.5 h-2.5 opacity-0 group-hover/a:opacity-40 transition-opacity ml-0.5" />}
      </button>
      <button onClick={cpAll} title={`Copiar par: ${a} ${b}`}
        className="text-blue-500/50 text-xs px-0.5 hover:text-blue-300 transition-colors cursor-pointer">
        {okAll ? <Check className="w-2.5 h-2.5 text-green-400" /> : <span>→</span>}
      </button>
      <button onClick={cpB} title={`Copiar: ${b}`}
        className="group/b px-2.5 py-1.5 hover:bg-blue-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-0.5">
        <span className="text-sm font-mono font-bold text-blue-200 tracking-wider">{b}</span>
        {okB ? <Check className="w-2.5 h-2.5 text-green-400 ml-0.5" /> : <Copy className="w-2.5 h-2.5 opacity-0 group-hover/b:opacity-40 transition-opacity ml-0.5" />}
      </button>
    </div>
  );
}

function CpBtn({ text, title: ti }: { text: string; title?: string }) {
  const [ok, setOk] = useState(false);
  const cp = async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); };
  return <button onClick={cp} className="p-1.5 rounded-lg hover:bg-white/10 transition-all shrink-0" title={ti || 'Copiar'}>{ok ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500 hover:text-blue-400" />}</button>;
}

export default function FolhaDeHorasPage() {
  const [data, setData] = useState<FolhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const fetchData = useCallback(async (dp?: string) => {
    setLoading(true);
    try { setData(await (await fetch(dp ? `/api/folha-de-horas?date=${dp}` : '/api/folha-de-horas')).json()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchData(currentDate || undefined); }, [fetchData, currentDate]);

  const exportCSV = () => {
    if (!data) return;
    const hd = ['Funcionário', ...data.dayHeaders.map(d => `${dowShort[d.dayOfWeek]} ${d.monthDay}`), 'TOTAL'];
    const rows = data.employees.map(emp => {
      const cols = data.dayHeaders.map(dh => {
        const e = emp.dailyData[dh.date]; if (!e) return '';
        const pairs = timePairs(allTimesExt(e.entryTime, e.breakTimes, e.exitTime));
        return pairs.map(p => `${p[0]} ${p[1]}`).join(' | ') + ` (${fmtHM(e.totalMinutes)})`;
      });
      return [emp.employeeName, ...cols, emp.totalWeekFormatted];
    });
    const csv = [hd.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `folha-horas-${data.weekStart}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600"><FileSpreadsheet className="w-6 h-6 text-white" /></div>
          <div><h2 className="text-2xl font-bold">Folha de Horas</h2><p className="text-sm text-gray-400">Períodos a pares · Clica para copiar · 25:00+ = após meia-noite</p></div>
        </div>
        {data && <button onClick={exportCSV} className="px-3 py-2 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-bold uppercase tracking-wider hover:bg-green-600/30 transition-all flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</button>}
      </div>

      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => data && setCurrentDate(data.prevWeekDate)} disabled={!data} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="px-5 py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 font-mono text-sm font-bold min-w-[240px] text-center">📅 {data?.weekRange || '...'}</div>
            <button onClick={() => data && setCurrentDate(data.nextWeekDate)} disabled={!data} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <span>👥 <strong className="text-white">{data?.totalEmployees || 0}</strong></span>
            <span>⏱️ <strong className="text-amber-400">{data?.grandTotalFormatted || '0h00m'}</strong></span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>
      ) : data && data.employees.length > 0 ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '1300px' }}>
              <thead>
                <tr className="bg-slate-950/80">
                  <th className="sticky left-0 z-20 bg-slate-950 border-b border-r border-white/10 px-3 py-3 text-left min-w-[200px]">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Funcionário</span>
                  </th>
                  {data.dayHeaders.map(dh => {
                    const we = dh.dayOfWeek === 0 || dh.dayOfWeek === 6;
                    return (
                      <th key={dh.date} className={`border-b border-r border-white/10 px-2 py-2 text-center min-w-[230px] ${we ? 'bg-red-950/30' : 'bg-slate-950/60'}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${we ? 'text-red-400/70' : 'text-gray-400'}`}>{dowFull[dh.dayOfWeek]}</div>
                        <div className={`text-sm font-mono font-bold mt-0.5 ${we ? 'text-red-400/50' : 'text-gray-200'}`}>{dh.monthDay}</div>
                      </th>
                    );
                  })}
                  <th className="border-b border-l-2 border-white/10 border-l-amber-500/30 px-3 py-3 text-center min-w-[90px] bg-amber-950/20">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Total</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp, ei) => (
                  <tr key={emp.employeeId} className={`group hover:bg-blue-950/15 transition-colors ${ei % 2 ? 'bg-white/[0.015]' : ''}`}>
                    <td className="sticky left-0 z-10 bg-slate-950/95 group-hover:bg-[#0d1530] border-b border-r border-white/10 px-3 py-3 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg shadow-blue-500/10">{emp.employeeName.charAt(0)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-semibold truncate">{emp.employeeName}</p>
                          <p className="text-gray-600 text-[9px] truncate">{[emp.department, emp.position].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                        <CpBtn text={buildCopyWeek(emp, data.dayHeaders)} title="Copiar semana" />
                      </div>
                    </td>

                    {data.dayHeaders.map(dh => {
                      const entry = emp.dailyData[dh.date];
                      const we = dh.dayOfWeek === 0 || dh.dayOfWeek === 6;
                      const absence = emp.absences?.[dh.date];

                      if (!entry) {
                        if (absence) {
                          return (
                            <td key={dh.date} className={`border-b border-r border-white/5 px-2 py-3 text-center ${we ? 'bg-red-950/10' : ''}`}>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase">
                                  ✓ Justificado
                                </span>
                                {absence.reason && <span className="text-[8px] text-gray-500 truncate max-w-[140px]" title={absence.reason}>{absence.reason}</span>}
                              </div>
                            </td>
                          );
                        }
                        return <td key={dh.date} className={`border-b border-r border-white/5 px-2 py-3 text-center ${we ? 'bg-red-950/10' : ''}`}>{we ? <span className="text-red-900/30 text-xs">—</span> : <span className="text-gray-800 text-xs">·</span>}</td>;
                      }

                      const times = allTimesExt(entry.entryTime, entry.breakTimes, entry.exitTime);
                      const pairs = timePairs(times);
                      const totColor = entry.totalMinutes >= 480 ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300';
                      const copyAll = pairs.map(p => `${p[0]} ${p[1]}`).join(' ');

                      return (
                        <td key={dh.date} className={`border-b border-r border-white/5 px-1.5 py-2 align-middle ${we ? 'bg-red-950/10' : ''}`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {pairs.map((p, i) => (
                              <Pair key={i} a={p[0]} b={p[1]} />
                            ))}
                            <div className={`ml-auto px-2.5 py-1.5 rounded-full border text-sm font-mono font-bold shrink-0 ${totColor}`}>
                              {fmtHM(entry.totalMinutes)}
                            </div>
                            <CpBtn text={copyAll} title="Copiar tudo" />
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {entry.hasAlerts && <AlertTriangle className={`w-3 h-3 ${entry.alertLevel === 'error' ? 'text-red-400' : 'text-amber-400'}`} />}
                            {absence && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold" title={absence.reason ? `Ausência: ${absence.reason}` : 'Ausência justificada'}>
                                <Check className="w-3 h-3" /> Justif.
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="border-b border-l-2 border-white/10 border-l-amber-500/30 px-3 py-3 text-center bg-amber-950/10 align-middle">
                      <div className="px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/30 inline-block">
                        <span className="text-amber-300 font-bold text-lg font-mono">{fmtHM(emp.totalWeekMinutes)}</span>
                      </div>
                      <div className="text-[9px] text-gray-600 mt-1">{emp.daysWorked}d</div>
                    </td>
                  </tr>
                ))}

                <tr className="bg-blue-950/30">
                  <td className="sticky left-0 z-10 bg-[#080e1e] border-t-2 border-r border-blue-500/40 px-3 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xs font-bold text-white">Σ</div>
                      <span className="text-blue-400 font-bold text-sm uppercase tracking-wider">Total Geral</span>
                    </div>
                  </td>
                  {data.dayHeaders.map(dh => {
                    const we = dh.dayOfWeek === 0 || dh.dayOfWeek === 6;
                    const dt = data.dailyTotals[dh.date] || 0;
                    return <td key={dh.date} className={`border-t-2 border-r border-blue-500/40 border-r-white/5 px-2 py-3 text-center ${we ? 'bg-red-950/10' : ''}`}>
                      {dt > 0 ? <span className="inline-block px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-mono font-bold">{fmtHM(dt)}</span> : <span className="text-gray-800 text-xs">—</span>}
                    </td>;
                  })}
                  <td className="border-t-2 border-l-2 border-blue-500/40 border-l-amber-500/30 px-3 py-3 text-center bg-amber-950/15">
                    <span className="inline-block px-5 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xl font-mono">{data.grandTotalFormatted}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-16 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Sem dados para esta semana</h3>
          <p className="text-gray-500 text-sm">Navegue para outra semana ou sincronize com o Discord.</p>
        </div>
      )}

      <div className="mt-4 glass-card rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          <span className="font-bold text-gray-400">Exemplo:</span>
          <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 px-1">
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">11:00</span>
            <span className="text-blue-500/50 text-xs">→</span>
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">13:10</span>
          </div>
          <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 px-1">
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">13:30</span>
            <span className="text-blue-500/50 text-xs">→</span>
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">20:20</span>
          </div>
          <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 px-1">
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">21:00</span>
            <span className="text-blue-500/50 text-xs">→</span>
            <span className="px-2 py-1 text-sm font-mono font-bold text-blue-200">26:25</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-bold">Total</span>
          <span className="text-gray-600">| Cada par = período de trabalho · Clica esquerda/direita para copiar individual</span>
        </div>
      </div>
    </div>
  );
}
