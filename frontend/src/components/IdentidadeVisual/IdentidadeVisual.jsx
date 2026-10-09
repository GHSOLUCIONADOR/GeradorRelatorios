import React, { useState, useEffect } from 'react';
import { getBranding, saveBranding, DEFAULT_BRANDING } from '../../services/brandingService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Badge } from '../ui';
import { Save, RotateCcw, Image as ImageIcon, Smartphone, Globe, Type, CheckCircle2, AlertCircle } from 'lucide-react';

export default function IdentidadeVisual() {
  const [formData, setFormData] = useState({
    appName: DEFAULT_BRANDING.appName,
    logoUrl: DEFAULT_BRANDING.logoUrl,
    iconUrl: DEFAULT_BRANDING.iconUrl
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getBranding();
      setFormData({
        appName: data.appName || DEFAULT_BRANDING.appName,
        logoUrl: data.logoUrl || DEFAULT_BRANDING.logoUrl,
        iconUrl: data.iconUrl || data.faviconUrl || DEFAULT_BRANDING.iconUrl
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await saveBranding({
        ...formData,
        faviconUrl: formData.iconUrl
      });
      setFeedback({
        type: 'success',
        message: 'Identidade visual atualizada com sucesso! Nome do app, logotipo do menu e favicon do navegador foram sincronizados.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar configurações. Tente novamente.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      appName: DEFAULT_BRANDING.appName,
      logoUrl: DEFAULT_BRANDING.logoUrl,
      iconUrl: DEFAULT_BRANDING.iconUrl
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Identidade Visual
          </h1>
          <Badge variant="primary">Design System Oficial GH</Badge>
        </div>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Gerencie os elementos visuais corporativos: nome do aplicativo, logotipo do menu lateral e o ícone / favicon exibido na aba do navegador e no aplicativo PWA.
        </p>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulário com os 3 campos oficiais */}
        <div className="lg:col-span-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Marca</CardTitle>
              <CardDescription>
                Informe o nome e os links diretos das imagens oficiais da empresa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} id="branding-form" className="space-y-6">
                {/* 1. Nome da Aplicação */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    1. Nome da Aplicação (appName)
                  </label>
                  <Input
                    type="text"
                    required
                    leftIcon={<Type className="w-4 h-4 text-zinc-400" />}
                    placeholder="Ex: GHRelatórios"
                    value={formData.appName}
                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                    helperText="Exibido no título da página do navegador e no cabeçalho do menu lateral."
                  />
                </div>

                {/* 2. URL da Logomarca do Menu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      2. URL da Logomarca do Menu (logoUrl)
                    </label>
                    <span className="text-[11px] text-zinc-400">Menu Azul #002972</span>
                  </div>
                  <Input
                    type="url"
                    required
                    leftIcon={<ImageIcon className="w-4 h-4 text-zinc-400" />}
                    placeholder="https://.../logo-branco.png"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    helperText="Imagem aplicada no topo do menu lateral com fundo azul escuro (#002972)."
                  />
                  {formData.logoUrl && (
                    <div className="mt-2 p-3 bg-[#002972] rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                      <img
                        src={formData.logoUrl}
                        alt="Preview Logo"
                        className="h-10 max-h-12 max-w-[85%] object-contain brightness-0 invert drop-shadow-md"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 3. URL do Ícone / Favicon */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      3. URL do Ícone / Favicon (faviconUrl / iconUrl)
                    </label>
                    <span className="text-[11px] text-zinc-400">Quadrado (Aba & PWA)</span>
                  </div>
                  <Input
                    type="url"
                    required
                    leftIcon={<Globe className="w-4 h-4 text-zinc-400" />}
                    placeholder="https://.../ICON.jpg"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                    helperText="Ícone na aba do navegador e no app PWA instalado."
                  />
                  {formData.iconUrl && (
                    <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                      {/* Quadrado branco arredondado para garantir visibilidade do ícone */}
                      <div className="bg-white p-2 rounded-2xl shadow-md border border-zinc-200/80 inline-flex items-center justify-center">
                        <img
                          src={formData.iconUrl}
                          alt="Preview Ícone"
                          className="w-12 h-12 rounded-lg object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={handleReset}
              >
                Restaurar Padrões GH
              </Button>
              <Button
                type="submit"
                form="branding-form"
                variant="primary"
                isLoading={saving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Salvar Identidade Visual
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Simulação em Tempo Real */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Simulação em Tempo Real
            </h3>

            {/* 1. Preview da Aba do Navegador com Favicon dinâmico */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm bg-zinc-100 dark:bg-zinc-800 mb-4">
              <div className="bg-zinc-200 dark:bg-zinc-700 px-3 py-2 flex items-center gap-2 border-b border-zinc-300 dark:border-zinc-600">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
                </div>
                {/* Aba do Navegador com Favicon e Nome */}
                <div className="ml-2 flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1 rounded-t-md text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-sm border-t border-x border-zinc-300 dark:border-zinc-700">
                  <img
                    src={formData.iconUrl || DEFAULT_BRANDING.iconUrl}
                    alt="Favicon"
                    className="w-4 h-4 rounded-sm object-contain"
                  />
                  <span>{formData.appName || DEFAULT_BRANDING.appName}</span>
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-zinc-900 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Aba do Navegador: Exibindo o ícone e título definidos.</span>
                <Badge variant="success">Favicon Ativo</Badge>
              </div>
            </div>

            {/* 2. Preview do Menu Lateral Corporativo */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm bg-[#002972] text-white mb-4">
              <div className="p-3 border-b border-white/10 text-[11px] font-semibold text-white/70 uppercase px-4 flex items-center justify-between">
                <span>Menu Lateral Corporativo</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white">#002972</span>
              </div>
              <div className="p-4 flex flex-col items-center justify-center gap-3">
                <img
                  src={formData.logoUrl || DEFAULT_BRANDING.logoUrl}
                  alt="Logo do Menu"
                  className="h-10 max-h-12 max-w-[85%] object-contain brightness-0 invert drop-shadow-md"
                />
                <span className="text-xs font-bold tracking-wide text-white">
                  {formData.appName || DEFAULT_BRANDING.appName}
                </span>

                <div className="w-full mt-2 space-y-1 pt-2 border-t border-white/10">
                  {/* Item Ativo */}
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white text-[#002972] font-semibold shadow-md text-xs">
                    <span className="text-[#002972]">🖨️</span>
                    <span>Impressão Operacional (Ativo)</span>
                  </div>
                  {/* Item Inativo */}
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/90 hover:bg-white/15 text-xs font-medium">
                    <span className="text-white/80">📊</span>
                    <span>Dashboard de Templates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Preview do Card PWA com Quadrado Branco */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm bg-white dark:bg-zinc-900 p-4">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Prompt de Instalação PWA</span>
                <span className="text-[10px] text-zinc-400">Quadrado branco de contraste</span>
              </div>
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                {/* Quadrado branco arredondado para não sumir no monitor */}
                <div className="bg-white p-2 rounded-2xl shadow-md border border-zinc-200/80 inline-flex items-center justify-center shrink-0">
                  <img
                    src={formData.iconUrl || DEFAULT_BRANDING.iconUrl}
                    alt="PWA Icon"
                    className="w-10 h-10 object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    Instalar {formData.appName || DEFAULT_BRANDING.appName}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    Acesso rápido direto da sua tela inicial ou desktop.
                  </p>
                </div>
                <Button size="sm" variant="primary">
                  Baixar App
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
