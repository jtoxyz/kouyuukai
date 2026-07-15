import { verify } from 'hono/jwt';

export type EmailBindings = {
  DB: D1Database;
  BREVO_API_KEY: string;
  SESSION_SECRET: string;
};

type Settings = { sender_name: string; sender_email: string; event_date: string; event_location: string };
type Template = { id: number; name: string; template_type: 'confirmation' | 'scheduled'; subject: string; body: string; days_before: number | null; send_time: string | null; enabled: number };
type Reservation = { id: number; reservation_code: string; email: string; name: string; category: string; participant_count: number };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

function bearerOrCookie(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer.trim();
  const cookie = request.headers.get('Cookie') || '';
  return cookie.match(/(?:^|;\s*)admin_session=([^;]+)/)?.[1] || '';
}

async function isAdmin(request: Request, env: EmailBindings): Promise<boolean> {
  const token = bearerOrCookie(request);
  if (!token) return false;
  try {
    const payload = await verify(token, env.SESSION_SECRET, 'HS256');
    return payload?.role === 'admin';
  } catch {
    return false;
  }
}

function render(text: string, reservation: Reservation | null, settings: Settings): string {
  const values: Record<string, string> = {
    name: reservation?.name || '',
    email: reservation?.email || '',
    reservation_code: reservation?.reservation_code || '',
    participant_count: reservation ? String(reservation.participant_count) : '',
    category: reservation?.category || '',
    event_date: settings.event_date,
    event_location: settings.event_location,
  };
  return text.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => values[key] ?? '');
}

function toHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

async function loadSettings(env: EmailBindings): Promise<Settings> {
  const row = await env.DB.prepare('SELECT sender_name, sender_email, event_date, event_location FROM email_settings WHERE id = 1').first<Settings>();
  if (!row) throw new Error('メール基本設定がありません。マイグレーションを適用してください。');
  return row;
}

async function sendBrevo(env: EmailBindings, settings: Settings, to: string, subject: string, body: string): Promise<string | null> {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY が設定されていません。');
  if (!settings.sender_email) throw new Error('送信元メールアドレスが未設定です。');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: settings.sender_name, email: settings.sender_email },
      to: [{ email: to }],
      subject,
      htmlContent: `<div style="font-family:Arial,'Noto Sans JP',sans-serif;line-height:1.8">${toHtml(body)}</div>`,
      textContent: body,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { messageId?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || `Brevo API error: ${response.status}`);
  return payload.messageId || null;
}

async function claimDelivery(env: EmailBindings, template: Template, reservation: Reservation): Promise<boolean> {
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO email_deliveries (template_id, reservation_id, recipient_email, status, attempted_at)
    VALUES (?, ?, ?, 'pending', datetime('now'))`)
    .bind(template.id, reservation.id, reservation.email).run();
  if (inserted.meta.changes > 0) return true;

  const retried = await env.DB.prepare(`UPDATE email_deliveries
    SET status='pending', error_message=NULL, attempted_at=datetime('now')
    WHERE template_id=? AND reservation_id=? AND status='failed'`)
    .bind(template.id, reservation.id).run();
  return retried.meta.changes > 0;
}

async function deliver(env: EmailBindings, template: Template, reservation: Reservation, settings: Settings): Promise<void> {
  const claimed = await claimDelivery(env, template, reservation);
  if (!claimed) return;

  try {
    const messageId = await sendBrevo(env, settings, reservation.email, render(template.subject, reservation, settings), render(template.body, reservation, settings));
    await env.DB.prepare(`UPDATE email_deliveries SET status='sent', provider_message_id=?, sent_at=datetime('now'), error_message=NULL WHERE template_id=? AND reservation_id=?`)
      .bind(messageId, template.id, reservation.id).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(`UPDATE email_deliveries SET status='failed', error_message=? WHERE template_id=? AND reservation_id=?`)
      .bind(message.slice(0, 1000), template.id, reservation.id).run();
    throw error;
  }
}

export async function sendConfirmation(env: EmailBindings, reservationToken: string): Promise<void> {
  const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reservationToken))))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const reservation = await env.DB.prepare(`SELECT id, reservation_code, email, name, category, participant_count FROM reservations WHERE access_token_hash=? AND cancelled_at IS NULL`)
    .bind(tokenHash).first<Reservation>();
  const template = await env.DB.prepare(`SELECT * FROM email_templates WHERE template_type='confirmation' AND enabled=1 LIMIT 1`).first<Template>();
  if (!reservation || !template) return;
  const sent = await env.DB.prepare(`SELECT 1 FROM email_deliveries WHERE template_id=? AND reservation_id=? AND status='sent'`).bind(template.id, reservation.id).first();
  if (sent) return;
  await deliver(env, template, reservation, await loadSettings(env));
}

function jstParts(date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export async function runScheduledEmails(env: EmailBindings): Promise<void> {
  const settings = await loadSettings(env);
  const now = jstParts();
  const templates = await env.DB.prepare(`SELECT * FROM email_templates WHERE template_type='scheduled' AND enabled=1 AND send_time IS NOT NULL`).all<Template>();
  for (const template of templates.results) {
    if (template.days_before === null || template.send_time === null) continue;
    const targetDate = addDays(settings.event_date, -template.days_before);
    if (targetDate !== now.date || now.time < template.send_time) continue;
    const rows = await env.DB.prepare(`SELECT r.id, r.reservation_code, r.email, r.name, r.category, r.participant_count
      FROM reservations r
      LEFT JOIN email_deliveries d ON d.template_id=? AND d.reservation_id=r.id
      WHERE r.cancelled_at IS NULL AND (d.id IS NULL OR d.status='failed')
      ORDER BY r.id ASC LIMIT 40`).bind(template.id).all<Reservation>();
    for (const reservation of rows.results) {
      try { await deliver(env, template, reservation, settings); }
      catch (error) { console.error(JSON.stringify({ type: 'scheduled_email_failed', templateId: template.id, reservationId: reservation.id, error: String(error) })); }
    }
  }
}

export async function handleEmailApi(request: Request, env: EmailBindings): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/admin/email')) return null;
  if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized', message: '管理者ログインが必要です。' }, 401);

  if (url.pathname === '/api/admin/email/config' && request.method === 'GET') {
    const settings = await loadSettings(env);
    const templates = await env.DB.prepare('SELECT * FROM email_templates ORDER BY template_type, days_before DESC, id').all<Template>();
    const recent = await env.DB.prepare(`SELECT d.id, d.recipient_email, d.status, d.error_message, d.sent_at, d.attempted_at, t.name AS template_name
      FROM email_deliveries d JOIN email_templates t ON t.id=d.template_id ORDER BY d.id DESC LIMIT 100`).all();
    return json({ settings, templates: templates.results, deliveries: recent.results });
  }

  if (url.pathname === '/api/admin/email/settings' && request.method === 'PUT') {
    const body = await request.json() as Partial<Settings>;
    await env.DB.prepare(`UPDATE email_settings SET sender_name=?, sender_email=?, event_date=?, event_location=?, updated_at=datetime('now') WHERE id=1`)
      .bind(body.sender_name || '', body.sender_email || '', body.event_date || '', body.event_location || '').run();
    return json({ success: true });
  }

  if (url.pathname === '/api/admin/email/templates' && request.method === 'POST') {
    const body = await request.json() as Partial<Template>;
    const result = await env.DB.prepare(`INSERT INTO email_templates (name, template_type, subject, body, days_before, send_time, enabled) VALUES (?, 'scheduled', ?, ?, ?, ?, ?)`)
      .bind(body.name || '新しい自動メール', body.subject || '', body.body || '', Number(body.days_before ?? 0), body.send_time || '09:00', body.enabled ? 1 : 0).run();
    return json({ success: true, id: result.meta.last_row_id });
  }

  const match = url.pathname.match(/^\/api\/admin\/email\/templates\/(\d+)$/);
  if (match && request.method === 'PUT') {
    const body = await request.json() as Partial<Template>;
    await env.DB.prepare(`UPDATE email_templates SET name=?, subject=?, body=?, days_before=?, send_time=?, enabled=?, updated_at=datetime('now') WHERE id=?`)
      .bind(body.name || '', body.subject || '', body.body || '', body.days_before ?? null, body.send_time || null, body.enabled ? 1 : 0, Number(match[1])).run();
    return json({ success: true });
  }
  if (match && request.method === 'DELETE') {
    const row = await env.DB.prepare('SELECT template_type FROM email_templates WHERE id=?').bind(Number(match[1])).first<{ template_type: string }>();
    if (row?.template_type === 'confirmation') return json({ message: '予約完了メールは削除できません。無効化してください。' }, 400);
    await env.DB.prepare('DELETE FROM email_templates WHERE id=?').bind(Number(match[1])).run();
    return json({ success: true });
  }

  if (url.pathname === '/api/admin/email/test' && request.method === 'POST') {
    const body = await request.json() as { email?: string; template_id?: number };
    const settings = await loadSettings(env);
    const template = await env.DB.prepare('SELECT * FROM email_templates WHERE id=?').bind(Number(body.template_id)).first<Template>();
    if (!body.email || !template) return json({ message: 'テスト送信先またはテンプレートが不正です。' }, 400);
    const sample: Reservation = { id: 0, reservation_code: 'R12345678', email: body.email, name: 'テスト太郎', category: '校友', participant_count: 1 };
    await sendBrevo(env, settings, body.email, render(template.subject, sample, settings), render(template.body, sample, settings));
    return json({ success: true });
  }

  return json({ message: 'Not found' }, 404);
}
