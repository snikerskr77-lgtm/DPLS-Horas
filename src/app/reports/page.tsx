'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { formatMinutesToHours, dayNames, nowInPortugal } from '@/lib/utils';

interface DailyEntry {
  totalMinutes: number;
  entryTime: string;
  exitTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  breakTimes: string[];
  periods: string[];
  alerts: string | null;
}

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  weekRange: string;
  weekDays: string[];
  report: Array<{
    employeeId: string;
    employeeName: string;
    weekRange: string;
    daysWorked: number;
    missingDays: number;
    missingDaysList: string[];
    totalMinutes: number;
    totalFormatted: string;
    hasUnjustifiedAbsence: boolean;
    hasAlerts: boolean;
    dailyEntries: Record<string, DailyEntry>;
  }>;
}

function formatPeriodsForExcel(periods: string[]): string {
  return periods.map((period) => period.replace('-', ' e ')).join(' , ');
}

function expandPeriodTimes(periods: string[]): string[] {
  return periods.flatMap((period) => period.split('-')).filter(Boolean);
}

export default function ReportsPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(nowInPortugal());
  const [agentSearch, setAgentSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => { fetchReport(); }, [currentDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      setReport(await (await fetch(`/api/reports/weekly?date=${format(currentDate, 'yyyy-MM-dd')}`)).json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredReport = useMemo(() => {
    if (!report) return [];
    const q = agentSearch.trim().toLowerCase();
    if (!q) return report.report;
    return report.report.filter(r => r.employeeName.toLowerCase().includes(q));
  }, [report, agentSearch]);

  const detailedRows = useMemo(() => {
    return filteredReport.flatMap((row) =>
      Object.entries(row.dailyEntries).map(([date, entry]) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        date,
        entry,
      }))
    ).sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date));
  }, [filteredReport]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1500);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const exportCSV = () => {
    if (!report) return;
    const headers = ['Funcionário', 'Data', 'Entrada', 'Pausas', 'Saída', 'Períodos de Trabalho', 'Formato Excel', 'Total Horas', 'Alertas'];
    const rows = detailedRows.map((row) => [
      row.employeeName,
      format(parseISO(row.date), 'dd/MM/yyyy'),
      row.entry.entryTime,
      row.entry.breakTimes.length > 0
        ? row.entry.breakTimes.reduce<string[]>((acc, time, index) => {
            if (index % 2 === 0 && row.entry.breakTimes[index + 1]) {
              acc.push(`${time} - ${row.entry.breakTimes[index + 1]}`);
            } else if (index % 2 === 0 && !row.entry.breakTimes[index + 1]) {
              acc.push(time);
            }
            return acc;
          }, []).join(' | ')
        : '',
      row.entry.exitTime || '',
      row.entry.periods.join(' | '),
      formatPeriodsForExcel(row.entry.periods),
      formatMinutesToHours(row.entry.totalMinutes),
      row.entry.alerts ? 'Sim' : '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_detalhado_${format(currentDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Relatórios</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Resumo semanal + detalhe para exportação</p>
        </div>
        <Button onClick={exportCSV} icon={<Download className="w-4 h-4" />} variant="secondary">Exportar CSV</Button>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
            <div className="px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <span className="font-bold text-blue-400 text-sm font-mono">{report?.weekRange || '...'}</span>
            </div>
            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-72">
              <Input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Pesquisar agente..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button variant="ghost" onClick={() => setCurrentDate(nowInPortugal())}>Semana Atual</Button>
          </div>
        </div>
      </div>

      {/* Weekly matrix */}
      <div className="glass-card rounded-xl neon-blue overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div></div>
        ) : !report || filteredReport.length === 0 ? (
          <div className="text-center py-16"><FileBarChart className="w-12 h-12 text-gray-700 mx-auto mb-3" /><h3 className="text-sm font-bold text-gray-400">Sem dados</h3><p className="text-xs text-gray-600 mt-1 font-mono">Sem resultados para o filtro atual</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/30">
                <tr>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest sticky left-0 bg-slate-900/95 backdrop-blur">Funcionário</th>
                  {report.weekDays.map((day, i) => (
                    <th key={day} className="text-center py-3 px-3 min-w-[96px]">
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
                {filteredReport.map((row) => (
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
                        <td key={day} className="py-3 px-3 text-center align-top">
                          {entry ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold font-mono text-green-400">{formatMinutesToHours(entry.totalMinutes)}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{entry.entryTime} → {entry.exitTime || '...'}</span>
                              {entry.periods.length > 0 && (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {expandPeriodTimes(entry.periods).map((time, idx) => {
                                      const timeKey = `${row.employeeId}-${day}-matrix-${time}-${idx}`;
                                      return (
                                        <button
                                          key={timeKey}
                                          type="button"
                                          onClick={() => copyText(time, timeKey)}
                                          className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 font-mono hover:bg-blue-500/20 hover:border-blue-400/40 transition-colors"
                                          title={`Copiar ${time}`}
                                        >
                                          {copiedKey === timeKey ? 'Copiado' : time}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="rounded-md border border-blue-500/10 bg-blue-500/[0.04] px-2 py-1 text-[10px] text-blue-300/70 font-mono leading-4 select-all cursor-text">
                                    {formatPeriodsForExcel(entry.periods)}
                                  </div>
                                </div>
                              )}
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

      {/* Detailed export-style table */}
      {report && detailedRows.length > 0 && (
        <div className="glass-card rounded-xl neon-amber overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Detalhe para Excel</h2>
            <p className="text-[10px] text-gray-600 font-mono mt-1">Copia diretamente no formato: 18:10 e 20:10 , 22:10 e 22:30 , 00:20 e 01:45</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/30">
                <tr>
                  {['Agente', 'Data', 'Entrada', 'Pausas', 'Saída', 'Horas para Copiar', 'Texto Excel', 'Total'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailedRows.map((row, idx) => {
                  const pauseGroups = row.entry.breakTimes.reduce<string[]>((acc, time, index) => {
                    if (index % 2 === 0 && row.entry.breakTimes[index + 1]) {
                      acc.push(`${time} e ${row.entry.breakTimes[index + 1]}`);
                    } else if (index % 2 === 0) {
                      acc.push(time);
                    }
                    return acc;
                  }, []);
                  const excelFormat = formatPeriodsForExcel(row.entry.periods);
                  const individualTimes = expandPeriodTimes(row.entry.periods);
                  const copyKey = `${row.employeeId}-${row.date}-${idx}`;

                  return (
                    <tr key={copyKey} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors align-top">
                      <td className="py-3 px-4 text-xs font-bold text-gray-300">{row.employeeName}</td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-400">{format(parseISO(row.date), 'dd/MM/yyyy')}</td>
                      <td className="py-3 px-4 text-xs font-mono text-green-400 font-bold">{row.entry.entryTime}</td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-300">{pauseGroups.join(' , ') || '—'}</td>
                      <td className="py-3 px-4 text-xs font-mono text-red-400 font-bold">{row.entry.exitTime || '—'}</td>
                      <td className="py-3 px-4 min-w-[260px]">
                        <div className="flex flex-wrap gap-1.5">
                          {individualTimes.length > 0 ? individualTimes.map((time, timeIndex) => {
                            const timeKey = `${copyKey}-${time}-${timeIndex}`;
                            return (
                              <button
                                key={timeKey}
                                type="button"
                                onClick={() => copyText(time, timeKey)}
                                className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-mono text-amber-200 hover:border-amber-400/40 hover:bg-amber-500/20 hover:text-amber-100 transition-colors"
                                title={`Copiar ${time}`}
                              >
                                {copiedKey === timeKey ? 'Copiado' : time}
                              </button>
                            );
                          }) : <span className="text-xs text-gray-600 font-mono">—</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[320px]">
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs font-mono text-blue-300 select-all leading-5 cursor-text">
                          {excelFormat || '—'}
                        </div>
                        <p className="mt-1 text-[10px] text-gray-600 font-mono">Seleciona este texto se precisares da linha completa.</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-amber-400 font-bold">{formatMinutesToHours(row.entry.totalMinutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report && filteredReport.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 neon-blue">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total de Horas</h3>
            <p className="text-2xl font-extrabold font-mono text-blue-400">{formatMinutesToHours(filteredReport.reduce((s, r) => s + r.totalMinutes, 0))}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">{filteredReport.length} funcionários</p>
          </div>
          <div className="glass-card rounded-xl p-5 neon-amber">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Média de Horas</h3>
            <p className="text-2xl font-extrabold font-mono text-amber-400">{formatMinutesToHours(Math.round(filteredReport.reduce((s, r) => s + r.totalMinutes, 0) / (filteredReport.length || 1)))}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">por funcionário</p>
          </div>
          <div className="glass-card rounded-xl p-5 neon-red">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Faltas Injustificadas</h3>
            <p className="text-2xl font-extrabold font-mono text-red-400">{filteredReport.filter(r => r.hasUnjustifiedAbsence).length}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">≥3 faltas na semana</p>
          </div>
        </div>
      )}
    </div>
  );
}
