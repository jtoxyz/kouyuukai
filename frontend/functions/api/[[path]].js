const BACKEND_ORIGIN = 'https://homecoming-backend.osukouyuukai.workers.dev';

export async function onRequest(context) {
  const backendUrl = new URL(context.request.url);
  const backendOrigin = new URL(BACKEND_ORIGIN);
  backendUrl.protocol = backendOrigin.protocol;
  backendUrl.hostname = backendOrigin.hostname;
  backendUrl.port = backendOrigin.port;

  const headers = new Headers(context.request.headers);
  headers.delete('host');

  return fetch(new Request(backendUrl.toString(), {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: 'manual',
  }));
}
