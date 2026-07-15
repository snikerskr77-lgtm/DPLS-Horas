'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Search } from 'lucide-react';

interface Employee {
  id: string; name: string; email: string | null;
  department: string | null; position: string | null;
  isActive: boolean; createdAt: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', department: '', position: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/employees');
    setEmployees(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setForm({ name: '', email: '', department: '', position: '' }); setEditingId(null); setShowForm(false); };

  const handleSave = async () => {
    if (editingId) {
      await fetch(`/api/employees/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    } else {
      await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    }
    resetForm(); fetchData();
  };

  const handleEdit = (e: Employee) => {
    setForm({ name: e.name, email: e.email || '', department: e.department || '', position: e.position || '' });
    setEditingId(e.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este funcionário e todos os seus registos?')) return;
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const filtered = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" />Funcionários</h2>
          <p className="text-sm text-gray-400 mt-1">Gestão de funcionários do sistema</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-500 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Funcionário
        </button>
      </div>

      <div className="glass-card rounded-xl p-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar funcionários..." className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum funcionário encontrado</p>
          <p className="text-gray-600 text-xs mt-1">Adicione funcionários ou importe via Discord</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className="glass-card rounded-2xl p-5 hover:border-blue-500/20 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{emp.name}</p>
                    <p className="text-[10px] text-gray-500">{emp.email || 'Sem email'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(emp)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {emp.department && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">{emp.department}</span>}
                {emp.position && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20">{emp.position}</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${emp.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {emp.isActive ? 'ATIVO' : 'INATIVO'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingId ? 'Editar Funcionário' : 'Novo Funcionário'}</h3>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-gray-400 block mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="Nome completo" />
              </div>
              <div><label className="text-xs text-gray-400 block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="email@exemplo.pt" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400 block mb-1">Departamento</label>
                  <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="Ex: Vendas" />
                </div>
                <div><label className="text-xs text-gray-400 block mb-1">Cargo</label>
                  <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="Ex: Agente" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={resetForm} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-all">Cancelar</button>
                <button onClick={handleSave} disabled={!form.name} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all disabled:opacity-30">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
