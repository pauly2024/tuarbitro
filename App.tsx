import React, { useState, useEffect, useRef } from 'react';
import { AppRole, Screen, UserData, Contract } from './types';
import UserDashboard from './screens/UserDashboard';
import AdminDashboard from './screens/AdminDashboard';
import WithdrawalsScreen from './screens/WithdrawalsScreen';
import PlansScreen from './screens/PlansScreen';
import ReferralsScreen from './screens/ReferralsScreen';
import SettingsScreen from './screens/SettingsScreen';
import HowItWorksScreen from './screens/HowItWorksScreen';
import HistoryScreen from './screens/HistoryScreen';
import LandingPage from './screens/LandingPage';
import AuthModal from './components/AuthModal';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { setAdminSettings, getAdminSettings } from './store';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>(AppRole.USER);
  const [activeScreen, setActiveScreen] = useState<Screen>('DASHBOARD');

  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRoleConfirmed, setIsRoleConfirmed] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'LOGIN' | 'REGISTER' }>({
    isOpen: false,
    mode: 'LOGIN',
  });
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [publicLogo, setPublicLogo] = useState<string | null>(getAdminSettings().logoUrl || null);

  const isFetchingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (import.meta.env.DEV) console.log("[App] URL params:", window.location.search, "ref found:", ref);
    if (ref) {
      setReferrerId(ref);
      sessionStorage.setItem('tuarbitro_ref', ref);
      if (import.meta.env.DEV) console.log("[App] Referrer set to:", ref);
    } else {
      const savedRef = sessionStorage.getItem('tuarbitro_ref');
      if (import.meta.env.DEV) console.log("[App] No ref in URL, saved ref:", savedRef);
      if (savedRef) setReferrerId(savedRef);
    }
  }, []);

  useEffect(() => {
    const syncSettings = async () => {
      try {
        if (import.meta.env.DEV) console.log('[Settings] Syncing... Wait for user session');

        // Esperar a que la sesión esté disponible
        const timeout = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout syncing settings')), 10000)
        );

        const userResult = await Promise.race([
          supabase.auth.getUser(),
          timeout
        ]);

        if (!userResult.data?.user) {
          if (import.meta.env.DEV) console.log('[Settings] No user session yet, skipping settings');
          return;
        }

        const settingsPromise = supabase
          .from('settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        const { data } = await settingsPromise;

        if (data) {
          if (import.meta.env.DEV) console.log('[Settings] Sync complete');
          const currentLocal = getAdminSettings();
          const validLogo = data.logo_url && data.logo_url.length > 5 ? data.logo_url : currentLocal.logoUrl;

          setAdminSettings({
            exchangeRate: data.exchange_rate,
            bankName: data.bank_name,
            bankAccount: data.bank_account,
            bankBeneficiary: data.bank_beneficiary,
            bankRNC: data.bank_rnc,
            bankCedula: data.bank_cedula || '',
            bankType: 'Corriente',
            cryptoWallet: data.crypto_wallet,
            cryptoNetwork: data.crypto_network,
            activeInvestors: data.active_investors || currentLocal.activeInvestors,
            logoUrl: validLogo,
          });
        }
      } catch (error) {
        console.error('[Settings] Sync failed:', error);
      }
    };

    syncSettings();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || !isRoleConfirmed) return;

    try {
      supabase.removeAllChannels();
    } catch (e) {
      console.warn('Error removing channels:', e);
    }

    try {
      if (role === AppRole.ADMIN) {
        const adminChannel = supabase
          .channel('admin-global-updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, () =>
            handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
            handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () =>
            handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .subscribe();
        return () => {
          try {
            supabase.removeChannel(adminChannel);
          } catch (e) {
            console.warn('Error removing admin channel:', e);
          }
        };
      } else {
        const userChannel = supabase
          .channel(`user-sync-${currentUser.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` },
            () => handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${currentUser.id}` },
            () => handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${currentUser.id}` },
            () => handleUserEntry(currentUser.id, currentUser.email, true),
          )
          .subscribe();
        return () => {
          try {
            supabase.removeChannel(userChannel);
          } catch (e) {
            console.warn('Error removing user channel:', e);
          }
        };
      }
    } catch (e) {
      console.warn('Realtime not available:', e);
    }
  }, [isAuthenticated, isRoleConfirmed, role, currentUser?.id]);

  useEffect(() => {
    let mounted = true;
    const lastProcessedUserId = { current: null as string | null };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (import.meta.env.DEV) console.log(`[Auth] Event: ${event}`, session?.user?.id);

      if (session) {
        if (lastProcessedUserId.current === session.user.id && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
          if (import.meta.env.DEV) console.log('[Auth] User already processed, skipping redundant entry');
          setIsSessionChecking(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          lastProcessedUserId.current = session.user.id;
          setIsSessionChecking(false);
          await handleUserEntry(session.user.id, session.user.email || 'usuario@tuarbitro.com');
        }
      } else {
        if (import.meta.env.DEV) console.log('[Auth] No session active');
        lastProcessedUserId.current = null;
        setIsAuthenticated(false);
        setIsRoleConfirmed(false);
        setCurrentUser(null);
        setRole(AppRole.USER);
        setActiveScreen('DASHBOARD');
        setIsSessionChecking(false);
      }
    });

    const safetyTimeout = setTimeout(() => {
      if (mounted && isSessionChecking) {
        console.warn('[Auth] Safety timeout reached for session check (20s)');
        setIsSessionChecking(false);
      }
    }, 20000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const handleUserEntry = async (userId: string, email: string, silent = false) => {
    setIsAuthenticated(true);
    if (!silent) setLoadingData(true);

    if (isFetchingRef.current) {
      if (import.meta.env.DEV) console.log('[Auth] Fetch already in progress, skipping...');
      setIsSessionChecking(false);
      return;
    }
    isFetchingRef.current = true;

    try {
      const isAdminEmail = email.toLowerCase().trim() === 'paulvalerio2018@gmail.com';

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Timeout loading profile - La base de datos no responde (10s)')),
          10000
        )
      );

      const dataPromise = (async () => {
        try {
          if (import.meta.env.DEV) console.time('handleUserEntry-' + userId);
          if (import.meta.env.DEV) console.log('[Auth] Fetching profile for:', userId);

          if (import.meta.env.DEV) console.time('profileFetch');
          // ✅ CORREGIDO: ahora pide también referrals_available y locked
          const profileFetch = supabase
            .from('profiles')
            .select('id, email, name, role, balance, available, locked, referrals_earned, referrals_available, referral_history, referred_by')
            .eq('id', userId)
            .maybeSingle();

          const { data: profile, error: profileError } = await profileFetch;
          if (import.meta.env.DEV) console.timeEnd('profileFetch');

          if (import.meta.env.DEV) console.log('[Auth] Profile fetch complete');

          if (profileError) {
            console.error('[Auth] Error fetching profile:', JSON.stringify(profileError, null, 2));

            const isRecursion = profileError.code === '42P17' || (profileError.message && profileError.message.includes('recursion'));
            const isPermissionDenied = profileError.code === '42501' || (profileError.message && profileError.message.includes('permission denied'));
            const isMissingPolicies = profileError.message && (profileError.message.includes('policy') || profileError.message.includes('RLS'));

            if (isRecursion || isPermissionDenied || isMissingPolicies || isAdminEmail) {
              console.warn('[Auth] Critical DB Error or Admin Fallback. Using emergency profile.');
              return {
                profile: {
                  id: userId,
                  email,
                  name: email.split('@')[0],
                  role: isAdminEmail ? 'ADMIN' : 'USER',
                  balance: 0,
                  available: 0,
                  locked: 0,
                  referrals_earned: 0,
                  referrals_available: 0,
                  referral_history: [],
                  referred_by: null
                },
                contractsDb: [],
                deposits: []
              };
            }
            throw profileError;
          }

          let currentProfile = profile;

          if (!currentProfile) {
            if (import.meta.env.DEV) console.log('[Auth] Profile not found, creating new one...');
            const userName = email.split('@')[0];
            const { data: newProfile, error: upsertError } = await supabase
              .from('profiles')
              .upsert(
                {
                  id: userId,
                  email,
                  name: userName,
                  role: isAdminEmail ? 'ADMIN' : 'USER',
                  referrals_earned: 0,
                  referrals_available: 0,
                  referral_history: [],
                },
                { onConflict: 'id' },
              )
              .select()
              .maybeSingle();

            if (upsertError) {
  console.error('[Auth] Error creating profile:', JSON.stringify(upsertError, null, 2));
  throw upsertError;
}
if (import.meta.env.DEV) console.log('[Auth] New profile created successfully');
currentProfile = newProfile || { id: userId, email, name: userName, role: 'USER' };
}

if (currentProfile && referrerId && referrerId !== 'admin' && currentProfile.referred_by == null && userId !== referrerId) {
  if (import.meta.env.DEV) console.log('[Auth] Applying referral:', referrerId);
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let sponsorId: string | null = referrerId;

    if (!uuidRegex.test(referrerId)) {
      const { data: sponsorProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('name', referrerId)
        .maybeSingle();
      sponsorId = sponsorProfile ? sponsorProfile.id : null;
    }

    if (sponsorId && sponsorId !== userId) {
      const { error: refErr } = await supabase
        .from('profiles')
        .update({ referred_by: sponsorId })
        .eq('id', userId);

      if (refErr) {
        console.error('[Auth] Error updating referred_by:', refErr);
      } else {
        currentProfile.referred_by = sponsorId;
        if (import.meta.env.DEV) console.log('[Auth] Referral applied successfully');
      }
    }
  } catch (e) {
    console.error('[Auth] Exception updating referred_by:', e);
  }
}

          if (import.meta.env.DEV) console.log('[Auth] Fetching contracts and deposits...');
          if (import.meta.env.DEV) console.time('contractsFetch');
          const contractsPromise = supabase.from('contracts').select('*').eq('user_id', userId).limit(100);
          if (import.meta.env.DEV) console.time('depositsFetch');
          const depositsPromise = supabase.from('deposits').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);

          const [contractsRes, depositsRes] = await Promise.all([contractsPromise, depositsPromise]);
          if (import.meta.env.DEV) console.timeEnd('contractsFetch');
          if (import.meta.env.DEV) console.timeEnd('depositsFetch');

          if (import.meta.env.DEV) console.log('[Auth] Contracts/Deposits fetch complete');

          if (contractsRes.error) {
            console.error('[Auth] Contracts error:', contractsRes.error);
            if (contractsRes.error.code === '42P17' || contractsRes.error.code === '42501') {
              console.warn('[Auth] DB Error on contracts. Using empty array.');
            } else {
              throw contractsRes.error;
            }
          }
          if (depositsRes.error) {
            console.error('[Auth] Deposits error:', depositsRes.error);
            if (depositsRes.error.code === '42P17' || depositsRes.error.code === '42501') {
              console.warn('[Auth] DB Error on deposits. Using empty array.');
            } else {
              throw depositsRes.error;
            }
          }

          const contractsData = contractsRes.data || [];
          const depositsData = depositsRes.data || [];

          if (import.meta.env.DEV) console.timeEnd('handleUserEntry-' + userId);

          return {
            profile: currentProfile,
            contractsDb: contractsData,
            deposits: depositsData
          };
        } catch (err) {
          if (isAdminEmail) {
            console.warn('[Auth] Exception in profile fetch, using Admin emergency fallback');
            return {
              profile: {
                id: userId,
                email,
                name: email.split('@')[0],
                role: 'ADMIN',
                balance: 0,
                available: 0,
                locked: 0,
                referrals_earned: 0,
                referrals_available: 0,
                referral_history: []
              },
              contractsDb: [],
              deposits: []
            };
          }
          throw err;
        }
      })();

      const result: any = await Promise.race([dataPromise, timeoutPromise]);

      if (result && result.profile) {
        setProfileLoadError(null);
        const { profile, contractsDb, deposits } = result;

        if (import.meta.env.DEV) console.log('[Auth] Profile loaded:', {
          id: profile.id,
          name: profile.name,
          available: profile.available,
          referrals_earned: profile.referrals_earned,
          referrals_available: profile.referrals_available,
          referred_by: profile.referred_by,
          referral_history: profile.referral_history,
        });

        if (profile.role === 'ADMIN') setRole(AppRole.ADMIN);
        else setRole(AppRole.USER);

        const mappedContracts: Contract[] = (contractsDb || []).map((c: any) => ({
          id: c.id,
          planId: c.plan_id,
          name: c.plan_name,
          amount: c.amount,
          amountFiat: c.amount_fiat,
          dailyRate: c.daily_rate,
          startDate: c.start_date,
          endDate: c.end_date,
          totalDays: c.total_days,
          status: c.status || 'ACTIVE',
        }));

        const activeContracts = mappedContracts.filter((c) => c.status === 'ACTIVE');
        const realLocked = activeContracts.reduce((acc, c) => acc + c.amount, 0);

        setCurrentUser({
          id: profile.id,
          name: profile.name || email.split('@')[0],
          email: profile.email || email,
          balance: Number(profile.balance || 0),
          available: Number(profile.available || 0),
          locked: realLocked,
          referralsEarned: Number(profile.referrals_earned ?? 0),
          referralsAvailable: Number(profile.referrals_available ?? 0),
          deposits:
            deposits?.map((d: any) => ({
              id: d.id,
              amount: d.amount,
              amountFiat: d.amount_fiat,
              method: d.method,
              status: d.status,
              date: new Date(d.created_at).toLocaleDateString(),
              hash: d.hash,
              proofImage: d.proof_url,
            })) || [],
          contracts: mappedContracts,
          referralHistory: Array.isArray(profile.referral_history)
            ? profile.referral_history
            : [],
          withdrawals: [],
          referredBy: profile.referred_by || null,
        });
        setIsRoleConfirmed(true);
      } else {
        const isAdminEmail = email.toLowerCase().trim() === 'paulvalerio2018@gmail.com';
        if (isAdminEmail) {
          console.warn('[Auth] Profile not found for Admin. Using emergency bypass.');
          setCurrentUser({
            id: userId,
            name: 'Admin (Bypass)',
            email: email,
            balance: 0,
            available: 0,
            locked: 0,
            referralsEarned: 0,
            referralsAvailable: 0,
            deposits: [],
            contracts: [],
            referralHistory: [],
            withdrawals: [],
            referredBy: null,
          });
          setRole(AppRole.ADMIN);
          setIsRoleConfirmed(true);
          setProfileLoadError(null);
        } else if (!currentUser) {
          setProfileLoadError('No se pudo cargar tu perfil. Revisa tu conexión o contacta a soporte.');
        }
      }
    } catch (e: any) {
      console.error('Critical Auth Error', e);
      setAuthModal({ isOpen: false, mode: 'LOGIN' });
      const isAdminEmail = email.toLowerCase().trim() === 'paulvalerio2018@gmail.com';

      if (isAdminEmail && (e.message?.includes('Timeout') || e.message?.includes('Database') || e.message?.includes('recursion') || e.message?.includes('not found'))) {
        console.warn('[Auth] Critical Error for Admin. Using emergency bypass.');
        setCurrentUser({
          id: userId,
          name: 'Admin (Bypass)',
          email: email,
          balance: 0,
          available: 0,
          locked: 0,
          referralsEarned: 0,
          referralsAvailable: 0,
          deposits: [],
          contracts: [],
          referralHistory: [],
          withdrawals: [],
          referredBy: null,
        });
        setRole(AppRole.ADMIN);
        setIsRoleConfirmed(true);
        setProfileLoadError(null);
      } else if (!currentUser) {
        setProfileLoadError(`Error crítico: ${e.message || 'Error desconocido'}`);
      }
    } finally {
      setLoadingData(false);
      isFetchingRef.current = false;
      setIsSessionChecking(false);
    }
  };
  const handleManualAuth = (isAdmin: boolean) => {
    setIsSessionChecking(false);
    if (isAdmin) {
      setIsAuthenticated(true);
      setRole(AppRole.ADMIN);
      setIsRoleConfirmed(true);
      setCurrentUser({
        id: 'admin-id',
        name: 'Administrador',
        email: 'admin@tuarbitro.com',
        balance: 0,
        available: 0,
        locked: 0,
        referralsEarned: 0,
        referralsAvailable: 0,
        deposits: [],
        contracts: [],
        referralHistory: [],
        withdrawals: [],
        referredBy: null,
      });
      setActiveScreen('DASHBOARD');
    }
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setIsRoleConfirmed(false);
    setCurrentUser(null);
    setRole(AppRole.USER);
    setActiveScreen('DASHBOARD');
    isFetchingRef.current = false;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
  };

  const refreshUser = () => {
    if (currentUser) {
      isFetchingRef.current = false;
      handleUserEntry(currentUser.id, currentUser.email);
    }
  };

  if (isSessionChecking) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-bg-dark items-center justify-center">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Iniciando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-bg-dark relative overflow-x-hidden">
        <header className="absolute top-0 w-full z-50 p-6 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
          <div className="flex items-center gap-2">
            {publicLogo ? (
              <img
                src={publicLogo}
                alt="Logo"
                className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1 border border-white/10"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-primary to
              -emerald-500 rounded-lg shadow-lg shadow-primary/20"></div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-white italic tracking-tighter text-lg leading-none">
                TUARBITRO
              </span>
              <span className="text-[7px] text-primary font-bold tracking-[0.3em] uppercase">
                Smart Invest
              </span>
            </div>
          </div>
          <button
            onClick={() => setAuthModal({ isOpen: true, mode: 'LOGIN' })}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-white transition-colors border border-white/10"
          >
            Acceder
          </button>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto">
          <LandingPage
            referrerId={referrerId}
            onStart={() => setAuthModal({ isOpen: true, mode: 'REGISTER' })}
            onLogin={() => setAuthModal({ isOpen: true, mode: 'LOGIN' })}
            onRegister={() => setAuthModal({ isOpen: true, mode: 'REGISTER' })}
          />
        </main>

        <AuthModal
          isOpen={authModal.isOpen}
          mode={authModal.mode}
          referrerId={referrerId}
          onClose={() => setAuthModal({ ...authModal, isOpen: false })}
          onAuth={handleManualAuth}
        />
      </div>
    );
  }

  if (!isRoleConfirmed || !currentUser) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-bg-dark items-center justify-center p-6 text-center">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Cargando plataforma...
        </p>
        {profileLoadError && (
          <button
            onClick={handleLogout}
            className="mt-8 text-[10px] text-slate-600 font-bold uppercase hover:text-slate-400 transition-colors"
          >
            Reiniciar Sesión
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-bg-dark text-slate-200 font-sans overflow-hidden">
      <div className="hidden md:block shrink-0">
        <Sidebar
          role={role}
          activeScreen={activeScreen}
          setActiveScreen={setActiveScreen}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        <Header role={role} screen={activeScreen} userData={currentUser} />

        <main className="flex-1 overflow-y-auto no-scrollbar relative w-full">
          {loadingData && (
            <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/20 overflow-hidden z-50">
              <div className="h-full bg-primary animate-pulse w-1/3 mx-auto rounded-full"></div>
            </div>
          )}

          <div className="p-0 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
            {role === AppRole.ADMIN ? (
              activeScreen === 'WITHDRAWALS' ? (
                <WithdrawalsScreen />
              ) : activeScreen === 'SETTINGS' ? (
                <SettingsScreen />
              ) : activeScreen === 'HISTORY' ? (
                <HistoryScreen userData={currentUser} isAdmin={true} />
              ) : (
                <AdminDashboard onUpdateUser={refreshUser} />
              )
            ) : activeScreen === 'PLANS' ? (
              <PlansScreen userData={currentUser} onUpdateUser={refreshUser} />
            ) : activeScreen === 'HOW_IT_WORKS' ? (
              <HowItWorksScreen />
            ) : activeScreen === 'REFERRALS' ? (
              <ReferralsScreen userData={currentUser} onUpdateUser={refreshUser} />
            ) : activeScreen === 'HISTORY' ? (
              <HistoryScreen userData={currentUser} isAdmin={false} />
            ) : (
              <UserDashboard userData={currentUser} onUpdateUser={refreshUser} />
            )}
          </div>
        </main>

        <BottomNav role={role} activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      </div>
    </div>
  );
};

export default App;