"use client";

import { ActiveSection, NavigationItem } from "./types";

type AdminSidebarProps = {
  activeSection: ActiveSection;
  navigationItems: NavigationItem[];
  onSectionChange: (section: ActiveSection) => void;
};

export default function AdminSidebar({
  activeSection,
  navigationItems,
  onSectionChange
}: AdminSidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100 lg:flex lg:flex-col">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="text-sm uppercase tracking-[0.18em] text-slate-400">Gridbox</div>
        <div className="mt-2 text-2xl font-bold">Admin</div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Eerst overzicht, dan installatie, dan beheer.
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigationItems.map((item) => {
          const active = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                active
                  ? "bg-white text-slate-900"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-6 py-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-white">Installatierichting</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Nieuwe boxen krijgen hier stap voor stap voorbereiding. Geen losse installatielogica verspreid door de admin.
          </p>
        </div>
      </div>
    </aside>
  );
}
