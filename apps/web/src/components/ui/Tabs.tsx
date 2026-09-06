/**
 * Tabs — segmented control with smooth active indicator
 *
 * Usage:
 *   <Tabs tabs={[{ id: 'all', label: 'All', count: 24 }]} active="all" onTabChange={setTab} />
 */



interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onTabChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs({ tabs, active, onTabChange, className = '', size = 'sm' }: TabsProps) {
  return (
    <div
      className={[
        'flex items-center gap-1 bg-surface-card border border-surface-border rounded-2xl p-1.5 shadow-card overflow-x-auto',
        className,
      ].join(' ')}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={[
              'flex items-center gap-1.5 whitespace-nowrap rounded-xl font-semibold',
              'transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated',
            ].join(' ')}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-mono min-w-[16px] text-center',
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-elevated text-slate-400',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
