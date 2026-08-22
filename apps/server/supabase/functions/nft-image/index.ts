// nft-image -- GET /nft/image/{tokenId}
//
// Always 302 -- never 404/500.
// Ronin Market crawlers expect an image URL that resolves.
// Even before a render is generated, redirect to placeholder.
//
// Pipeline:
//   1. Validate tokenId (positive integer string)
//   2. HEAD check Supabase Storage: renders/{tokenId}.png
//   3. If exists (2xx): 302 to render URL
//   4. Otherwise: 302 to placeholder
//
// No DB query. No auth. Public endpoint.
// Render pipeline: Blender worker uploads to renders/{tokenId}.png (OQ-1/OQ-2 future work).
// Placeholder: renders/placeholder.png must be uploaded to the renders bucket before deploy.
//
// CAVEAT (OQ-7): placeholder.png is sourced from kijo/assets/images/.
// Upload it to Supabase Storage (renders bucket) before enabling nft-image.

const PROJECT_REF  = 'xutjubkaskwchzyzwryk';
const STORAGE_BASE = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/renders`;

// Placeholder: renders/placeholder.png in the same public bucket.
// Upload kijo/assets/images/<chosen file>.png as "placeholder.png" before first deploy.
const PLACEHOLDER_URL = `${STORAGE_BASE}/placeholder.png`;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function redirect302(url: string, ttl = 60): Response {
  return new Response(null, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      'Location':      url,
      // Short TTL: after a render is generated, Ronin Market should pick it up quickly.
      // Placeholder redirects are also short so marketplaces don't cache them indefinitely.
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
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

  // Accept GET only; everything else falls through to placeholder redirect.
  // (Spec: never 404/500 -- even method errors 302 to placeholder.)
  if (req.method !== 'GET') return redirect302(PLACEHOLDER_URL);

  // ---- 1. Parse tokenId -----------------------------------------------------
  // Accepts any positive integer string. Invalid tokenId -> placeholder (never 404).
  const raw = new URL(req.url).pathname.split('/').pop() ?? '';
  if (!/^\d+$/.test(raw)) return redirect302(PLACEHOLDER_URL);
  const tokenId = parseInt(raw, 10);
  if (tokenId <= 0) return redirect302(PLACEHOLDER_URL);

  // ---- 2. HEAD check Supabase Storage ---------------------------------------
  // Renders bucket is public -- no auth needed for HEAD.
  // Supabase CDN returns 200 if file exists, 400/404 if not.
  const renderUrl = `${STORAGE_BASE}/${tokenId}.png`;
  try {
    const headRes = await fetch(renderUrl, {
      method: 'HEAD',
      // 3-second timeout: fast HEAD, never block Ronin Market crawlers.
      signal: AbortSignal.timeout(3_000),
    });
    if (headRes.ok) {
      // Render exists -- longer TTL (10 min): rendered images don't change often.
      return redirect302(renderUrl, 600);
    }
    // Not yet rendered (404 or other error): fall through to placeholder.
  } catch {
    // Network error or timeout -- fall through to placeholder.
    // Log silently; never surface to caller.
    console.error(`[nft-image] HEAD check failed for token ${tokenId} -- using placeholder`);
  }

  // ---- 3. Placeholder fallback ----------------------------------------------
  // Short TTL (60s): once the render is generated, Ronin Market should pick it up.
  return redirect302(PLACEHOLDER_URL, 60);
});
