
import React from 'react';
import { AppRole, Screen } from '../types';

interface BottomNavProps {
  role: AppRole;
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ role, activeScreen, setActiveScreen }) => {
  const adminTabs = [
    { id: 'DASHBOARD' as Screen, label: 'Resumen', icon: 'dashboard' },
    { id: 'WITHDRAWALS' as Screen, label: 'Retiros', icon: 'payments' },
    { id: 'HISTORY' as Screen, label: 'Historial', icon: 'history' },
    { id: 'SETTINGS' as Screen, label: 'Ajustes', icon: 'settings' },
    { id: 'HOW_IT_WORKS' as Screen, label: 'Guía', icon: 'help' },
  ];

  const userTabs = [
    { id: 'DASHBOARD' as Screen, label: 'Inicio', icon: 'grid_view' },
    { id: 'PLANS' as Screen, label: 'Invertir', icon: 'analytics' },
    { id: 'HISTORY' as Screen, label: 'Historial', icon: 'history' },
    { id: 'HOW_IT_WORKS' as Screen, label: 'Guía', icon: 'help' },
    { id: 'REFERRALS' as Screen, label: 'Red', icon: 'group' },
  ];

  const tabs = role === AppRole.ADMIN ? adminTabs : userTabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-[100] ios-blur border-t border-white/10 px-4 pb-8 pt-3">
      <div className="flex items-end justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveScreen(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-1' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-tighter">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
