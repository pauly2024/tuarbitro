
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserData, getAdminSettings, AdminSettings } from '../store';

interface Transaction {
  id: string;
  type: 'DEPOSITO' | 'RETIRO' | 'COMISION' | 'GANANCIA';
  amount: number;
  status: string;
  date: string;
  description: string;
  details?: any;
}

interface HistoryScreenProps {
  userData: UserData | null;
  isAdmin: boolean;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ userData, isAdmin }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'DEPOSITO' | 'RETIRO' | 'COMISION'>('ALL');
  const [settings] = useState<AdminSettings>(getAdminSettings());

  useEffect(() => {
    fetchHistory();
  }, [userData?.id, isAdmin]);

  const fetchHistory = async () => {
    // Si no es admin y no tenemos userData, no podemos cargar nada
    if (!isAdmin && (!userData || !userData.id)) {
      console.log('No se puede cargar historial: usuario no definido');
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const allTxs: Transaction[] = [];

      // Fetch profiles for names
      const { data: profiles } = await supabase.from('profiles').select('id, name');
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => {
        nameMap[p.id] = p.name;
      });

      // 1. Fetch Deposits
      const { data: deposits, error: depError } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (depError) console.error('Error cargando depósitos:', depError);
      
      (deposits || []).forEach(d => {
        // Si no es admin, filtrar manualmente
        if (!isAdmin && d.user_id !== userData?.id) return;

        const userName = nameMap[d.user_id] || 'Usuario';
        allTxs.push({
          id: d.id,
          type: 'DEPOSITO',
          amount: d.amount,
          status: d.status,
          date: d.created_at,
          description: `Depósito de ${userName} vía ${d.method === 'BANK' ? 'Banco' : 'USDT'}`,
          details: d
        });
      });

      // 2. Fetch Withdrawals
      const { data: withdrawals, error: withError } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (withError) console.error('Error cargando retiros:', withError);
      
      (withdrawals || []).forEach(w => {
        // Si no es admin, filtrar manualmente
        if (!isAdmin && w.user_id !== userData?.id) return;

        const userName = nameMap[w.user_id] || 'Usuario';
        allTxs.push({
          id: w.id,
          type: 'RETIRO',
          amount: w.amount,
          status: w.status,
          date: w.created_at,
          description: `Retiro de ${userName} (${w.type.includes('REF') ? 'Comisiones' : 'Balance'})`,
          details: w
        });
      });

      // 3. Referral History (from profiles)
      if (isAdmin) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, referral_history');
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach(p => {
          nameMap[p.id] = p.name;
        });

        (profiles || []).forEach(p => {
          const history = p.referral_history || [];
          history.forEach((h: any) => {
            const displayName = nameMap[h.fromUser] || h.fromUser || 'Referido';
            allTxs.push({
              id: h.id || Math.random().toString(36).substr(2, 9),
              type: 'COMISION',
              amount: h.amount,
              status: h.status || 'COMPLETADO',
              date: h.date_iso || h.created_at || new Date().toISOString(),
              description: `Comisión de ${displayName} (Sponsor: ${p.name})`,
              details: h
            });
          });
        });
      } else if (userData) {
        const history = userData.referralHistory || [];
        
        // Fetch names for UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuids = history.map((h: any) => h.fromUser).filter((u: string) => u && uuidRegex.test(u));
        let nameMap: Record<string, string> = {};
        
        if (uuids.length > 0) {
          const { data: refProfiles } = await supabase.from('profiles').select('id, name').in('id', uuids);
          if (refProfiles) {
            refProfiles.forEach(p => {
              nameMap[p.id] = p.name;
            });
          }
        }

        history.forEach((h: any) => {
          const displayName = nameMap[h.fromUser] || h.fromUser;
          allTxs.push({
            id: h.id || Math.random().toString(36).substr(2, 9),
            type: 'COMISION',
            amount: h.amount,
            status: h.status || 'COMPLETADO',
            date: h.date_iso || h.created_at || new Date().toISOString(),
            description: `Comisión por inversión de ${displayName}`,
            details: h
          });
        });
      }

      // Sort all by date
      allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTxs);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = filter === 'ALL' 
    ? transactions 
    : transactions.filter(t => t.type === filter);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APROBADO':
      case 'COMPLETADO':
      case 'PAGADO':
      case 'ACTIVE':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'PENDIENTE':
      case 'WAITING':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'RECHAZADO':
      case 'CANCELADO':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSITO': return 'add_circle';
      case 'RETIRO': return 'remove_circle';
      case 'COMISION': return 'group_add';
      case 'GANANCIA': return 'trending_up';
      default: return 'receipt_long';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSITO': return 'text-emerald-400';
      case 'RETIRO': return 'text-red-400';
      case 'COMISION': return 'text-primary';
      case 'GANANCIA': return 'text-blue-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="px-6 py-4 space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Historial de Transacciones</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Registro global de movimientos' : 'Tus movimientos financieros'}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {(['ALL', 'DEPOSITO', 'RETIRO', 'COMISION'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                filter === f 
                  ? 'bg-primary text-bg-dark border-primary shadow-lg shadow-primary/20' 
                  : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/20'
              }`}
            >
              {f === 'ALL' ? 'Todo' : f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargando historial...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="glass-card rounded-[2rem] p-12 text-center border-white/5">
          <span className="material-symbols-outlined text-6xl text-slate-700 mb-4">history_toggle_off</span>
          <h3 className="text-lg font-black text-white uppercase italic">Sin transacciones</h3>
          <p className="text-sm text-slate-500 mt-2">No se encontraron movimientos que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => (
            <div 
              key={tx.id}
              className="glass-card rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all flex items-center gap-4 group"
            >
              <div className={`size-12 rounded-xl flex items-center justify-center bg-white/5 ${getTypeColor(tx.type)} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-2xl">{getTypeIcon(tx.type)}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white truncate">{tx.description}</h4>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className="size-1 bg-slate-700 rounded-full"></span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ID: {tx.id.slice(0, 8)}</p>
                </div>
              </div>

              <div className="text-right">
                <p className={`text-sm font-black tracking-tight ${tx.type === 'RETIRO' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {tx.type === 'RETIRO' ? '-' : '+'}{tx.amount.toLocaleString()} USDT
                </p>
                <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                  ≈ RD$ {(tx.amount * settings.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryScreen;
