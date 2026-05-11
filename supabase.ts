import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qowdpwvycqmiusrmoseo.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvd2Rwd3Z5Y3FtaXVzcm1vc2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzM4OTYsImV4cCI6MjA4Njk0OTg5Nn0.DmX2f9Nd16X1dKQGI96tEPL40hFgQJT5C7PSHYvkRIg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'tuarbitro-auth-v3',
    flowType: 'pkce',
    // @ts-ignore - lockType is supported by gotrue but might not be in the types yet
    lockType: 'none',
  } as any,
  global: {
    headers: { 'x-application-name': 'tuarbitro-smart-invest' },
  },
});
