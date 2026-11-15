import React, { useEffect, useState } from 'react';
import { AlertCircle, Database, RefreshCw } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TripDataProvider, useTripData } from './context/TripDataContext';
import { isSupabaseConfigured } from './lib/supabase';
import { BrandLogo } from './components/BrandLogo';
import { AppShell, type AppPageId } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { FacultyDashboardPage } from './pages/FacultyDashboardPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

function ConfigurationRequiredView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9F8] p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E8E5] bg-white p-8 shadow-sm">
        <BrandLogo variant="dark" size="lg" />
        <div className="mt-6 flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
          <div>
            <h1 className="font-display text-xl font-bold text-[#111C18]">
              Supabase Configuration Required
            </h1>
            <p className="mt-2 text-sm text-[#4A5D55] leading-relaxed">
              TripLedger requires your Supabase project URL and publishable key in environment
              configuration before authentication can start.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-[#E2E8E5] bg-[#F7F9F8] p-3.5 font-mono text-xs text-[#111C18]">
              {`VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { isAdmin, isFaculty } = useAuth();
  const { dataError, refreshAll } = useTripData();
  const [activePage, setActivePage] = useState<AppPageId>('dashboard');

  // Enforce strict role-based route protection
  useEffect(() => {
    if (isFaculty && (activePage === 'audit' || activePage === 'settings')) {
      setActivePage('dashboard');
    }
  }, [isFaculty, activePage]);

  const handleNavigate = (page: AppPageId) => {
    if (isFaculty && (page === 'audit' || page === 'settings')) {
      setActivePage('dashboard');
      return;
    }
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return isAdmin ? (
          <AdminDashboardPage onNavigate={handleNavigate} />
        ) : (
          <FacultyDashboardPage onNavigate={handleNavigate} />
        );
      case 'participants':
        return <ParticipantsPage />;
      case 'income':
        return <IncomePage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'documents':
        return <DocumentsPage />;
      case 'audit':
        return isAdmin ? <AuditLogsPage /> : <FacultyDashboardPage onNavigate={handleNavigate} />;
      case 'settings':
        return isAdmin ? <SettingsPage /> : <FacultyDashboardPage onNavigate={handleNavigate} />;
      default:
        return isAdmin ? (
          <AdminDashboardPage onNavigate={handleNavigate} />
        ) : (
          <FacultyDashboardPage onNavigate={handleNavigate} />
        );
    }
  };

  return (
    <AppShell activePage={activePage} onNavigate={handleNavigate}>
      {dataError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B91C1C]/25 bg-[#FEE2E2]/45 px-4 py-3 text-xs text-[#991B1B]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{dataError}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshAll(false)}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-[#111C18] shadow-xs hover:bg-[#F7F9F8]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Sync
          </button>
        </div>
      )}
      {renderPage()}
    </AppShell>
  );
}

function AppRouter() {
  const { user, profile, loading, isRecoveryMode } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'forgot'>('login');

  if (!isSupabaseConfigured) {
    return <ConfigurationRequiredView />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F9F8] gap-4">
        <BrandLogo variant="dark" size="lg" />
        <p className="text-xs font-medium text-[#4A5D55]">Verifying secure session...</p>
      </div>
    );
  }

  if (isRecoveryMode) {
    return <ResetPasswordPage />;
  }

  if (!user || !profile) {
    if (authView === 'forgot') {
      return <ForgotPasswordPage onBack={() => setAuthView('login')} />;
    }
    return <LoginPage onForgotPassword={() => setAuthView('forgot')} />;
  }

  return (
    <TripDataProvider>
      <AuthenticatedWorkspace />
    </TripDataProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  );
}
