import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  created_at: string;
  profiles?: { name: string; email: string; available?: number; referrals_earned?: number };
  bank_info?: any;
  wallet_address?: string;
  proof_image?: string;
  hash?: string;
}

const WithdrawalsScreen: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<WithdrawalRequest | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalPending: 0, count: 0 });
  const [adminProof, setAdminProof] = useState({ hash: '', imageUrl: '' });
  const [isUploading, setIsUploading] = useState(false);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*, profiles:user_id(name, email, available, referrals_earned)')
        .eq('status', 'PENDIENTE')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn("Tabla 'withdrawals' no encontrada o error de conexión. Mostrando vacío.", error);
        setRequests([]);
        setStats({ totalPending: 0, count: 0 });
      } else {
        const safeData = data || [];
        setRequests(safeData);

        const total = safeData.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
        setStats({ totalPending: total, count: safeData.length });
      }
    } catch (e) {
      console.error(e);
      setRequests([]);
      setStats({ totalPending: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();

    const channel = supabase
      .channel('withdrawals_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchWithdrawals())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = (req: WithdrawalRequest) => {
    if (!req.user_id) {
      alert('Error: No se pudo identificar el usuario del retiro. Contacta a soporte.');
      console.error('Withdrawal sin user_id:', req);
      return;
    }
    setSelectedReq(req);
    setAdminProof({ hash: '', imageUrl: '' });
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('withdrawal-proofs')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('withdrawal-proofs')
        .getPublicUrl(filePath);

      setAdminProof(prev => ({ ...prev, imageUrl: data.publicUrl }));
    } catch (e: any) {
      alert('Error al subir imagen: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const processPayment = async (status: 'APROBADO' | 'RECHAZADO') => {
    if (!selectedReq || !selectedReq.user_id) {
      alert('Error: No se pudo identificar el usuario del retiro.');
      return;
    }

    const confirmMsg =
      status === 'APROBADO'
        ? '¿Confirmas que has enviado el pago al usuario?'
        : '¿Seguro que deseas rechazar esta solicitud?';

    if (!window.confirm(confirmMsg)) return;

    if (status === 'APROBADO' && !adminProof.hash && !adminProof.imageUrl) {
      const continueWithoutProof = window.confirm(
        'No has proporcionado un Hash o Comprobante. ¿Deseas continuar de todas formas?'
      );
      if (!continueWithoutProof) return;
    }

    try {
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({
          status,
          hash: adminProof.hash || null,
          proof_image: adminProof.imageUrl || null,
        })
        .eq('id', selectedReq.id);

      if (withdrawalError) throw withdrawalError;

      if (status === 'APROBADO') {
        const isRefWithdrawal = selectedReq.type && selectedReq.type.includes('REF');
        if (!isRefWithdrawal) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, available')
            .eq('id', selectedReq.user_id)
            .maybeSingle();

          if (profileError) throw profileError;
          if (!profile) throw new Error('No se encontro el perfil del usuario.');

          const currentVal = Number(profile.available || 0);

          if (currentVal < Number(selectedReq.amount)) {
            throw new Error('El usuario ya no tiene saldo suficiente para este retiro.');
          }

          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({
              available: currentVal - Number(selectedReq.amount),
            })
            .eq('id', selectedReq.user_id);

          if (updateProfileError) throw updateProfileError;
        }
      }

      if (status === 'RECHAZADO') {
        const isRefWithdrawal = selectedReq.type && selectedReq.type.includes('REF');
        if (isRefWithdrawal) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, available, referrals_available')
            .eq('id', selectedReq.user_id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (profile) {
            const newAvailable = Number(profile.available || 0) + Number(selectedReq.amount);
            const newRefAvailable = Number(profile.referrals_available || 0) + Number(selectedReq.amount);

            const { error: updateProfileError } = await supabase
              .from('profiles')
              .update({ available: newAvailable, referrals_available: newRefAvailable })
              .eq('id', selectedReq.user_id);

            if (updateProfileError) throw updateProfileError;
          }
        }
      }

      alert(`Solicitud ${status} correctamente.`);
      setShowModal(false);
      setSelectedReq(null);
      setAdminProof({ hash: '', imageUrl: '' });
      fetchWithdrawals();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="px-6 py-4 space-y-6 pb-24 md:pb-6">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Gestión de Retiros</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Supervisión financiera en tiempo real
          </p>
        </div>
        <button
          onClick={fetchWithdrawals}
          className="text-primary text-xs font-black uppercase hover:underline"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card col-span-2 p-6 rounded-3xl relative overflow-hidden bg-gradient-to-r from-slate-900 to-bg-dark border border-white/10">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 relative z-10">
            Total Solicitado (Pendiente)
          </p>
          <p className="text-3xl font-black text-white tracking-tighter relative z-10">
            {loading ? '...' : `USDT ${stats.totalPending.toLocaleString()}`}
          </p>
          <span className="material-symbols-outlined text-white/5 text-[100px] absolute -right-4 -bottom-4 z-0">
            payments
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">En Cola</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white">{stats.count}</span>
            {stats.count > 0 && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                Acción requerida
              </span>
            )}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado</p>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="text-sm font-black uppercase">Sistema Activo</span>
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Solicitudes ({requests.length})
          </h3>
          <span className="material-symbols-outlined text-slate-500 cursor-pointer">filter_list</span>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2"></div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Buscando solicitudes...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl border-dashed border-white/10">
              <span className="material-symbols-outlined text-4xl text-slate-700 mb-2">inbox</span>
              <p className="text-xs font-bold text-white uppercase">No hay retiros pendientes</p>
              <p className="text-[10px] text-slate-500 mt-1">Las nuevas solicitudes aparecerán aquí.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="glass-card p-4 rounded-2xl space-y-4 border border-white/5 hover:border-primary/20 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">{req.profiles?.name || 'Usuario'}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 tracking-tighter">
                      {req.profiles?.email}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <p className="text-[9px] text-primary font-bold bg-primary/10 inline-block px-1.5 rounded">
                        {req.created_at.split('T')[0]}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold bg-white/5 inline-block px-1.5 rounded border border-white/5">
                        Saldo: {Number((req.profiles as any)?.available || 0).toFixed(2)} USDT
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-white tracking-tight">
                      USDT {Number(req.amount).toLocaleString()}
                    </p>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                        req.type.includes('REF')
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : req.type.includes('USDT')
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {req.type.replace('REF_', 'REFERIDO ')}
                    </span>
                  </div>
                </div>

                <div className="bg-black/20 p-3 rounded-xl text-[10px] space-y-1 font-mono text-slate-400 border border-white/5">
                  {req.type.includes('USDT') ? (
                    <p className="break-all">
                      Wallet: <span className="text-white select-all">{req.wallet_address || 'No especificada'}</span>
                    </p>
                  ) : (
                    <>
                      <p>
                        Banco: <span className="text-white">{req.bank_info?.bankName}</span>
                      </p>
                      <p>
                        Cuenta: <span className="text-white select-all">{req.bank_info?.accountNumber}</span>
                      </p>
                      <p>
                        Titular: <span className="text-white">{req.bank_info?.beneficiary}</span>
                      </p>
                      {req.bank_info?.cedula && (
                        <p>
                          Cédula/ID: <span className="text-white">{req.bank_info?.cedula}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req)}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-slate-900 text-xs font-black uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-primary/10 hover:bg-white"
                  >
                    Procesar Pago
                  </button>
                  <button
                          onClick={() => {
                            if (!req.user_id) {
                              alert('Error: No se pudo identificar el usuario del retiro.');
                              return;
                            }
                            setSelectedReq(req);
                            processPayment('RECHAZADO');
                          }}
                    className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-500 text-xs font-black uppercase tracking-widest transition-transform active:scale-95 hover:bg-red-500/10"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && selectedReq && (
        <div className="fixed inset-0 z-[110] bg-bg-dark/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="glass-card w-full max-w-sm rounded-[2.5rem] p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            <div className="flex flex-col items-center text-center gap-6">
              <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="material-symbols-outlined text-primary text-4xl">verified_user</span>
              </div>

              <div>
                <h2 className="text-xl font-black text-white leading-tight">Confirmar Transferencia</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                  Acción Irreversible
                </p>
              </div>

              <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/5 text-left space-y-3">
                <div className="flex justify-between">
                  <span className="text-[9px] font-black text-slate-600 uppercase">Beneficiario</span>
                  <span className="text-[9px] font-black text-primary uppercase">{selectedReq.type}</span>
                </div>

                <p className="text-sm font-bold text-white">{selectedReq.profiles?.name}</p>
                <p className="text-lg font-black text-white tracking-tighter">
                  USDT {Number(selectedReq.amount).toLocaleString()}
                </p>

                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Datos de Destino</p>
                  {selectedReq.type.includes('USDT') ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400">Dirección Solana/USDT:</p>
                      <p className="text-xs font-mono text-white break-all select-all">
                        {selectedReq.wallet_address || 'No especificada'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[10px]">
                      <p className="text-slate-400">
                        Banco: <span className="text-white">{selectedReq.bank_info?.bankName}</span>
                      </p>
                      <p className="text-slate-400">
                        Cuenta: <span className="text-white select-all">{selectedReq.bank_info?.accountNumber}</span>
                      </p>
                      <p className="text-slate-400">
                        Titular: <span className="text-white">{selectedReq.bank_info?.beneficiary}</span>
                      </p>
                      {selectedReq.bank_info?.cedula && (
                        <p className="text-slate-400">
                          Cédula: <span className="text-white">{selectedReq.bank_info?.cedula}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 space-y-3 border-t border-white/5">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Hash de Transacción / Referencia
                    </label>
                    <input
                      type="text"
                      value={adminProof.hash}
                      onChange={(e) => setAdminProof((prev) => ({ ...prev, hash: e.target.value }))}
                      placeholder="Pega el hash o número de ref"
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-[10px] outline-none focus:border-primary mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Foto del Comprobante
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-primary/30 cursor-pointer transition-colors">
                        <span className="material-symbols-outlined text-slate-500 text-sm">add_a_photo</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {isUploading ? 'Subiendo...' : adminProof.imageUrl ? 'Cambiar Foto' : 'Subir Foto'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>

                      {adminProof.imageUrl && (
                        <div className="size-12 rounded-lg overflow-hidden border border-primary/30">
                          <img
                            src={adminProof.imageUrl}
                            alt="Comprobante"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-3 pt-2">
                <button
                  onClick={() => processPayment('APROBADO')}
                  className="w-full py-4 rounded-2xl bg-primary text-slate-900 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 hover:bg-emerald-400"
                >
                  Confirmar Pago Realizado
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 text-slate-500 text-xs font-bold uppercase hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawalsScreen;