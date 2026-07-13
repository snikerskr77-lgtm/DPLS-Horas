'use client';

import { useEffect, useState } from 'react';
import { Plus, Clock, AlertTriangle, Edit2, Trash2, ChevronLeft, ChevronRight, XCircle, CheckCircle } from 'lucide-react';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Select from '@/components/Select';
import TimeInput from '@/components/TimeInput';
import DateInput from '@/components/DateInput';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';
import { formatMinutesToHours, nowInPortugal, todayInPortugal } from '@/lib/utils';
import type { Employee } from '@/db/schema';

interface TimeEntry {
  id: string; employeeId: string; employeeName: string | null; date: string;
  entryTime: string; exitTime: string | null; breakStart: string | null;
  breakEnd: string | null; totalMinutes: number | null; notes: string | null; alerts: string | null;
}

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(nowInPortugal());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [formData, setFormData] = useState({ employeeId: '', date: todayInPortugal(), entryTime: '', exitTime: '', breakStart: '', breakEnd: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchEntries(); }, [currentDate, selectedEmployee]);

  const fetchEmployees = async () => { try { setEmployees(await (await fetch('/api/employees')).json()); } catch (e) { console.error(e); } };
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') });
      if (selectedEmployee) params.append('employeeId', selectedEmployee);
      setEntries(await (await fetch(`/api/time-entries?${params}`)).json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openModal = (entry?: TimeEntry) => {
    setError('');
    if (entry) { setEditingEntry(entry); setFormData({ employeeId: entry.employeeId, date: entry.date, entryTime: entry.entryTime, exitTime: entry.exitTime || '', breakStart: entry.breakStart || '', breakEnd: entry.breakEnd || '', notes: entry.notes || '' }); }
    else { setEditingEntry(null); setFormData({ employeeId: selectedEmployee || '', date: todayInPortugal(), entryTime: '', exitTime: '', breakStart: '', breakEnd: '', notes: '' }); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditingEntry(null); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch(editingEntry ? `/api/time-entries/${editingEntry.id}` : '/api/time-entries', { method: editingEntry ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { fetchEntries(); closeModal(); } else { const d = await res.json(); setError(d.error || 'Erro'); }
    } catch { setError('Erro ao guardar'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => { if (!confirm('Eliminar este registo?')) return; try { await fetch(`/api/time-entries/${id}`, { method: 'DELETE' }); fetchEntries(); } catch (e) { console.error(e); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Picagem de Ponto</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Registos de entrada e saída</p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus className="w-4 h-4" />}>Novo Registo</Button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
            <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-lg">
              <span className="text-xs font-bold font-mono text-gray-300">{format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yyyy')}</span>
            </div>
            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(nowInPortugal())}>Hoje</Button>
          </div>
          <div className="flex-1 max-w-xs">
            <Select options={[{ value: '', label: 'Todos os funcionários' }, ...employees.map(e => ({ value: e.id, label: e.name }))]} value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl neon-blue overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16"><Clock className="w-12 h-12 text-gray-700 mx-auto mb-3" /><h3 className="text-sm font-bold text-gray-400">Sem registos</h3><p className="text-xs text-gray-600 mt-1 font-mono">Nenhum registo nesta semana</p><div className="mt-4"><Button onClick={() => openModal()} icon={<Plus className="w-4 h-4" />}>Novo Registo</Button></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/30">
                <tr>
                  {['Funcionário','Data','Entrada','Saída','Pausa','Total','Alertas',''].map(h => (
                    <th key={h} className={`${h === '' ? 'text-right' : 'text-left'} py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  let parsedAlerts: Array<{ level?: string; code?: string; message: string; field?: string }> = [];
                  if (entry.alerts) {
                    try {
                      const raw = JSON.parse(entry.alerts);
                      if (Array.isArray(raw)) {
                        parsedAlerts = raw.map((a: string | { level?: string; code?: string; message: string; field?: string }) =>
                          typeof a === 'string' ? { level: 'warning', code: 'LEGACY', message: a } : a
                        );
                      }
                    } catch { /* ignore */ }
                  }
                  const errorCount = parsedAlerts.filter(a => a.level === 'error').length;
                  const warnCount = parsedAlerts.filter(a => a.level !== 'error').length;
                  const hasErrors = errorCount > 0;
                  const hasWarnings = warnCount > 0;
                  const isClean = parsedAlerts.length === 0 && !!entry.entryTime && !!entry.exitTime;

                  return (
                    <tr key={entry.id} className={`border-t hover:bg-white/[0.02] transition-colors ${hasErrors ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-white/5'}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${hasErrors ? 'bg-red-500/20 border-red-500/30 text-red-400' : isClean ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'}`}>{entry.employeeName?.charAt(0) || '?'}</div>
                          <span className="text-sm font-bold text-gray-300">{entry.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-400">{format(parseISO(entry.date), 'dd/MM/yyyy')}</td>
                      <td className="py-3 px-4">
                        {parsedAlerts.some(a => a.field === 'entrada') ? (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs font-mono font-bold">{entry.entryTime} ⚠</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-xs font-mono font-bold">{entry.entryTime}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {!entry.exitTime ? (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-[10px] font-bold animate-pulse">SEM SAÍDA</span>
                        ) : parsedAlerts.some(a => a.field === 'saida') ? (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs font-mono font-bold">{entry.exitTime} ⚠</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-xs font-mono font-bold">{entry.exitTime}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-500">{entry.breakStart && entry.breakEnd ? `${entry.breakStart} - ${entry.breakEnd}` : '-'}</td>
                      <td className="py-3 px-4"><span className={`text-sm font-extrabold font-mono ${hasErrors ? 'text-red-400' : isClean ? 'text-green-400' : 'text-amber-400'}`}>{entry.totalMinutes ? formatMinutesToHours(entry.totalMinutes) : '—'}</span></td>
                      <td className="py-3 px-4">
                        {isClean ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-[10px] font-bold text-green-400"><CheckCircle className="w-3 h-3" />OK</span>
                        ) : parsedAlerts.length > 0 && (
                          <div className="group relative">
                            <div className="flex items-center gap-1.5 cursor-pointer">
                              {hasErrors && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] font-bold text-red-400"><XCircle className="w-3 h-3" />{errorCount}</span>}
                              {hasWarnings && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] font-bold text-amber-400"><AlertTriangle className="w-3 h-3" />{warnCount}</span>}
                            </div>
                            <div className="hidden group-hover:block absolute right-0 top-full mt-1 z-20 w-72 p-3 glass-card rounded-lg neon-red text-left">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Alertas do Registo</p>
                              <ul className="space-y-1.5">
                                {parsedAlerts.map((alert, i) => (
                                  <li key={i} className={`text-[11px] font-mono flex items-start gap-2 ${alert.level === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                    {alert.level === 'error' ? <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                                    <span>{alert.message}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openModal(entry)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => handleDelete(entry.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-500/60" /></button>
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingEntry ? 'Editar Registo' : 'Novo Registo'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-mono">{error}</div>}
          {!editingEntry && <Select label="Funcionário *" options={employees.map(e => ({ value: e.id, label: e.name }))} value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} required />}
          <DateInput label="Data *" value={formData.date} onChange={(v) => setFormData({ ...formData, date: v })} required disabled={!!editingEntry} />
          <div className="grid grid-cols-2 gap-4">
            <TimeInput label="Hora de Entrada *" value={formData.entryTime} onChange={(v) => setFormData({ ...formData, entryTime: v })} required placeholder="09:00" />
            <TimeInput label="Hora de Saída" value={formData.exitTime} onChange={(v) => setFormData({ ...formData, exitTime: v })} placeholder="18:00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TimeInput label="Início da Pausa" value={formData.breakStart} onChange={(v) => setFormData({ ...formData, breakStart: v })} placeholder="12:30" />
            <TimeInput label="Fim da Pausa" value={formData.breakEnd} onChange={(v) => setFormData({ ...formData, breakEnd: v })} placeholder="13:30" />
          </div>
          <Input label="Notas" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Observações opcionais" />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editingEntry ? 'Guardar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
