
import React from 'react';
import { AppRole, Screen } from '../types';

interface SidebarProps {
  role: AppRole;
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeScreen, setActiveScreen, onLogout }) => {
  const adminTabs = [
    { id: 'DASHBOARD' as Screen, label: 'Resumen', icon: 'dashboard' },
    { id: 'WITHDRAWALS' as Screen, label: 'Retiros', icon: 'payments' },
    { id: 'HISTORY' as Screen, label: 'HISTORIAL (DEBUG)', icon: 'history' },
    { id: 'SETTINGS' as Screen, label: 'Ajustes', icon: 'settings' },
    { id: 'HOW_IT_WORKS' as Screen, label: 'Guía', icon: 'help' },
  ];

  const userTabs = [
    { id: 'DASHBOARD' as Screen, label: 'Inicio', icon: 'grid_view' },
    { id: 'PLANS' as Screen, label: 'Invertir', icon: 'analytics' },
    { id: 'HISTORY' as Screen, label: 'HISTORIAL (DEBUG)', icon: 'history' },
    { id: 'HOW_IT_WORKS' as Screen, label: 'Guía', icon: 'help' },
    { id: 'REFERRALS' as Screen, label: 'Red de Socios', icon: 'group' },
  ];

  const tabs = role === AppRole.ADMIN ? adminTabs : userTabs;

  return (
    <div className="flex flex-col w-64 h-full bg-bg-dark border-r border-white/5 p-6">
      <div className="mb-10 px-2">
         <h1 className="text-xl font-black text-white tracking-tighter italic flex flex-col">
            TUARBITRORD
            <span className="text-[10px] text-primary not-italic font-bold tracking-[0.4em]">SMART INVEST</span>
         </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {tabs.map((tab) => {
          const isActive = activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveScreen(tab.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'fill-1' : ''} group-hover:scale-110 transition-transform`}>
                {tab.icon}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <button 
        onClick={onLogout}
        className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all mt-auto"
      >
        <span className="material-symbols-outlined">logout</span>
        <span className="text-xs font-bold uppercase tracking-widest">Cerrar Sesión</span>
      </button>
    </div>
  );
};

export default Sidebar;
