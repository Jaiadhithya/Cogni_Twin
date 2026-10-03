/**
 * Same-origin proxy to the CogniTwin backend.
 *
 * The browser calls /api/<path>; this handler forwards it to BACKEND_API_URL/<path>
 * and, when BACKEND_API_KEY is set, adds the X-API-Key header. Both variables are
 * server-only: the key never reaches the browser.
 */
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND_URL = (process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

/** Request headers worth forwarding. Everything else (cookies, host, origin…) stays behind. */
const FORWARD_REQUEST_HEADERS = ['accept', 'content-type', 'content-length', 'x-request-id'];
/** Response headers worth returning. Encoding headers are dropped: fetch() already decoded the body. */
const FORWARD_RESPONSE_HEADERS = ['content-type', 'x-request-id', 'retry-after'];

type RouteContext = { params: Promise<{ path: string[] }> };

function errorResponse(status: number, type: string, message: string): Response {
  return Response.json({ status: 'error', error: { type, message, details: [] } }, { status });
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const target = `${BACKEND_URL}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const apiKey = process.env.BACKEND_API_KEY;
  if (apiKey) headers.set('X-API-Key', apiKey);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by Node's fetch when streaming a request body (multipart uploads).
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual',
      cache: 'no-store',
    } as RequestInit);
  } catch {
    return errorResponse(502, 'BACKEND_UNREACHABLE', 'The CogniTwin backend is not reachable.');
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
export const PUT = proxy;
export const PATCH = proxy;
