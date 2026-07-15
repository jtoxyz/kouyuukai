import app, { type Bindings } from './index';
import { handleEmailApi, runScheduledEmails, sendConfirmation, type EmailBindings } from './email';

type WorkerBindings = Bindings & EmailBindings;

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('Origin') || '';

  if (
    origin === 'https://koyukai.pages.dev' ||
    /^https:\/\/[a-z0-9-]+\.koyukai\.pages\.dev$/i.test(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return origin;
  }

  return '';
}

function applyCorsHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    const origin = getCorsOrigin(request);

    if (request.method === 'OPTIONS') {
      return applyCorsHeaders(new Response(null, { status: 204 }), origin);
    }

    const emailResponse = await handleEmailApi(request, env);
    if (emailResponse) return applyCorsHeaders(emailResponse, origin);

    const response = await app.fetch(request, env, ctx);

    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/reservations' && response.ok) {
      const payload = await response.clone().json().catch(() => null) as { token?: string } | null;
      if (payload?.token) {
        ctx.waitUntil(sendConfirmation(env, payload.token).catch((error) => {
          console.error(JSON.stringify({ type: 'confirmation_email_failed', error: String(error) }));
        }));
      }
    }

    return applyCorsHeaders(response, origin);
  },

  async scheduled(_controller: ScheduledController, env: WorkerBindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledEmails(env).catch((error) => {
      console.error(JSON.stringify({ type: 'scheduled_email_job_failed', error: String(error) }));
    }));
  },
};
