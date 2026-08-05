import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cnfgzrfapywrcccempug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZmd6cmZhcHl3cmNjY2VtcHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA2NDUsImV4cCI6MjEwMDkwNjY0NX0.vSAnFT2Zx7Bf-KND_8uAIcsEvt0gjeNqkV6wipZm6yk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
