'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Settings, MessageSquare, Users, Clock, Zap, PlayCircle, Save, Eye, EyeOff, Key, Hash } from 'lucide-react';
import Button from '@/components/Button';

interface DiscordConfig { configured: boolean; hasToken: boolean; hasChannel: boolean; channelId: string | null; }
interface SyncStats { threadsProcessed: number; messagesProcessed: number; entriesCreated: number; entriesUpdated: number; employeesCreated: number; errors: string[]; }
interface SyncResult { success: boolean; message: string; stats?: SyncStats; }

export default function DiscordPage() {
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { checkConfig(); loadSettings(); }, []);

  const checkConfig = async () => { try { setConfig(await (await fetch('/api/discord/sync')).json()); } catch (e) { console.error(e); } finally { setLoading(false); } };
  const loadSettings = async () => { try { const d = await (await fetch('/api/settings')).json(); if (d.discord_channel_id) setChannelId(d.discord_channel_id); } catch (e) { console.error(e); } };

  const handleSaveConfig = async () => {
    setSaving(true); setSaveMessage(null);
    try {
      const s: Record<string, string> = {};
      if (botToken.trim()) s.discord_bot_token = botToken.trim();
      if (channelId.trim()) s.discord_channel_id = channelId.trim();
      if (Object.keys(s).length === 0) { setSaveMessage({ type: 'error', text: 'Preencha pelo menos um campo' }); return; }
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (res.ok) { setSaveMessage({ type: 'success', text: 'Configurações guardadas!' }); setBotToken(''); checkConfig(); }
      else setSaveMessage({ type: 'error', text: 'Erro ao guardar' });
    } catch { setSaveMessage({ type: 'error', text: 'Erro de conexão' }); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    setSyncing(true); setResult(null);
    try { const d = await (await fetch('/api/discord/sync', { method: 'POST' })).json(); setResult(d); if (d.success) setLastSync(new Date()); }
    catch { setResult({ success: false, message: 'Erro de conexão.' }); }
    finally { setSyncing(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-widest uppercase font-mono">Sincronização Discord</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">Importar dados de picagem de ponto</p>
        </div>
        <Button onClick={handleSync} loading={syncing} disabled={!config?.configured} icon={<RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />}>
          {syncing ? 'A sincronizar...' : 'Sincronizar Agora'}
        </Button>
      </div>

      {/* Configuration Form */}
      <div className="glass-card rounded-xl p-5 neon-blue">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" /> Configuração do Bot
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Token do Bot</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Cole o token aqui..." className="w-full px-3 py-2 pr-10 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500/50" />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1 font-mono">Developer Portal → Bot → Reset Token</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ID do Canal</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input type="text" value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="1234567890123456789" className="w-full px-3 py-2 pl-9 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500/50" />
            </div>
            <p className="text-[10px] text-gray-600 mt-1 font-mono">Click direito no canal → Copiar ID</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleSaveConfig} loading={saving} icon={<Save className="w-4 h-4" />}>Guardar</Button>
          {saveMessage && <span className={`text-xs font-mono ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{saveMessage.text}</span>}
        </div>
      </div>

      {/* Status */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Estado
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${config?.hasToken ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            {config?.hasToken ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-xs font-bold text-white">Token do Bot</p>
              <p className="text-[10px] text-gray-500 font-mono">{config?.hasToken ? 'Configurado ✓' : 'Não configurado'}</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${config?.hasChannel ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            {config?.hasChannel ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-xs font-bold text-white">Canal ID</p>
              <p className="text-[10px] text-gray-500 font-mono">{config?.hasChannel ? config.channelId : 'Não configurado'}</p>
            </div>
          </div>
        </div>
        {config?.configured && (
          <div className="mt-4 p-3 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-400">Pronto para sincronizar!</span>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="glass-card rounded-xl p-5 border-blue-500/10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Como funciona
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: MessageSquare, color: 'blue', title: '1. Lê mensagens', desc: 'Conecta ao Discord e lê todas as mensagens do canal ou fórum.' },
            { icon: Users, color: 'amber', title: '2. Identifica agentes', desc: 'Extrai nomes das threads (ex: "Picagem - João Silva").' },
            { icon: Clock, color: 'green', title: '3. Processa picagens', desc: 'Extrai data, entrada, saída e pausas de cada mensagem.' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="bg-black/20 rounded-lg p-4 border border-white/5">
                <div className={`w-8 h-8 rounded-lg bg-${item.color}-500/10 border border-${item.color}-500/30 flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 text-${item.color}-400`} />
                </div>
                <h3 className="text-xs font-bold text-white mb-1">{item.title}</h3>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Formato esperado:</p>
          <pre className="p-3 bg-black/50 text-green-400 rounded text-xs font-mono overflow-x-auto">
{`📆 Data: 15/01/2024
🕐 Hora De Entrada: 09:00
🕐 Hora De Saída: 18:00`}
          </pre>
        </div>
      </div>

      {/* Sync Result */}
      {result && (
        <div className={`glass-card rounded-xl p-5 ${result.success ? 'neon-green border-green-500/20' : 'neon-red border-red-500/20'}`}>
          <div className="flex items-start gap-4">
            {result.success ? <CheckCircle className="w-7 h-7 text-green-400" /> : <XCircle className="w-7 h-7 text-red-400" />}
            <div className="flex-1">
              <h3 className={`text-sm font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Sincronização concluída!' : 'Erro na sincronização'}
              </h3>
              <p className={`text-xs font-mono mt-1 ${result.success ? 'text-green-400/70' : 'text-red-400/70'}`}>{result.message}</p>
              {result.stats && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Threads', value: result.stats.threadsProcessed, color: 'text-gray-300' },
                    { label: 'Mensagens', value: result.stats.messagesProcessed, color: 'text-gray-300' },
                    { label: 'Criados', value: result.stats.entriesCreated, color: 'text-green-400' },
                    { label: 'Atualizados', value: result.stats.entriesUpdated, color: 'text-blue-400' },
                    { label: 'Novos Agentes', value: result.stats.employeesCreated, color: 'text-amber-400' },
                  ].map((item, i) => (
                    <div key={i} className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                      <p className={`text-xl font-extrabold font-mono ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.stats?.errors && result.stats.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Erros ({result.stats.errors.length}):</p>
                  <ul className="text-xs text-red-400/70 space-y-1 max-h-24 overflow-y-auto font-mono">
                    {result.stats.errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lastSync && <div className="text-center text-[10px] text-gray-600 font-mono">Última sincronização: {lastSync.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })} (PT 🇵🇹)</div>}

      {/* Parser Test */}
      <ParserTest />
    </div>
  );
}

interface ParsedAlertItem {
  level: string;
  code: string;
  message: string;
  field?: string;
}

interface ParserResult {
  input: string;
  parsed: {
    valid: boolean;
    complete: boolean;
    dateDisplay?: string;
    entryTime?: string;
    exitTime?: string;
    totalFormatted?: string;
    breakTimes?: string[];
    alerts: ParsedAlertItem[];
    rawAlerts: string[];
  };
}

function ParserTest() {
  const [msg, setMsg] = useState(`📆 Data:12/07/2026\n\n🕐 Hora De Entrada:01:03\n🕐 Pausa:09:42\n🕐 Hora De Saída:\n🖊️ Resumo\n• Patrulha com alguém`);
  const [res, setRes] = useState<ParserResult | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    try { setRes(await (await fetch('/api/discord/test-parser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })).json()); }
    catch (e) { console.error(e); } finally { setTesting(false); }
  };

  return (
    <div className="glass-card rounded-xl p-5 neon-amber">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
        <PlayCircle className="w-4 h-4 text-amber-400" /> Testar Parser
      </h2>
      <p className="text-[10px] text-gray-500 mb-3">Cole uma mensagem de picagem para verificar os erros detetados.</p>
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} className="w-full h-32 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-green-400 font-mono text-xs focus:outline-none focus:border-amber-500/50 resize-none" />
      <div className="mt-3"><Button onClick={test} loading={testing} variant="secondary">Testar Mensagem</Button></div>
      {res && (
        <div className="mt-4 space-y-3">
          {/* Status Banner */}
          <div className={`p-3 rounded-lg border flex items-center gap-3 ${
            res.parsed.complete ? 'bg-green-500/5 border-green-500/20' :
            res.parsed.valid ? 'bg-amber-500/5 border-amber-500/20' :
            'bg-red-500/5 border-red-500/20'
          }`}>
            {res.parsed.complete ? (
              <><CheckCircle className="w-5 h-5 text-green-400" /><div><p className="text-xs font-bold text-green-400">REGISTO COMPLETO</p><p className="text-[10px] text-green-400/60 font-mono">Sem erros — tudo correto</p></div></>
            ) : res.parsed.valid ? (
              <><AlertTriangle className="w-5 h-5 text-amber-400" /><div><p className="text-xs font-bold text-amber-400">REGISTO INCOMPLETO</p><p className="text-[10px] text-amber-400/60 font-mono">Pode ser guardado mas tem problemas</p></div></>
            ) : (
              <><XCircle className="w-5 h-5 text-red-400" /><div><p className="text-xs font-bold text-red-400">REGISTO INVÁLIDO</p><p className="text-[10px] text-red-400/60 font-mono">Não pode ser processado</p></div></>
            )}
          </div>

          {/* Extracted Fields */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Data', value: res.parsed.dateDisplay, ok: !!res.parsed.dateDisplay },
              { label: 'Entrada', value: res.parsed.entryTime, ok: !!res.parsed.entryTime && !res.parsed.alerts.some(a => a.field === 'entrada') },
              { label: 'Saída', value: res.parsed.exitTime || 'VAZIA', ok: !!res.parsed.exitTime && !res.parsed.alerts.some(a => a.field === 'saida' && a.level === 'error') },
              { label: 'Pausa', value: res.parsed.breakTimes?.join(', ') || '—', ok: !res.parsed.alerts.some(a => a.field === 'pausa') },
              { label: 'Total', value: res.parsed.totalFormatted || '—', ok: !!res.parsed.totalFormatted },
            ].map((f, i) => (
              <div key={i} className={`rounded-lg p-2.5 border ${f.ok ? 'bg-black/30 border-white/5' : 'bg-red-500/5 border-red-500/20'}`}>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{f.label}</p>
                <p className={`text-xs font-bold font-mono mt-0.5 ${f.ok ? 'text-white' : 'text-red-400'}`}>{f.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Alerts List */}
          {res.parsed.alerts.length > 0 && (
            <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/5 bg-black/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {res.parsed.alerts.filter(a => a.level === 'error').length} ERROS · {res.parsed.alerts.filter(a => a.level === 'warning').length} AVISOS
                </p>
              </div>
              <ul className="divide-y divide-white/5">
                {res.parsed.alerts.map((alert, i) => (
                  <li key={i} className={`px-3 py-2.5 flex items-start gap-2.5 ${alert.level === 'error' ? 'bg-red-500/[0.03]' : ''}`}>
                    {alert.level === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${alert.level === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                          {alert.level === 'error' ? 'ERRO' : 'AVISO'}
                        </span>
                        {alert.field && <span className="text-[10px] text-gray-600 font-mono uppercase">{alert.field}</span>}
                        <span className="text-[10px] text-gray-700 font-mono">{alert.code}</span>
                      </div>
                      <p className={`text-xs font-mono mt-1 ${alert.level === 'error' ? 'text-red-400/90' : 'text-amber-400/80'}`}>{alert.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
