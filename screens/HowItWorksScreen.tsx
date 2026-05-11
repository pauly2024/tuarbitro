
import React, { useState } from 'react';

const steps = [
  {
    num: 1,
    title: 'Crea tu cuenta segura',
    desc: 'Te registras con tu nombre y correo y accedes a tu panel privado donde ves todos tus balances, contratos, retiros y referidos en tiempo real. Desde tu panel puedes actualizar tus datos, ver tu historial de movimientos y cerrar sesión en cualquier momento.'
  },
  {
    num: 2,
    title: 'Elige tu plan y calcula',
    desc: 'Revisas los planes de 30, 60 y 90 días, sus porcentajes diarios y mínimos de entrada, y utilizas la calculadora para ver cuánto generarías con diferentes montos. Así sabes antes de invertir cuánto podrías ganar y qué plan se adapta mejor a tu capital y objetivo.'
  },
  {
    num: 3,
    title: 'Deposita y crea contratos',
    desc: 'Agregas tus métodos de pago (wallet USDT solana o cuentas bancarias) y creas contratos desde tu saldo disponible con un par de clics. Cada contrato muestra el monto invertido, días transcurridos, porcentaje completado y ganancias acumuladas día a día.'
  },
  {
    num: 4,
    title: 'Retira tus ganancias',
    desc: 'Cuando tienes saldo disponible puedes solicitar retiros hacia tu cuenta bancaria o tu wallet USDT. El sistema registra cada solicitud y el administrador la procesa en el día configurado. Verás el estado de cada retiro (pendiente, completado o rechazado) y el historial queda guardado en tu cuenta.'
  },
  {
    num: 5,
    title: 'Gana más con referidos',
    desc: 'Obtienes tu enlace personal de referidos y lo compartes con amigos o clientes. Cada vez que uno de ellos invierte, recibes un 10% de comisión sobre su inversión. En la sección de referidos ves cuántas personas has invitado, cuánto han invertido y el total de bonos generados para tu balance de referidos.'
  }
];

const features = [
  {
    title: 'Control total',
    desc: 'Ves todos tus contratos, retiros y referidos en un solo panel sin depender de capturas ni mensajes.',
    icon: 'dashboard'
  },
  {
    title: 'Transparencia',
    desc: 'Cada movimiento queda guardado: inversiones, ganancias diarias, solicitudes de retiro y aprobaciones.',
    icon: 'visibility'
  },
  {
    title: 'Escalable',
    desc: 'Puedes empezar con montos bajos, ir aumentando contratos y aprovechar el programa de referidos para crecer más rápido.',
    icon: 'trending_up'
  }
];

const HowItWorksScreen: React.FC = () => {
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const toggleStep = (index: number) => {
    setOpenStep(openStep === index ? null : index);
  };

  return (
    <div className="px-6 py-4 space-y-8 pb-24">
      <div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Cómo Funciona</h2>
        <p className="text-slate-500 text-xs font-medium">Guía paso a paso para operar en la plataforma.</p>
      </div>

      {/* EXPLICACIÓN DEL FONDO COMÚN (DESPLEGABLE) */}
      <div className="glass-card rounded-[2rem] border border-primary/30 relative overflow-hidden bg-gradient-to-br from-primary/10 to-bg-dark shadow-[0_0_40px_rgba(45,212,191,0.05)]">
        <button 
          onClick={() => setIsExplanationOpen(!isExplanationOpen)}
          className="w-full flex items-center justify-between p-6 text-left relative z-10"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">pie_chart</span>
            <div>
              <h3 className="text-lg font-black text-white uppercase italic tracking-tight">¿De dónde salen las ganancias?</h3>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">Entiende nuestro modelo de negocio</p>
            </div>
          </div>
          <span className={`material-symbols-outlined text-primary text-2xl transition-transform duration-300 ${isExplanationOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExplanationOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-6 pt-0 relative z-10 border-t border-white/10 mt-2 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed text-justify">
              Tuarbitro es una plataforma de inversión en donde operamos con un <strong>fondo común</strong>. Nuestro equipo realiza <strong>arbitraje financiero</strong> (compramos barato y vendemos caro) operando con diferentes monedas fiat y criptomonedas en múltiples mercados.
            </p>
            
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
              <h4 className="text-[10px] font-black text-primary uppercase mb-2">¿Por qué necesitamos inversionistas?</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed text-justify">
                Si operas como un inversionista particular, las ganancias absolutas son muy pocas debido al margen. Por ejemplo: si inviertes $100 dólares y ganas un 10%, tu beneficio es de $10. Está bien, pero si en vez de $100 operamos con <strong>$1,000 por operación</strong>, la ganancia sería de $100.
                <br/><br/>
                Al agrupar el capital de muchos inversionistas en un fondo común, nosotros como operadores tenemos un margen de maniobra mucho mayor. Esto nos permite ejecutar operaciones de alto volumen y así poder repartir beneficios mucho más atractivos para todos.
              </p>
            </div>

            <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
              <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">calculate</span>
                Ejemplo Real de Rendimiento
              </h4>
              <p className="text-[11px] text-emerald-100/70 leading-relaxed text-justify">
                Imagina que la plataforma cuenta con un fondo global de <strong>RD$ 15,438,500</strong>. 
                Si logramos un rendimiento diario del <strong>5%</strong> mediante nuestras operaciones de arbitraje, estaríamos generando unos <strong>RD$ 771,925 diarios</strong> de beneficios netos.
                <br/><br/>
                <strong>¿Cómo se reparte?</strong><br/>
                De esos RD$ 771,925:<br/>
                • El <strong>50% (RD$ 385,962)</strong> se distribuye entre los inversionistas según sus planes (1.5% a 2.5% diario).<br/>
                • El <strong>30% (RD$ 231,577)</strong> se reinvierte en el fondo común para aumentar el volumen de operación.<br/>
                • El <strong>20% (RD$ 154,385)</strong> cubre costos operativos, mantenimiento de la plataforma y ganancias del equipo gestor.
                <br/><br/>
                Este modelo asegura que el fondo siempre crezca y que los pagos sean sostenibles a largo plazo.
              </p>
            </div>

            <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">currency_exchange</span>
                Ejemplo de Arbitraje (Compra/Venta)
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="size-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold text-white mt-0.5">1</div>
                  <p className="text-[10px] text-slate-300">Compramos <strong>10,000 USDT</strong> en un exchange A a una tasa de <strong>RD$ 59.50</strong> (Inversión: RD$ 595,000).</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="size-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold text-white mt-0.5">2</div>
                  <p className="text-[10px] text-slate-300">Vendemos esos mismos <strong>10,000 USDT</strong> en un mercado P2P o exchange B a una tasa de <strong>RD$ 61.20</strong> (Retorno: RD$ 612,000).</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="size-4 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-bold text-white mt-0.5">✓</div>
                  <p className="text-[10px] text-emerald-400 font-bold">Ganancia Bruta: RD$ 17,000 en una sola operación de minutos.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Icon */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[150px] text-primary -rotate-12">monitoring</span>
        </div>
      </div>

      {/* BOX ESPECIAL DE MÉTODOS DE RECARGA */}
      <div className="glass-card p-6 rounded-[2rem] border border-primary/30 relative overflow-hidden bg-gradient-to-br from-primary/5 to-bg-dark shadow-[0_0_40px_rgba(45,212,191,0.05)]">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[120px] text-primary rotate-12">account_balance_wallet</span>
        </div>
        
        <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary text-2xl animate-pulse">tips_and_updates</span>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Métodos de Recarga</h3>
            </div>
            
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                En Tuarbitro Smart Invest no necesitas ser experto en criptomonedas. Ofrecemos dos vías para recargar tu cuenta:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {/* OPCIÓN 1: INTERCAMBIO / BANCO */}
                <div className="bg-bg-dark/60 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-blue-400">currency_exchange</span>
                        <h4 className="text-xs font-black text-white uppercase">Vía Intercambio (Banco)</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed text-justify">
                        Si no usas cripto, simplemente transfiere pesos a la <strong>cuenta bancaria indicada</strong>. 
                        Tu líder o la persona que te invitó gestionará el intercambio por ti.
                        <br/><br/>
                        <span className="text-blue-300 font-bold">El saldo se acredita en tu cuenta como USDT, pero lo verás reflejado principalmente en PESOS (RD$) con la equivalencia en pequeño.</span>
                    </p>
                </div>

                {/* OPCIÓN 2: CRYPTO DIRECTO */}
                <div className="bg-bg-dark/60 p-4 rounded-2xl border border-white/10 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary">bolt</span>
                        <h4 className="text-xs font-black text-white uppercase">Vía Blockchain (USDT)</h4>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed text-justify">
                        Si ya tienes una wallet, envía USDT directamente a la dirección de la plataforma.
                        <br/><br/>
                        <span className="text-primary font-bold">El sistema detecta la transacción automáticamente en la cadena de bloques y acredita tu saldo en aproximadamente 3 minutos.</span>
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* Accordion Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div 
            key={step.num} 
            className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 border ${openStep === index ? 'border-primary/50 bg-white/5' : 'border-white/5'}`}
          >
            <button 
              onClick={() => toggleStep(index)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 flex items-center justify-center size-8 rounded-lg font-black text-xs transition-colors ${openStep === index ? 'bg-primary text-bg-dark' : 'bg-white/10 text-white'}`}>
                  {step.num}
                </div>
                <h3 className={`text-sm font-black uppercase italic tracking-tight ${openStep === index ? 'text-primary' : 'text-white'}`}>
                  {step.title}
                </h3>
              </div>
              <span className={`material-symbols-outlined transition-transform duration-300 ${openStep === index ? 'rotate-180 text-primary' : 'text-slate-500'}`}>
                expand_more
              </span>
            </button>
            
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${openStep === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="p-4 pt-0 text-[11px] text-slate-300 font-medium leading-relaxed border-t border-white/5 mt-2">
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid gap-4">
        {features.map((feat, i) => (
          <div key={i} className="glass-card p-5 rounded-2xl flex items-start gap-4">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <span className="material-symbols-outlined text-xl">{feat.icon}</span>
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase italic mb-1">{feat.title}</h4>
              <p className="text-[10px] text-slate-400 leading-snug">{feat.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HowItWorksScreen;
