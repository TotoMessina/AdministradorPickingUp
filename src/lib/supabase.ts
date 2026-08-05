import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://cnfgzrfapywrcccempug.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZmd6cmZhcHl3cmNjY2VtcHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA2NDUsImV4cCI6MjEwMDkwNjY0NX0.vSAnFT2Zx7Bf-KND_8uAIcsEvt0gjeNqkV6wipZm6yk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

