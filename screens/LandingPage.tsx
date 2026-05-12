
import React, { useState, useEffect } from 'react';
import { getAdminSettings } from '../store';

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
      { label: 'Regla de retiro', value: 'Solo al finalizar' },
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
      { label: 'Retiro parcial', value: 'A los 30 días' },
    ],
    note: 'A los 30 días puedes retirar las ganancias acumuladas. El capital permanece bloqueado hasta el día 90.'
  },
];

const generalSteps = [
  {
    title: 'Registro de cuenta',
    desc: 'El usuario hace clic en “Registrarme” desde la página de planes o desde el botón “Entrar”. En la pantalla de registro completa su nombre, correo y contraseña. Tras enviar el formulario, recibe un correo para confirmar la cuenta.'
  },
  {
    title: 'Acceso al panel',
    desc: 'Una vez confirmada la cuenta, el usuario entra con su correo y contraseña. Dentro del panel ve su saldo actual, contratos activos, historial de movimientos y accesos rápidos para abrir nuevos contratos.'
  },
  {
    title: 'Elección del plan',
    desc: 'Desde el panel o la página de planes, el usuario elige si quiere contratar un plan de 30, 60 o 90 días. Cada plan tiene una tasa diaria distinta: 1.5 %, 2.0 % y 2.5 % respectivamente.'
  },
  {
    title: 'Creación del contrato',
    desc: 'Al escoger un plan, se abre un formulario donde define cuánto va a depositar. El sistema muestra un resumen con: monto a invertir, tasa diaria, duración y una proyección de la ganancia total. Al confirmar, se crea el contrato en su cuenta.'
  },
  {
    title: 'Ganancias diarias',
    desc: 'Cada día, Tuarbitro Smart Invest calcula la ganancia del contrato según la tasa diaria del plan. Esa ganancia se suma al saldo del usuario y al total de ganancias del contrato, que puede verse en el dashboard.'
  },
  {
    title: 'Retiros y reinversiones',
    desc: 'El usuario puede solicitar retiros de su saldo disponible según las reglas del sistema, o usar ese saldo para abrir nuevos contratos en cualquiera de los planes disponibles.'
  },
  {
    title: 'Cierre del contrato',
    desc: 'Cuando se completa el plazo de 30, 60 o 90 días, el contrato pasa a estado “Finalizado” y el usuario puede ver un resumen de su rendimiento: capital inicial, ganancias totales, retiros realizados y saldo reinvertido.'
  }
];

interface LandingPageProps {
  onStart: () => void;
  onRegister: () => void;
  onLogin: () => void;
  referrerId: string | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onRegister, onLogin, referrerId }) => {
  const [settings, setSettings] = useState(getAdminSettings());
  const [stats, setStats] = useState({ fund: 0, paid: 0, yield: 0, activeInvestors: 0 });
  const [openPlanId, setOpenPlanId] = useState<string | null>('plan90');
  const [amountRD, setAmountRD] = useState<number>(0);
  const [estimatedProfitRD, setEstimatedProfitRD] = useState<number>(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl || null);
  
  // Estado para el desplegable de referidos y guía general
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  const [showGeneralDetails, setShowGeneralDetails] = useState(false);
  const [showProfitDetails, setShowProfitDetails] = useState(false);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const newSettings = getAdminSettings();
      setSettings(newSettings);
      setLogoUrl(newSettings.logoUrl || null);
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  // LÓGICA AVANZADA DE LIVE STATS
  useEffect(() => {
    const calculateMarketStats = () => {
        const now = new Date();
        const day = now.getDay(); // 0 Domingo, 1 Lunes ... 5 Viernes, 6 Sábado
        const hour = now.getHours();
        
        // Semilla base diaria para montos grandes
        const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        
        // 1. Lógica del Rendimiento (Yield)
        // Rango deseado: 2.6% a 3.9%
        let calculatedYield = 3.25; // Valor medio base
        
        // Variación horaria (Ruido suave basado en la hora para que cambie durante el día)
        // Usamos Math.sin para que suba y baje suavemente durante las 24h
        const hourlyFluctuation = Math.sin(hour) * 0.3; 

        if (day === 1) { 
            // LUNES: Tendencia ALCISTA (Sube mucho)
            // Rango objetivo aprox: 3.4% - 3.9%
            calculatedYield = 3.6 + (hourlyFluctuation * 0.3); // Menos fluctuación negativa
        } else if (day === 5) {
            // VIERNES: Tendencia BAJISTA (Baja un poco)
            // Rango objetivo aprox: 2.6% - 2.9%
            calculatedYield = 2.75 + (hourlyFluctuation * 0.15);
        } else {
            // RESTO DE DÍAS: Rango medio (2.9% - 3.5%)
            calculatedYield = 3.2 + hourlyFluctuation;
        }

        // Clamp estricto para asegurar límites 2.6 - 3.9
        if (calculatedYield > 3.9) calculatedYield = 3.9;
        if (calculatedYield < 2.6) calculatedYield = 2.6;

        // 2. Lógica del Fondo (Crece constantemente + variación diaria)
        const baseFund = 15420500;
        const dailyGrowth = (seed % 100) * 1500; // Crecimiento pseudo-aleatorio diario
        const currentFund = baseFund + dailyGrowth + (hour * 250); // Crece un poco cada hora

        setStats({
            fund: currentFund,
            paid: 4280300 + (seed % 25000) + (hour * 100),
            yield: calculatedYield,
            activeInvestors: 2450 + (seed % 200)
        });
    };

    calculateMarketStats();
    
    // Actualizar cada hora si el usuario deja la página abierta
    const interval = setInterval(calculateMarketStats, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

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

  const handleStartAction = () => {
    if (referrerId) {
      onRegister();
    } else {
      alert("Tuarbitro Smart Invest es una comunidad exclusiva. Para registrarte, debes usar el enlace de invitación de un socio activo.");
    }
  };

  return (
    <div className="space-y-10 pb-20 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Hero Section */}
      <section className="px-6 text-center space-y-6 relative z-10 pt-6">
        {logoUrl && (
          <div className="size-32 mx-auto mb-6 bg-gradient-to-br from-white/10 to-transparent rounded-3xl p-0.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-bg-dark rounded-[22px]"></div>
             <img src={logoUrl} alt="Platform Logo" className="w-full h-full object-contain relative z-10 p-4 drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500" />
          </div>
        )}
        
        <div>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-[0.85] mb-2">
            Smart <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Invest</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-[280px] mx-auto">
            Plataforma de arbitraje financiero de alto rendimiento.
            <span className="text-primary block mt-1 font-bold">Acceso exclusivo por invitación.</span>
          </p>
        </div>

        {/* EXPLICACIÓN DE GANANCIAS Y LIVE STATS */}
        <div className="relative overflow-hidden glass-card rounded-[2.5rem] p-6 border-primary/30 bg-gradient-to-br from-primary/10 via-bg-dark to-bg-dark shadow-[0_20px_50px_rgba(45,212,191,0.15)] group hover:shadow-primary/30 transition-all duration-500 text-left mt-8 mb-8">
          <div className="absolute top-0 right-0 p-4 opacity-50">
             <span className="material-symbols-outlined text-[100px] text-white/5 rotate-12">monitoring</span>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-primary/20 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Live Stats</span>
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Mercado RD$</span>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Fondo Gestionado</p>
              <h2 className="text-4xl font-black text-white tracking-tighter italic">RD$ {stats.fund.toLocaleString()}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Pagado Total</p>
                <p className="text-lg font-black text-emerald-400">RD$ {stats.paid.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Usuarios Activos</p>
                <p className="text-lg font-black text-primary">{(settings.activeInvestors || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Rendimiento Hoy</p>
                <p className={`text-lg font-black ${stats.yield >= 3.0 ? 'text-primary' : stats.yield < 2.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    +{stats.yield.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div>
              <button 
                onClick={() => setShowProfitDetails(!showProfitDetails)}
                className="flex items-center justify-between w-full group"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  <h3 className="text-sm font-black text-white uppercase italic tracking-widest">¿De dónde salen las ganancias?</h3>
                </div>
                <span className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${showProfitDetails ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {showProfitDetails && (
                <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Generamos rendimientos diarios a través de <strong className="text-primary">arbitraje financiero de alta frecuencia</strong>. Nuestro sistema detecta y aprovecha las diferencias de precios en múltiples mercados globales de forma automatizada, asegurando ganancias consistentes sin depender de la dirección del mercado.
                  </p>
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-3">
                     <p className="text-[11px] text-slate-300 leading-snug">
                        <strong className="text-white block mb-1">1. Detección de Oportunidades:</strong> 
                        Monitoreamos constantemente diferentes exchanges y plataformas financieras buscando discrepancias de precios en el mismo activo (ej. USDT).
                     </p>
                     <p className="text-[11px] text-slate-300 leading-snug">
                        <strong className="text-white block mb-1">2. Ejecución Simultánea:</strong> 
                        Al encontrar una diferencia, compramos el activo donde está más barato y lo vendemos donde está más caro en fracciones de segundo.
                     </p>
                     <p className="text-[11px] text-slate-300 leading-snug">
                        <strong className="text-white block mb-1">3. Ganancia Libre de Riesgo Direccional:</strong> 
                        Como la compra y venta ocurren al mismo tiempo, la ganancia está garantizada por la diferencia de precio, sin importar si el mercado sube o baja mañana.
                     </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {referrerId === 'admin' ? (
          <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/40 p-3 px-6 rounded-2xl inline-block shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-pulse-soft">
             <div className="flex items-center gap-2 justify-center">
               <span className="material-symbols-outlined text-blue-400 text-lg">verified</span>
               <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Invitación VIP</p>
                  <p className="text-[8px] font-bold text-blue-200 uppercase tracking-wide mt-0.5">Acceso Administrador</p>
               </div>
             </div>
          </div>
        ) : referrerId ? (
          <div className="bg-primary/10 border border-primary/20 p-3 px-6 rounded-2xl inline-block">
             <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-pulse"></span>
                Código Validado
             </p>
          </div>
        ) : (
           <div className="h-6"></div>
        )}
      </section>

      {/* GUÍA DE INICIO DESPLEGABLE CON INFO DE PAGOS */}
      <section className="px-6 relative z-10">
        <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
             <button 
               onClick={() => setShowGeneralDetails(!showGeneralDetails)}
               className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
             >
                <div className="flex items-center gap-3">
                   <div className="size-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <span className="material-symbols-outlined">menu_book</span>
                   </div>
                   <div className="text-left">
                      <p className="text-sm font-black text-white uppercase italic">Cómo funciona</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Guía de la plataforma</p>
                   </div>
                </div>
                <span className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${showGeneralDetails ? 'rotate-180 text-indigo-400' : ''}`}>expand_more</span>
             </button>

             <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showGeneralDetails ? 'max-h-[1600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 pt-0 border-t border-white/5 space-y-6">
                   
                   {/* NUEVO BOX: EXPLICACIÓN DE RECARGA SIN CRYPTO */}
                   <div className="mt-6 bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-20">
                          <span className="material-symbols-outlined text-6xl text-white rotate-12">savings</span>
                      </div>
                      
                      <div className="relative z-10">
                          <h4 className="text-sm font-black text-white uppercase italic mb-2 flex items-center gap-2">
                             <span className="material-symbols-outlined text-primary">verified</span>
                             Sin Complicaciones
                          </h4>
                          <p className="text-xs text-slate-200 font-medium leading-relaxed mb-4">
                             ¿No sabes usar criptomonedas? <br/>
                             <span className="text-primary font-bold">¡No te preocupes!</span>
                          </p>
                          
                          <div className="space-y-3">
                             <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                <p className="text-[10px] text-indigo-200 font-black uppercase mb-1">Opción 1: Vía Banco (Pesos)</p>
                                <p className="text-[10px] text-slate-400 leading-snug">
                                   Simplemente transfiere en <strong>Pesos (RD$)</strong> a la cuenta oficial. Tu líder o la plataforma gestionará el cambio a USDT por ti y te acreditará el saldo.
                                </p>
                             </div>
                             <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                                <p className="text-[10px] text-emerald-200 font-black uppercase mb-1">Opción 2: Vía Blockchain</p>
                                <p className="text-[10px] text-slate-400 leading-snug">
                                   Si ya tienes wallet, envía USDT directo. El sistema lo detecta automáticamente en ~3 minutos.
                                </p>
                             </div>
                          </div>
                      </div>
                   </div>

                   <div className="mt-4">
                      <p className="text-xs text-slate-300 font-medium leading-relaxed mb-6">
                        Estos son los pasos reales que sigue cualquier usuario dentro de Tuarbitro Smart Invest: desde el registro hasta la compra del paquete y la visualización de sus ganancias diarias.
                      </p>
                      
                      <div className="space-y-5 relative">
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-white/10"></div>
                        {generalSteps.map((step, i) => (
                           <div key={i} className="flex gap-4 relative">
                              <div className="size-6 rounded-full bg-bg-dark border border-indigo-500/50 text-indigo-400 flex items-center justify-center text-[10px] font-black z-10 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                {i+1}
                              </div>
                              <div>
                                 <h4 className="text-xs font-bold text-white uppercase mb-1">{step.title}</h4>
                                 <p className="text-[10px] text-slate-400 leading-relaxed">{step.desc}</p>
                              </div>
                           </div>
                        ))}
                      </div>

                      <div className="mt-6 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-center">
                          <p className="text-xs font-bold text-indigo-300 uppercase mb-2">¿Listo para empezar?</p>
                          <p className="text-[10px] text-slate-400">Revisa los planes disponibles, calcula cuánto podrías ganar y luego crea tu cuenta para comenzar a invertir en Tuarbitro Smart Invest.</p>
                      </div>
                   </div>
                </div>
             </div>
        </div>
      </section>

      {/* Referral Info Section (DETALLADO PARA VISITANTES) */}
      <section className="px-6 space-y-4 pt-6">
        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter text-center">Plan de Referidos</h2>
        <div className="relative overflow-hidden rounded-[2.5rem] p-8 bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900 shadow-2xl shadow-indigo-500/30 border border-white/10">
           <div className="relative z-10 text-center">
              <span className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-[8px] font-black text-white uppercase tracking-[0.2em] mb-6 border border-white/20 backdrop-blur-md">Beneficio Partner</span>
              
              <div className="flex items-center justify-center gap-1 mb-2">
                 <h3 className="text-6xl font-black text-white tracking-tighter italic">10</h3>
                 <span className="text-3xl font-black text-indigo-200 italic">%</span>
              </div>
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest mb-8">Comisión por Depósito</p>
              
              <div className="grid grid-cols-1 gap-3 text-left">
                 <div className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                    <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">payments</span>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-indigo-200 uppercase tracking-wider">Pagos Inmediatos</p>
                       <p className="text-xs font-bold text-white">Al instante</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                    <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">lock_open</span>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-indigo-200 uppercase tracking-wider">Disponibilidad</p>
                       <p className="text-xs font-bold text-white">Retiro Inmediato</p>
                    </div>
                 </div>
              </div>
           </div>
           
           {/* Decorative elements */}
           <div className="absolute -top-20 -right-20 size-60 bg-blue-400/30 rounded-full blur-[60px]"></div>
           <div className="absolute -bottom-20 -left-20 size-60 bg-indigo-400/30 rounded-full blur-[60px]"></div>
        </div>

        {/* COMPONENTE DESPLEGABLE PUBLICO REFERIDOS */}
        <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden mt-4">
             <button 
               onClick={() => setShowReferralDetails(!showReferralDetails)}
               className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
             >
                <div className="flex items-center gap-3">
                   <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined">info</span>
                   </div>
                   <div className="text-left">
                      <p className="text-sm font-black text-white uppercase italic">¿Cómo Funciona?</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Detalles del sistema</p>
                   </div>
                </div>
                <span className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${showReferralDetails ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
             </button>

             <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showReferralDetails ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 pt-0 border-t border-white/5 space-y-4">
                   <div className="mt-4 flex gap-3">
                      <span className="text-xl font-black text-primary">1.</span>
                      <div>
                         <h4 className="text-xs font-bold text-white uppercase">Copia tu Enlace</h4>
                         <p className="text-[10px] text-slate-400 leading-snug">Una vez registrado, tendrás un enlace único en tu panel.</p>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <span className="text-xl font-black text-primary">2.</span>
                      <div>
                         <h4 className="text-xs font-bold text-white uppercase">Ellos Invierten</h4>
                         <p className="text-[10px] text-slate-400 leading-snug">Cuando tu referido activa un Plan (30, 60 o 90 días).</p>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <span className="text-xl font-black text-primary">3.</span>
                      <div>
                         <h4 className="text-xs font-bold text-white uppercase">Ganas el 10%</h4>
                         <p className="text-[10px] text-slate-400 leading-snug">Recibes inmediatamente el 10% del monto invertido en tu saldo disponible.</p>
                      </div>
                   </div>
                   <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
                      <p className="text-[9px] font-bold text-red-400 uppercase">Requisito: Debes tener una inversión activa.</p>
                   </div>
                </div>
             </div>
        </div>
      </section>

      {/* Planes Interactivos */}
      <section className="px-6 space-y-6">
        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter text-center">Calculadora de Ganancias</h2>
        
        <div className="space-y-4">
          {plans.map((plan) => {
            const isOpen = openPlanId === plan.id;
            return (
              <div 
                key={plan.id}
                className={`glass-card rounded-[1.8rem] overflow-hidden transition-all duration-300 border ${isOpen ? 'border-primary shadow-[0_0_40px_rgba(45,212,191,0.1)] bg-white/5' : 'border-white/5'}`}
              >
                <div 
                  onClick={() => togglePlan(plan.id)}
                  className="p-6 cursor-pointer relative"
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-bl from-primary to-emerald-500 text-bg-dark text-[8px] font-black uppercase px-4 py-1.5 rounded-bl-2xl shadow-lg">
                      Más Elegido
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`size-14 rounded-full flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-primary text-bg-dark shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500'}`}>
                        <span className="material-symbols-outlined text-3xl">{plan.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{plan.name}</h3>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded">{plan.dailyRate} diario</span>
                           <span className="text-[10px] text-slate-500 font-bold uppercase">{plan.days} Días</span>
                        </div>
                      </div>
                    </div>
                    <div className={`size-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-white text-bg-dark rotate-180' : 'text-slate-500'}`}>
                        <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
                    </div>
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 pb-6 pt-0">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6"></div>
                    
                    <div className="space-y-3 mb-6">
                      {plan.details.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-white/5 last:border-0 last:pb-0">
                          <span className="text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                          <span className={`font-black text-sm ${item.label.includes('Ganancia') ? 'text-emerald-400' : 'text-white'}`}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-bg-dark/60 p-5 rounded-2xl border border-white/5 space-y-4 shadow-inner">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Simular Inversión (RD$)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">RD$</span>
                            <input 
                            type="number" 
                            value={amountRD || ''}
                            onChange={(e) => setAmountRD(Number(e.target.value))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white font-black text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-slate-700" 
                            placeholder={`${plan.min.toLocaleString()}`} 
                            />
                        </div>
                      </div>

                      {amountRD > 0 && (
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary/20 to-emerald-500/10 rounded-xl border border-primary/20">
                           <span className="text-[10px] text-primary font-black uppercase tracking-wider">Retorno Total</span>
                           <span className="text-base font-black text-white">RD$ {estimatedProfitRD.toLocaleString()}</span>
                        </div>
                      )}

                      <button 
                        onClick={handleStartAction}
                        className="w-full py-4 bg-primary text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 active:scale-95 hover:bg-primary/90 transition-all"
                      >
                        {referrerId ? 'Elegir este Plan' : 'Solicitar Acceso'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="glass-card p-8 rounded-[3rem] bg-gradient-to-br from-primary/10 to-transparent border-primary/20 text-center space-y-6 relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Únete a la <br /> Élite</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">La red de inversión #1 del Mundo</p>
            <button 
                onClick={handleStartAction}
                className="w-full py-5 bg-white text-bg-dark font-black text-sm uppercase tracking-widest rounded-2xl active:scale-95 transition-all hover:bg-slate-200 shadow-xl"
            >
                Abrir mi cuenta
            </button>
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-bg-dark/50 to-transparent pointer-events-none"></div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
