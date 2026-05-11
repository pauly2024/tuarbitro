import React, { useState, useEffect } from 'react';
import { UserData, getAdminSettings } from '../store';
import { supabase } from '../supabase';

interface ReferralsScreenProps {
  userData: UserData | null;
  onUpdateUser: () => void;
}

const ReferralsScreen: React.FC<ReferralsScreenProps> = ({ userData, onUpdateUser }) => {
  const [referralCount, setReferralCount] = useState(0);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'BANK' | 'CRYPTO'>('CRYPTO');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawBankInfo, setWithdrawBankInfo] = useState({
    bankName: '',
    accountNumber: '',
    beneficiary: '',
    cedula: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingReferralWithdrawals, setPendingReferralWithdrawals] = useState(0);

  const settings = getAdminSettings();

  useEffect(() => {
    const fetchReferrals = async () => {
      if (!userData) {
        setLoading(false);
        return;
      }

      try {
        const { data, count, error } = await supabase
          .from('profiles')
          .select('id, email, name', { count: 'exact' })
          .eq('referred_by', userData.id);

        console.log('[DEBUG REFERRALS] id usado:', userData.id, '| data:', data, '| error:', error);

        if (error) {
          console.error('[REFERRALS] profiles by referred_by error:', error);
        }

        let finalUsers = data || [];

        if ((!finalUsers || finalUsers.length === 0) && userData.referralHistory?.length) {
          const uniqueFromUsers = Array.from(
            new Set(
              userData.referralHistory
                .map((h: any) => h.fromUser)
                .filter(Boolean)
            )
          );

          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          const uuidRefs = uniqueFromUsers.filter((value: string) => uuidRegex.test(value));
          const nameRefs = uniqueFromUsers.filter((value: string) => !uuidRegex.test(value));

          let rebuiltUsers: any[] = [];

          if (uuidRefs.length > 0) {
            const { data: profilesById, error: profilesByIdError } = await supabase
              .from('profiles')
              .select('id, email, name')
              .in('id', uuidRefs);

            if (profilesByIdError) {
              console.error('[REFERRALS] profiles by ids error:', profilesByIdError);
            } else if (profilesById) {
              rebuiltUsers = [...rebuiltUsers, ...profilesById];
            }
          }

          if (nameRefs.length > 0) {
            rebuiltUsers = [
              ...rebuiltUsers,
              ...nameRefs.map((name: string, index: number) => ({
                id: `history-name-${index}-${name}`,
                email: '',
                name,
              })),
            ];
          }

          const deduped = Array.from(
            new Map(rebuiltUsers.map((u) => [String(u.name || u.id), u])).values()
          );

          finalUsers = deduped;
        }

        setReferredUsers(finalUsers);
        setReferralCount(finalUsers.length > 0 ? finalUsers.length : count || 0);
      } catch (e) {
        console.error('[REFERRALS] fetchReferrals unexpected error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, [userData]);

  useEffect(() => {
    const fetchPendingReferralWithdrawals = async () => {
      if (!userData?.id) {
        setPendingReferralWithdrawals(0);
        return;
      }

      const { data, error } = await supabase
        .from('withdrawals')
        .select('amount, status, type')
        .eq('user_id', userData.id)
        .in('type', ['REF_BANCO', 'REF_USDT'])
        .in('status', ['PENDIENTE', 'APROBADO', 'PAGADO']);

      if (error) {
        console.error('[REFERRAL] Error fetching withdrawals:', error);
        setPendingReferralWithdrawals(0);
        return;
      }

      const totalPending = (data || []).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      );

      setPendingReferralWithdrawals(totalPending);
    };

    fetchPendingReferralWithdrawals();
  }, [userData]);

  if (!userData) return null;

  const isVIP =
    (userData.contracts && userData.contracts.length > 0) || userData.locked > 0;

  const rawReferralAvailable = Number(userData.referralsAvailable ?? 0);

  const availableReferralBalance = Math.max(
    0,
    rawReferralAvailable - Number(pendingReferralWithdrawals || 0)
  );

  const handleWithdrawReferrals = async () => {
    if (!userData) return;

    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor ingresa un monto válido.');
      return;
    }

    if (amountNum > availableReferralBalance) {
      alert('Saldo de comisiones insuficiente.');
      return;
    }

    if (withdrawMethod === 'CRYPTO' && !withdrawWallet) {
      alert('Por favor ingresa tu dirección de billetera USDT.');
      return;
    }

    if (withdrawMethod === 'BANK') {
      if (
        !withdrawBankInfo.bankName ||
        !withdrawBankInfo.accountNumber ||
        !withdrawBankInfo.beneficiary
      ) {
        alert('Por favor completa todos los datos bancarios.');
        return;
      }
    }

        const currentAvailable = Number(userData.available ?? 0);
    setIsProcessing(true);
    if (currentAvailable < amountNum) {
  alert('Tu balance disponible actual es menor al monto a retirar.');
  return;
}


    try {
      const { error: insertError } = await supabase.from('withdrawals').insert({
        user_id: userData.id,
        amount: amountNum,
        type: withdrawMethod === 'BANK' ? 'REF_BANCO' : 'REF_USDT',
        status: 'PENDIENTE',
        wallet_address: withdrawMethod === 'CRYPTO' ? withdrawWallet : null,
        bank_info: withdrawMethod === 'BANK' ? withdrawBankInfo : null,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      const newAvailable = currentAvailable - amountNum;
      const newReferralsAvailable = Math.max(0, rawReferralAvailable - amountNum);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          available: newAvailable,
          referrals_available: newReferralsAvailable,
        })
        .eq('id', userData.id);

      if (updateError) throw updateError;

      alert('Solicitud de retiro de comisiones enviada correctamente.');
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      setWithdrawWallet('');
      setWithdrawBankInfo({
        bankName: '',
        accountNumber: '',
        beneficiary: '',
        cedula: '',
      });

      onUpdateUser();
    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="px-6 py-4 space-y-6 pb-24">

      <div className="relative overflow-hidden rounded-[2.5rem] p-8 bg-gradient-to-r from-indigo-600 to-blue-600 shadow-2xl">
        <div className="relative z-10 text-center">
          <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.3em] mb-2">
            Socios VIP
          </p>
          <h2 className="text-5xl font-black text-white italic tracking-tighter mb-4">
            10% <span className="text-2xl not-italic font-normal opacity-80">Comisión</span>
          </h2>
          <p className="text-xs text-blue-100 font-medium leading-relaxed max-w-[250px] mx-auto">
            Tu red de inversión crece contigo.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">info</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white uppercase italic">¿Cómo Funciona?</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                Detalles del sistema de comisiones
              </p>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${
              showDetails ? 'rotate-180 text-primary' : ''
            }`}
          >
            expand_more
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            showDetails ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-5 pt-0 border-t border-white/5 space-y-4">
            <div className="mt-4 flex gap-3">
              <span className="text-xl font-black text-primary">1.</span>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Copia tu Enlace</h4>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Comparte tu link único. Tus amigos deben registrarse usando ese enlace.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-xl font-black text-primary">2.</span>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Ellos Invierten</h4>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Cuando tu referido activa un Plan (30, 60 o 90 días), el sistema lo detecta.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-xl font-black text-primary">3.</span>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Ganas el 10%</h4>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Recibes inmediatamente el 10% del monto invertido en tu saldo disponible.
                </p>
              </div>
            </div>
            <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
              <p className="text-[9px] font-bold text-red-400 uppercase">
                Requisito: Debes tener una inversión activa.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">
          Tu Enlace Personal
        </p>
        <div
          className={`p-1 rounded-2xl border ${
            isVIP ? 'bg-white/5 border-primary/30' : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          {isVIP ? (
            <div className="flex items-center gap-2 p-1">
              <div className="flex-1 px-4 py-3 text-xs text-slate-300 truncate font-mono bg-black/20 rounded-xl">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/?ref=${userData?.name || userData?.id}`
                  : `https://tudominio.com/?ref=${userData?.name || userData?.id}`}
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && (userData?.name || userData?.id)) {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/?ref=${userData?.name || userData?.id}`
                    );
                    alert('Copiado!');
                  }
                }}
                className="bg-primary text-bg-dark p-3 rounded-xl hover:bg-white transition-colors"
              >
                <span className="material-symbols-outlined">content_copy</span>
              </button>
            </div>
          ) : (
            <div className="p-4 text-center">
              <span className="material-symbols-outlined text-red-400 text-2xl mb-2">lock</span>
              <p className="text-xs font-bold text-white uppercase">Enlace Bloqueado</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Debes tener una inversión activa para invitar.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl text-center">
          <span className="text-3xl font-black text-white">
            {loading ? '-' : referralCount}
          </span>
          <p className="text-[9px] font-black text-slate-500 uppercase mt-1">
            Socios Registrados
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl text-center relative overflow-hidden group">
          <span className="text-3xl font-black text-emerald-400">
            {availableReferralBalance.toFixed(2)}
          </span>
          <p className="text-[9px] font-black text-slate-500 uppercase mt-1">
            USDT Disponibles (Comisiones)
          </p>
          {availableReferralBalance > 0 && (
            <button
              onClick={() => setWithdrawModalOpen(true)}
              className="mt-3 w-full py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
            >
              Retirar Comisiones
            </button>
          )}
        </div>
      </div>

      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <div className="glass-card w-full max-w-sm p-0 rounded-[2rem] border border-emerald-500/30 overflow-hidden my-auto relative shadow-2xl">
            <button
              onClick={() => setWithdrawModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 p-2 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="p-6 pb-0 text-center">
              <h3 className="text-xl font-black text-white uppercase italic">
                Retirar Comisiones
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                Disponible para retirar: {availableReferralBalance.toFixed(2)} USDT
              </p>
            </div>

            <div className="flex p-4 gap-2">
              <button
                onClick={() => { setWithdrawMethod('BANK'); setWithdrawAmount(''); }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  withdrawMethod === 'BANK'
                    ? 'bg-white text-bg-dark border-white'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                Banco
              </button>
              <button
                onClick={() => { setWithdrawMethod('CRYPTO'); setWithdrawAmount(''); }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  withdrawMethod === 'CRYPTO'
                    ? 'bg-white text-bg-dark border-white'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                USDT
              </button>
            </div>

            <div className="px-6 pb-6 space-y-5">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Monto a Retirar (USDT)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Monto a retirar"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-black text-lg outline-none focus:border-emerald-500 mt-1"
                />
              </div>

              {withdrawMethod === 'BANK' ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre del Banco"
                    value={withdrawBankInfo.bankName}
                    onChange={(e) => setWithdrawBankInfo({ ...withdrawBankInfo, bankName: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />
                  <input
                    type="text"
                    placeholder="Número de Cuenta"
                    value={withdrawBankInfo.accountNumber}
                    onChange={(e) => setWithdrawBankInfo({ ...withdrawBankInfo, accountNumber: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />
                  <input
                    type="text"
                    placeholder="Nombre del Beneficiario"
                    value={withdrawBankInfo.beneficiary}
                    onChange={(e) => setWithdrawBankInfo({ ...withdrawBankInfo, beneficiary: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />
                  <input
                    type="text"
                    placeholder="Cédula (Opcional)"
                    value={withdrawBankInfo.cedula}
                    onChange={(e) => setWithdrawBankInfo({ ...withdrawBankInfo, cedula: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Dirección USDT ({settings.cryptoNetwork})
                  </label>
                  <input
                    type="text"
                    value={withdrawWallet}
                    onChange={(e) => setWithdrawWallet(e.target.value)}
                    placeholder="Dirección de billetera"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs outline-none focus:border-white mt-1"
                  />
                </div>
              )}

              <button
                onClick={handleWithdrawReferrals}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-500 text-bg-dark font-black text-sm uppercase rounded-xl shadow-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Procesando...' : 'Solicitar Retiro'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-black text-white uppercase tracking-widest pl-2 mb-3">
          Historial de Comisiones
        </h3>
        <div className="space-y-3">
          {!userData.referralHistory || userData.referralHistory.length === 0 ? (
            <div className="glass-card p-6 text-center border-dashed border-white/10 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                Sin comisiones aún
              </p>
            </div>
          ) : (
            userData.referralHistory.map((h: any, i: number) => {
              const refUser = referredUsers.find(
                (u) => u.id === h.fromUser || u.name === h.fromUser
              );
              const displayName = refUser ? refUser.name : h.fromUser;

              let formattedDate = h.date;
              try {
                if (h.date && h.date.includes('T')) {
                  formattedDate = new Date(h.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                }
              } catch (e) {}

              return (
                <div
                  key={i}
                  className="glass-card p-4 rounded-xl flex justify-between items-center border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <span className="material-symbols-outlined text-sm">add</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Ref: {displayName}</p>
                      <p className="text-[9px] text-slate-500">{formattedDate}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-emerald-400">
                    +{Number(h.amount).toFixed(2)} USDT
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-black text-white uppercase tracking-widest pl-2 mb-3">
          Mis Invitados
        </h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4">
              <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
            </div>
          ) : referredUsers.length === 0 ? (
            <div className="glass-card p-6 text-center border-dashed border-white/10 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                Sin invitados aún
              </p>
            </div>
          ) : (
            referredUsers.map((u, i) => (
              <div
                key={i}
                className="glass-card p-4 rounded-xl flex items-center gap-3 border border-white/5"
              >
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                  {(u.name || u.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{u.name || 'Usuario'}</p>
                  <p className="text-[9px] text-slate-500">{u.email || 'Sin email disponible'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default ReferralsScreen;