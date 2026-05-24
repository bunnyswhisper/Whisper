export type AdminSectionTab = { id: string; label: string };

type AdminSectionTabsProps = {
  tabs: AdminSectionTab[];
  activeId: string;
  onChange: (id: string) => void;
};

export function AdminSectionTabs({
  tabs,
  activeId,
  onChange,
}: AdminSectionTabsProps) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Analytics sections"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition sm:text-sm ${
              active
                ? 'border-purple-300/50 bg-purple-500/20 text-white shadow-[0_0_24px_rgba(168,85,247,0.25)]'
                : 'border-purple-950 bg-[#0d0716] text-gray-400 hover:border-purple-800 hover:text-purple-200'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
