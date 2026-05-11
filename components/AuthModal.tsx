import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { getAdminSettings } from '../store';

interface AuthModalProps {
  mode: 'LOGIN' | 'REGISTER';
  isOpen: boolean;
  referrerId: string | null;
  onClose: () => void;
  onAuth: (isAdmin: boolean, userData?: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  isOpen,
  referrerId,
  onClose,
  onAuth,
}) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualReferrerId, setManualReferrerId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    getAdminSettings().logoUrl || null
  );
  const [currentMode, setCurrentMode] = useState<'LOGIN' | 'REGISTER'>(mode);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [resolvedReferrerId, setResolvedReferrerId] = useState<string | null>(null);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setLogoUrl(getAdminSettings().logoUrl || null);
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () =>
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const finalReferrerId = (() => {
    const rawRef = referrerId || manualReferrerId;

    if (!rawRef) return null;

    try {
      if (rawRef.includes('http')) {
        const url = new URL(rawRef);
        const fromUrl = url.searchParams.get('ref');
        if (fromUrl) return fromUrl.trim();
      }
    } catch (e) {
      console.warn('[Auth] Invalid referrer URL, using raw value');
    }

    const clean = rawRef.trim();
    return clean || null;
  })();

  // Resolver nombre + ID real del sponsor
  useEffect(() => {
    const fetchReferrerName = async () => {
      if (!finalReferrerId) {
        setReferrerName(null);
        setResolvedReferrerId(null);
        return;
      }

      if (finalReferrerId === 'admin') {
        setReferrerName('Administración');
        setResolvedReferrerId('admin');
        return;
      }

      try {
        const cleanRef = finalReferrerId.trim();

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let data: any[] | null = null;
        let error: any = null;

        if (uuidRegex.test(cleanRef)) {
          const result = await supabase
            .from('profiles')
            .select('id, name')
            .eq('id', cleanRef)
            .limit(1);

          data = result.data;
          error = result.error;
        } else {
          let result = await supabase
            .from('profiles')
            .select('id, name')
            .ilike('name', cleanRef)
            .limit(1);

          data = result.data;
          error = result.error;

          if ((!data || data.length === 0) && cleanRef) {
            result = await supabase
              .from('profiles')
              .select('id, name')
              .eq('name', cleanRef)
              .limit(1);

            data = result.data;
            error = result.error;
          }
        }

        console.log('[Auth] Referrer query result:', {
          finalReferrerId: cleanRef,
          data: JSON.stringify(data),
          error: error
            ? JSON.stringify(error, Object.getOwnPropertyNames(error))
            : 'null',
        });

        if (error) {
          console.error('[Auth] Error finding referrer:', error);
          setReferrerName(null);
          setResolvedReferrerId(null);
          return;
        }

        if (data && data.length > 0) {
          setReferrerName(data[0].name);
          setResolvedReferrerId(data[0].id);
        } else {
          console.warn('Referente no encontrado:', cleanRef);
          setReferrerName(null);
          setResolvedReferrerId(null);
        }
      } catch (e) {
        console.error('[Auth] Unexpected error finding referrer:', e);
        setReferrerName(null);
        setResolvedReferrerId(null);
      }
    };

    fetchReferrerName();
  }, [finalReferrerId]);

  useEffect(() => {
    console.log('[Auth] AuthModal useEffect, isOpen:', isOpen, 'mode:', mode);

    if (isOpen) {
      setUsername('');
      setEmail('');
      setPassword('');
      setManualReferrerId('');
      setError('');
      setCurrentMode(mode);
      console.log('[Auth] Setting currentMode to:', mode);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const generateEmail = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed.includes('@')) {
      return `${trimmed.toLowerCase().replace(/\s+/g, '')}@tuarbitro.com`;
    }
    return trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('[Auth] handleSubmit called, mode:', currentMode);

    try {
      if (currentMode === 'LOGIN') {
        console.log('[Auth] Executing LOGIN');
        const loginIdentifier = generateEmail(email);
        console.log('Intentando login con:', loginIdentifier);

        try {
          await supabase.auth.signOut();
          localStorage.removeItem('supabase.auth.token');
        } catch (e) {}

        if (email.trim() === 'admin' && password === '2828') {
          console.log('Iniciando sesión de administrador...');

          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: 'admin@tuarbitro.com',
              password: 'admin-password-secure-2828',
            });

          if (signInError) {
            console.log('Admin no existe o error, intentando registro...');
            const { error: signUpError } = await supabase.auth.signUp({
              email: 'admin@tuarbitro.com',
              password: 'admin-password-secure-2828',
              options: {
                data: { name: 'Administrador', role: 'ADMIN' },
              },
            });

            if (signUpError) throw signUpError;

            const retrySignIn = await supabase.auth.signInWithPassword({
              email: 'admin@tuarbitro.com',
              password: 'admin-password-secure-2828',
            });

            if (retrySignIn.error) throw retrySignIn.error;
          }

          onAuth(true, {
            name: 'Administrador',
            email: 'admin@tuarbitro.com',
            role: 'ADMIN',
          });
          onClose();
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginIdentifier,
          password,
        });

        if (error) throw error;

        const user = data.user;
        if (!user) throw new Error('No se pudo obtener el usuario autenticado.');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        onAuth(profile?.role === 'ADMIN', profile);
        onClose();
        return;
      }

      if (currentMode === 'REGISTER') {
        console.log('[Auth] Executing REGISTER');

        if (!username.trim()) {
          throw new Error('Debes escribir un nombre de usuario.');
        }

        if (!email.trim()) {
          throw new Error('Debes escribir un correo o nombre.');
        }

        if (!password.trim() || password.trim().length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }

        const finalEmail = generateEmail(email);
        const cleanUserName = username.trim();
        const cleanReferrer =
          resolvedReferrerId && resolvedReferrerId !== 'admin'
            ? resolvedReferrerId
            : null;

        console.log('[Auth] Calling signUp with:', {
          finalEmail,
          cleanUserName,
          finalReferrerId,
          resolvedReferrerId,
          cleanReferrer,
        });

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: {
            data: {
              name: cleanUserName,
              referred_by: cleanReferrer,
            },
          },
        });

        if (signUpError) throw signUpError;

        const user = signUpData.user;
        if (!user) {
          throw new Error(
            'Registro creado, pero no se recibió el usuario. Revisa confirmación de correo.'
          );
        }

        const profilePayload: any = {
          id: user.id,
          name: cleanUserName,
          email: finalEmail,
          available: 0,
          locked: 0,
          referrals_earned: 0,
          referral_history: [],
        };

        if (cleanReferrer) {
          profilePayload.referred_by = cleanReferrer;
        }

        const { error: profileInsertError } = await supabase
          .from('profiles')
          .upsert(profilePayload);

        if (profileInsertError) {
          console.error('[Auth] Error inserting profile:', profileInsertError);
          throw profileInsertError;
        }

        const { data: insertedProfile, error: fetchProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchProfileError) {
          console.error('[Auth] Error fetching inserted profile:', fetchProfileError);
        }

        onAuth(false, insertedProfile || profilePayload);
        onClose();
      }
    } catch (err: any) {
      console.error('[Auth] Error:', err);
      setError(err?.message || 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          ✕
        </button>

        <div className="flex flex-col items-center mb-6">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-3" />
          ) : null}

          <h2 className="text-2xl font-black text-white uppercase italic">
            {currentMode === 'LOGIN' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>

          {referrerName ? (
            <p className="text-xs text-emerald-400 mt-2 font-bold uppercase">
              Referido por: {referrerName}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentMode === 'REGISTER' && (
            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400"
                placeholder="Tu nombre"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 font-bold uppercase mb-1">
              Correo o usuario
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400"
              placeholder="ejemplo o correo"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-bold uppercase mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400"
              placeholder="******"
            />
          </div>

          {!referrerId && currentMode === 'REGISTER' && (
            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase mb-1">
                Link o código de referido
              </label>
              <input
                type="text"
                value={manualReferrerId}
                onChange={(e) => setManualReferrerId(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400"
                placeholder="Pega el link o username"
              />
            </div>
          )}

          {error ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 text-slate-950 font-black uppercase py-3 hover:bg-emerald-300 transition disabled:opacity-60"
          >
            {loading
              ? 'Procesando...'
              : currentMode === 'LOGIN'
              ? 'Entrar'
              : 'Registrarme'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() =>
              setCurrentMode(currentMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')
            }
            className="text-sm text-slate-400 hover:text-white"
          >
            {currentMode === 'LOGIN'
              ? '¿No tienes cuenta? Regístrate'
              : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;