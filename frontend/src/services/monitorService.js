/**
 * monitorService.js
 * Monitoramento global do app GH Relatórios:
 * Captura automática de erros de execução (JavaScript), rejeição de Promises e falhas de requisição,
 * registrando chamados automaticamente no backend.
 */

let usuarioAtual = null;
let initialized = false;
const errosRecentes = new Map(); // Para deduplicação rápida na memória do cliente

export function setUsuarioMonitor(user) {
  usuarioAtual = user;
}

export function reportarErroSistema({
  titulo,
  mensagem,
  stack = '',
  tipo_erro = 'RUNTIME_JAVASCRIPT',
  prioridade = 'alta',
  origem = 'AUTOMATICO',
  url_tela = null
}) {
  try {
    const rota = url_tela || window.location.pathname;
    const msg = String(mensagem || 'Erro não especificado');

    // Chave de deduplicação (mensagem + rota)
    const chaveErro = `${msg}_${rota}`;
    const agora = Date.now();
    const ultimoDisparo = errosRecentes.get(chaveErro);

    // Evita reportar o mesmíssimo erro repetido em menos de 10 segundos
    if (ultimoDisparo && (agora - ultimoDisparo) < 10000) {
      console.warn('[monitorService] Erro idêntico suprimido para evitar flood:', msg);
      return;
    }
    errosRecentes.set(chaveErro, agora);

    const payload = {
      titulo: titulo || `Falha capturada em ${rota}`,
      mensagem: msg,
      stack: stack ? String(stack) : '',
      tipo_erro,
      origem,
      prioridade,
      url_tela: rota,
      usuario_email: usuarioAtual?.email || 'Não autenticado',
      usuario_nome: usuarioAtual?.displayName || '',
      navegador: navigator.userAgent
    };

    fetch('/api/chamados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(dados => {
        console.log(`[monitorService] 🎫 Chamado registrado com sucesso: ${dados.protocolo || dados.id}`);
      })
      .catch(err => {
        console.warn('[monitorService] Falha ao enviar chamado automático:', err.message);
      });
  } catch (e) {
    console.error('[monitorService] Erro fatal no monitoramento:', e);
  }
}

export function initGlobalMonitor() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // 1. Captura erros não tratados de JavaScript
  window.addEventListener('error', (event) => {
    // Ignora erros originados por extensões de terceiros do Chrome/Firefox se não tiverem relação com o app
    const filename = event.filename || '';
    if (filename.includes('chrome-extension://') || filename.includes('moz-extension://')) {
      return;
    }

    reportarErroSistema({
      titulo: `Erro não tratado: ${event.message || 'Exceção JavaScript'}`,
      mensagem: `${event.message} (${filename}:${event.lineno}:${event.colno})`,
      stack: event.error?.stack || `Em ${filename}:${event.lineno}`,
      tipo_erro: 'RUNTIME_JAVASCRIPT',
      prioridade: 'alta',
      origem: 'AUTOMATICO'
    });
  });

  // 2. Captura Promises rejeitadas sem catch (ex: falhas assíncronas / APIs)
  window.addEventListener('unhandledrejection', (event) => {
    const motivo = event.reason;
    const mensagem = motivo instanceof Error ? motivo.message : (typeof motivo === 'string' ? motivo : JSON.stringify(motivo));
    const stack = motivo instanceof Error ? motivo.stack : '';

    reportarErroSistema({
      titulo: `Promessa Rejeitada: ${mensagem ? mensagem.slice(0, 80) : 'Falha Assíncrona'}`,
      mensagem: mensagem || 'Promise rejeitada sem tratamento (unhandledrejection)',
      stack: stack || 'Sem stack trace',
      tipo_erro: 'PROMISE_REJEITADA',
      prioridade: 'alta',
      origem: 'AUTOMATICO'
    });
  });

  console.log('🛡️ [monitorService] Auto-monitoramento de erros ativado no app GH Relatórios.');
}
