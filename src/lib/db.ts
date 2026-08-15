// lib/db.ts
import { supabaseAdmin } from './supabaseAdmin';

// Export supabaseAdmin as `db` so all imports resolve correctly
export const db = supabaseAdmin;