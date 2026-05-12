import React, { useState, useRef, useEffect } from 'react';
import { AdminSettings, setAdminSettings, getAdminSettings } from '../store';
import { supabase } from '../supabase';

const SettingsScreen: React.FC = () => {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<AdminSettings>(getAdminSettings());
  const [loading, setLoading] = useState(false);
  const [dbId, setDbId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const local = getAdminSettings();
      setSettings(local);
      if (local.logoUrl) setLogoPreview(local.logoUrl);

      const { data } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setDbId(data.id);

        const newSettings: AdminSettings = {
          exchangeRate: data.exchange_rate || local.exchangeRate,
          bankName: data.bank_name || local.bankName || '',
          bankAccount: data.bank_account || local.bankAccount || '',
          bankBeneficiary: data.bank_beneficiary || local.bankBeneficiary || '',
          bankRNC: data.bank_rnc || local.bankRNC || '',
          bankCedula: data.bank_cedula || local.bankCedula || '',
          bankType: data.bank_type || local.bankType || 'Corriente',
          cryptoWallet: data.crypto_wallet || local.cryptoWallet || '',
          cryptoNetwork: data.crypto_network || local.cryptoNetwork || '',
          activeInvestors: data.active_investors || local.activeInvestors || 0,
          logoUrl: data.logo_url || local.logoUrl || ''
        };

        setSettings(newSettings);
        setAdminSettings(newSettings);
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('El archivo es muy pesado. Máximo 2MB.');
        return;
      }

      setLogoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let url = e.target.value;

    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      if (!url.startsWith('/')) url = '/' + url;
    }

    setSettings(prev => ({ ...prev, logoUrl: url }));
    setLogoPreview(url);
    setLogoFile(null);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    let finalLogoUrl = settings.logoUrl;

    try {
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split('.').pop();
          const fileName = `logo_${Date.now()}.${fileExt}`;
          const filePath = `brand/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, logoFile, { upsert: true });

          if (!uploadError) {
            const {
              data: { publicUrl }
            } = supabase.storage.from('assets').getPublicUrl(filePath);

            finalLogoUrl = publicUrl;
          } else {
            console.warn('Upload failed, falling back to base64 local preview.');
            if (logoPreview && logoPreview.startsWith('data:')) {
              finalLogoUrl = logoPreview;
            }
          }
        } catch (uploadErr) {
          console.warn('Upload exception:', uploadErr);
        }
      }

      const newSettingsState: AdminSettings = {
        ...settings,
        logoUrl: finalLogoUrl
      };

      setSettings(newSettingsState);
      setAdminSettings(newSettingsState);
      window.dispatchEvent(new Event('settingsUpdated'));

      const updates = {
        exchange_rate: settings.exchangeRate,
        bank_name: settings.bankName,
        bank_account: settings.bankAccount,
        bank_beneficiary: settings.bankBeneficiary,
        bank_rnc: settings.bankRNC,
        bank_cedula: settings.bankCedula,
        bank_type: settings.bankType,
        crypto_wallet: settings.cryptoWallet,
        crypto_network: settings.cryptoNetwork,
        active_investors: settings.activeInvestors,
        logo_url: finalLogoUrl
      };

      try {
        if (dbId) {
          await supabase.from('settings').update(updates).eq('id', dbId);
        } else {
          const { data: insertedData } = await supabase
            .from('settings')
            .insert(updates)
            .select('id')
            .single();

          if (insertedData?.id) {
            setDbId(insertedData.id);
          }
        }
      } catch (dbError) {
        console.warn('DB Sync failed but local saved:', dbError);
      }

      alert('Configuración guardada correctamente.');
    } catch (e: any) {
      console.error(e);
      alert('Guardado localmente.');
    } finally {
      setLoading(false);
    }
  };

  const resetLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    setSettings(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (field: keyof AdminSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="px-6 py-4 space-y-6">
      <div className="mb-2">
        <span className="text-primary text-[10px] font-black tracking-[0.2em] uppercase">
          Admin Setup
        </span>
        <h2 className="text-2xl font-bold text-white mb-1">Configuración</h2>
        <p className="text-sm text-slate-500 font-medium">
          Ajustes globales de la plataforma
        </p>
      </div>

      <section className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">palette</span>
          <h3 className="text-base font-bold text-white">Identidad de Marca</h3>
        </div>

        <div className="flex flex-col gap-4">
          <div className="w-full h-32 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden border border-white/5 shadow-lg relative group">
            {logoPreview ? (
              <img src={logoPreview} alt="Preview" className="h-full object-contain p-4" />
            ) : (
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">
                  image
                </span>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Sin Logo</p>
              </div>
            )}

            {logoPreview && (
              <button
                onClick={resetLogo}
                className="absolute top-2 right-2 p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-primary text-bg-dark font-black uppercase text-[10px] rounded-xl transition-all hover:bg-primary/90"
              >
                Subir desde Dispositivo
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 material-symbols-outlined text-sm">
                link
              </span>
              <input
                type="text"
                value={settings.logoUrl || ''}
                onChange={handleUrlChange}
                placeholder="URL o nombre de archivo (ej: logo.png)"
                className="w-full bg-bg-dark border border-white/10 rounded-xl py-3 pl-9 pr-4 text-[10px] text-white focus:border-primary outline-none font-mono"
              />
            </div>

            <p className="text-[9px] text-slate-500 pl-1">
              * Si el archivo está en la raíz, escribe{' '}
              <span className="font-mono text-primary">/nombre.png</span>
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLogoSelect}
            accept="image/*"
            className="hidden"
          />
        </div>
      </section>

      <section className="glass-card rounded-3xl p-6 space-y-5 border-primary/20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">
            currency_exchange
          </span>
          <h3 className="text-base font-bold text-white">Tasa del Mercado</h3>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
            1 USDT equivale a:
          </label>
          <div className="relative">
            <input
              type="number"
              value={settings.exchangeRate}
              onChange={(e) => handleChange('exchangeRate', parseFloat(e.target.value) || 0)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-lg font-black text-primary focus:border-primary outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">
              RD$
            </span>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">
            currency_bitcoin
          </span>
          <h3 className="text-base font-bold text-white">Infraestructura Crypto</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Red Blockchain
            </label>
            <input
              type="text"
              value={settings.cryptoNetwork}
              onChange={(e) => handleChange('cryptoNetwork', e.target.value)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-xs font-bold text-white focus:border-primary outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Wallet USDT (Solana)
            </label>
            <input
              type="text"
              value={settings.cryptoWallet}
              onChange={(e) => handleChange('cryptoWallet', e.target.value)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-[10px] font-mono text-slate-300 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Usuarios Activos (Visual)
            </label>
            <input
              type="number"
              value={settings.activeInvestors}
              onChange={(e) => handleChange('activeInvestors', parseInt(e.target.value) || 0)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold text-white focus:border-primary outline-none"
            />
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">
            account_balance
          </span>
          <h3 className="text-base font-bold text-white">Cuenta Bancaria</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Banco
            </label>
            <input
              type="text"
              value={settings.bankName}
              onChange={(e) => handleChange('bankName', e.target.value)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Número de Cuenta
              </label>
              <input
                type="text"
                value={settings.bankAccount}
                onChange={(e) => handleChange('bankAccount', e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                RNC
              </label>
              <input
                type="text"
                value={settings.bankRNC}
                onChange={(e) => handleChange('bankRNC', e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Beneficiario
              </label>
              <input
                type="text"
                value={settings.bankBeneficiary}
                onChange={(e) => handleChange('bankBeneficiary', e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Cédula
              </label>
              <input
                type="text"
                value={settings.bankCedula}
                onChange={(e) => handleChange('bankCedula', e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="pb-8">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="w-full py-4 bg-primary hover:bg-primary/90 text-slate-900 font-black text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="size-4 rounded-full border-2 border-bg-dark border-t-transparent animate-spin"></div>
              Guardando...
            </>
          ) : (
            'Guardar Cambios'
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;