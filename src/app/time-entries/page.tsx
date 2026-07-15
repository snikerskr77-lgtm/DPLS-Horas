'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Pencil, Trash2, X, AlertTriangle, Search } from 'lucide-react';

interface Employee { id: string; name: string; }
interface TimeEntry {
  id: string; employeeId: string; employeeName: string | null;
  date: string; entryTime: string; exitTime: string | null;
  breakStart: string | null; breakEnd: string | null;
  totalMinutes: number | null; alerts: string | null;
}

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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

  const fmtMin = (m: number | null) => { if (!m) return '0h00m'; const h = Math.floor(m / 60); return `${h}h${String(m % 60).padStart(2, '0')}m`; };

  const filtered = entries.filter(e => !search || (e.employeeName || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-blue-400" />Picagem de Ponto</h2>
          <p className="text-sm text-gray-400 mt-1">Registos de entrada e saída</p>
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

      {/* Entries Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16"><Clock className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">Nenhum registo encontrado</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Funcionário</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Entrada</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Saída</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pausa</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Alertas</th>
                <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => {
                  let alerts: Array<{ level: string; message: string }> = [];
                  try { if (e.alerts) alerts = JSON.parse(e.alerts); } catch { /* ignore */ }
                  return (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[10px] font-bold">{e.employeeName?.charAt(0) || '?'}</div><span className="text-sm">{e.employeeName}</span></div></td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{e.date.split('-').reverse().join('/')}</td>
                      <td className="px-4 py-3 text-sm font-mono text-green-400">{e.entryTime}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{e.exitTime || <span className="text-red-400">--:--</span>}</td>
                      <td className="px-4 py-3 text-sm font-mono text-purple-300">{e.breakStart && e.breakEnd ? `${e.breakStart}-${e.breakEnd}` : <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-sm font-mono text-amber-400 font-bold">{fmtMin(e.totalMinutes)}</td>
                      <td className="px-4 py-3">{alerts.length > 0 ? <AlertTriangle className={`w-4 h-4 ${alerts.some(a => a.level === 'error') ? 'text-red-400' : 'text-amber-400'}`} /> : <span className="text-green-400 text-[10px]">✓</span>}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
