import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

export type Bindings = {
  DB: D1Database;
  DUPLICATE_RESERVATION_MODE: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  EVENT_DATE: string;
  EVENT_LOCATION: string;
  EVENT_RESERVATION_END: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS は worker.ts のホワイトリストだけで扱う。ここで付けると許可外オリジンにも
// ヘッダーが残り、worker.ts 側が消さないため全オリジン許可になってしまう。

// Helper: Normalize Email
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Helper: Normalize Name (removes all spaces for strict comparison, trims for display)
function normalizeNameForComparison(name: string): string {
  return name.replace(/[\s　]/g, '').trim();
}

// Helper: SHA-256 Hash for tokens
async function hashToken(token: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Get current datetime in JST (Asia/Tokyo) as ISO string
function getNowJST(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T') + '+09:00';
}

// Helper: Generate Random Code (e.g. R12345678)
function generateReservationCode(): string {
  const chars = '0123456789';
  let result = 'R';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Verify Admin Session
async function getAdminSession(c: any): Promise<boolean> {
  const authorization = c.req.header('Authorization') || '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim() || getCookie(c, 'admin_session');
  if (!token) return false;
  try {
    const payload = await verify(token, c.env.SESSION_SECRET, 'HS256');
    return payload && payload.role === 'admin';
  } catch {
    return false;
  }
}

// ==========================================
// 1. PUBLIC ENDPOINTS
// ==========================================

// Health check. Confirms the worker is reachable and the D1 binding resolves,
// so a deploy can be verified without touching reservation data.
app.get('/api/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok', database: 'ok' });
  } catch (err: any) {
    return c.json({ status: 'ok', database: 'error', message: err.message }, 503);
  }
});

// Get Event Information (Includes location and dates from config/vars)
app.get('/api/event', async (c) => {
  try {
    const event = await c.env.DB.prepare(
      'SELECT id, title, capacity, reserved_count, is_accepting FROM events WHERE id = 1'
    ).first<any>();
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // Merge database state with environment configs
    return c.json({
      title: event.title,
      capacity: event.capacity,
      reserved_count: event.reserved_count,
      is_accepting: event.is_accepting,
      event_date: c.env.EVENT_DATE,
      event_location: c.env.EVENT_LOCATION,
      reservation_end: c.env.EVENT_RESERVATION_END,
      duplicate_mode: c.env.DUPLICATE_RESERVATION_MODE || 'A'
    });
  } catch (err: any) {
    return c.json({ error: 'Database error', message: err.message }, 500);
  }
});

// Create Reservation
app.post('/api/reservations', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      email, 
      name, 
      category, 
      participant_count, 
      discovery_source, 
      discovery_source_other, 
      requested_event,
      force // Used for duplicate warning override (Mode B)
    } = body;
    
    // Validate inputs
    if (!email || !name || !category || !participant_count || !discovery_source) {
      return c.json({ error: 'ValidationError', message: '必須項目が入力されていません。' }, 400);
    }
    
    const count = Number(participant_count);
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      return c.json({ error: 'ValidationError', message: '申し込み人数は1名から4名までです。' }, 400);
    }
    
    if (requested_event && requested_event.length > 500) {
      return c.json({ error: 'ValidationError', message: '今後開催してほしいイベントは500文字以内で入力してください。' }, 400);
    }
    
    // Normalize data
    const normEmail = normalizeEmail(email);
    const normName = normalizeNameForComparison(name);
    const cleanName = name.trim();
    
    // Check Event is open and has capacity
    const event = await c.env.DB.prepare('SELECT capacity, reserved_count, is_accepting FROM events WHERE id = 1').first<any>();
    if (!event) {
      return c.json({ error: 'NotFound', message: 'イベント情報が見つかりません。' }, 404);
    }
    
    if (event.is_accepting === 0) {
      return c.json({ error: 'ReservationClosed', message: 'ただいま予約受付を停止しています。' }, 400);
    }
    
    if (event.reserved_count + count > event.capacity) {
      return c.json({ error: 'CapacityExceeded', message: `定員（残り ${event.capacity - event.reserved_count} 名）を超過するため予約できません。` }, 400);
    }
    
    // Handle Duplication Checks
    const duplicateMode = c.env.DUPLICATE_RESERVATION_MODE || 'A';
    const existing = await c.env.DB.prepare(
      'SELECT id, name, category, participant_count FROM reservations WHERE normalized_email = ? AND cancelled_at IS NULL'
    ).bind(normEmail).first<any>();
    
    if (existing) {
      if (duplicateMode === 'A') {
        // Mode A: Strictly forbid duplicates
        return c.json({ 
          error: 'DuplicateEmail', 
          message: 'このメールアドレスでは既に予約されています。' 
        }, 400);
      } else if (duplicateMode === 'B' && !force) {
        // Mode B: Warn but allow override (if force is not true)
        return c.json({ 
          error: 'DuplicateWarning', 
          message: 'このメールアドレスは既に登録されています。このまま登録を続行しますか？' 
        }, 400);
      }
      // Mode C: Proceed normally
    }
    
    // Generate secure token and internal reservation code
    const token = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const code = generateReservationCode();
    
    // Insert into DB. triggers will enforce safety checks
    const query = `
      INSERT INTO reservations (
        reservation_code, access_token_hash, email, normalized_email, name, normalized_name,
        category, participant_count, discovery_source, discovery_source_other, requested_event, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    try {
      await c.env.DB.prepare(query)
        .bind(code, tokenHash, email.trim(), normEmail, cleanName, normName, category, count, discovery_source, discovery_source_other || null, requested_event || null)
        .run();
    } catch (dbErr: any) {
      // Catch trigger exceptions (SQLite raises ABORT with trigger message)
      if (dbErr.message.includes('CAPACITY_EXCEEDED')) {
        return c.json({ error: 'CapacityExceeded', message: '定員を超過するため予約を完了できませんでした。' }, 400);
      }
      if (dbErr.message.includes('RESERVATION_CLOSED')) {
        return c.json({ error: 'ReservationClosed', message: 'ただいま予約受付は停止されています。' }, 400);
      }
      throw dbErr;
    }
    
    return c.json({
      success: true,
      token,
      name: cleanName,
      email: email.trim(),
      participant_count: count,
      category,
      reservation_code: code
    });
  } catch (err: any) {
    return c.json({ error: 'InternalError', message: 'サーバーエラーが発生しました。' }, 500);
  }
});

// Query reservation lists based on a list of tokens (supports multiple tokens per device)
app.post('/api/reservations/tokens', async (c) => {
  try {
    const { tokens } = await c.req.json();
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return c.json({ reservations: [] });
    }
    
    const reservations = [];
    for (const token of tokens) {
      const hash = await hashToken(token);
      const res = await c.env.DB.prepare(
        'SELECT id, name, category, participant_count, checked_in, checked_in_at, created_at, reservation_code FROM reservations WHERE access_token_hash = ? AND cancelled_at IS NULL'
      ).bind(hash).first<any>();
      
      if (res) {
        reservations.push({
          token, // return same token to map on client side
          id: res.id,
          name: res.name,
          category: res.category,
          participant_count: res.participant_count,
          checked_in: res.checked_in,
          checked_in_at: res.checked_in_at,
          created_at: res.created_at,
          reservation_code: res.reservation_code
        });
      }
    }
    
    return c.json({ reservations });
  } catch (err: any) {
    return c.json({ error: 'InternalError', message: '予約データの照会に失敗しました。' }, 500);
  }
});

// Search reservation by Name + Email (Strict validation)
app.post('/api/reservations/search', async (c) => {
  try {
    const { name, email } = await c.req.json();
    if (!name || !email) {
      return c.json({ error: 'ValidationError', message: '氏名とメールアドレスを入力してください。' }, 400);
    }
    
    const normEmail = normalizeEmail(email);
    const normName = normalizeNameForComparison(name);
    
    // Find matching reservation
    const res = await c.env.DB.prepare(
      'SELECT id, name, category, participant_count, checked_in FROM reservations WHERE normalized_email = ? AND normalized_name = ? AND cancelled_at IS NULL'
    ).bind(normEmail, normName).first<any>();
    
    if (!res) {
      return c.json({ error: 'NotFound', message: 'ご予約が見つかりませんでした。入力内容をお確かめください。' }, 404);
    }
    
    // Issue a new token and update hash (since original token plaintext is lost)
    const newToken = crypto.randomUUID();
    const newHash = await hashToken(newToken);
    
    await c.env.DB.prepare(
      'UPDATE reservations SET access_token_hash = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(newHash, res.id).run();
    
    return c.json({
      success: true,
      token: newToken,
      name: res.name,
      category: res.category,
      participant_count: res.participant_count
    });
  } catch (err: any) {
    return c.json({ error: 'InternalError', message: '検索中にエラーが発生しました。' }, 500);
  }
});


// ==========================================
// 2. ADMIN ENDPOINTS (Cookie-based auth)
// ==========================================

// Admin Login
app.post('/api/admin/login', async (c) => {
  try {
    const { password } = await c.req.json();
    const correctPassword = c.env.ADMIN_PASSWORD;
    if (!correctPassword) {
      return c.json({ error: 'ServerError', message: 'ADMIN_PASSWORD が設定されていません。' }, 500);
    }
    
    if (password !== correctPassword) {
      return c.json({ error: 'Unauthorized', message: 'パスワードが正しくありません。' }, 401);
    }
    
    // Create JWT Session
    const payload = {
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 // 8 hours session
    };
    const sessionToken = await sign(payload, c.env.SESSION_SECRET, 'HS256');
    
    const host = c.req.header('Host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    // Set HTTPOnly cookie
    setCookie(c, 'admin_session', sessionToken, {
      httpOnly: true,
      secure: !isLocalhost, // secure only on production (non-localhost)
      sameSite: 'None',
      path: '/',
      maxAge: 60 * 60 * 8 // 8 hours
    });
    
    return c.json({ success: true, token: sessionToken });
  } catch (err: any) {
    return c.json({ error: 'InternalError', message: 'ログイン処理に失敗しました。' }, 500);
  }
});

// Admin Logout
app.post('/api/admin/logout', async (c) => {
  deleteCookie(c, 'admin_session', {
    path: '/'
  });
  return c.json({ success: true });
});

// Admin Middleware check
app.use('/api/admin/*', async (c, next) => {
  const authorized = await getAdminSession(c);
  if (!authorized) {
    return c.json({ error: 'Unauthorized', message: 'セッションが切断されたか、ログインされていません。' }, 401);
  }
  await next();
});

// Admin Dashboard Summary
app.get('/api/admin/summary', async (c) => {
  try {
    const event = await c.env.DB.prepare(
      'SELECT capacity, reserved_count, is_accepting FROM events WHERE id = 1'
    ).first<any>();
    
    const counts = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_reservations, 
        SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checked_in_count
      FROM reservations 
      WHERE cancelled_at IS NULL
    `).first<any>();
    
    if (!event) {
      return c.json({ error: 'Event state not initialized' }, 500);
    }
    
    return c.json({
      capacity: event.capacity,
      reserved_count: event.reserved_count, // sum of participants via trigger
      remaining: event.capacity - event.reserved_count,
      total_reservations: counts.total_reservations || 0,
      checked_in_count: counts.checked_in_count || 0,
      is_accepting: event.is_accepting
    });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Admin Reservations List & Search (Masks emails by default)
app.get('/api/admin/reservations', async (c) => {
  try {
    const search = c.req.query('search') || '';
    let reservations: any[];
    
    if (search.trim() !== '') {
      const param = `%${search.trim()}%`;
      // Search partial match in name, email, or reservation_code
      reservations = await c.env.DB.prepare(`
        SELECT id, reservation_code, email, name, category, participant_count, checked_in, checked_in_at, created_at, cancelled_at
        FROM reservations
        WHERE (name LIKE ? OR email LIKE ? OR reservation_code LIKE ?) AND cancelled_at IS NULL
        ORDER BY name COLLATE NOCASE ASC
      `).bind(param, param, param).all<any>().then(res => res.results);
    } else {
      // List all active
      reservations = await c.env.DB.prepare(`
        SELECT id, reservation_code, email, name, category, participant_count, checked_in, checked_in_at, created_at, cancelled_at
        FROM reservations
        WHERE cancelled_at IS NULL
        ORDER BY name COLLATE NOCASE ASC
      `).all<any>().then(res => res.results);
    }
    
    // Mask emails for list views
    const masked = reservations.map(r => {
      const parts = r.email.split('@');
      let maskedEmail = r.email;
      if (parts.length === 2) {
        const username = parts[0];
        const domain = parts[1];
        const visible = username.substring(0, Math.min(2, username.length));
        maskedEmail = `${visible}***@${domain}`;
      }
      return {
        ...r,
        email: maskedEmail
      };
    });
    
    return c.json({ reservations: masked });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Admin API to fetch full unmasked list for Excel Generation (Client-side ExcelJS)
app.get('/api/admin/reservations/export', async (c) => {
  try {
    // Returns all reservations including cancelled or active
    const reservations = await c.env.DB.prepare(`
      SELECT * FROM reservations
      ORDER BY id ASC
    `).all<any>().then(res => res.results);
    
    return c.json({ reservations });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Admin Reservation Details (Unmasked details)
app.get('/api/admin/reservations/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const res = await c.env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(id).first<any>();
    
    if (!res) {
      return c.json({ error: 'NotFound', message: '予約情報が見つかりません。' }, 404);
    }
    
    return c.json({ reservation: res });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Toggle Check-in State
app.post('/api/admin/reservations/:id/checkin', async (c) => {
  try {
    const id = c.req.param('id');
    const { checked_in } = await c.req.json();
    const flag = checked_in ? 1 : 0;
    const time = checked_in ? getNowJST() : null;
    
    await c.env.DB.prepare(
      'UPDATE reservations SET checked_in = ?, checked_in_at = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(flag, time, id).run();
    
    return c.json({ success: true, checked_in: flag, checked_in_at: time });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Cancel Reservation (Soft Delete)
app.post('/api/admin/reservations/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Check if it's already cancelled
    const res = await c.env.DB.prepare('SELECT cancelled_at FROM reservations WHERE id = ?').bind(id).first<any>();
    if (!res) {
      return c.json({ error: 'NotFound', message: '予約情報が見つかりません。' }, 404);
    }
    
    if (res.cancelled_at) {
      return c.json({ error: 'BadRequest', message: 'この予約はすでにキャンセルされています。' }, 400);
    }
    
    // Update cancelled_at. trigger automatically decrements events.reserved_count
    await c.env.DB.prepare(
      'UPDATE reservations SET cancelled_at = datetime("now"), updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

// Admin toggle event acceptance state (Start / Stop)
app.post('/api/admin/event/toggle', async (c) => {
  try {
    const { is_accepting } = await c.req.json();
    const flag = is_accepting ? 1 : 0;
    
    await c.env.DB.prepare(
      'UPDATE events SET is_accepting = ?, updated_at = datetime("now") WHERE id = 1'
    ).bind(flag).run();
    
    return c.json({ success: true, is_accepting: flag });
  } catch (err: any) {
    return c.json({ error: 'DatabaseError', message: err.message }, 500);
  }
});

export default app;
