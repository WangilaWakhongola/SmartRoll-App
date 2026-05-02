// ============================================================
// SmartRoll — Supabase Re-export Shim
// The real Supabase client lives in src/services/supabase.ts.
// This file exists only for backward compatibility with any
// remaining imports that use 'lib/supabase'.
// Prefer importing directly from src/services/supabase.
// ============================================================

export { supabase } from '../src/services/supabase';
