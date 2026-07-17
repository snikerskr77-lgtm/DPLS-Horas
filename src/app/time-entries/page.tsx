'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Pencil, Trash2, X, AlertTriangle, Search, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Employee { id: string; name: string; }
interface TimeEntry {
  id: string; employeeId: string; employeeName: string | null;
  date: string; entryTime: string; exitTime: string | null;
  breakStart: string | null; breakEnd: string | null;
  breakTimes: string | null;
  totalMinutes: number | null; notes: string | null; alerts: string | null;
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fromMin(m: number) { const nm = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(nm / 60)).padStart(2, '0')}:${String(nm % 60).padStart(2, '0')}`; }
function fmtMin(m: number | null) { if (!m) return '0h00m'; const h = Math.floor(m / 60); return `${h}h${String(m % 60).padStart(2, '0')}m`; }

function getBreakTimesFromEntry(e: TimeEntry): string[] {
  // Try breakTimes JSON first, then notes meta, then legacy columns
  if (e.breakTimes) {
    try { const arr = JSON.parse(e.breakTimes); if (Array.isArray(arr)) return arr; } catch { /* ignore */ }
  }
  if (e.notes && e.notes.startsWith('__TTMETA__:')) {
    try {
      const meta = JSON.parse(e.notes.slice('__TTMETA__:'.length));
      if (meta.breakTimes && Array.isArray(meta.breakTimes)) return meta.breakTimes;
    } catch { /* ignore */ }
  }
  return [e.breakStart, e.breakEnd].filter(Boolean) as string[];
}

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

function breakPairs(breakTimes: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < breakTimes.length; i += 2) {
    if (i + 1 < breakTimes.length) pairs.push([breakTimes[i], breakTimes[i + 1]]);
  }
  return pairs;
}

function Pair({ a, b, color = 'blue' }: { a: string; b: string; color?: 'blue' | 'purple' }) {
  const [ok, setOk] = useState(false);
  const cp = async () => { await navigator.clipboard.writeText(`${a} ${b}`); setOk(true); setTimeout(() => setOk(false), 1200); };
  const colors = color === 'blue'
    ? 'bg-blue-500/15 border-blue-500/35 text-blue-200'
    : 'bg-purple-500/15 border-purple-500/35 text-purple-200';
  return (
    <button onClick={cp} title={`Copiar: ${a}→${b}`}
      className={`inline-flex items-center rounded-full border shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-all ${colors}`}>
      <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold">{a}</span>
      <span className={`text-[9px] px-0.5 ${color === 'blue' ? 'text-blue-500/50' : 'text-purple-500/50'}`}>
        {ok ? <Check className="w-2 h-2 text-green-400" /> : '→'}
      </span>
      <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold">{b}</span>
    </button>
  );
}

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: '', date: '', entryTime: '', exitTime: '', breakStart: '', breakEnd: '', notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [entriesRes, empsRes] = await Promise.all([fetch('/api/time-entries'), fetch('/api/employees')]);
    setEntries(await entriesRes.json());
    setEmployees(await empsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setForm({ employeeId: '', date: '', entryTime: '', exitTime: '', breakStart: '', breakEnd: '', notes: '' }); setEditingId(null); setShowForm(false); };

  const handleSave = async () => {
    if (editingId) {
      await fetch(`/api/time-entries/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    } else {
      await fetch('/api/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    }
    resetForm(); fetchData();
  };

  const handleEdit = (e: TimeEntry) => {
    setForm({ employeeId: e.employeeId, date: e.date, entryTime: e.entryTime, exitTime: e.exitTime || '', breakStart: e.breakStart || '', breakEnd: e.breakEnd || '', notes: '' });
    setEditingId(e.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este registo?')) return;
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const filtered = entries.filter(e => !search || (e.employeeName || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-blue-400" />Picagem de Ponto</h2>
          <p className="text-sm text-gray-400 mt-1">Registos de entrada e saída · Períodos a pares</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-500 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Registo
        </button>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por funcionário..." className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>
      </div>

      {/* Entries */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16"><Clock className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">Nenhum registo encontrado</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Funcionário</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Períodos de Trabalho</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Info</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => {
                  let alerts: Array<{ level: string; message: string }> = [];
                  try { if (e.alerts) alerts = JSON.parse(e.alerts); } catch { /* ignore */ }

                  const bt = getBreakTimesFromEntry(e);
                  const times = allTimesExt(e.entryTime, bt, e.exitTime);
                  const workPairs = timePairs(times);
                  const bPairs = breakPairs(bt);
                  const isExpanded = expandedId === e.id;
                  const hasMultipleBreaks = bt.length > 2;
                  const copyText = workPairs.map(p => `${p[0]} ${p[1]}`).join(' ');

                  return (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{e.employeeName?.charAt(0) || '?'}</div>
                          <span className="text-sm truncate">{e.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{e.date.split('-').reverse().join('/')}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1.5">
                          {/* Work periods as blue pairs */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {workPairs.map((p, i) => (
                              <Pair key={i} a={p[0]} b={p[1]} color="blue" />
                            ))}
                            <CpBtn text={copyText} />
                          </div>
                          {/* Break pairs as purple pairs (if any) */}
                          {bPairs.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">Pausas:</span>
                              {bPairs.map((p, i) => (
                                <Pair key={i} a={p[0]} b={p[1]} color="purple" />
                              ))}
                            </div>
                          )}
                          {/* Odd break (unpaired) */}
                          {bt.length > 0 && bt.length % 2 !== 0 && (
                            <span className="text-[9px] text-amber-400">⚠ Pausa ímpar: {bt[bt.length - 1]}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full border text-sm font-mono font-bold ${(e.totalMinutes || 0) >= 480 ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                          {fmtMin(e.totalMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {alerts.length > 0 ? (
                            <button onClick={() => setExpandedId(isExpanded ? null : e.id)} className="flex items-center gap-1 cursor-pointer">
                              <AlertTriangle className={`w-4 h-4 ${alerts.some(a => a.level === 'error') ? 'text-red-400' : 'text-amber-400'}`} />
                              <span className="text-[10px] text-gray-500">{alerts.length}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                            </button>
                          ) : (
                            <span className="text-green-400 text-[10px]">✓</span>
                          )}
                          {hasMultipleBreaks && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">{bt.length / 2}P</span>}
                        </div>
                        {/* Expanded alerts */}
                        {isExpanded && alerts.length > 0 && (
                          <div className="mt-2 space-y-1 max-w-xs">
                            {alerts.map((a, i) => (
                              <div key={i} className={`text-[10px] px-2 py-1 rounded ${a.level === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                {a.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 glass-card rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          <span className="font-bold text-gray-400">Legenda:</span>
          <div className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 px-2 py-0.5">
            <span className="text-[10px] font-mono font-bold text-blue-200">11:40→12:35</span>
          </div>
          <span>= Período de trabalho</span>
          <div className="inline-flex items-center rounded-full bg-purple-500/15 border border-purple-500/35 px-2 py-0.5">
            <span className="text-[10px] font-mono font-bold text-purple-200">12:35→13:05</span>
          </div>
          <span>= Pausa</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">3P</span>
          <span>= Nº de pausas</span>
          <span className="text-gray-600">| Clica num par para copiar</span>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingId ? 'Editar Registo' : 'Novo Registo'}</h3>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {!editingId && (
                <>
                  <div><label className="text-xs text-gray-400 block mb-1">Funcionário</label>
                    <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50">
                      <option value="">Selecionar...</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-400 block mb-1">Data</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400 block mb-1">Entrada</label>
                  <input type="time" value={form.entryTime} onChange={e => setForm({ ...form, entryTime: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" />
                </div>
                <div><label className="text-xs text-gray-400 block mb-1">Saída</label>
                  <input type="time" value={form.exitTime} onChange={e => setForm({ ...form, exitTime: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400 block mb-1">Início Pausa</label>
                  <input type="time" value={form.breakStart} onChange={e => setForm({ ...form, breakStart: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" />
                </div>
                <div><label className="text-xs text-gray-400 block mb-1">Fim Pausa</label>
                  <input type="time" value={form.breakEnd} onChange={e => setForm({ ...form, breakEnd: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={resetForm} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-all">Cancelar</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CpBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const cp = async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); };
  return <button onClick={cp} className="p-1 rounded-lg hover:bg-white/10 transition-all shrink-0" title="Copiar tudo">{ok ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-blue-400" />}</button>;
}
