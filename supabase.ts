import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qowdpwvycqmiusrmoseo.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvd2Rwd3Z5Y3FtaXVzcm1vc2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzM4OTYsImV4cCI6MjA4Njk0OTg5Nn0.DmX2f9Nd16X1dKQGI96tEPL40hFgQJT5C7PSHYvkRIg';

// Configuración de cookies optimizada para evitar problemas de LocalStorage vacío
// La clave es: usar 'lax' en SameSite, autenticación persistente y evitar detectSessionInUrl
const authConfig = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false, // DESACTIVADO - causaba conflictos con navegadores modernos que bloquean tercero
  storageKey: 'tuarbitro-auth-v3',
  flowType: 'pkce',
  // Configuración de cookies para asegurar persistencia de la sesión
  cookies: {
    name: 'tuarbitro-auth-token-box',
    lifetime: 60 * 60 * 7, // 7 horas (máximo soportado por nodos gotrue: 24h, pero 7h es seguro)
    domain: '', // Dejar vacío para que funcione en todos los subdominios automáticamente
    path: '/',
    sameSite: 'lax' as const, // 'lax' es más compatible que 'strict'
    secure: import.meta.env.PROD, // Solo HTTPS en producción
  },
  // @ts-ignore - lockType soportado por gotrue
  lockType: 'none',
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authConfig,
  global: {
    headers: { 'x-application-name': 'tuarbitro-smart-invest' },
  },
});

// Función de depuración para verificar persistencia de sesión
export const getAuthStatus = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    return {
      hasUser: !!user,
      hasSession: !!session,
      userData: user,
      sessionData: session,
      localStorageKeys: Object.keys(localStorage).filter(k => k.includes('tuarbitro')),
      cookies: document.cookie.split(';').filter(c => c.trim().includes('tuarbitro-auth')),
      error: error || sessionError,
    };
  } catch (err) {
    return { error: err };
  }
};

// Función helper para limpiar sesión consigo console.log informativo
export const logAuthDebugInfo = async (context: string = '') => {
  const result = await getAuthStatus();
  console.log(`[Auth Debug${context ? ` - ${context}` : ''}]`);
  console.log('- User:', result.hasUser);
  console.log('- Session:', result.hasSession);
  console.log('- LocalStorage t-auth keys:', result.localStorageKeys);
  console.log('- Cookies:', result.cookies);
  console.table(result.userData);
};
