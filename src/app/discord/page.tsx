'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, RefreshCw, Settings, CheckCircle, XCircle, Save } from 'lucide-react';

interface SyncStatus { configured: boolean; hasToken: boolean; hasChannel: boolean; channelId: string | null; }
interface SyncResult { success: boolean; message: string; stats?: { threadsProcessed: number; messagesProcessed: number; entriesCreated: number; entriesUpdated: number; employeesCreated: number; errors: string[]; }; }

export default function DiscordPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [token, setToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discord/sync');
      setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/discord/sync', { method: 'POST' });
      setSyncResult(await res.json());
    } catch (e) {
      setSyncResult({ success: false, message: e instanceof Error ? e.message : 'Erro desconhecido' });
    }
    setSyncing(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (token) await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'discord_bot_token', value: token }) });
      if (channelId) await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'discord_channel_id', value: channelId }) });
      await fetchStatus();
      setShowSettings(false); setToken(''); setChannelId('');
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-blue-400" />Discord Sync</h2>
          <p className="text-sm text-gray-400 mt-1">Sincronizar registos de ponto do Discord</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configurações
          </button>
          <button onClick={handleSync} disabled={syncing || !status?.configured} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-30">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'A sincronizar...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            {status?.hasToken ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-bold">Bot Token</span>
          </div>
          <p className="text-xs text-gray-500">{status?.hasToken ? 'Token configurado' : 'Token não configurado'}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            {status?.hasChannel ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-bold">Canal Discord</span>
          </div>
          <p className="text-xs text-gray-500">{status?.channelId ? `ID: ${status.channelId}` : 'Canal não configurado'}</p>
        </div>
      </div>

      {/* Settings Form */}
      {showSettings && (
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Configurações Discord</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Bot Token</label>
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Cole o token do bot aqui..." className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono placeholder:text-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">ID do Canal</label>
              <input value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="Ex: 1234567890123456789" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono placeholder:text-gray-700" />
            </div>
            <button onClick={handleSaveSettings} disabled={saving || (!token && !channelId)} className="px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-500 transition-all flex items-center gap-2 disabled:opacity-30">
              <Save className="w-4 h-4" /> {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className={`glass-card rounded-2xl p-6 ${syncResult.success ? 'neon-green' : 'neon-red'}`}>
          <div className="flex items-center gap-2 mb-3">
            {syncResult.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <span className={`font-bold ${syncResult.success ? 'text-green-400' : 'text-red-400'}`}>{syncResult.success ? 'Sincronização concluída' : 'Erro na sincronização'}</span>
          </div>
          <p className="text-sm text-gray-300 mb-4">{syncResult.message}</p>
          {syncResult.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Threads', value: syncResult.stats.threadsProcessed },
                { label: 'Mensagens', value: syncResult.stats.messagesProcessed },
                { label: 'Criados', value: syncResult.stats.entriesCreated },
                { label: 'Atualizados', value: syncResult.stats.entriesUpdated },
                { label: 'Funcionários', value: syncResult.stats.employeesCreated },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {syncResult.stats?.errors && syncResult.stats.errors.length > 0 && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400 font-bold mb-1">Erros ({syncResult.stats.errors.length}):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {syncResult.stats.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-red-300/80 font-mono">{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!syncResult && !showSettings && (
        <div className="glass-card rounded-2xl p-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Configure o bot e canal Discord nas configurações</p>
          <p className="text-gray-600 text-xs mt-1">Depois clique em Sincronizar para importar os registos</p>
        </div>
      )}
    </div>
  );
}
