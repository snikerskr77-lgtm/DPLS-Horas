'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, RefreshCw, Settings, CheckCircle, XCircle, Save, FlaskConical, AlertTriangle, Clock } from 'lucide-react';

interface SyncStatus { configured: boolean; hasToken: boolean; hasChannel: boolean; channelId: string | null; }
interface SyncResult { success: boolean; message: string; stats?: { threadsProcessed: number; messagesProcessed: number; entriesCreated: number; entriesUpdated: number; employeesCreated: number; errors: string[]; }; }

interface ParsedPeriod { start: string; end: string; }
interface ParserResult {
  input?: string;
  error?: string;
  parsed?: {
    valid: boolean;
    complete: boolean;
    date?: string;
    dateDisplay?: string;
    entryTime?: string;
    exitTime?: string;
    breakTimes?: string[];
    totalMinutes?: number;
    totalFormatted?: string;
    periods?: ParsedPeriod[];
    alerts: Array<{ level: string; code: string; message: string; field?: string }>;
    rawAlerts: string[];
    agentName?: string;
  };
}

const EXAMPLE_MESSAGE = `📆 Data: 15/07/2026

🕐 Hora De Entrada: 11:40
🕐 Pausa: 12:35 - 13:05 ; 16:30 - 18:25 ; 20:10 - 22:45
🕐 Hora De Saída: 03:40

🖊️Resumo:
Patrulha - @129 | Leandro Fontes`;

export default function DiscordPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [token, setToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [saving, setSaving] = useState(false);

  // Parser tester
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState<ParserResult | null>(null);
  const [testing, setTesting] = useState(false);

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

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/discord/test-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMsg }),
      });
      setTestResult(await res.json());
    } catch (e) {
      setTestResult({ error: e instanceof Error ? e.message : 'Erro desconhecido' });
    }
    setTesting(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" /></div>;

  const p = testResult?.parsed;

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

      {/* ── TESTAR PARSER ── */}
      <div className="glass-card rounded-2xl p-6 mb-6 neon-blue">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Testar Parser</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Cola aqui a mensagem tal como aparece no Discord para veres <strong className="text-gray-300">exatamente o que o sistema captura</strong> — antes de sincronizar.
        </p>
        <textarea
          value={testMsg}
          onChange={e => setTestMsg(e.target.value)}
          placeholder="Cola a mensagem de picagem de ponto aqui...&#10;&#10;📆 Data: 15/07/2026&#10;🕐 Hora De Entrada: 11:40&#10;🕐 Pausa: 12:35 - 13:05 ; ...&#10;🕐 Hora De Saída: 03:40"
          rows={8}
          className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono placeholder:text-gray-700 resize-y"
        />
        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleTest} disabled={testing || !testMsg.trim()} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center gap-2 disabled:opacity-30">
            <FlaskConical className="w-4 h-4" /> {testing ? 'A testar...' : 'Testar Parser'}
          </button>
          <button onClick={() => setTestMsg(EXAMPLE_MESSAGE)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 transition-all">
            Usar exemplo
          </button>
        </div>

        {/* Resultado do parser */}
        {testResult && (
          <div className="mt-5 border-t border-white/10 pt-5">
            {testResult.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{testResult.error}</div>
            ) : p ? (
              <div className="space-y-4">
                {/* Estado */}
                <div className="flex items-center gap-2 flex-wrap">
                  {p.valid ? (
                    <span className="px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-bold">✓ VÁLIDO</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold">✗ INVÁLIDO</span>
                  )}
                  {p.complete && (
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs font-bold">COMPLETO</span>
                  )}
                  {p.agentName && (
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs">👤 {p.agentName}</span>
                  )}
                </div>

                {/* Dados principais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Data</p>
                    <p className="text-sm font-mono text-white">{p.dateDisplay || '—'}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Entrada</p>
                    <p className="text-sm font-mono text-green-400">{p.entryTime || '—'}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Saída</p>
                    <p className="text-sm font-mono text-red-400">{p.exitTime || '—'}</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-bold mb-1">Total</p>
                    <p className="text-sm font-mono font-bold text-amber-300">{p.totalFormatted || '0h00m'}</p>
                  </div>
                </div>

                {/* Períodos de trabalho */}
                {p.periods && p.periods.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Períodos de Trabalho ({p.periods.length})</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.periods.map((period, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/35 overflow-hidden">
                          <span className="px-2 py-1 text-xs font-mono font-bold text-blue-200">{period.start}</span>
                          <span className="text-blue-500/50 text-[10px] px-0.5">→</span>
                          <span className="px-2 py-1 text-xs font-mono font-bold text-blue-200">{period.end}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pausas */}
                {p.breakTimes && p.breakTimes.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Pausas Detetadas — ordenadas automaticamente ({p.breakTimes.length / 2})</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: Math.floor(p.breakTimes.length / 2) }).map((_, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-purple-500/15 border border-purple-500/35 overflow-hidden">
                          <span className="px-2 py-1 text-xs font-mono font-bold text-purple-200">{p.breakTimes![i * 2]}</span>
                          <span className="text-purple-500/50 text-[10px] px-0.5">→</span>
                          <span className="px-2 py-1 text-xs font-mono font-bold text-purple-200">{p.breakTimes![i * 2 + 1]}</span>
                        </span>
                      ))}
                      {p.breakTimes.length % 2 !== 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/35 px-2 py-1 text-xs font-mono font-bold text-amber-300">
                          {p.breakTimes[p.breakTimes.length - 1]} ⚠ sem par
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Alertas */}
                {p.alerts && p.alerts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alertas ({p.alerts.length})</p>
                    {p.alerts.map((a, i) => (
                      <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${a.level === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                        <span className="font-mono text-[10px] opacity-60 mr-2">[{a.code}]</span>{a.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

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
        <div className="glass-card rounded-2xl p-10 text-center">
          <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Configure o bot e canal Discord nas configurações</p>
          <p className="text-gray-600 text-xs mt-1">Depois clique em Sincronizar para importar os registos</p>
        </div>
      )}
    </div>
  );
}
