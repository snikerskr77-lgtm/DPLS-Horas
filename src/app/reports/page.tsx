'use client';

import { useEffect, useState } from 'react';
import { FileBarChart, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Button from '@/components/Button';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { formatMinutesToHours, dayNames, nowInPortugal } from '@/lib/utils';

interface WeeklyReport {
  weekStart: string; weekEnd: string; weekRange: string; weekDays: string[];
  report: Array<{
    employeeId: string; employeeName: string; weekRange: string;
    daysWorked: number; missingDays: number; missingDaysList: string[];
    totalMinutes: number; totalFormatted: string; hasUnjustifiedAbsence: boolean; hasAlerts: boolean;
    dailyEntries: Record<string, { totalMinutes: number; entryTime: string; exitTime: string | null; alerts: string | null }>;
  }>;
}

export default function ReportsPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(nowInPortugal());

  useEffect(() => { fetchReport(); }, [currentDate]);

  const fetchReport = async () => {
    setLoading(true);
    try { setReport(await (await fetch(`/api/reports/weekly?date=${format(currentDate, 'yyyy-MM-dd')}`)).json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!report) return;
    const headers = ['Funcionário','Semana','Dias Trabalhados','Dias Falta','Total Horas','Falta Injustificada'];
    const rows = report.report.map(r => [r.employeeName, r.weekRange, r.daysWorked, r.missingDays, r.totalFormatted, r.hasUnjustifiedAbsence ? 'Sim' : 'Não']);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${format(currentDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Relatórios</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Resumo semanal de horas e presenças</p>
        </div>
        <Button onClick={exportCSV} icon={<Download className="w-4 h-4" />} variant="secondary">Exportar CSV</Button>
      </div>

      {/* Week Navigation */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
            <div className="px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <span className="font-bold text-blue-400 text-sm font-mono">{report?.weekRange || '...'}</span>
            </div>
            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
          </div>
          <Button variant="ghost" onClick={() => setCurrentDate(nowInPortugal())}>Semana Atual</Button>
        </div>
      </div>

      {/* Report Table */}
      <div className="glass-card rounded-xl neon-blue overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div></div>
        ) : !report || report.report.length === 0 ? (
          <div className="text-center py-16"><FileBarChart className="w-12 h-12 text-gray-700 mx-auto mb-3" /><h3 className="text-sm font-bold text-gray-400">Sem dados</h3><p className="text-xs text-gray-600 mt-1 font-mono">Adicione registos de ponto para ver o relatório</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/30">
                <tr>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest sticky left-0 bg-slate-900/95 backdrop-blur">Funcionário</th>
                  {report.weekDays.map((day, i) => (
                    <th key={day} className="text-center py-3 px-3 min-w-[75px]">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{dayNames[i]}</div>
                      <div className="text-[10px] text-gray-600 font-mono">{format(parseISO(day), 'dd/MM')}</div>
                    </th>
                  ))}
                  <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Faltas</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody>
                {report.report.map((row) => (
                  <tr key={row.employeeId} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 sticky left-0 bg-slate-900/95 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] font-bold">{row.employeeName.charAt(0)}</div>
                        <span className="text-xs font-bold text-gray-300">{row.employeeName}</span>
                      </div>
                    </td>
                    {report.weekDays.map((day) => {
                      const entry = row.dailyEntries[day];
                      return (
                        <td key={day} className="py-3 px-3 text-center">
                          {entry ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold font-mono text-green-400">{formatMinutesToHours(entry.totalMinutes)}</span>
                              <span className="text-[10px] text-gray-600 font-mono">{entry.entryTime}-{entry.exitTime || '...'}</span>
                              {entry.alerts && <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />}
                            </div>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center"><span className="text-sm font-extrabold font-mono text-amber-400">{row.totalFormatted}</span></td>
                    <td className="py-3 px-4 text-center">
                      {row.missingDays > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-[10px] font-bold">{row.missingDays} dias</span>
                          <span className="text-[10px] text-gray-600 font-mono mt-0.5">{row.missingDaysList.join(', ')}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-[10px] font-bold">OK</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.hasUnjustifiedAbsence ? (
                        <div className="flex items-center justify-center gap-1 text-red-400"><XCircle className="w-4 h-4" /><span className="text-[10px] font-bold">INJUST.</span></div>
                      ) : row.hasAlerts ? (
                        <div className="flex items-center justify-center gap-1 text-amber-400"><AlertTriangle className="w-4 h-4" /><span className="text-[10px] font-bold">ALERTA</span></div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-green-400"><CheckCircle className="w-4 h-4" /><span className="text-[10px] font-bold">OK</span></div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {report && report.report.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 neon-blue">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total de Horas</h3>
            <p className="text-2xl font-extrabold font-mono text-blue-400">{formatMinutesToHours(report.report.reduce((s, r) => s + r.totalMinutes, 0))}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">{report.report.length} funcionários</p>
          </div>
          <div className="glass-card rounded-xl p-5 neon-amber">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Média de Horas</h3>
            <p className="text-2xl font-extrabold font-mono text-amber-400">{formatMinutesToHours(Math.round(report.report.reduce((s, r) => s + r.totalMinutes, 0) / (report.report.length || 1)))}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">por funcionário</p>
          </div>
          <div className="glass-card rounded-xl p-5 neon-red">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Faltas Injustificadas</h3>
            <p className="text-2xl font-extrabold font-mono text-red-400">{report.report.filter(r => r.hasUnjustifiedAbsence).length}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">≥3 faltas na semana</p>
          </div>
        </div>
      )}
    </div>
  );
}
