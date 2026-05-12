
import React, { useState, useEffect } from 'react';
import { UserData, getAdminSettings, AdminSettings, ReferralTx } from '../store';
import { supabase } from '../supabase';

const plans = [
  { 
    id: 'plan30', 
    name: 'Plan 30 Días', 
    dailyRate: '1.5%',
    rateVal: 1.5, 
    min: 1000, 
    days: 30, 
    icon: 'calendar_month', 
    details: [
      { label: 'Duración', value: '30 días' },
      { label: 'Inversión mínima', value: 'RD$ 1,000' },
      { label: 'Tasa diaria', value: '1.5%' },
      { label: 'Ganancia total', value: '45%' },
      { label: 'Retiros', value: 'Al finalizar plazo' },
    ],
    note: 'El capital y las ganancias estarán disponibles para retiro únicamente al completar los 30 días.'
  },
  { 
    id: 'plan60', 
    name: 'Plan 60 Días', 
    dailyRate: '2.0%', 
    rateVal: 2.0,
    min: 3000, 
    days: 60, 
    icon: 'update', 
    details: [
      { label: 'Duración', value: '60 días' },
      { label: 'Inversión mínima', value: 'RD$ 3,000' },
      { label: 'Tasa diaria', value: '2.0%' },
      { label: 'Ganancia total', value: '120%' },
      { label: 'Retiro parcial', value: '50% al doblar' },
    ],
    note: 'Cuando tu inversión se duplique (200%), podrás retirar hasta el 50% del total. El resto continúa hasta el día 60.'
  },
  { 
    id: 'plan90', 
    name: 'Plan 90 Días', 
    dailyRate: '2.5%', 
    rateVal: 2.5,
    min: 5000, 
    days: 90, 
    icon: 'diamond', 
    popular: true,
    details: [
      { label: 'Duración', value: '90 días' },
      { label: 'Inversión mínima', value: 'RD$ 5,000' },
      { label: 'Tasa diaria', value: '2.5%' },
      { label: 'Ganancia total', value: '225%' },
      { label: 'Ganancias', value: 'Retiro mensual (30 días)' },
    ],
    note: 'A los 30 días puedes retirar las ganancias acumuladas. El capital permanece bloqueado hasta el día 90.'
  },
];

interface PlansScreenProps {
  userData: UserData | null;
  onUpdateUser: () => void;
}

const PlansScreen: React.FC<PlansScreenProps> = ({ userData, onUpdateUser }) => {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [amountRD, setAmountRD] = useState<number>(0);
  const [estimatedProfitRD, setEstimatedProfitRD] = useState<number>(0);
  const [settings, setSettings] = useState<AdminSettings>(getAdminSettings());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (openPlanId && amountRD > 0) {
      const plan = plans.find(p => p.id === openPlanId);
      if (plan) {
        setEstimatedProfitRD(amountRD * (plan.rateVal / 100) * plan.days);
      }
    } else {
      setEstimatedProfitRD(0);
    }
  }, [amountRD, openPlanId]);

  const togglePlan = (id: string) => {
    if (openPlanId === id) {
      setOpenPlanId(null);
    } else {
      setOpenPlanId(id);
      setAmountRD(0);
    }
  };

  const availableInPesos = userData ? userData.available * settings.exchangeRate : 0;

  const handleInvest = async (planId: string) => {
    if (!userData) return;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (amountRD < plan.min) {
      alert(`El monto mínimo es RD$ ${plan.min.toLocaleString()}`);
      return;
    }

    const amountInUSDT = amountRD / settings.exchangeRate;

    if (userData.available < amountInUSDT) {
      alert(`Saldo insuficiente. Tienes RD$ ${availableInPesos.toLocaleString()} disponibles.`);
      return;
    }

    setLoading(true);

    try {
        if (userData.referredBy && userData.referredBy !== 'admin') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            let query = supabase.from('profiles').select('*');
            
            if (uuidRegex.test(userData.referredBy)) {
                query = query.eq('id', userData.referredBy);
            } else {
                query = query.eq('name', userData.referredBy.trim());
            }

            const { data: sponsor } = await query.single();
            
            if (sponsor) {
                const commission = amountInUSDT * 0.10; // 10%
                const newAvailable = (sponsor.available || 0) + commission;
                const newEarned = (sponsor.referrals_earned || 0) + commission;

                const newHistoryItem: ReferralTx = {
                    id: Math.random().toString(36).substr(2, 6).toUpperCase(),
                    fromUser: userData.name,
                    amount: commission,
                    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                    status: 'PAGADO'
                };

                const currentHistory = sponsor.referral_history || [];
                const updatedHistory = [newHistoryItem, ...currentHistory];

                const { error: updateError } = await supabase.from('profiles').update({
                    available: newAvailable,
                    referrals_earned: newEarned,
                    referral_history: updatedHistory
                }).eq('id', sponsor.id);

                if (updateError) {
                    console.error("ERROR CRÍTICO: No se pudo actualizar el saldo del patrocinador:", updateError);
                    alert("Error al procesar comisión: " + updateError.message);
                    throw updateError;
                }
                
                console.log("Comisión aplicada con éxito a:", sponsor.name, "Monto:", commission);
            }
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.days);

        const { error: contractError } = await supabase
          .from('contracts')
          .insert({
            user_id: userData.id,
            plan_id: plan.id,
            plan_name: plan.name,
            amount: amountInUSDT,
            amount_fiat: amountRD,
            daily_rate: plan.rateVal,
            total_days: plan.days,
            start_date: new Date().toISOString(),
            end_date: endDate.toISOString(),
            status: 'ACTIVE'
          });

        if (contractError) throw contractError;

        const newBalanceAvailable = userData.available - amountInUSDT;
        const newBalanceLocked = userData.locked + amountInUSDT;

        const { error: userUpdateError } = await supabase
            .from('profiles')
            .update({
                available: newBalanceAvailable,
                locked: newBalanceLocked
            })
            .eq('id', userData.id);

        if (userUpdateError) throw userUpdateError;

        alert(`¡Contrato activado! Inversión guardada correctamente.`);
        setAmountRD(0);
        setOpenPlanId(null);
        onUpdateUser();

    } catch (error: any) {
        console.error("Error al invertir:", error);
        if (error.code === '42501' || (error.message && error.message.includes('permission denied'))) {
            alert("Error de Permisos (403): No tienes permiso para crear contratos. Esto suele deberse a que las políticas RLS de Supabase no están configuradas correctamente para la tabla 'contracts'.");
        } else {
            alert("Error: " + (error.message || "Ocurrió un error inesperado al procesar la inversión."));
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="px-6 py-4 space-y-6 pb-24 md:pb-6">
      <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Planes de Inversión</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isOpen = openPlanId === plan.id;
          return (
            <div 
              key={plan.id}
              className={`glass-card rounded-[1.5rem] overflow-hidden transition-all duration-300 border ${isOpen ? 'border-primary shadow-[0_0_30px_rgba(45,212,191,0.15)] bg-white/5' : 'border-white/5 hover:border-white/20'}`}
            >
              {/* HEADER CON CLICK: Solo esta parte activa/desactiva el acordeón */}
              <div onClick={() => togglePlan(plan.id)} className="p-5 cursor-pointer relative flex flex-col justify-between select-none">
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-bg-dark text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl">Popular</div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`size-12 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-primary text-bg-dark' : 'bg-white/5 text-slate-400'}`}>
                      <span className="material-symbols-outlined text-2xl">{plan.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase italic">{plan.name}</h3>
                      <p className="text-xs font-bold text-primary">{plan.dailyRate} diario</p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                </div>
              </div>
              
              {/* CONTENIDO (CALCULADORA): Stop Propagation para evitar cierres accidentales al escribir */}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
                onClick={(e) => e.stopPropagation()} 
              >
                  <div className="px-5 pb-5 pt-0 border-t border-white/5">
                      <div className="space-y-3 py-4">
                          {/* NOTA IMPORTANTE DE RETIRO */}
                          <div className="bg-white/5 border border-primary/20 p-3 rounded-xl mb-4">
                              <p className="text-[10px] font-bold text-slate-300 leading-snug">
                                  <span className="text-primary uppercase font-black mr-1">Regla:</span>
                                  {plan.note}
                              </p>
                          </div>

                          {plan.details.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0">
                              <span className="text-slate-500 font-bold uppercase tracking-wide">{item.label}</span>
                              <span className={`font-black ${item.label.includes('Ganancia') || item.label.includes('Tasa') ? 'text-primary' : 'text-white'}`}>{item.value}</span>
                          </div>
                          ))}
                      </div>

                      {/* CALCULADORA DE INGRESOS */}
                      <div className="bg-bg-dark/50 p-4 rounded-xl border border-white/5 space-y-4 shadow-inner">
                          <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Monto a Invertir (RD$)</label>
                          <input 
                              type="number" 
                              value={amountRD || ''}
                              onChange={(e) => setAmountRD(Number(e.target.value))}
                              className="w-full bg-bg-dark border border-white/10 rounded-xl py-3 px-4 text-white font-black text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" 
                              placeholder={`Mínimo: ${plan.min}`} 
                          />
                          <div className="text-right mt-1">
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Saldo Disp: RD$ {availableInPesos.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                          </div>
                          </div>

                          {/* RESULTADO DE CALCULADORA */}
                          {amountRD > 0 && (
                          <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-1">
                              <span className="text-[10px] text-primary font-black uppercase">Ganancia Total Est.</span>
                              <span className="text-sm font-black text-white">RD$ {estimatedProfitRD.toLocaleString()}</span>
                          </div>
                          )}

                          <button 
                          onClick={() => handleInvest(plan.id)}
                          disabled={loading}
                          className="w-full py-4 bg-primary text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 active:scale-95 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                          >
                          {loading ? 'Procesando...' : 'Crear Contrato Ahora'}
                          </button>
                      </div>
                  </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlansScreen;
