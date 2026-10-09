const DEFAULT_BRANDING = {
  appName: 'GHRelatórios',
  logoUrl: 'https://buckettiimagens.s3.us-east-2.amazonaws.com/Imagens-s3/logo+GH+branco.png',
  iconUrl: 'https://ghsolucionador.github.io/LogoseIcons/ICON%20-%20GHRelatorios.jpg',
  faviconUrl: 'https://ghsolucionador.github.io/LogoseIcons/ICON%20-%20GHRelatorios.jpg'
};

const STORAGE_KEY = 'gh_branding_settings';

export const applyBrandingToDOM = (branding) => {
  if (!branding) return;
  const icon = branding.faviconUrl || branding.iconUrl || DEFAULT_BRANDING.iconUrl;
  const name = branding.appName || DEFAULT_BRANDING.appName;

  // Atualiza título da aba do navegador
  if (name) {
    document.title = name;
  }

  // Atualiza favicons no <head>
  const iconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]'
  ];

  iconSelectors.forEach(selector => {
    let link = document.querySelector(selector);
    if (!link) {
      link = document.createElement('link');
      if (selector.includes('apple')) link.rel = 'apple-touch-icon';
      else if (selector.includes('shortcut')) link.rel = 'shortcut icon';
      else link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = icon;
  });
};

export const getBranding = async () => {
  // 1. Tenta carregar do localStorage para render instantâneo
  let cached = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('[Branding] Erro ao ler cache local:', e);
  }

  // 2. Busca do backend
  try {
    const res = await fetch('/api/branding');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      const merged = {
        ...DEFAULT_BRANDING,
        ...data,
        iconUrl: data.iconUrl || data.faviconUrl || DEFAULT_BRANDING.iconUrl,
        faviconUrl: data.faviconUrl || data.iconUrl || DEFAULT_BRANDING.faviconUrl
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      applyBrandingToDOM(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Branding] Erro ao buscar da API, usando cache/padrão:', err);
  }

  const result = cached ? { ...DEFAULT_BRANDING, ...cached } : DEFAULT_BRANDING;
  applyBrandingToDOM(result);
  return result;
};

export const saveBranding = async (branding) => {
  const payload = {
    ...DEFAULT_BRANDING,
    ...branding,
    iconUrl: branding.iconUrl || branding.faviconUrl || DEFAULT_BRANDING.iconUrl,
    faviconUrl: branding.faviconUrl || branding.iconUrl || DEFAULT_BRANDING.faviconUrl
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  applyBrandingToDOM(payload);

  try {
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const saved = await res.json();
      window.dispatchEvent(new CustomEvent('branding-updated', { detail: saved }));
      return saved;
    }
  } catch (e) {
    console.error('[Branding] Erro ao salvar na API:', e);
  }

  window.dispatchEvent(new CustomEvent('branding-updated', { detail: payload }));
  return payload;
};

export { DEFAULT_BRANDING };
