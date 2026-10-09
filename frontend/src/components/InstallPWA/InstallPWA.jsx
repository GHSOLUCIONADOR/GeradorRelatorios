import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, CheckCircle2, X } from 'lucide-react';
import { getBranding, DEFAULT_BRANDING } from '../../services/brandingService';
import { cn } from '../../lib/utils';

export default function InstallPWA({ isCollapsed = false, className }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [appIcon, setAppIcon] = useState(DEFAULT_BRANDING.iconUrl);
  const [appName, setAppName] = useState(DEFAULT_BRANDING.appName);

  useEffect(() => {
    // Check if standalone
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true;
    
    setIsStandalone(isStandaloneMode);
    setIsInstalled(isStandaloneMode);

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    getBranding().then(b => {
      if (b && (b.iconUrl || b.faviconUrl)) setAppIcon(b.iconUrl || b.faviconUrl);
      if (b && b.appName) setAppName(b.appName);
    });

    const onBrandingUpdate = (e) => {
      if (e.detail) {
        if (e.detail.iconUrl || e.detail.faviconUrl) {
          setAppIcon(e.detail.iconUrl || e.detail.faviconUrl);
        }
        if (e.detail.appName) {
          setAppName(e.detail.appName);
        }
      }
    };
    window.addEventListener('branding-updated', onBrandingUpdate);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('branding-updated', onBrandingUpdate);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const isInstallable = !!deferredPrompt || (isIOS && !isStandalone);

  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <>
      <button
        onClick={installApp}
        title={isCollapsed ? `Instalar ${appName}` : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
          "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 hover:from-emerald-500/30 hover:to-teal-500/30 hover:text-white border border-emerald-500/30 shadow-sm",
          isCollapsed ? "justify-center px-2" : "",
          className
        )}
      >
        <Download className="h-5 w-5 shrink-0 text-emerald-400 animate-bounce" />
        {!isCollapsed && <span className="truncate">Instalar Aplicativo</span>}
      </button>

      {/* Modal explicativo para iOS / Dispositivos Móveis */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Quadrado branco arredondado para o ícone não sumir */}
                <div className="w-12 h-12 rounded-2xl bg-white p-2 flex items-center justify-center shadow-md border border-zinc-200/50 shrink-0">
                  <img src={appIcon} alt={appName} className="w-full h-full object-contain rounded-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Instalar {appName}</h3>
                  <p className="text-xs text-zinc-400">No seu iPhone ou dispositivo</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 my-4 text-sm text-zinc-300">
              <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <div className="p-2 rounded-lg bg-[#002972]/30 text-blue-400 shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">1. Toque em Compartilhar</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Na barra inferior do navegador, clique no botão de compartilhar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <div className="p-2 rounded-lg bg-[#002972]/30 text-blue-400 shrink-0">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">2. Adicionar à Tela de Início</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Role as opções para baixo e selecione "Adicionar à Tela de Início".</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">3. Pronto!</p>
                  <p className="text-xs text-zinc-400 mt-0.5">O ícone oficial com fundo quadrado arredondado ficará disponível no seu aparelho.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#002972] hover:bg-[#002972]/90 text-white font-medium text-sm transition-colors shadow-lg"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
