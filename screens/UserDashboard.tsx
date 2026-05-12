
import React, { useState, useEffect, useRef } from 'react';
import { UserData, getAdminSettings, AdminSettings } from '../store';
import { supabase } from '../supabase'; 

interface UserDashboardProps {
  userData: UserData | null;
  onUpdateUser: () => void; 
}

const UserDashboard: React.FC<UserDashboardProps> = ({ userData, onUpdateUser }) => {
  const [isDepositModalOpen, setDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState<'BANK' | 'CRYPTO'>('BANK');
  const [withdrawMethod, setWithdrawMethod] = useState<'BANK' | 'CRYPTO'>('BANK');
  const [depositHash, setDepositHash] = useState(''); 
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawBankInfo, setWithdrawBankInfo] = useState({
    bankName: '',
    accountNumber: '',
    beneficiary: '',
    cedula: ''
  });
  const [proofFile, setProofFile] = useState<File | null>(null); 
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<AdminSettings>(getAdminSettings());
  const [marketStats, setMarketStats] = useState({ fund: 0, paid: 0, yield: 0, activeInvestors: 0 });
  const [referralNames, setReferralNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchReferralNames = async () => {
      if (!userData || !userData.referralHistory) return;
      const history = userData.referralHistory;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuids = history.map((h: any) => h.fromUser).filter((u: string) => u && uuidRegex.test(u));
      
      if (uuids.length > 0) {
        const { data: refProfiles } = await supabase.from('profiles').select('id, name').in('id', uuids);
        if (refProfiles) {
          const nameMap: Record<string, string> = {};
          refProfiles.forEach(p => {
            nameMap[p.id] = p.name;
          });
          setReferralNames(nameMap);
        }
      }
    };
    fetchReferralNames();
  }, [userData]);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(getAdminSettings());
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    const calculateMarketStats = () => {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        
        let calculatedYield = 3.25;
        const hourlyFluctuation = Math.sin(hour) * 0.3; 

        if (day === 1) { 
            calculatedYield = 3.6 + (hourlyFluctuation * 0.3);
        } else if (day === 5) {
            calculatedYield = 2.75 + (hourlyFluctuation * 0.15);
        } else {
            calculatedYield = 3.2 + hourlyFluctuation;
        }

        if (calculatedYield > 3.9) calculatedYield = 3.9;
        if (calculatedYield < 2.6) calculatedYield = 2.6;

        const baseFund = 154600500;
        const dailyGrowth = (seed % 100) * 1500;
        const currentFund = baseFund + dailyGrowth + (hour * 250);

        setMarketStats({
            fund: currentFund,
            paid: 4280300 + (seed % 25000) + (hour * 100),
            yield: calculatedYield,
            activeInvestors: 2450 + (seed % 200)
        });
    };

    calculateMarketStats();
    const interval = setInterval(calculateMarketStats, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  if (!userData) return null;

  const safeRate = settings.exchangeRate > 10 ? settings.exchangeRate : 60.50;
  const balanceInPesos = userData.available * safeRate;
  const investedInPesos = userData.locked * safeRate;
  const earningsInPesos = userData.referralsEarned * safeRate;

  const contractsEarningsUSDT = (userData.contracts || []).reduce((acc, contract) => {
      const startDate = new Date(contract.startDate);
      const now = new Date();
      const diffTime = Math.max(0, now.getTime() - startDate.getTime());
      const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const totalDays = contract.totalDays || 30;
      const accruedProfitUSDT = contract.amount * (contract.dailyRate / 100) * Math.min(daysPassed, totalDays);
      return acc + accruedProfitUSDT;
  }, 0);
  const contractsEarningsInPesos = contractsEarningsUSDT * safeRate;

  // Combine transactions for recent history
  const recentTransactions = [
    ...(userData.deposits || []).map((d: any) => ({
      id: d.id,
      type: 'DEPOSITO',
      amount: d.amount,
      amountFiat: d.amountFiat,
      status: d.status,
      date: d.date || d.created_at || new Date().toISOString(),
      method: d.method,
      title: d.status === 'APROBADO' ? 'Depósito Exitoso' : 'Solicitud Depósito'
    })),
    ...(userData.withdrawals || []).map((w: any) => ({
      id: w.id,
      type: 'RETIRO',
      amount: w.amount,
      amountFiat: w.amount * (safeRate - 2),
      status: w.status,
      date: w.created_at || new Date().toISOString(),
      method: w.type,
      title: `Retiro ${w.type.includes('REF') ? 'Comisiones' : 'Balance'}`
    })),
    ...(userData.referralHistory || []).map((h: any) => ({
      id: h.id || Math.random().toString(36).substr(2, 9),
      type: 'COMISION',
      amount: h.amount,
      amountFiat: h.amount * safeRate,
      status: h.status || 'COMPLETADO',
      date: h.date_iso || h.created_at || h.date || new Date().toISOString(),
      method: 'REFERIDO',
      title: `Comisión de ${referralNames[h.fromUser] || h.fromUser}`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        alert("La imagen es muy pesada. Máximo 5MB.");
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeposit = async () => {
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }

    if (!proofFile) {
      alert("Es obligatorio subir el comprobante de pago.");
      return;
    }

    if (depositMethod === 'CRYPTO' && !depositHash) {
      alert("Por favor ingresa el Hash / TXID de la transacción.");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${userData.id}_${Date.now()}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets') 
        .upload(filePath, proofFile);

      let finalProofUrl = null;
      if (!uploadError) {
         const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(filePath);
         finalProofUrl = publicUrl;
      } else {
         finalProofUrl = proofPreview; 
      }

      let finalAmountUSDT = 0;
      let methodLabel = '';

      if (depositMethod === 'BANK') {
        finalAmountUSDT = amountNum / safeRate;
        methodLabel = 'BANCO (DOP)';
      } else {
        finalAmountUSDT = amountNum;
        methodLabel = 'USDT (SOLANA)';
      }

      const { error: insertError } = await supabase
        .from('deposits')
        .insert({
            user_id: userData.id,
            amount: finalAmountUSDT,
            amount_fiat: depositMethod === 'BANK' ? amountNum : null,
            method: methodLabel,
            status: 'PENDIENTE',
            hash: depositMethod === 'CRYPTO' ? depositHash : `REF-BANCO-${Date.now()}`,
            proof_url: finalProofUrl
        });

      if (insertError) throw insertError;

      alert('Solicitud enviada correctamente. Espere aprobación del administrador.');
      
      setDepositModalOpen(false);
      setDepositAmount('');
      setDepositHash('');
      setProofFile(null);
      setProofPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUpdateUser();

    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }

    if (amountNum > userData.available) {
      alert("Saldo insuficiente.");
      return;
    }

    if (withdrawMethod === 'CRYPTO' && !withdrawWallet) {
      alert("Por favor ingresa tu dirección de billetera USDT.");
      return;
    }

    if (withdrawMethod === 'BANK') {
      if (!withdrawBankInfo.bankName || !withdrawBankInfo.accountNumber || !withdrawBankInfo.beneficiary) {
        alert("Por favor completa todos los datos bancarios.");
        return;
      }
    }

    setIsUploading(true); // Reusing loading state

    try {
      // 1. Create withdrawal request (Balance is NOT deducted yet)
      const { error: insertError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: userData.id,
          amount: amountNum,
          type: withdrawMethod === 'BANK' ? 'BANCO' : 'USDT',
          status: 'PENDIENTE',
          wallet_address: withdrawMethod === 'CRYPTO' ? withdrawWallet : null,
          bank_info: withdrawMethod === 'BANK' ? withdrawBankInfo : null,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      alert('Solicitud de retiro enviada correctamente.');
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      setWithdrawWallet('');
      setWithdrawBankInfo({ bankName: '', accountNumber: '', beneficiary: '', cedula: '' });
      onUpdateUser();

    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const getContractDates = (startDateStr: string, days: number) => {
      const start = new Date(startDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + days);
      
      const today = new Date();
      const timeDiff = end.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      return {
          start: start.toLocaleDateString(),
          end: end.toLocaleDateString(),
          daysLeft: daysLeft > 0 ? daysLeft : 0
      };
  };

  return (
    <div className="px-6 py-4 space-y-6 pb-24 md:pb-6 max-w-7xl mx-auto">
      {/* Header Saludo */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Panel de Control</h2>
          <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">Resumen Financiero</p>
        </div>
        <button 
          onClick={onUpdateUser}
          className="size-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-slate-500 hover:text-primary"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* TARJETA PRINCIPAL DE SALDO */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-800 to-bg-dark border border-white/10 p-6 shadow-2xl md:col-span-2 lg:col-span-2">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between h-full">
              <div className="mb-6 md:mb-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Saldo Disponible</p>
                  <div className="flex flex-col">
                    <h2 className="text-4xl md:text-5xl font-black text-primary tracking-tight">
                      RD$ {balanceInPesos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                    <p className="text-xs font-bold text-white mt-1 bg-white/10 self-start px-2 py-0.5 rounded">
                      ≈ {userData.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                    </p>
                  </div>
              </div>
              <div className="flex gap-3 md:flex-col md:w-40">
                <button 
                  onClick={() => setDepositModalOpen(true)}
                  className="flex-1 bg-primary text-bg-dark px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 hover:bg-white"
                >
                  <span className="material-symbols-outlined text-sm">add_card</span>
                  Depositar
                </button>
                <button 
                  onClick={() => setWithdrawModalOpen(true)}
                  className="flex-1 bg-white/5 text-white border border-white/10 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-white/10 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Retirar
                </button>
              </div>
            </div>
            {/* Background Gradients */}
            <div className="absolute -top-10 -right-10 size-40 bg-primary/10 rounded-full blur-3xl"></div>
          </div>

          {/* ESTADÍSTICAS RÁPIDAS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-3 h-full md:col-span-2 lg:col-span-1">
            <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Capital Activo</p>
              <p className="text-lg font-black text-white">RD$ {investedInPesos.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Ganancia Contratos</p>
              <p className="text-lg font-black text-primary">RD$ {contractsEarningsInPesos.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col justify-center col-span-2 md:col-span-1 lg:col-span-1">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Ganancia Ref.</p>
              <p className="text-lg font-black text-emerald-400">RD$ {earningsInPesos.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
          </div>
      </div>

      {/* LIVE STATS (MERCADO RD$) */}
      <div className="relative overflow-hidden glass-card rounded-[2rem] p-6 border-primary/20 bg-gradient-to-br from-primary/5 via-bg-dark to-bg-dark shadow-lg">
        <div className="absolute top-0 right-0 p-4 opacity-30">
            <span className="material-symbols-outlined text-[80px] text-white/5 rotate-12">monitoring</span>
        </div>
        
        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-primary/20 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Mercado en Vivo</span>
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Global</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Fondo Gestionado</p>
              <p className="text-xl font-black text-white italic">RD$ {marketStats.fund.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Usuarios Activos</p>
              <p className="text-xl font-black text-primary italic">{(settings.activeInvestors || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Pagos Totales</p>
              <p className="text-xl font-black text-emerald-400 italic">RD$ {marketStats.paid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Rendimiento Hoy</p>
              <p className={`text-xl font-black ${marketStats.yield >= 3.0 ? 'text-primary' : marketStats.yield < 2.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  +{marketStats.yield.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE INFORMATIVO DE RECARGA SIN CRYPTO (ANTES DEL PORTAFOLIO) */}
      <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-indigo-500/20 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between relative overflow-hidden">
         <div className="flex items-center gap-4 relative z-10">
            <div className="size-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
               <span className="material-symbols-outlined">currency_exchange</span>
            </div>
            <div>
               <h4 className="text-sm font-black text-white uppercase italic">¿No usas Criptomonedas?</h4>
               <p className="text-[10px] text-slate-400">
                  Puedes recargar vía <span className="text-white font-bold">Transferencia Bancaria (Pesos)</span>. 
                  Nosotros nos encargamos del cambio a USDT automáticamente.
               </p>
            </div>
         </div>
         <button 
           onClick={() => setDepositModalOpen(true)}
           className="px-5 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase text-indigo-300 hover:bg-indigo-500 hover:text-white transition-all shrink-0 z-10"
         >
           Ver Datos Bancarios
         </button>
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -translate-y-10 translate-x-10"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PORTAFOLIO DETALLADO */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest px-1">Mi Portafolio</h3>
            
            {!userData.contracts || userData.contracts.length === 0 ? (
               <div className="text-center py-8 glass-card rounded-2xl border-dashed border-white/10">
                  <span className="material-symbols-outlined text-slate-700 text-3xl mb-2">assignment_add</span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">No tienes contratos activos</p>
               </div>
            ) : (
               <div className="space-y-3">
                  {userData.contracts.map((contract, i) => {
                     const isExpanded = expandedContractId === contract.id;
                     const startDate = new Date(contract.startDate);
                     const endDate = new Date(contract.endDate || getContractDates(contract.startDate, contract.totalDays).end);
                     const now = new Date();
                     
                     // Cálculo de días transcurridos
                     const diffTime = Math.max(0, now.getTime() - startDate.getTime());
                     const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                     const totalDays = contract.totalDays || 30;
                     const daysLeft = Math.max(0, totalDays - daysPassed);
                     
                     // Tasa de cambio del contrato (o fallback a safeRate)
                     const exchangeRate = contract.amountFiat ? (contract.amountFiat / contract.amount) : safeRate;
                     
                     // Ganancia acumulada hasta hoy
                     const accruedProfitUSDT = contract.amount * (contract.dailyRate / 100) * Math.min(daysPassed, totalDays);
                     const totalProfitUSDT = contract.amount * (contract.dailyRate / 100) * totalDays;
                     
                     // Lógica de pago según plan
                     let nextPaymentDateObj = new Date(endDate);
                     let amountToPayUSDT = 0;
                     let paymentRule = "";
                     
                     if (contract.planId === 'plan90') {
                         paymentRule = "Retiro de ganancias cada 30 días.";
                         const periodsPassed = Math.floor(daysPassed / 30);
                         if (periodsPassed >= (totalDays / 30)) {
                             nextPaymentDateObj = endDate;
                             amountToPayUSDT = contract.amount * (contract.dailyRate / 100) * 30;
                         } else {
                             nextPaymentDateObj = new Date(startDate);
                             nextPaymentDateObj.setDate(startDate.getDate() + (periodsPassed + 1) * 30);
                             amountToPayUSDT = contract.amount * (contract.dailyRate / 100) * 30;
                         }
                     } else if (contract.planId === 'plan60') {
                         paymentRule = "50% al duplicar, resto al final.";
                         const daysToDuplicate = Math.ceil(100 / contract.dailyRate);
                         const duplicateDate = new Date(startDate);
                         duplicateDate.setDate(startDate.getDate() + daysToDuplicate);
                         
                         const totalAtEnd = contract.amount + totalProfitUSDT;
                         
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
                         amountToPayUSDT = contract.amount + totalProfitUSDT;
                     }
                     
                     const nextPaymentDateStr = nextPaymentDateObj.toLocaleDateString();
                     const amountToPayFiat = amountToPayUSDT * exchangeRate;
                     const totalProfitFiat = totalProfitUSDT * exchangeRate;
                     const initialFiat = contract.amountFiat || (contract.amount * exchangeRate);
                     
                     return (
                      <div key={contract.id || i} className="glass-card rounded-2xl border border-white/5 relative overflow-hidden group hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setExpandedContractId(isExpanded ? null : contract.id)}>
                         <div className="p-5">
                             <div className="absolute top-0 right-0 bg-primary/20 px-3 py-1 rounded-bl-xl">
                                <span className="text-[9px] font-black text-primary uppercase">{daysLeft} días restantes</span>
                             </div>
                             
                             <div className="flex items-start gap-4 mb-4">
                                <div className="size-10 rounded-full bg-white/5 flex items-center justify-center text-2xl">
                                   {contract.planId === 'plan90' ? '💎' : contract.planId === 'plan60' ? '⚡' : '📅'}
                                </div>
                                <div>
                                   <h4 className="text-sm font-black text-white uppercase italic">{contract.name}</h4>
                                   <p className="text-[10px] text-slate-400 font-mono">Iniciado: {startDate.toLocaleDateString()}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                                <div>
                                   <p className="text-[8px] text-slate-500 font-black uppercase">Inversión Inicial</p>
                                   <p className="text-xs font-black text-white">
                                      RD$ {initialFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                   </p>
                                   <p className="text-[9px] text-slate-500">
                                      USDT {contract.amount.toLocaleString()}
                                   </p>
                                </div>
                                <div className="text-right">
                                   <p className="text-[8px] text-slate-500 font-black uppercase">Próximo Pago</p>
                                   <p className="text-xs font-black text-emerald-400">{nextPaymentDateStr}</p>
                                   <p className="text-[10px] font-bold text-white mt-0.5">RD$ {amountToPayFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                   <p className="text-[8px] text-slate-500">USDT {amountToPayUSDT.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                </div>
                             </div>
                             
                             <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div 
                                   className="h-full bg-primary" 
                                   style={{ width: `${Math.min(100, (daysPassed / totalDays) * 100)}%` }}
                                ></div>
                             </div>
                             <div className="flex justify-between items-center text-[9px]">
                                <span className="text-slate-500 font-black uppercase tracking-widest">Progreso</span>
                                <div className="text-right">
                                  <span className="text-primary font-black block">+RD$ {(accruedProfitUSDT * exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                  <span className="text-slate-500">USDT {accruedProfitUSDT.toFixed(2)}</span>
                                </div>
                             </div>
                             
                             <div className="mt-2 text-center">
                                <span className={`material-symbols-outlined text-slate-500 transition-transform ${isExpanded ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                             </div>
                         </div>
                         
                         {isExpanded && (
                            <div className="bg-primary/[0.02] border-t border-primary/10 p-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <h4 className="text-[9px] font-black text-primary uppercase tracking-widest">Detalles del Tiempo</h4>
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
                                      <span className="text-primary font-black">{daysPassed} / {totalDays}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-[9px] font-black text-primary uppercase tracking-widest">Rendimiento</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Tasa Diaria:</span>
                                      <span className="text-primary font-black">{contract.dailyRate}%</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-slate-500">Ganancia Diaria:</span>
                                      <div className="text-right">
                                        <span className="text-white font-bold block">RD$ {((contract.amount * (contract.dailyRate/100)) * exchangeRate).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                        <span className="text-slate-500 text-[8px]">USDT {(contract.amount * (contract.dailyRate/100)).toFixed(2)}</span>
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
                              </div>
                              
                              <div className="mt-4 space-y-3">
                                  <h4 className="text-[9px] font-black text-primary uppercase tracking-widest">Regla de Pago</h4>
                                  <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                                    <p className="text-[10px] text-primary-200 leading-relaxed italic text-white">
                                      "{paymentRule}"
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                     <span className={`size-2 rounded-full ${contract.status === 'ACTIVE' ? 'bg-primary animate-pulse' : 'bg-slate-500'}`}></span>
                                     <span className="text-[8px] font-black text-white uppercase tracking-widest">Estado: {contract.status}</span>
                                  </div>
                              </div>
                            </div>
                         )}
                      </div>
                     );
                  })}
               </div>
            )}
          </div>

          {/* HISTORIAL DE TRANSACCIONES */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest px-1">Historial de Operaciones</h3>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-6 glass-card rounded-2xl border-dashed border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Sin movimientos registrados</p>
                </div>
              ) : (
                recentTransactions.map(t => {
                  let formattedDate = t.date;
                  try {
                    if (t.date.includes('T')) {
                      formattedDate = new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                  } catch (e) {}

                  return (
                    <div key={t.id} className="glass-card p-4 rounded-2xl flex justify-between items-center border border-white/5 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                          t.type === 'DEPOSITO' ? 'bg-emerald-500/10 text-emerald-500' : 
                          t.type === 'RETIRO' ? 'bg-red-500/10 text-red-500' : 
                          'bg-primary/10 text-primary'
                        }`}>
                          <span className="material-symbols-outlined text-sm">
                            {t.type === 'DEPOSITO' ? 'add_circle' : t.type === 'RETIRO' ? 'remove_circle' : 'group_add'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase">{t.title}</p>
                          <p className="text-[9px] text-slate-500 uppercase font-mono">{formattedDate} • {t.method}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {t.amountFiat ? (
                          <>
                            <p className="text-sm font-black text-white">
                              {t.type === 'RETIRO' ? '-' : '+'}RD$ {t.amountFiat.toLocaleString(undefined, {maximumFractionDigits: 2})}
                            </p>
                            <p className="text-[8px] text-slate-500 font-bold">({t.amount.toFixed(2)} USDT)</p>
                          </>
                        ) : (
                          <>
                             <p className="text-sm font-black text-white">
                               {t.type === 'RETIRO' ? '-' : '+'}USDT {t.amount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                             </p>
                          </>
                        )}
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase mt-1 inline-block ${t.status === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-500' : t.status === 'APROBADO' || t.status === 'COMPLETADO' || t.status === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
      </div>

            {/* MODAL DEPÓSITO */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <div className="glass-card w-full max-w-sm p-0 rounded-[2rem] border border-primary/30 overflow-hidden my-auto relative shadow-2xl">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 p-2 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="p-6 pb-0 text-center">
              <h3 className="text-xl font-black text-white uppercase italic">Recargar Cuenta</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                Tasa Actual: 1 USDT = RD$ {safeRate.toFixed(2)}
              </p>
            </div>

            <div className="flex p-4 gap-2">
              <button
                onClick={() => {
                  setDepositMethod('BANK');
                  setDepositAmount('');
                  setDepositHash('');
                  setProofFile(null);
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  depositMethod === 'BANK'
                    ? 'bg-primary border-primary text-bg-dark'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                Banco / Intercambio
              </button>

              <button
                onClick={() => {
                  setDepositMethod('CRYPTO');
                  setDepositAmount('');
                  setDepositHash('');
                  setProofFile(null);
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  depositMethod === 'CRYPTO'
                    ? 'bg-primary border-primary text-bg-dark'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                USDT (Crypto)
              </button>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {depositMethod === 'BANK' ? (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                    <p className="text-[9px] text-blue-300 leading-snug text-center">
                      <span className="font-black uppercase block mb-1">Recarga vía Intermediario</span>
                      Realiza la transferencia a esta cuenta. Tu líder o administrador validará el pago y te acreditará el equivalente en USDT.
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Cuenta Destino</p>
                    <div className="text-xs font-bold text-white space-y-1">
                      <p className="flex justify-between">
                        <span className="text-slate-500">Banco:</span>
                        <span>{settings.bankName}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Cuenta:</span>
                        <span className="font-mono text-primary tracking-wider">{settings.bankAccount}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Titular:</span>
                        <span>{settings.bankBeneficiary}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500">Cédula:</span>
                        <span className="font-mono">{settings.bankCedula || 'No disponible'}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Monto a Enviar (Pesos RD$)
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Ej: 6000"
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-black text-lg outline-none focus:border-primary mt-1"
                    />
                    {depositAmount && !isNaN(parseFloat(depositAmount)) && (
                      <div className="mt-2 text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          Se acreditará en tu cuenta
                        </p>
                        <p className="text-sm font-black text-emerald-400">
                          ≈ {(parseFloat(depositAmount) / safeRate).toFixed(2)} USDT
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    <p className="text-[9px] text-emerald-400 leading-snug text-center">
                      <span className="font-black uppercase block mb-1">Recarga Automática</span>
                      El saldo se acredita automáticamente tras 3 confirmaciones de red (~3 min).
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">
                      Wallet Address ({settings.cryptoNetwork})
                    </p>
                    <div className="flex gap-2">
                      <p className="text-[10px] font-mono text-white break-all">{settings.cryptoWallet}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(settings.cryptoWallet)}
                        className="text-primary"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Monto enviado (USDT)
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-black text-lg outline-none focus:border-primary mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Hash / TXID
                    </label>
                    <input
                      type="text"
                      value={depositHash}
                      onChange={(e) => setDepositHash(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs outline-none focus:border-primary mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  Comprobante de Pago
                </label>
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all ${
                    isUploading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {proofPreview ? (
                    <img
                      src={proofPreview}
                      alt="Comprobante"
                      className="w-full h-32 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-600">cloud_upload</span>
                      <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                        Toca para subir imagen
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              <button
                onClick={handleDeposit}
                disabled={isUploading}
                className="w-full py-4 bg-primary text-bg-dark font-black text-sm uppercase rounded-xl shadow-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? 'Procesando...' : 'Confirmar Envío'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RETIRO */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
          <div className="glass-card w-full max-w-sm p-0 rounded-[2rem] border border-red-500/30 overflow-hidden my-auto relative shadow-2xl">
            <button
              onClick={() => setWithdrawModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 p-2 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="p-6 pb-0 text-center">
              <h3 className="text-xl font-black text-white uppercase italic">Solicitar Retiro</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                Disponible: {userData.available.toFixed(2)} USDT
              </p>
            </div>

            <div className="flex p-4 gap-2">
              <button
                onClick={() => {
                  setWithdrawMethod('BANK');
                  setWithdrawAmount('');
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  withdrawMethod === 'BANK'
                    ? 'bg-white text-bg-dark border-white'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                Cuenta Bancaria
              </button>

              <button
                onClick={() => {
                  setWithdrawMethod('CRYPTO');
                  setWithdrawAmount('');
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  withdrawMethod === 'CRYPTO'
                    ? 'bg-white text-bg-dark border-white'
                    : 'bg-transparent border-white/10 text-slate-400'
                }`}
              >
                USDT Crypto
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
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-black text-lg outline-none focus:border-red-500 mt-1"
                />
                {withdrawAmount && !isNaN(parseFloat(withdrawAmount)) && withdrawMethod === 'BANK' && (
                  <div className="mt-2 text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Recibirás aprox.</p>
                    <p className="text-sm font-black text-white">
                      RD$ {(parseFloat(withdrawAmount) * (safeRate - 2)).toFixed(2)}
                    </p>
                    <p className="text-[8px] text-slate-500 italic">
                      Tasa de venta: {(safeRate - 2).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {withdrawMethod === 'BANK' ? (
                <div className="space-y-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-slate-400 leading-snug text-center">
                      Ingresa los datos de tu cuenta bancaria donde deseas recibir los fondos.
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Nombre del Banco"
                    value={withdrawBankInfo.bankName}
                    onChange={(e) =>
                      setWithdrawBankInfo({ ...withdrawBankInfo, bankName: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />

                  <input
                    type="text"
                    placeholder="Número de Cuenta"
                    value={withdrawBankInfo.accountNumber}
                    onChange={(e) =>
                      setWithdrawBankInfo({ ...withdrawBankInfo, accountNumber: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />

                  <input
                    type="text"
                    placeholder="Nombre del Beneficiario"
                    value={withdrawBankInfo.beneficiary}
                    onChange={(e) =>
                      setWithdrawBankInfo({ ...withdrawBankInfo, beneficiary: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />

                  <input
                    type="text"
                    placeholder="Cédula / ID (Opcional)"
                    value={withdrawBankInfo.cedula}
                    onChange={(e) =>
                      setWithdrawBankInfo({ ...withdrawBankInfo, cedula: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-white"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-slate-400 leading-snug text-center">
                      Asegúrate de que la dirección sea correcta y corresponda a la red <strong>{settings.cryptoNetwork}</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Tu Dirección de Billetera
                    </label>
                    <input
                      type="text"
                      value={withdrawWallet}
                      onChange={(e) => setWithdrawWallet(e.target.value)}
                      placeholder="Ej: T..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs outline-none focus:border-white mt-1"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={isUploading}
                className="w-full py-4 bg-primary text-bg-dark font-black text-sm uppercase rounded-xl shadow-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? 'Procesando...' : 'Solicitar Retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;