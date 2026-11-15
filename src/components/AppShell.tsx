import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  FolderLock,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTripData } from '../context/TripDataContext';
import { formatTimeOnly } from '../lib/formatters';

export type AppPageId =
  | 'dashboard'
  | 'participants'
  | 'income'
  | 'expenses'
  | 'reports'
  | 'documents'
  | 'audit'
  | 'settings';

interface AppShellProps {
  activePage: AppPageId;
  onNavigate: (page: AppPageId) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: AppPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'income', label: 'Income', icon: ArrowDownLeft },
  { id: 'expenses', label: 'Expenses', icon: ArrowUpRight },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'documents', label: 'Documents', icon: FolderLock },
  { id: 'audit', label: 'Audit Logs', icon: History, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const { profile, isAdmin, signOut } = useAuth();
  const { budgetSettings, syncStatus, lastSyncedAt, refreshAll } = useTripData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeNav = visibleNavItems.find((n) => n.id === activePage) ?? visibleNavItems[0];

  const handleNavClick = (id: AppPageId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const handleManualSync = async () => {
    setManualRefreshing(true);
    await refreshAll(true);
    setManualRefreshing(false);
  };

  const renderSyncIndicator = () => {
    if (syncStatus === 'offline') {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B91C1C]">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Offline</span>
        </div>
      );
    }
    if (syncStatus === 'reconnecting' || syncStatus === 'connecting') {
      return (
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309]">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="whitespace-nowrap">
            {syncStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        </div>
      );
    }
    return (
      <div
        className="inline-flex items-center gap-2 text-xs text-[#4A5D55]"
        title={`Last synchronised at ${formatTimeOnly(lastSyncedAt)}`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-[#16794F] shrink-0" aria-hidden="true" />
        <Wifi className="h-3.5 w-3.5 text-[#16794F] shrink-0 hidden sm:inline" />
        <span className="font-medium text-[#111C18] whitespace-nowrap">Live</span>
        <span className="hidden md:inline text-[#71857D] font-mono tabular-nums whitespace-nowrap">
          · {formatTimeOnly(lastSyncedAt)}
        </span>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#113C2E] text-white">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <BrandLogo variant="light" size="md" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-white/75 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 py-3.5 border-b border-white/10">
        <p className="text-xs font-medium text-[#A7D7C0] truncate">
          {budgetSettings?.trip_name ?? 'Maharashtra Western Ghats Study Tour'}
        </p>
        <p className="mt-0.5 text-[11px] text-white/70 font-mono tabular-nums">
          {budgetSettings
            ? `${new Date(`${budgetSettings.trip_start_date}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })} – ${new Date(`${budgetSettings.trip_end_date}T00:00:00`).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}`
            : '3 Dec – 12 Dec 2026'}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary Navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#16794F] text-white shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/8 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {profile?.full_name ?? 'User'}
            </p>
            {!isAdmin && <Lock className="h-3.5 w-3.5 shrink-0 text-[#A7D7C0]" aria-label="Read-only account" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {isAdmin ? 'Main Admin · Money Tracker' : 'Faculty Viewer · Read-Only'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F9F8] text-[#111C18]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#091D15]/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-4 border-b border-[#E2E8E5] bg-white/95 px-4 sm:px-6 backdrop-blur-sm">
          {/* Left Zone: Mobile Trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-[#4A5D55] hover:bg-[#EEF3F0] hover:text-[#111C18] lg:hidden shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="hidden sm:inline text-[#71857D] whitespace-nowrap">TripLedger</span>
              <span className="hidden sm:inline text-[#71857D]" aria-hidden="true">/</span>
              <h1 className="truncate font-display text-base font-semibold text-[#111C18]">
                {activeNav.label}
              </h1>
            </div>
          </div>

          {/* Right Zone: Live Realtime Status + Account Menu */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="flex items-center gap-2">
              {renderSyncIndicator()}
              <button
                type="button"
                onClick={handleManualSync}
                className="rounded-lg p-1.5 text-[#71857D] hover:bg-[#EEF3F0] hover:text-[#111C18] transition-colors"
                title="Refresh ledger now"
                aria-label="Refresh ledger now"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${manualRefreshing ? 'animate-spin text-[#16794F]' : ''}`} />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-[#E2E8E5] bg-white px-2.5 py-1.5 text-left hover:bg-[#F7F9F8] transition-colors"
                aria-expanded={userMenuOpen}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#113C2E] text-xs font-semibold text-white shrink-0">
                  {(profile?.full_name ?? 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden sm:block max-w-[140px]">
                  <p className="truncate text-xs font-semibold text-[#111C18]">
                    {profile?.full_name}
                  </p>
                  <p className="truncate text-[11px] text-[#71857D]">
                    {isAdmin ? 'Admin' : 'Faculty Read-Only'}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#71857D] shrink-0" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-[#E2E8E5] bg-white p-2 shadow-xl">
                    <div className="border-b border-[#E2E8E5] px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-[#111C18]">
                        {profile?.full_name}
                      </p>
                      <p className="truncate text-xs text-[#71857D]">{profile?.email}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#16794F]">
                        {isAdmin ? 'Role: Main Admin' : 'Role: Faculty Viewer (Read-Only)'}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onNavigate('settings');
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#111C18] hover:bg-[#F7F9F8]"
                      >
                        <Settings className="h-3.5 w-3.5 text-[#4A5D55]" />
                        Settings & Security
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut();
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2]/50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
