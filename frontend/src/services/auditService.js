/**
 * auditService.js
 * Serviço client-side para registro de auditoria de acessos e ações no GH Relatórios.
 */

let usuarioAtualCache = null;

export function setUsuarioAuditoria(user) {
  usuarioAtualCache = user;
}

export async function registrarAcaoAuditoria({
  tipo_processo,
  descricao,
  detalhes = {},
  status = 'sucesso',
  usuario_email = null,
  usuario_nome = null
}) {
  try {
    const email = usuario_email || usuarioAtualCache?.email || 'anonimo@sistema.com';
    const nome = usuario_nome || usuarioAtualCache?.displayName || email.split('@')[0];

    const payload = {
      tipo_processo: tipo_processo || 'GERAL',
      descricao: descricao || 'Ação executada no sistema',
      usuario_email: email,
      usuario_nome: nome,
      detalhes: {
        ...detalhes,
        url_atual: window.location.pathname,
        timestamp_client: new Date().toISOString()
      },
      status: status || 'sucesso'
    };

    // Envio não-bloqueante
    fetch('/api/auditoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn('[auditService] Falha ao enviar log de auditoria:', err.message);
    });
  } catch (error) {
    console.warn('[auditService] Erro ao registrar auditoria:', error);
  }
}
