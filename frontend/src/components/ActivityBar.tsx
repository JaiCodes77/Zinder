import React from 'react';
import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';

export type ActivityTab = 'discover' | 'matches' | 'profile' | 'projectHelp';

export type ActivityNavItem = {
  key: ActivityTab;
  label: string;
  icon: LucideIcon;
  path: string;
};

type ActivityBarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  navItems: ActivityNavItem[];
  activeTab: ActivityTab;
  onNavigate: (tab: ActivityTab) => void;
  matchCount: number;
  userName?: string;
  userEmail?: string;
  userInitials: string;
  onLogout: () => void | Promise<void>;
  Avatar: React.FC<{ initials: string; size?: string; className?: string }>;
};

export const ActivityBar: React.FC<ActivityBarProps> = ({
  collapsed,
  onToggleCollapsed,
  navItems,
  activeTab,
  onNavigate,
  matchCount,
  userName,
  userEmail,
  userInitials,
  onLogout,
  Avatar,
}) => {
  return (
    <aside
      className="activity-bar"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="Activity bar"
    >
      <div
        className={`activity-bar__header ${
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="brand-mark w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0">
            <span className="text-[13px] font-bold text-bg-base leading-none select-none">Z</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-[15px] tracking-tight text-fg truncate">Zinder</span>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse activity bar"
            className="p-1 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand activity bar"
          className="mx-auto mt-2 mb-1 p-1.5 rounded-md text-fg-subtle hover:text-fg-muted hover:bg-white/5 transition-colors duration-200"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <nav className="activity-bar__nav" aria-label="Primary">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const showBadge = key === 'matches' && matchCount > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              aria-label={showBadge ? `${label}, ${matchCount} conversations` : label}
              className={`activity-bar__item ${active ? 'is-active' : ''} ${
                collapsed ? 'is-collapsed' : ''
              }`}
            >
              {active && <span className="activity-bar__accent" aria-hidden />}
              <span className="activity-bar__icon-wrap">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent-brand' : ''}`}
                  strokeWidth={active ? 2.25 : 1.75}
                  fill={active ? 'currentColor' : 'none'}
                  fillOpacity={active ? 0.18 : 0}
                  aria-hidden
                />
                {showBadge && collapsed && (
                  <span className="activity-bar__badge-dot" aria-hidden>
                    {matchCount > 9 ? '9+' : matchCount}
                  </span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="activity-bar__label truncate flex-1 text-left">{label}</span>
                  {showBadge && (
                    <span className="nav-count-chip flex-shrink-0" aria-hidden>
                      {matchCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && (
                <span className="activity-bar__tooltip" role="tooltip">
                  {label}
                  {showBadge ? ` · ${matchCount}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="activity-bar__account">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar initials={userInitials} size="w-8 h-8 text-[11px]" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-fg truncate leading-tight">
                  {userName || 'Loading…'}
                </p>
                <p className="text-[11px] text-fg-subtle truncate leading-tight mt-0.5">
                  {userEmail || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors duration-200 flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="mt-2 mx-auto flex p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
