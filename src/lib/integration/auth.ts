// lib/integration/auth.ts
import { createClient } from '@supabase/supabase-js';

export interface AuthenticatedIntegration {
  credential_id: string;
  user_id: string;
  name: string;
  scopes: string[];
}

export async function authenticateApiKey(
  apiKey: string | null,
  requiredScope: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ error: string | null; auth: AuthenticatedIntegration | null }> {
  if (!apiKey || !apiKey.startsWith('qb_live_')) {
    return { error: 'Missing or malformed X-API-Key header.', auth: null };
  }

  // Hash the incoming key to compare with stored SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const { data: cred, error } = await supabase
    .from('api_credentials')
    .select('id, user_id, name, scopes, revoked_at')
    .eq('api_key_hash', keyHash)
    .single();

  if (error || !cred) {
    return { error: 'Invalid API Key.', auth: null };
  }

  if (cred.revoked_at) {
    return { error: 'API Key has been revoked.', auth: null };
  }

  if (!cred.scopes.includes(requiredScope) && !cred.scopes.includes('admin')) {
    return { error: `Forbidden: Missing required scope '${requiredScope}'.`, auth: null };
  }

  // Asynchronously update last_used_at timestamp
  supabase
    .from('api_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', cred.id)
    .then();

  return {
    error: null,
    auth: {
      credential_id: cred.id,
      user_id: cred.user_id,
      name: cred.name,
      scopes: cred.scopes,
    },
  };
}