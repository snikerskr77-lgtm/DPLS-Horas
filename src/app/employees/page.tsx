'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Mail, Building, Briefcase } from 'lucide-react';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import type { Employee } from '@/db/schema';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', department: '', position: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      setEmployees(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({ name: employee.name, email: employee.email || '', department: employee.department || '', position: employee.position || '' });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', email: '', department: '', position: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingEmployee(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
      const res = await fetch(url, { method: editingEmployee ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { fetchEmployees(); closeModal(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este funcionário?')) return;
    try { await fetch(`/api/employees/${id}`, { method: 'DELETE' }); fetchEmployees(); } catch (e) { console.error(e); }
  };

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Funcionários</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Gerir funcionários e informações</p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus className="w-4 h-4" />}>Novo Funcionário</Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        <Input placeholder="Pesquisar por nome, email ou departamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<Search className="w-4 h-4" />} />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center neon-blue">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-gray-400">{searchTerm ? 'Nenhum resultado' : 'Sem funcionários'}</h3>
          <p className="text-xs text-gray-600 mt-1 font-mono">{searchTerm ? 'Tente uma pesquisa diferente' : 'Adicione o primeiro funcionário'}</p>
          {!searchTerm && <div className="mt-4"><Button onClick={() => openModal()} icon={<Plus className="w-4 h-4" />}>Adicionar</Button></div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((employee) => (
            <div key={employee.id} className="glass-card rounded-xl p-5 hover:border-blue-500/20 transition-all duration-300 hover:scale-[1.01]">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{employee.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${employee.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-gray-500/10 text-gray-500 border border-white/10'}`}>
                      {employee.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(employee)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                  <button onClick={() => handleDelete(employee.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-500/60" /></button>
                </div>
              </div>
              <div className="space-y-1.5">
                {employee.email && <div className="flex items-center gap-2 text-xs text-gray-500 font-mono"><Mail className="w-3.5 h-3.5" /><span className="truncate">{employee.email}</span></div>}
                {employee.department && <div className="flex items-center gap-2 text-xs text-gray-500 font-mono"><Building className="w-3.5 h-3.5" /><span>{employee.department}</span></div>}
                {employee.position && <div className="flex items-center gap-2 text-xs text-gray-500 font-mono"><Briefcase className="w-3.5 h-3.5" /><span>{employee.position}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" required />
          <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Departamento" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="Ex: Vendas" />
            <Input label="Cargo" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} placeholder="Ex: Agente" />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editingEmployee ? 'Guardar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
