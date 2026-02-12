// API helper for Google Drive, Sheets, and Docs (synchronous for QuickJS runtime)

export function driveFetch(
  endpoint: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
    baseUrl?: string;
    rawBody?: boolean;
  } = {}
): { success: boolean; data?: unknown; error?: { code: number; message: string } } {
  const cred = oauth.getCredential();
  if (!cred) {
    return {
      success: false,
      error: { code: 401, message: 'Google Drive not connected. Complete OAuth setup first.' },
    };
  }

  const backendUrl = platform.env('BACKEND_URL') || '';
  if (!backendUrl) {
    return { success: false, error: { code: 500, message: 'BACKEND_URL not configured' } };
  }

  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const url = backendUrl.replace(/\/$/, '') + '/proxy/by-id/' + cred.credentialId + path;

  try {
    const opts: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    } = {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      timeout: options.timeout || 30,
    };
    if (options.body) opts.body = options.body;

    const response = net.fetch(url, opts) as unknown as {
      status: number;
      headers: Record<string, string>;
      body: string;
    };

    const s = globalThis.getGoogleDriveSkillState();
    if (response.headers['x-ratelimit-remaining']) {
      s.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
    }
    if (response.headers['x-ratelimit-reset']) {
      s.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'], 10) * 1000;
    }

    if (response.status >= 200 && response.status < 300) {
      const data = options.rawBody
        ? response.body
        : response.body
          ? JSON.parse(response.body)
          : null;
      s.lastApiError = null;
      return { success: true, data };
    }
    const error = response.body
      ? JSON.parse(response.body)
      : { code: response.status, message: 'API request failed' };
    s.lastApiError = (error as { message?: string }).message || `HTTP ${response.status}`;
    return { success: false, error: { code: response.status, message: s.lastApiError } };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const s = globalThis.getGoogleDriveSkillState();
    s.lastApiError = errorMsg;
    return { success: false, error: { code: 500, message: errorMsg } };
  }
}

declare global {
  var googleDriveApi: { driveFetch: typeof driveFetch };
}
globalThis.googleDriveApi = { driveFetch };
