'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EVENT_CONFIG } from '../../../config/eventConfig';

type Settings = { sender_name: string; sender_email: string; event_date: string; event_location: string };
type Template = { id: number; name: string; template_type: 'confirmation' | 'scheduled'; subject: string; body: string; days_before: number | null; send_time: string | null; enabled: number };
type Delivery = { id: number; recipient_email: string; status: string; error_message: string | null; sent_at: string | null; attempted_at: string; template_name: string };

const emptySettings: Settings = { sender_name: '大阪産業大学校友会', sender_email: '', event_date: '2026-10-31', event_location: '' };

export default function EmailAdminPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const adminFetch = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const token = sessionStorage.getItem('admin_session_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${EVENT_CONFIG.apiUrl}${path}`, { ...init, headers, credentials: 'include' });
  };

  const load = async () => {
    const response = await adminFetch('/api/admin/email/config');
    if (response.status === 401) { window.location.href = '/admin'; return; }
    if (!response.ok) { setMessage('メール設定を取得できません。D1マイグレーションが未適用の可能性があります。'); return; }
    const data = await response.json();
    setSettings(data.settings);
    setTemplates(data.templates || []);
    setDeliveries(data.deliveries || []);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setBusy(true); setMessage('');
    const response = await adminFetch('/api/admin/email/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setMessage(response.ok ? '基本設定を保存しました。' : '基本設定を保存できませんでした。');
    setBusy(false);
  };

  const saveTemplate = async (template: Template) => {
    setBusy(true); setMessage('');
    const response = await adminFetch(`/api/admin/email/templates/${template.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(template) });
    setMessage(response.ok ? `${template.name}を保存しました。` : 'テンプレートを保存できませんでした。');
    setBusy(false);
    await load();
  };

  const addTemplate = async () => {
    const response = await adminFetch('/api/admin/email/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '新しい自動メール', subject: '', body: '', days_before: 0, send_time: '09:00', enabled: 0 }) });
    if (response.ok) await load();
  };

  const removeTemplate = async (template: Template) => {
    if (!confirm(`${template.name}を削除しますか？`)) return;
    const response = await adminFetch(`/api/admin/email/templates/${template.id}`, { method: 'DELETE' });
    setMessage(response.ok ? '削除しました。' : '削除できませんでした。');
    if (response.ok) await load();
  };

  const testSend = async (template: Template) => {
    if (!testEmail) { setMessage('テスト送信先を入力してください。'); return; }
    setBusy(true); setMessage('テスト送信中です。');
    const response = await adminFetch('/api/admin/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testEmail, template_id: template.id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'テストメールを送信しました。' : data.message || 'テスト送信に失敗しました。');
    setBusy(false);
  };

  const updateTemplate = (id: number, patch: Partial<Template>) => setTemplates((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));

  return (
    <div className="container" style={{ maxWidth: 960, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div><h1>メール設定</h1><p style={{ color: '#666' }}>予約完了メールと自動リマインドを管理します。</p></div>
        <Link href="/admin" className="btn btn-outline" style={{ width: 'auto' }}>管理画面へ戻る</Link>
      </div>

      {message && <div className="info-box" style={{ marginBottom: 20 }}>{message}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>基本設定</h2>
        <label className="form-label">送信元表示名</label>
        <input className="form-control" value={settings.sender_name} onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })} />
        <label className="form-label" style={{ marginTop: 14 }}>送信元メールアドレス</label>
        <input className="form-control" type="email" value={settings.sender_email} onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })} placeholder="Brevoで認証済みのアドレス" />
        <label className="form-label" style={{ marginTop: 14 }}>開催日</label>
        <input className="form-control" type="date" value={settings.event_date} onChange={(e) => setSettings({ ...settings, event_date: e.target.value })} />
        <label className="form-label" style={{ marginTop: 14 }}>開催場所</label>
        <input className="form-control" value={settings.event_location} onChange={(e) => setSettings({ ...settings, event_location: e.target.value })} />
        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy} onClick={saveSettings}>基本設定を保存</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>テスト送信先</h2>
        <input className="form-control" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="確認用メールアドレス" />
      </div>

      {templates.map((template) => (
        <div className="card" style={{ marginBottom: 24 }} key={template.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <h2>{template.name}</h2>
            <label><input type="checkbox" checked={template.enabled === 1} onChange={(e) => updateTemplate(template.id, { enabled: e.target.checked ? 1 : 0 })} /> 有効</label>
          </div>
          <label className="form-label">管理用の名前</label>
          <input className="form-control" value={template.name} onChange={(e) => updateTemplate(template.id, { name: e.target.value })} />
          {template.template_type === 'scheduled' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div><label className="form-label">開催日の何日前</label><input className="form-control" type="number" min="0" value={template.days_before ?? 0} onChange={(e) => updateTemplate(template.id, { days_before: Number(e.target.value) })} /></div>
            <div><label className="form-label">送信開始時刻</label><input className="form-control" type="time" value={template.send_time || '09:00'} onChange={(e) => updateTemplate(template.id, { send_time: e.target.value })} /></div>
          </div>}
          <label className="form-label" style={{ marginTop: 14 }}>件名</label>
          <input className="form-control" value={template.subject} onChange={(e) => updateTemplate(template.id, { subject: e.target.value })} />
          <label className="form-label" style={{ marginTop: 14 }}>本文</label>
          <textarea className="form-control" rows={12} value={template.body} onChange={(e) => updateTemplate(template.id, { body: e.target.value })} />
          <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>差し込み: {'{{name}} {{reservation_code}} {{participant_count}} {{category}} {{event_date}} {{event_location}}'}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} disabled={busy} onClick={() => saveTemplate(template)}>保存</button>
            <button className="btn btn-outline" style={{ width: 'auto' }} disabled={busy} onClick={() => testSend(template)}>テスト送信</button>
            {template.template_type === 'scheduled' && <button className="btn btn-outline" style={{ width: 'auto', color: 'var(--color-error)' }} onClick={() => removeTemplate(template)}>削除</button>}
          </div>
        </div>
      ))}

      <button className="btn btn-accent" onClick={addTemplate}>自動メールを追加</button>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>直近の送信履歴</h2>
        <div className="table-responsive"><table className="admin-table"><thead><tr><th>メール</th><th>送信先</th><th>状態</th><th>日時・エラー</th></tr></thead><tbody>
          {deliveries.length === 0 ? <tr><td colSpan={4}>送信履歴はありません。</td></tr> : deliveries.map((item) => <tr key={item.id}><td>{item.template_name}</td><td>{item.recipient_email}</td><td>{item.status}</td><td>{item.sent_at || item.attempted_at}{item.error_message ? ` / ${item.error_message}` : ''}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}
