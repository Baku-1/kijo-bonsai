// apps/render-worker/src/storage.ts
// Upload rendered artifacts to Supabase Storage 'renders' bucket.
// Supports both PNG and GLB via contentType parameter.

import type { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';

const BUCKET = 'renders';

// Upload a local file to Supabase Storage.
// storagePath: e.g. "42.png" or "42.glb" (stored at renders/storagePath)
// contentType: 'image/png' for renders, 'model/gltf-binary' for GLB
export async function uploadRender(
  supabase: SupabaseClient,
  localPath: string,
  storagePath: string,
  contentType: string = 'image/png',
): Promise<void> {
  const fileBuffer = await fs.readFile(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true, // replace previous render if it exists
    });
  if (error) {
    throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
  }
}
