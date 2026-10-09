import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login/Login';

import TemplateEditor from './components/TemplateEditor/TemplateEditor';
import PrintOperacional from './components/PrintOperacional/PrintOperacional';
import TemplateDashboard from './components/TemplateDashboard/TemplateDashboard';
import ConexoesAdmin from './components/ConexoesAdmin/ConexoesAdmin';
import CategoriasAdmin from './components/CategoriasAdmin/CategoriasAdmin';
import PerfisAdmin from './components/PerfisAdmin/PerfisAdmin';
import UsuariosAdmin from './components/UsuariosAdmin/UsuariosAdmin';
import AuditoriaAdmin from './components/Auditoria/AuditoriaAdmin';
import ChamadosAdmin from './components/Chamados/ChamadosAdmin';
import ConfigEmailsAdmin from './components/ConfigEmails/ConfigEmailsAdmin';
import IdentidadeVisual from './components/IdentidadeVisual/IdentidadeVisual';
import InstallPWA from './components/InstallPWA/InstallPWA';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { initGlobalMonitor } from './services/monitorService';
import { getBranding, DEFAULT_BRANDING } from './services/brandingService';
import { cn } from './lib/utils';

import {
  Printer,
  LayoutDashboard,
  FilePlus,
  Cable,
  FolderKanban,
  ShieldCheck,
  Users,
  Palette,
  LifeBuoy,
  Activity,
  Mail,
  ChevronRight,
  Menu,
  X,
  LogOut
} from 'lucide-react';

function UserAvatar({ user, className = "w-10 h-10" }) {
  const name = user?.nome || user?.name || user?.email || 'Usuário';
  const getInitials = (n) => {
    if (!n) return 'GH';
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={name}
        className={cn("rounded-full object-cover shrink-0 border border-white/20", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-white/20 text-white font-bold flex items-center justify-center shrink-0 border border-white/20 text-xs shadow-inner select-none",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const { currentUser, userProfile, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    initGlobalMonitor();

    // Garante que o aplicativo use sempre o tema claro oficial corporativo
    document.documentElement.classList.remove('dark', 'dark-theme');
    document.documentElement.classList.add('light-theme');
    localStorage.removeItem('gh_theme');

    getBranding().then(b => {
      if (b) setBranding(b);
    });

    const onBrandingUpdate = (e) => {
      if (e.detail) setBranding(prev => ({ ...prev, ...e.detail }));
    };
    window.addEventListener('branding-updated', onBrandingUpdate);
    return () => window.removeEventListener('branding-updated', onBrandingUpdate);
  }, []);

  if (!currentUser) {
    return <Login />;
  }

  const telas = userProfile?.telas_acesso || [];
  const isAdmin = userProfile?.isAdmin;
  const hasAccess = (tela) => isAdmin || telas.includes(tela);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    {
      id: '/',
      label: 'Impressão Operacional',
      icon: Printer,
      show: hasAccess('print')
    },
    // Seção Administração
    {
      id: '/admin',
      label: 'Dashboard de Templates',
      icon: LayoutDashboard,
      show: hasAccess('admin'),
      section: 'Administração'
    },
    {
      id: '/editor',
      label: 'Novo Modelo',
      icon: FilePlus,
      show: hasAccess('editor')
    },
    {
      id: '/conexoes',
      label: 'Conexões ERP',
      icon: Cable,
      show: hasAccess('conexoes')
    },
    {
      id: '/categorias',
      label: 'Categorias',
      icon: FolderKanban,
      show: hasAccess('categorias')
    },
    {
      id: '/perfis',
      label: 'Perfis de Acesso',
      icon: ShieldCheck,
      show: hasAccess('perfis')
    },
    {
      id: '/usuarios',
      label: 'Usuários',
      icon: Users,
      show: hasAccess('usuarios')
    },
    {
      id: '/identidade',
      label: 'Identidade Visual',
      icon: Palette,
      show: hasAccess('branding')
    },
    // Seção Monitoramento & TI
    {
      id: '/chamados',
      label: 'Chamados e TI',
      icon: LifeBuoy,
      show: hasAccess('chamados'),
      section: 'Monitoramento & TI'
    },
    {
      id: '/auditoria',
      label: 'Auditoria & Indicadores',
      icon: Activity,
      show: hasAccess('auditoria')
    },
    {
      id: '/emails',
      label: 'Configuração E-mails',
      icon: Mail,
      show: hasAccess('emails')
    }
  ];

  const visibleItems = menuItems.filter(item => item.show);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 overflow-hidden">
      {/* =========================================================================
          1. SIDEBAR DESKTOP (Idêntico ao padrão oficial da Intranet GH)
          ========================================================================= */}
      <aside
        className={cn(
          "hidden flex-col border-r border-white/10 bg-[#002972] transition-all duration-300 lg:flex dark:border-white/10 dark:bg-[#002972] shrink-0",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Área do Logo com botão de recolher (h-32 px-6) */}
        <div
          className={cn(
            "flex h-32 items-center px-6 border-b border-white/10 shrink-0",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed && (
            branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-24 max-h-28 max-w-[200px] object-contain brightness-0 invert drop-shadow-md transition-all"
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.src = DEFAULT_BRANDING.logoUrl; }}
              />
            ) : (
              <span className="text-xl font-black tracking-tighter text-white">
                {branding?.appName || 'GHRelatórios'}
              </span>
            )
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-sm transition-all hover:bg-white/20 active:scale-95 shrink-0"
            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Navegação Principal com menu-scrollbar */}
        <nav className="flex-1 overflow-y-auto menu-scrollbar space-y-1 p-4">
          {visibleItems.map((item, index) => {
            const active = isActive(item.id);
            const showSectionHeader = item.section && (index === 0 || visibleItems[index - 1]?.section !== item.section);

            return (
              <React.Fragment key={item.id}>
                {showSectionHeader && (
                  <div className={cn(
                    "px-4 py-2 mt-4 mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 select-none",
                    isCollapsed ? "text-center px-0" : ""
                  )}>
                    {isCollapsed ? "•••" : item.section}
                  </div>
                )}
                <Link
                  to={item.id}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-200 select-none",
                    active
                      ? "bg-white text-[#002972] font-semibold shadow-md dark:bg-white dark:text-[#002972]"
                      : "text-white/90 font-medium hover:bg-white/15 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-[#002972]" : "text-white/80"
                    )}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Rodapé Corporativo da Sidebar */}
        <div className="border-t border-white/15 p-4 space-y-2 shrink-0">
          <InstallPWA isCollapsed={isCollapsed} className="mb-2" />

          {/* Cartão do Usuário */}
          <div
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-xl transition-colors hover:bg-white/10 text-left text-white select-none",
              isCollapsed ? "justify-center px-0" : ""
            )}
          >
            <UserAvatar user={currentUser} className="w-10 h-10 border border-white/20" />
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="truncate text-sm font-semibold text-white">
                  {currentUser?.nome || currentUser?.name || currentUser?.email || 'Usuário'}
                </span>
                <span className="text-xs text-white/70">
                  {userProfile?.isAdmin ? 'Administrador' : (userProfile?.nome || 'Operador')}
                </span>
              </div>
            )}
          </div>

          {/* Tag de Versão Oficial */}
          {!isCollapsed && (
            <div className="px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 select-none">
              GH RELATÓRIOS V1.0-RBAC
            </div>
          )}

          {/* Botão Sair */}
          <button
            onClick={logout}
            title={isCollapsed ? "Sair da Conta" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 transition-all hover:bg-white/15 hover:text-white select-none",
              isCollapsed ? "justify-center px-2" : ""
            )}
          >
            <LogOut className="h-5 w-5 shrink-0 text-white/80" />
            {!isCollapsed && <span>Sair da Conta</span>}
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. HEADER MOBILE (z-30 lg:hidden)
          ========================================================================= */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#002972] px-4 lg:hidden text-white z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir Menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all shadow-sm"
            >
              <Menu className="h-6 w-6" />
            </button>
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-9 max-h-10 object-contain brightness-0 invert drop-shadow-sm"
              />
            ) : (
              <span className="text-base font-black tracking-tighter text-white">
                {branding?.appName || 'GHRelatórios'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <UserAvatar user={currentUser} className="w-8 h-8 border border-white/20" />
          </div>
        </header>

        {/* Drawer Mobile com Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[#002972] shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          )}
        >
          <div className="flex h-20 items-center justify-between px-5 border-b border-white/10">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-14 max-h-16 object-contain brightness-0 invert drop-shadow-md"
              />
            ) : (
              <span className="text-lg font-black tracking-tighter text-white">
                {branding?.appName || 'GHRelatórios'}
              </span>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Recolher Menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all shadow-sm"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto menu-scrollbar space-y-1 p-3">
            {visibleItems.map((item, index) => {
              const active = isActive(item.id);
              const showSectionHeader = item.section && (index === 0 || visibleItems[index - 1]?.section !== item.section);

              return (
                <React.Fragment key={item.id}>
                  {showSectionHeader && (
                    <div className="px-4 py-2 mt-3 mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 select-none">
                      {item.section}
                    </div>
                  )}
                  <Link
                    to={item.id}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 select-none",
                      active
                        ? "bg-white text-[#002972] font-semibold shadow-md dark:bg-white dark:text-[#002972]"
                        : "text-white/90 hover:bg-white/15 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        active ? "text-[#002972]" : "text-white/80"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="border-t border-white/15 p-4 space-y-2">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/90 transition-all hover:bg-white/15 hover:text-white select-none"
            >
              <LogOut className="h-5 w-5 shrink-0 text-white/80" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </aside>

        {/* =========================================================================
            3. ÁREA DE CONTEÚDO PRINCIPAL (bg-zinc-50 dark:bg-zinc-950)
            ========================================================================= */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>
            <Routes>
              {hasAccess('print') && <Route path="/" element={<PrintOperacional />} />}
              {hasAccess('admin') && <Route path="/admin" element={<TemplateDashboard />} />}
              {hasAccess('editor') && <Route path="/editor" element={<TemplateEditor />} />}
              {hasAccess('editor') && <Route path="/editor/:id" element={<TemplateEditor />} />}
              {hasAccess('conexoes') && <Route path="/conexoes" element={<ConexoesAdmin />} />}
              {hasAccess('categorias') && <Route path="/categorias" element={<CategoriasAdmin />} />}
              {hasAccess('perfis') && <Route path="/perfis" element={<PerfisAdmin />} />}
              {hasAccess('usuarios') && <Route path="/usuarios" element={<UsuariosAdmin />} />}
              {hasAccess('branding') && <Route path="/identidade" element={<IdentidadeVisual />} />}
              {hasAccess('chamados') && <Route path="/chamados" element={<ChamadosAdmin />} />}
              {hasAccess('auditoria') && <Route path="/auditoria" element={<AuditoriaAdmin />} />}
              {hasAccess('emails') && <Route path="/emails" element={<ConfigEmailsAdmin />} />}
              <Route path="*" element={<div className="p-8 text-center text-zinc-500"><h2>Bem-vindo! Selecione uma opção no menu lateral.</h2></div>} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
