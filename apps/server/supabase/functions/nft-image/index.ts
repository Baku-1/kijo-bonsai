// nft-image -- GET /nft/image/{tokenId}
//
// Returns image bytes directly (200 OK, Content-Type: image/png).
// Ronin Wallet and Ronin Market crawlers do NOT follow 302 redirects on NFT
// image URLs -- they expect the image URL to return bytes, not a Location header.
//
// Pipeline:
//   1. Validate tokenId (positive integer string)
//   2. HEAD check Supabase Storage: renders/{tokenId}.png
//   3. If exists: GET + proxy image bytes (10 min cache)
//   4. Otherwise: GET + proxy placeholder.png bytes (60s cache)
//
// No DB query. No auth. Public endpoint.
// Render pipeline: Blender worker uploads to renders/{tokenId}.png (future work).
// Placeholder: placeholder.png lives in Supabase Storage renders bucket.

const PROJECT_REF  = 'xutjubkaskwchzyzwryk';
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/renders`;

const PLACEHOLDER_URL = `${STORAGE_BASE}/placeholder.png`;

// Ambient Deno type declaration for IDE/TypeScript compilers outside the Deno runtime
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch image from upstream and return bytes directly to caller.
// Buffers into ArrayBuffer so Content-Length is explicitly set (required by
// many mobile wallet image decoders that fail on chunked streaming).
async function proxyImage(url: string, ttl: number): Promise<Response | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('Content-Type') || 'image/png';
    return new Response(buf, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type':   contentType,
        'Content-Length': String(buf.byteLength),
        'Cache-Control':  `public, max-age=${ttl}, s-maxage=${ttl}`,
      },
    });
  } catch {
    return null;
  }
}

// Last-resort: 1x1 transparent PNG so the response is always a valid image.
// 68 bytes, hand-encoded. Avoids any scenario where Ronin sees 0 bytes.
const FALLBACK_PNG = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, // IEND chunk
  0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
  0x60, 0x82,
]);

function fallbackResponse(): Response {
  return new Response(FALLBACK_PNG, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type':   'image/png',
      'Content-Length': String(FALLBACK_PNG.byteLength),
      'Cache-Control':  'public, max-age=30, s-maxage=30',
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  // Non-GET: serve placeholder image (never 404/500).
  if (req.method !== 'GET') {
    return (await proxyImage(PLACEHOLDER_URL, 60)) ?? fallbackResponse();
  }

  // ---- 1. Parse tokenId (supports both /3 and /3.png) -----------------------
  const raw = new URL(req.url).pathname.split('/').pop() ?? '';
  const match = raw.match(/^(\d+)(?:\.png)?$/);
  if (!match) {
    return (await proxyImage(PLACEHOLDER_URL, 60)) ?? fallbackResponse();
  }
  const tokenId = parseInt(match[1], 10);
  if (tokenId <= 0) {
    return (await proxyImage(PLACEHOLDER_URL, 60)) ?? fallbackResponse();
  }

  // ---- 2. HEAD check Supabase Storage ---------------------------------------
  const renderUrl = `${STORAGE_BASE}/${tokenId}.png`;
  try {
    const headRes = await fetch(renderUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3_000),
    });
    if (headRes.ok) {
      // Render exists -- proxy it. 10 min cache: renders rarely change.
      const proxied = await proxyImage(renderUrl, 600);
      if (proxied) return proxied;
      // GET failed after HEAD succeeded (race / transient) -- fall through.
    }
  } catch {
    console.error(`[nft-image] HEAD check failed for token ${tokenId}`);
  }

  // ---- 3. Placeholder fallback (60s cache) ----------------------------------
  return (await proxyImage(PLACEHOLDER_URL, 60)) ?? fallbackResponse();
});
