import app, { type Bindings } from './index';

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
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const origin = getCorsOrigin(request);

    if (request.method === 'OPTIONS') {
      return applyCorsHeaders(new Response(null, { status: 204 }), origin);
    }

    const response = await app.fetch(request, env, ctx);
    return applyCorsHeaders(response, origin);
  },
};
