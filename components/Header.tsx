
import React, { useEffect, useState } from 'react';
import { AppRole, Screen } from '../types';
import { UserData, getAdminSettings } from '../store';
import { supabase } from '../supabase';

interface HeaderProps {
  role: AppRole;
  screen: Screen;
  userData?: UserData | null;
  hideUser?: boolean;
}

const Header: React.FC<HeaderProps> = ({ role, screen, userData, hideUser = false }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(getAdminSettings().logoUrl || null);
  const [imgError, setImgError] = useState(false);

  const fetchLogo = async () => {
    try {
      // Prioridad: Local Storage actualizado
      const localSettings = getAdminSettings();
      if (localSettings.logoUrl) {
        setLogoUrl(localSettings.logoUrl);
        setImgError(false);
      }

      // Verificación en segundo plano con Supabase
      const { data } = await supabase.from('settings').select('logo_url').limit(1).maybeSingle();
      if (data && data.logo_url && data.logo_url !== logoUrl) {
        setLogoUrl(data.logo_url);
        setImgError(false);
      }
    } catch (e) {
      console.error('Error loading logo', e);
    }
  };

  useEffect(() => {
    fetchLogo();
    const handleSettingsUpdate = () => fetchLogo();
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const DefaultLogo = () => (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.3)] border border-white/10 shrink-0">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-bg-dark">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 ios-blur border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {logoUrl && !imgError ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1 border border-white/10"
              onError={() => setImgError(true)}
            />
          ) : (
            <DefaultLogo />
          )}

          <div className="hidden sm:block">
            <h1 className="text-sm font-black text-white tracking-tighter leading-none flex flex-col uppercase italic">
              TUARBITRO
              <span className="text-[7px] text-primary not-italic font-bold tracking-[0.3em] mt-0.5">SMART INVEST</span>
            </h1>
          </div>
        </div>
      </div>
      
      {!hideUser && (
        <div className="flex items-center gap-3">
          {role === AppRole.ADMIN ? (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">MODO ADMIN</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-bold text-slate-500 uppercase leading-none">{userData?.name || 'Inversor'}</p>
                <p className="text-[10px] font-black text-white">ID: #{userData?.id?.slice(0, 8) || '----'}</p>
              </div>
              <div className="w-9 h-9 rounded-full border border-white/10 p-0.5 overflow-hidden bg-bg-dark">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.id || 'user'}&backgroundColor=161B26`} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover" 
                />
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
