import React, { useState, useEffect } from 'react';
import { getAdminSettings } from '../store';
import { supabase } from '../supabase';

const AdminDashboard: React.FC<{onUpdateUser: any}> = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [allContractsList, setAllContractsList] = useState<any[]>([]);
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<any | null>(null);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState(getAdminSettings());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalReferrals: 0,
    activeContractsCapital: 0,
    activeContractsCount: 0
  });
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [adminWithdrawalProof, setAdminWithdrawalProof] = useState({ hash: '', imageUrl: '' });
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);

  useEffect(() => {
    const updateSettings = () => setSettings(getAdminSettings());
    window.addEventListener('settingsUpdated', updateSettings);
    return () => window.removeEventListener('settingsUpdated', updateSettings);
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    const timeout = setTimeout(() => {
      if (isRefreshing) {
        setIsRefreshing(false);
        setProfileLoadError("⚠️ TIEMPO DE ESPERA AGOTADO: La base de datos está tardando demasiado en responder.");
      }
    }, 45000);

    try {
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      
      if (profilesError) {
        console.error("Profiles error:", profilesError);
        const isRecursion = profilesError.code === '42P17' || (profilesError.message && profilesError.message.includes('recursion'));
        
        if (isRecursion) {
          setProfileLoadError("⚠️ ERROR CRÍTICO DE BASE DE DATOS: Se detectó una recursión infinita en las políticas de Supabase. Por favor, ejecuta el script SQL de limpieza proporcionado.");
        } else if (profilesError.code === '42501') {
          setProfileLoadError("⚠️ ERROR DE PERMISOS (RLS): No tienes permiso para leer la tabla 'profiles'.");
        }
        throw profilesError;
      }
      if (profiles) {
        setUsers(profiles);
        setProfileLoadError(null);
      }

      const { data: deposits, error: depositsError } = await supabase
        .from('deposits')
        .select(`*, profiles:user_id (name, email)`)
        .eq('status', 'PENDIENTE');
      if (depositsError) throw depositsError;
      if (deposits) setPendingDeposits(deposits);

      const { data: withdrawals, error: withdrawalsError } = await supabase
  .from('withdrawals')
  .select('*')
  .eq('status', 'PENDIENTE');

if (withdrawalsError) throw withdrawalsError;
if (withdrawals) setPendingWithdrawals(withdrawals);
      const { data: fullContracts, error: fullContractsError } = await supabase
        .from('contracts')
        .select(`*, profiles:user_id (name, email)`)
        .order('created_at', { ascending: false });
      
      if (fullContractsError) {
        console.error("Error fetching all contracts:", fullContractsError);
        setContractsError(fullContractsError.message);
      } else {
        setAllContractsList(fullContracts || []);
        setContractsError(null);
      }

      // Global Stats
      const { data: allDeposits } = await supabase.from('deposits').select('amount').eq('status', 'APROBADO');
      const { data: allWithdrawals } = await supabase.from('withdrawals').select('amount').eq('status', 'APROBADO');
      const { data: allContracts } = await supabase.from('contracts').select('amount').eq('status', 'ACTIVE');
      
      const totalDep = (allDeposits || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const totalWith = (allWithdrawals || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const totalCont = (allContracts || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const countCont = (allContracts || []).length;
      
      // Referral stats from profiles
      const totalRef = (profiles || []).reduce((acc, curr) => acc + (Number(curr.referrals_earned) || 0), 0);

      setGlobalStats({
        totalDeposits: totalDep,
        totalWithdrawals: totalWith,
        totalReferrals: totalRef,
        activeContractsCapital: totalCont,
        activeContractsCount: countCont
      });

    } catch(e) {
      console.error("Error fetching admin data:", e);
    } finally {
      clearTimeout(timeout);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('admin-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchData())
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const approveDeposit = async (depositId: string, userId: string, amount: number) => {
  if (!window.confirm(`¿Aprobar depósito de ${amount} USDT?`)) return;

  try {
    const numericAmount = Number(amount || 0);

    const { error: depError } = await supabase
      .from('deposits')
      .update({ status: 'APROBADO' })
      .eq('id', depositId);

    if (depError) throw depError;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('balance, available')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) throw profileErr;

    if (profile) {
      const newBalance = Number(profile.balance || 0) + numericAmount;
      const newAvailable = Number(profile.available || 0) + numericAmount;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          balance: newBalance,
          available: newAvailable,
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    }

    alert('Aprobado correctamente.');
    fetchData();
  } catch (e: any) {
    alert('Error: ' + e.message);
  }
};
  const rejectDeposit = async (depositId: string) => {
      if(!window.confirm("¿Rechazar depósito?")) return;
      try {
          await supabase.from('deposits').update({ status: 'RECHAZADO' }).eq('id', depositId);
          alert('Rechazado.');
          fetchData();
      } catch (e: any) { alert('Error: ' + e.message); }
  };

  const handleWithdrawalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `proofs/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('withdrawal-proofs').upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('withdrawal-proofs').getPublicUrl(filePath);
      setAdminWithdrawalProof(prev => ({ ...prev, imageUrl: data.publicUrl }));
    } catch (e: any) {
      alert('Error al subir imagen: ' + e.message);
    } finally {
      setIsUploadingProof(false);
    }
  };
const processWithdrawal = async (status: 'APROBADO' | 'RECHAZADO') => {
  if (!selectedWithdrawal) return;

  const confirmMsg =
    status === 'APROBADO'
      ? '¿Confirmas que has enviado el pago al usuario?'
      : '¿Seguro que deseas rechazar esta solicitud?';

  if (!window.confirm(confirmMsg)) return;

  if (
    status === 'APROBADO' &&
    !adminWithdrawalProof.hash &&
    !adminWithdrawalProof.imageUrl
  ) {
    const continueWithoutProof = window.confirm(
      'No has proporcionado un Hash o Comprobante. ¿Deseas continuar de todas formas?'
    );
    if (!continueWithoutProof) return;
  }

  setIsProcessingWithdrawal(true);

  try {
    const withdrawalAmount = Number(selectedWithdrawal.amount || 0);
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      throw new Error('El monto del retiro no es válido.');
    }

    const isRefWithdrawal =
      selectedWithdrawal.type && selectedWithdrawal.type.includes('REF');
    const withdrawalUserId = selectedWithdrawal.userid;
    if (!withdrawalUserId) {
      throw new Error('No se pudo identificar el usuario del retiro.');
    }
    
    if (status === 'APROBADO') {
      if (!isRefWithdrawal) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, available')
          .eq('id', withdrawalUserId)
          .single();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Perfil del usuario no encontrado.');

        const currentVal = Number(profile.available || 0);

        if (currentVal < withdrawalAmount) {
          throw new Error('El usuario ya no tiene saldo suficiente para este retiro.');
        }

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            available: currentVal - withdrawalAmount,
          })
          .eq('id', withdrawalUserId);

        if (updateProfileError) throw updateProfileError;
      }

      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({
          status: 'APROBADO',
          hash: adminWithdrawalProof.hash || null,
          proofimage: adminWithdrawalProof.imageUrl || null,
        })
        .eq('id', selectedWithdrawal.id);

      if (withdrawalError) throw withdrawalError;
    }

    if (status === 'RECHAZADO') {
      if (isRefWithdrawal) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, available, referralsavailable')
          .eq('id', withdrawalUserId)
          .single();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Perfil del usuario no encontrado.');

        const newAvailable = Number(profile.available || 0) + withdrawalAmount;
        const newRefAvailable =
          Number(profile.referralsavailable || 0) + withdrawalAmount;

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            available: newAvailable,
            referralsavailable: newRefAvailable,
          })
          .eq('id', withdrawalUserId);

        if (updateProfileError) throw updateProfileError;
      }

      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({
          status: 'RECHAZADO',
          hash: adminWithdrawalProof.hash || null,
          proofimage: adminWithdrawalProof.imageUrl || null,
        })
        .eq('id', selectedWithdrawal.id);

      if (withdrawalError) throw withdrawalError;
    }

    alert(`Solicitud ${status.toLowerCase()} correctamente.`);
    setShowWithdrawalModal(false);
    setSelectedWithdrawal(null);
    setAdminWithdrawalProof({ hash: '', imageUrl: '' });
    fetchData();
  } catch (e: any) {
    console.error('Error procesando retiro:', e);
    alert(`Error: ${e.message}`);
  } finally {
    setIsProcessingWithdrawal(false);
  }
};
  
  const openUserDetail = async (user: any) => {
      setViewUser(user);
      
      const { data: deposits } = await supabase
          .from('deposits')
          .select('*')
          .eq('user_id', user.id);
          
      const { data: withdrawals } = await supabase
          .from('withdrawals')
          .select('*')
          .eq('user_id', user.id);

      const combinedHistory = [
          ...(deposits || []).map(d => ({ 
              ...d, 
              typeLabel: d.method || 'DEPÓSITO',
              dateObj: new Date(d.created_at)
          })),
          ...(withdrawals || []).map(w => ({ 
              ...w, 
              typeLabel: w.type?.includes('REF') ? 'RETIRO COMISIÓN' : 'RETIRO',
              dateObj: new Date(w.created_at)
          })),
          ...(user.referral_history || []).map((r: any) => ({ 
              ...r, 
              typeLabel: 'COMISIÓN RECIBIDA',
              status: 'APROBADO',
              dateObj: new Date()
          }))
      ].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

      setUserHistory(combinedHistory);

      const { data: contracts } = await supabase
          .from('contracts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
      setUserContracts(contracts || []);
  };

  const deleteUserFull = async (userId: string) => {
    if (!window.confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará permanentemente al usuario, sus contratos y depósitos. No se puede deshacer.")) return;
    
    setDeletingUser(true);
    try {
        await supabase.from('deposits').delete().eq('user_id', userId);
        await supabase.from('contracts').delete().eq('user_id', userId);
        await supabase.from('withdrawals').delete().eq('user_id', userId);
        
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        
        if (error) throw error;
        
        alert("Usuario eliminado correctamente.");
        setViewUser(null);
        fetchData();
    } catch (e: any) {
        alert("Error al eliminar: " + e.message);
    } finally {
        setDeletingUser(false);
    }
  };

  const repairOldCommissions = async () => {
    if (!window.confirm("⚠️ ¿REPARAR COMISIONES ANTIGUAS?\n\nEsta acción escaneará todos los contratos y aplicará comisiones faltantes a los patrocinadores, rastreando cada contrato individualmente.")) return;
    
    setIsRefreshing(true);
    try {
        const { data: contracts, error: cError } = await supabase.from('contracts').select('*');
        if (cError) throw cError;

        const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
        if (pError) throw pError;

        let repairedCount = 0;

        for (const contract of contracts || []) {
            const user = profiles?.find(p => p.id === contract.user_id);
            if (!user || !user.referred_by || user.referred_by === 'admin') continue;

            const sponsor = profiles?.find(p => p.id === user.referred_by || p.name === user.referred_by.trim());
            if (!sponsor) continue;

            const alreadyPaid = sponsor.referral_history?.some((r: any) => r.contract_id === contract.id);
            if (alreadyPaid) continue;

            const commission = contract.amount * 0.10;
            const newAvailable = (sponsor.available || 0) + commission;
            const newEarned = (sponsor.referrals_earned || 0) + commission;

            const newHistoryItem = {
                id: Math.random().toString(36).substr(2, 6).toUpperCase(),
                contract_id: contract.id,
                fromUser: user.name,
                amount: commission,
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: 'PAGADO'
            };

            const updatedHistory = [newHistoryItem, ...(sponsor.referral_history || [])];

            await supabase.from('profiles').update({
                available: newAvailable,
                referrals_earned: newEarned,
                referral_history: updatedHistory
            }).eq('id', sponsor.id);

            repairedCount++;
        }

        alert(`✅ Proceso completado. Se repararon ${repairedCount} comisiones.`);
        fetchData();
    } catch (e: any) {
        alert("Error al reparar: " + e.message);
    } finally {
        setIsRefreshing(false);
    }
  };

  const cleanDuplicateCommissions = async () => {
    if (!window.confirm("⚠️ ¿LIMPIAR DUPLICADOS?\n\nEsta acción eliminará comisiones duplicadas en el historial de los patrocinadores.")) return;
    
    setIsRefreshing(true);
    try {
        const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
        if (pError) throw pError;

        for (const sponsor of profiles || []) {
            if (!sponsor.referral_history || sponsor.referral_history.length === 0) continue;

            const uniqueHistory: any[] = [];
            const seenContractIds = new Set();
            let amountToSubtract = 0;

            for (const item of sponsor.referral_history) {
                if (item.contract_id && !seenContractIds.has(item.contract_id)) {
                    uniqueHistory.push(item);
                    seenContractIds.add(item.contract_id);
                } else if (item.contract_id) {
                    amountToSubtract += item.amount;
                }
            }

            if (amountToSubtract > 0) {
                await supabase.from('profiles').update({
                    available: Math.max(0, (sponsor.available || 0) - amountToSubtract),
                    referrals_earned: Math.max(0, (sponsor.referrals_earned || 0) - amountToSubtract),
                    referral_history: uniqueHistory
                }).eq('id', sponsor.id);
            }
        }
        alert("✅ Limpieza completada.");
        fetchData();
    } catch (e: any) {
        alert("Error al limpiar: " + e.message);
    } finally {
        setIsRefreshing(false);
    }
  };

  // FIX: Capital Global = Capital en contratos activos + balances disponibles de clientes
  const realUsers = users.filter(u => u.role !== 'ADMIN');
  const availableBalance = realUsers.reduce((acc, u) => acc + (u.available || 0), 0);
  const totalFundsUSDT = globalStats.activeContractsCapital + availableBalance;
  const safeRate = settings.exchangeRate > 10 ? settings.exchangeRate : 60.50;
  const totalFundsRD = totalFundsUSDT * safeRate;

  return (
    <div className="py-4 space-y-6 pb-20 md:pb-6">
      {/* HEADER WITH REFRESH */}
      <div className="px-6 flex justify-between items-end">
         <div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Panel Maestro</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Vista General de Administración</p>
         </div>
         <button 
            onClick={fetchData} 
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase text-white transition-all active:scale-95"
         >
            <span className={`material-symbols-outlined text-lg ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
            {isRefreshing ? 'Cargando...' : 'Actualizar'}
         </button>
         <button 
            onClick={repairOldCommissions} 
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-black uppercase text-emerald-400 transition-all active:scale-95"
         >
            <span className="material-symbols-outlined text-lg">build</span>
            Reparar Comisiones
         </button>
         <button 
            onClick={cleanDuplicateCommissions} 
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-black uppercase text-red-400 transition-all active:scale-95"
         >
            <span className="material-symbols-outlined text-lg">cleaning_services</span>
            Limpiar Duplicados
         </button>
      </div>

      {/* STATS GLOBALES */}
      <section className="px-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Depósitos</p>
          <p className="text-lg font-black text-emerald-400">{globalStats.totalDeposits.toLocaleString()} USDT</p>
          <p className="text-[8px] text-slate-600 font-bold">Aprobados</p>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Capital Activo</p>
          <p className="text-lg font-black text-primary">{globalStats.activeContractsCapital.toLocaleString()} USDT</p>
          <p className="text-[8px] text-slate-600 font-bold">En Contratos</p>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Contratos Activos</p>
          <p className="text-lg font-black text-white">{globalStats.activeContractsCount}</p>
          <p className="text-[8px] text-slate-600 font-bold">Total Plataforma</p>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Retiros</p>
          <p className="text-lg font-black text-red-400">{globalStats.totalWithdrawals.toLocaleString()} USDT</p>
          <p className="text-[8px] text-slate-600 font-bold">Aprobados</p>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Comisiones</p>
          <p className="text-lg font-black text-blue-400">{globalStats.totalReferrals.toLocaleString()} USDT</p>
          <p className="text-[8px] text-slate-600 font-bold">Generadas</p>
        </div>
      </section>
      
      {profileLoadError && (
        <div className="mx-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500">warning</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400 uppercase tracking-tight">Error de Base de Datos</p>
            <p className="text-xs text-red-300/80 mt-1">{profileLoadError}</p>
          </div>
        </div>
      )}

      {/* TARJETA DESTACADA: LINK MAESTRO */}
      <section className="px-6">
         <div className="glass-card p-6 rounded-3xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-indigo-500/20 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                     <span className="material-symbols-outlined text-2xl">link</span>
                  </div>
                  <div>
                     <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Tu Link Maestro</h3>
                     <p className="text-[10px] text-indigo-200 font-medium">Usa este enlace para invitar nuevos usuarios a la plataforma.</p>
                  </div>
               </div>
               
               <div className="w-full md:w-auto flex items-center gap-2 bg-black/40 p-2 pl-4 rounded-xl border border-white/10">
                   <span className="text-xs text-slate-400 font-mono select-all truncate max-w-[200px] md:max-w-[300px]">
                      {window.location.origin}/?ref=admin
                   </span>
                   <button 
                      onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/?ref=admin`);
                          alert('Link Maestro copiado al portapapeles');
                      }}
                      className="p-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors"
                      title="Copiar"
                   >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                   </button>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
         </div>
      </section>

      {/* HEADER METRICS */}
      <section className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl bg-gradient-to-br from-indigo-900/50 to-bg-dark border border-indigo-500/20 md:col-span-2">
            <p className="text-indigo-300 text-[9px] font-bold uppercase tracking-widest mb-1">Capital Global (Clientes)</p>
            <h4 className="text-3xl font-black text-white tracking-tight">RD$ {totalFundsRD.toLocaleString(undefined, {maximumFractionDigits: 0})}</h4>
            <p className="text-[10px] font-bold text-white/50 mt-0.5">≈ {totalFundsUSDT.toLocaleString(undefined, {maximumFractionDigits: 2})} USDT</p>
          </div>

          <div className="glass-card p-5 rounded-2xl flex flex-col justify-center items-center text-center">
             <span className="material-symbols-outlined text-3xl text-amber-500 mb-1">pending_actions</span>
             <p className="text-white text-2xl font-black">{pendingDeposits.length + pendingWithdrawals.length}</p>
             <p className="text-[9px] text-slate-500 font-black uppercase">Pendientes ({pendingDeposits.length} dep / {pendingWithdrawals.length} ret)</p>
          </div>
      </section>

      {/* PENDING DEPOSITS */}
      <section className="px-6">
        <h2 className="text-lg font-bold text-white tracking-tight mb-4 flex items-center gap-2">
            <span className="size-2 bg-amber-500 rounded-full animate-pulse"></span>
            Solicitudes Pendientes ({pendingDeposits.length})
        </h2>
        {pendingDeposits.length === 0 ? (
          <div className="p-8 text-center glass-card rounded-2xl border-dashed border-white/10">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Todo al día</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingDeposits.map((item, i) => {
              const displayAmountRD = item.amount_fiat || (item.amount * settings.exchangeRate);
              const userName = users.find((u: any) => u.id === item.userid)?.name || 'Usuario';
              return (
                <div key={i} className="glass-card p-4 rounded-2xl space-y-4 border border-amber-500/20 bg-amber-500/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{userName || 'Usuario'}</p>
                      <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded text-amber-200 mt-1 inline-block uppercase font-bold border border-white/10">
                        {item.method}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">RD$ {displayAmountRD.toLocaleString()}</p>
                      <p className="text-[9px] text-amber-400 font-bold">Solicita: {item.amount.toFixed(2)} USDT</p>
                    </div>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 font-mono truncate max-w-[150px]">{item.hash || 'Sin Hash'}</span>
                    {item.proof_url && (
                      <button onClick={() => setSelectedProof(item.proof_url)} className="text-[9px] text-primary font-bold uppercase underline">Ver Foto</button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveDeposit(item.id, item.user_id, Number(item.amount || 0))} className="flex-1 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase rounded-xl shadow-lg hover:bg-emerald-600 transition-colors">Aprobar</button>
                    <button onClick={() => rejectDeposit(item.id)} className="flex-1 py-3 bg-red-500/20 text-red-400 font-black text-[10px] uppercase rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-colors">Rechazar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RETIROS PENDIENTES */}
      <section className="px-6">
        <h2 className="text-lg font-bold text-white tracking-tight mb-4 flex items-center gap-2">
            <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
            Retiros Pendientes ({pendingWithdrawals.length})
        </h2>
        {pendingWithdrawals.length === 0 ? (
          <div className="p-8 text-center glass-card rounded-2xl border-dashed border-white/10">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Sin retiros pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingWithdrawals.map((item, i) => {
              const userName = users.find((u: any) => u.id === item.userid)?.name || 'Usuario';
              const isRef = item.type && item.type.includes('REF');
              return (
                <div key={i} className="glass-card p-4 rounded-2xl space-y-4 border border-red-500/20 bg-red-500/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{userName || 'Usuario'}</p>
                      <span className="text-[8px] bg-white/10 px-2 py-0.5 rounded text-red-200 mt-1 inline-block uppercase font-bold border border-white/10">
                        {isRef ? 'Comision' : 'Balance'} - {item.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">{Number(item.amount).toFixed(2)} USDT</p>
                      <p className="text-[9px] text-red-400 font-bold">= RD$ {(Number(item.amount) * (settings.exchangeRate > 10 ? settings.exchangeRate : 60.50)).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-[9px] space-y-1">
                    {item.type && item.type.includes('USDT') && !item.type.includes('BANCO') ? (
                      <p className="text-slate-400">Wallet: <span className="text-white font-mono break-all">{item.wallet_address || 'No especificada'}</span></p>
                    ) : (
                      <>
                        {item.bank_info?.bankName && <p className="text-slate-400">Banco: <span className="text-white">{item.bank_info.bankName}</span></p>}
                        {item.bank_info?.accountNumber && <p className="text-slate-400">Cuenta: <span className="text-white font-mono">{item.bank_info.accountNumber}</span></p>}
                        {item.bank_info?.beneficiary && <p className="text-slate-400">Titular: <span className="text-white">{item.bank_info.beneficiary}</span></p>}
                      </>
                    )}
                    <p className="text-slate-500 mt-1">{new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedWithdrawal(item); setAdminWithdrawalProof({ hash: '', imageUrl: '' }); setShowWithdrawalModal(true); }} className="flex-1 py-3 bg-primary text-bg-dark font-black text-[10px] uppercase rounded-xl shadow-lg hover:bg-emerald-400 transition-colors">Procesar Pago</button>
                    <button onClick={() => { setSelectedWithdrawal(item); processWithdrawal('RECHAZADO'); }} className="flex-1 py-3 bg-red-500/20 text-red-400 font-black text-[10px] uppercase rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-colors">Rechazar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {/* SECCIÓN DE CONTRATOS GLOBALES */}
      <section className="px-6">
        <div className="glass-card rounded-3xl overflow-hidden border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-emerald-500/[0.03]">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Gestión de Contratos ({allContractsList.length})</h3>
                <p className="text-[10px] text-emerald-500/60 font-medium italic">Control de pagos y rendimientos por contrato</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[8px] text-slate-500 uppercase font-black">Capital en Contratos</p>
                  <p className="text-sm font-black text-emerald-400">{globalStats.activeContractsCapital.toLocaleString()} USDT</p>
               </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {contractsError && (
              <div className="p-4 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase text-center border-b border-white/5">
                Error al cargar contratos: {contractsError}
              </div>
            )}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Usuario / Plan</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Inversión</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Próximo Pago</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Acumulado</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allContractsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-xs text-slate-600 font-bold uppercase">No hay contratos registrados</p>
                    </td>
                  </tr>
                ) : (
                  allContractsList.map((c) => {
                    const isExpanded = expandedContractId === c.id;
                    const startDate = new Date(c.start_date);
                    const endDate = new Date(c.end_date);
                    const now = new Date();
                    
                    const diffTime = Math.max(0, now.getTime() - startDate.getTime());
                    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const totalDays = c.total_days || 30;
                    
                    const exchangeRate = c.amount_fiat ? (c.amount_fiat / c.amount) : 60.50;
                    
                    const accruedProfitUSDT = c.amount * (c.daily_rate / 100) * Math.min(daysPassed, totalDays);
                    const totalProfitUSDT = c.amount * (c.daily_rate / 100) * totalDays;
                    
                    let nextPaymentDateObj = new Date(endDate);
                    let amountToPayUSDT = 0;
                    let paymentRule = "";
                    
                    if (c.plan_id === 'plan90') {
                        paymentRule = "Retiro de ganancias cada 30 días.";
                        const periodsPassed = Math.floor(daysPassed / 30);
                        if (periodsPassed >= (totalDays / 30)) {
                            nextPaymentDateObj = endDate;
                            amountToPayUSDT = c.amount * (c.daily_rate / 100) * 30;
                        } else {
                            nextPaymentDateObj = new Date(startDate);
                            nextPaymentDateObj.setDate(startDate.getDate() + (periodsPassed + 1) * 30);
                            amountToPayUSDT = c.amount * (c.daily_rate / 100) * 30;
                        }
                    } else if (c.plan_id === 'plan60') {
                        paymentRule = "50% al duplicar, resto al final.";
                        const daysToDuplicate = Math.ceil(100 / c.daily_rate);
                        const duplicateDate = new Date(startDate);
                        duplicateDate.setDate(startDate.getDate() + daysToDuplicate);
                        
                        const totalAtEnd = c.amount + totalProfitUSDT;
                        
                        if (daysPassed < daysToDuplicate) {
                            nextPaymentDateObj = duplicateDate;
                            amountToPayUSDT = totalAtEnd / 2;
                        } else {
                            nextPaymentDateObj = endDate;
                            amountToPayUSDT = totalAtEnd / 2;
                        }
                    } else {
                        paymentRule = "Capital + Ganancias al finalizar.";
                        nextPaymentDateObj = endDate;
                        amountToPayUSDT = c.amount + totalProfitUSDT;
                    }

                    const nextPaymentDateStr = nextPaymentDateObj.toLocaleDateString();
                    const amountToPayFiat = amountToPayUSDT * exchangeRate;
                    const totalProfitFiat = totalProfitUSDT * exchangeRate;
                    const initialFiat = c.amount_fiat || (c.amount * exchangeRate);

                    return (
                      <React.Fragment key={c.id}>
                        <tr className={`hover:bg-emerald-500/[0.03] transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-500/[0.05]' : ''}`} onClick={() => setExpandedContractId(isExpanded ? null : c.id)}>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-white">{c.profiles?.name || 'Usuario'}</p>
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter">{c.plan_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-black text-white">RD$ {initialFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                            <p className="text-[9px] text-slate-500">USDT {c.amount.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[12px] text-emerald-500">event</span>
                                    <p className="text-[10px] font-black text-emerald-400">{nextPaymentDateStr}</p>
                                </div>
                                <p className="text-[10px] font-bold text-white mt-0.5">RD$ {amountToPayFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                <p className="text-[8px] text-slate-500">USDT {amountToPayUSDT.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-black text-emerald-400">+RD$ {(accruedProfitUSDT * exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                            <p className="text-[9px] text-slate-500">USDT {accruedProfitUSDT.toFixed(2)}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`material-symbols-outlined text-slate-500 transition-transform ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`}>expand_more</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-emerald-500/[0.02] border-l-2 border-emerald-500">
                            <td colSpan={5} className="px-6 py-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-3">
                                  <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Detalles del Tiempo</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Fecha Inicio:</span>
                                      <span className="text-white font-bold">{startDate.toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Fecha Fin:</span>
                                      <span className="text-white font-bold">{endDate.toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Días Transcurridos:</span>
                                      <span className="text-emerald-400 font-black">{daysPassed} / {totalDays}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Rendimiento</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Tasa Diaria:</span>
                                      <span className="text-emerald-400 font-black">{c.daily_rate}%</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Ganancia Diaria:</span>
                                      <div className="text-right">
                                        <span className="text-white font-bold block">RD$ {((c.amount * (c.daily_rate/100)) * exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                        <span className="text-slate-500 text-[8px]">USDT {(c.amount * (c.daily_rate/100)).toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Ganancia Total Est.:</span>
                                      <div className="text-right">
                                        <span className="text-white font-bold block">RD$ {totalProfitFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                        <span className="text-slate-500 text-[8px]">USDT {totalProfitUSDT.toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Monto Próximo Pago:</span>
                                      <div className="text-right">
                                        <span className="text-emerald-400 font-black block">RD$ {amountToPayFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                        <span className="text-emerald-500/60 text-[8px]">USDT {amountToPayUSDT.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Regla de Pago</h4>
                                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <p className="text-[10px] text-emerald-200 leading-relaxed italic">
                                      "{paymentRule}"
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                     <span className={`size-2 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                     <span className="text-[8px] font-black text-white uppercase tracking-widest">Estado: {c.status}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* USER LIST */}
      <section className="bg-white/[0.02] rounded-t-[2.5rem] border-t border-white/5 px-6 pt-8 pb-10 min-h-[50vh]">
        <h2 className="text-lg font-bold text-white tracking-tight mb-6">Cartera de Clientes ({realUsers.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user, i) => (
              <div key={i} className={`glass-card p-4 rounded-2xl flex items-center justify-between border transition-colors group ${user.role === 'ADMIN' ? 'border-primary/20 bg-primary/5' : 'border-white/5 hover:border-primary/30'}`}>
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-full flex items-center justify-center text-white font-black border border-white/10 transition-colors ${user.role === 'ADMIN' ? 'bg-primary text-bg-dark' : 'bg-slate-700 group-hover:bg-primary group-hover:text-bg-dark'}`}>
                    {(user.name || 'U')[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{user.name}</p>
                        {user.role === 'ADMIN' && <span className="text-[7px] bg-primary text-bg-dark px-1 rounded font-black">ADMIN</span>}
                    </div>
                    <p className="text-[9px] text-slate-500">{user.email}</p>
                  </div>
                </div>
                <button 
                    onClick={() => openUserDetail(user)}
                    className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black text-primary uppercase hover:bg-primary hover:text-bg-dark transition-all"
                >
                    Ver Expediente
                </button>
              </div>
          ))}
        </div>
      </section>

      {/* MODAL DETALLE USUARIO */}
      {viewUser && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex justify-end">
            <div className="w-full max-w-md bg-bg-dark h-full overflow-y-auto border-l border-white/10 p-6 animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black text-white uppercase italic">Expediente</h2>
                    <button onClick={() => setViewUser(null)} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                </div>

                <div className="text-center mb-8">
                    <div className="size-20 bg-primary/10 rounded-full mx-auto mb-3 flex items-center justify-center border-2 border-primary">
                        <span className="text-2xl font-black text-primary">{viewUser.name[0]}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">{viewUser.name}</h3>
                    <p className="text-xs text-slate-500 mb-4">{viewUser.email}</p>
                    <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black">Disponible</p>
                            <p className="text-lg font-black text-white">{viewUser.available?.toFixed(2)} USDT</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black">Bloqueado</p>
                            <p className="text-lg font-black text-white">{viewUser.locked?.toFixed(2)} USDT</p>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Red de Referidos</h4>
                    <div className="space-y-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Patrocinador (Invitado por)</p>
                            <p className="text-sm font-bold text-white">
                                {viewUser.referred_by === 'admin' ? 'Administración' : (users.find(u => u.id === viewUser.referred_by)?.name || viewUser.referred_by || 'Ninguno')}
                            </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-2">Usuarios que ha invitado</p>
                            {users.filter(u => u.referred_by === viewUser.id).length === 0 ? (
                                <p className="text-xs text-slate-600 italic">No ha invitado a nadie aún.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {users.filter(u => u.referred_by === viewUser.id).map(u => (
                                        <li key={u.id} className="text-xs font-bold text-white flex items-center gap-2">
                                            <span className="size-1.5 bg-primary rounded-full"></span>
                                            {u.name} <span className="text-[9px] text-slate-500 font-normal">({u.email})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Contratos Activos</h4>
                    {userContracts.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Sin contratos vigentes.</p>
                    ) : (
                        <div className="space-y-3">
                            {userContracts.map((c, idx) => (
                                <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-white font-bold text-xs">{c.plan_name}</span>
                                        <span className="text-primary font-black text-xs">{c.amount.toFixed(2)} USDT</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
                                        <p>Inicio: {new Date(c.start_date).toLocaleDateString()}</p>
                                        <p>Fin: {new Date(c.end_date).toLocaleDateString()}</p>
                                        <p>Inv. Fiat: RD$ {c.amount_fiat?.toLocaleString()}</p>
                                        <p className="text-emerald-500">{c.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mb-8">
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Historial Financiero</h4>
                    <div className="space-y-2">
                        {userHistory.map((h, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                <div>
                                    <p className="text-xs font-bold text-white">{h.typeLabel}</p>
                                    <p className="text-[9px] text-slate-500">{h.dateObj ? h.dateObj.toLocaleDateString() : h.date}</p>
                                    {h.fromUser && <p className="text-[8px] text-emerald-400">Ref: {users.find(u => u.id === h.fromUser)?.name || h.fromUser.slice(0,8)}</p>}
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-black ${h.typeLabel === 'COMISIÓN RECIBIDA' ? 'text-emerald-400' : 'text-white'}`}>{h.typeLabel === 'COMISIÓN RECIBIDA' ? '+' : ''}{h.amount.toFixed(2)} USDT</p>
                                    <p className={`text-[8px] uppercase font-bold ${h.status === 'APROBADO' ? 'text-emerald-500' : h.status === 'PENDIENTE' ? 'text-amber-500' : 'text-red-500'}`}>{h.status}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                    <button 
                        onClick={() => deleteUserFull(viewUser.id)}
                        disabled={deletingUser}
                        className="w-full py-4 rounded-xl border border-red-500/30 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                        {deletingUser ? 'Eliminando...' : 'Eliminar Usuario'}
                    </button>
                    <p className="text-[9px] text-slate-600 text-center mt-2">Esta acción borrará toda la data relacionada al usuario.</p>
                </div>
            </div>
        </div>
      )}

      {showWithdrawalModal && selectedWithdrawal && (
        <div className="fixed inset-0 z-[110] bg-bg-dark/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="glass-card w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="material-symbols-outlined text-primary text-4xl">verified_user</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-white leading-tight">Confirmar Transferencia</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Accion Irreversible</p>
              </div>
              <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 text-left space-y-3">
                <div className="flex justify-between">
                  <span className="text-[9px] font-black text-slate-600 uppercase">Beneficiario</span>
                  <span className="text-[9px] font-black text-primary uppercase">{selectedWithdrawal.type}</span>
                </div>
                <p className="text-sm font-bold text-white">{Array.isArray(selectedWithdrawal.profiles) ? selectedWithdrawal.profiles[0]?.name : selectedWithdrawal.profiles?.name || 'Usuario'}</p>
                <p className="text-lg font-black text-white tracking-tighter">USDT {Number(selectedWithdrawal.amount).toLocaleString()}</p>
                <div className="pt-2 space-y-3 border-t border-white/5">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Hash de Transaccion / Referencia</label>
                    <input type="text" value={adminWithdrawalProof.hash} onChange={(e) => setAdminWithdrawalProof(prev => ({ ...prev, hash: e.target.value }))} placeholder="Pega el hash o numero de ref" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-[10px] outline-none focus:border-primary mt-1" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Foto del Comprobante</label>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-primary/30 cursor-pointer transition-colors">
                        <span className="material-symbols-outlined text-slate-500 text-sm">add_a_photo</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{isUploadingProof ? 'Subiendo...' : adminWithdrawalProof.imageUrl ? 'Cambiar Foto' : 'Subir Foto'}</span>
                        <input type="file" accept="image/*" onChange={handleWithdrawalFileUpload} className="hidden" />
                      </label>
                      {adminWithdrawalProof.imageUrl && (
                        <div className="size-12 rounded-lg overflow-hidden border border-primary/30">
                          <img src={adminWithdrawalProof.imageUrl} alt="Comprobante" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full space-y-3 pt-2">
                <button onClick={() => processWithdrawal('APROBADO')} disabled={isProcessingWithdrawal} className="w-full py-4 rounded-2xl bg-primary text-slate-900 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 hover:bg-emerald-400 disabled:opacity-50">{isProcessingWithdrawal ? 'Procesando...' : 'Confirmar Pago Realizado'}</button>
                <button onClick={() => { setShowWithdrawalModal(false); setSelectedWithdrawal(null); }} className="w-full py-2 text-slate-500 text-xs font-bold uppercase hover:text-white">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProof && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedProof(null)}>
          <img src={selectedProof} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white p-4"><span className="material-symbols-outlined text-3xl">close</span></button>
        </div>
      )}
      {/* Sección de Ayuda SQL para RLS */}
      {profileLoadError && (profileLoadError.includes('permisos') || profileLoadError.includes('RLS') || profileLoadError.includes('recursión')) && (
        <div className="mt-12 p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-amber-500">database</span>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">Configuración de Base de Datos (RLS)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Si ves errores de permisos (403/42501) o "contratos no tiene políticas", copia y ejecuta este código en el 
            <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" className="text-primary hover:underline mx-1">SQL Editor de Supabase</a>:
          </p>
          <div className="bg-black/40 p-4 rounded-xl font-mono text-[10px] text-amber-200 overflow-x-auto whitespace-pre border border-white/5">
  {`-- 1. Habilitar RLS en todas las tablas
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
  ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
  
  -- 2. Políticas para PROFILES
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  
  DROP POLICY IF EXISTS "Users can view referred profiles" ON profiles;
  CREATE POLICY "Users can view referred profiles" ON profiles FOR SELECT USING (
    referred_by::text = auth.uid()::text OR 
    referred_by::text = (auth.jwt() -> 'user_metadata' ->> 'name')
  );

  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );
  
  -- 3. Políticas para CONTRACTS
  DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
  CREATE POLICY "Users can view own contracts" ON contracts FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Admins can view all contracts" ON contracts;
  CREATE POLICY "Admins can view all contracts" ON contracts FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );
  DROP POLICY IF EXISTS "Admins can manage contracts" ON contracts;
  CREATE POLICY "Admins can manage contracts" ON contracts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );`}
          </div>
          <button 
            onClick={() => {
              const sql = `-- 1. Habilitar RLS en todas las tablas
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
  ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
  
  -- 2. Políticas para PROFILES
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  
  DROP POLICY IF EXISTS "Users can view referred profiles" ON profiles;
  CREATE POLICY "Users can view referred profiles" ON profiles FOR SELECT USING (
    referred_by::text = auth.uid()::text OR 
    referred_by::text = (auth.jwt() -> 'user_metadata' ->> 'name')
  );

  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );
  
  -- 3. Políticas para CONTRACTS
  DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
  CREATE POLICY "Users can view own contracts" ON contracts FOR SELECT USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Admins can view all contracts" ON contracts;
  CREATE POLICY "Admins can view all contracts" ON contracts FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );
  DROP POLICY IF EXISTS "Admins can manage contracts" ON contracts;
  CREATE POLICY "Admins can manage contracts" ON contracts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );`;
              navigator.clipboard.writeText(sql);
              alert("SQL copiado al portapapeles");
            }}
            className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white font-bold hover:bg-white/10 transition-colors"
          >
            COPIAR CÓDIGO SQL
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;