import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { reportarErroSistema } from '../../services/monitorService';
import './ChamadosAdmin.css';

export default function ChamadosAdmin() {
  const { currentUser } = useAuth();

  const [chamados, setChamados] = useState([]);
  const [resumo, setResumo] = useState({ total: 0, a_fazer: 0, em_andamento: 0, finalizado: 0, automaticos: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroOrigem, setFiltroOrigem] = useState('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas');
  const [buscaTexto, setBuscaTexto] = useState('');

  // Seleção Múltipla para Lote
  const [selecionados, setSelecionados] = useState([]);

  // Modais
  const [modalDetalhes, setModalDetalhes] = useState(null);
  const [modalPrompt, setModalPrompt] = useState(false);
  const [promptGerado, setPromptGerado] = useState('');
  const [copiadoSucesso, setCopiadoSucesso] = useState(false);
  const [modalNovoManual, setModalNovoManual] = useState(false);
  const [formManual, setFormManual] = useState({ titulo: '', mensagem: '', prioridade: 'media' });

  useEffect(() => {
    carregarChamados();
  }, [filtroStatus, filtroOrigem, filtroPrioridade]);

  const carregarChamados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (filtroOrigem !== 'todas') params.append('origem', filtroOrigem);
      if (filtroPrioridade !== 'todas') params.append('prioridade', filtroPrioridade);
      if (buscaTexto) params.append('busca', buscaTexto);

      const [resChamados, resResumo] = await Promise.all([
        fetch(`/api/chamados?${params.toString()}`),
        fetch('/api/chamados/resumo')
      ]);

      if (resChamados.ok) setChamados(await resChamados.json());
      if (resResumo.ok) setResumo(await resResumo.json());
    } catch (err) {
      console.error('Erro ao carregar chamados:', err);
    }
    setLoading(false);
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    carregarChamados();
  };

  // Seleção múltipla
  const handleToggleSelecionar = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelecionarTodos = () => {
    if (selecionados.length === chamados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(chamados.map(c => c.id));
    }
  };

  // Alterar Status em Lote (Os 3 Status)
  const handleAlterarStatusLote = async (novoStatus) => {
    if (selecionados.length === 0) return;

    try {
      const res = await fetch('/api/chamados/em-lote/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selecionados,
          status: novoStatus,
          usuario_email: currentUser?.email || 'Administrador'
        })
      });

      if (res.ok) {
        setSelecionados([]);
        carregarChamados();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao alterar status em lote.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao alterar em lote.');
    }
  };

  // Excluir em Lote
  const handleExcluirLote = async () => {
    if (selecionados.length === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selecionados.length} chamado(s)?`)) return;

    try {
      const res = await fetch('/api/chamados/em-lote/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selecionados,
          usuario_email: currentUser?.email || 'Administrador'
        })
      });

      if (res.ok) {
        setSelecionados([]);
        carregarChamados();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir em lote.');
    }
  };

  // Exportar Múltiplos Chamados em Modelo de Prompt para IA
  const handleAbrirModalPrompt = () => {
    const chamadosAlvo = chamados.filter(c => selecionados.includes(c.id));
    if (chamadosAlvo.length === 0) {
      alert('Selecione ao menos um chamado para exportar.');
      return;
    }

    const agora = new Date().toLocaleString('pt-BR');
    let textoPrompt = `# RELATÓRIO DE ERROS E CHAMADOS DO SISTEMA PARA RESOLUÇÃO\n\n`;
    textoPrompt += `**Aplicação**: GH Relatórios (Gerador e Impressão Operacional de Documentos)\n`;
    textoPrompt += `**Data da Extração**: ${agora}\n`;
    textoPrompt += `**Quantidade de Chamados Selecionados**: ${chamadosAlvo.length}\n`;
    textoPrompt += `**Solicitante**: ${currentUser?.email || 'Equipe TI GH'}\n\n`;
    textoPrompt += `------------------------------------------------------------\n\n`;

    chamadosAlvo.forEach((c, idx) => {
      const statusLabel = c.status === 'a_fazer' ? 'A Fazer' : (c.status === 'em_andamento' ? 'Em Andamento' : 'Finalizado');
      textoPrompt += `### Chamado #${idx + 1}: [${c.protocolo}] - ${c.titulo}\n`;
      textoPrompt += `- **Status Atual**: ${statusLabel}\n`;
      textoPrompt += `- **Origem**: ${c.origem} (Auto-monitoramento do Sistema)\n`;
      textoPrompt += `- **Tipo de Erro**: ${c.tipo_erro || 'RUNTIME_JAVASCRIPT'}\n`;
      textoPrompt += `- **Prioridade**: ${(c.prioridade || 'media').toUpperCase()}\n`;
      textoPrompt += `- **Tela / Rota**: ${c.url_tela || '/'}\n`;
      textoPrompt += `- **Usuário Afetado**: ${c.usuario_email || 'Não informado'}\n`;
      textoPrompt += `- **Data de Ocorrência**: ${c.data_criacao || ''}\n`;
      textoPrompt += `- **Ocorrências Detectadas**: ${c.ocorrencias || 1}x\n`;
      textoPrompt += `- **Navegador / Ambiente**: ${c.navegador || 'N/A'}\n\n`;
      textoPrompt += `**Mensagem de Erro:**\n> ${c.mensagem || 'Sem mensagem detalhada'}\n\n`;

      if (c.stack) {
        textoPrompt += `**Stack Trace do Erro:**\n\`\`\`\n${c.stack}\n\`\`\`\n\n`;
      }
      if (c.observacoes) {
        textoPrompt += `**Observações Anteriores:**\n> ${c.observacoes}\n\n`;
      }
      textoPrompt += `------------------------------------------------------------\n\n`;
    });

    textoPrompt += `## SOLICITAÇÃO PARA A IA (Instruções de Resolução):\n`;
    textoPrompt += `Por favor, atue como desenvolvedor sênior fullstack responsável pelo sistema GH Relatórios e realize o seguinte:\n`;
    textoPrompt += `1. **Diagnóstico da Causa Raiz**: Analise detalhadamente cada erro e stack trace listado acima, explicando a falha técnica exata.\n`;
    textoPrompt += `2. **Arquivos Afetados**: Identifique os arquivos específicos do frontend e/ou backend que precisam de intervenção.\n`;
    textoPrompt += `3. **Plano de Correção em Código**: Forneça as alterações de código exatas e definitivas necessárias para eliminar cada falha reportada.\n`;
    textoPrompt += `4. **Medidas Preventivas**: Recomende validações ou tratamentos defensivos adicionais para evitar reincidência.\n`;

    setPromptGerado(textoPrompt);
    setCopiadoSucesso(false);
    setModalPrompt(true);
  };

  const handleCopiarPrompt = () => {
    navigator.clipboard.writeText(promptGerado).then(() => {
      setCopiadoSucesso(true);
      setTimeout(() => setCopiadoSucesso(false), 3000);
    });
  };

  // Simular Erro para teste do Auto-Monitoramento
  const handleSimularErro = () => {
    try {
      // Dispara erro simulado através do monitorService
      reportarErroSistema({
        titulo: 'Teste de Auto-Monitoramento: Falha simulada de conexão ERP',
        mensagem: 'TypeError: Cannot read properties of undefined (reading "execQuery") at PrintOperacional.jsx:42',
        stack: 'TypeError: Cannot read properties of undefined (reading "execQuery")\n  at PrintOperacional.jsx:42:15\n  at commitHookEffectListMount (react-dom.development.js:23150)\n  at commitPassiveMountEffects (react-dom.development.js:23216)',
        tipo_erro: 'RUNTIME_JAVASCRIPT',
        prioridade: 'alta',
        origem: 'AUTOMATICO',
        url_tela: '/imprimir-teste'
      });
      alert('🧪 Erro simulado reportado com sucesso! O chamado foi criado e o e-mail de notificação disparado.');
      setTimeout(carregarChamados, 600);
    } catch (e) {
      console.error(e);
    }
  };

  // Criar Chamado Manual
  const handleSalvarManual = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formManual,
          origem: 'MANUAL',
          usuario_email: currentUser?.email || 'Administrador',
          url_tela: window.location.pathname
        })
      });

      if (res.ok) {
        setModalNovoManual(false);
        setFormManual({ titulo: '', mensagem: '', prioridade: 'media' });
        carregarChamados();
      } else {
        alert('Erro ao criar chamado manual.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Atualizar Status individualmente
  const handleAtualizarStatusIndividual = async (id, novoStatus) => {
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus,
          usuario_email: currentUser?.email || 'Administrador'
        })
      });

      if (res.ok) {
        const atualizado = await res.json();
        setModalDetalhes(atualizado);
        carregarChamados();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatarStatus = (st) => {
    if (st === 'a_fazer') return 'A Fazer';
    if (st === 'em_andamento') return 'Em Andamento';
    if (st === 'finalizado') return 'Finalizado';
    return st;
  };

  return (
    <div className="tickets-container">
      {/* Cabeçalho */}
      <div className="tickets-header">
        <div className="tickets-header-title">
          <h1>🎫 Monitoramento e Chamados Automáticos</h1>
          <p>O próprio aplicativo se auto-monitora capturando exceções e notificando o TI em tempo real.</p>
        </div>

        <div className="tickets-header-actions">
          <button
            onClick={handleSimularErro}
            className="btn-secondary-action"
            title="Dispara um erro controlado para demonstrar o auto-monitoramento e e-mail automático"
          >
            🧪 Testar Auto-Monitoramento
          </button>
          <button
            onClick={() => setModalNovoManual(true)}
            className="btn-primary-action"
          >
            + Abrir Chamado Manual
          </button>
        </div>
      </div>

      {/* Cartões dos 3 Status Principais */}
      <div className="tickets-kpi-grid">
        <div
          className={`ticket-kpi-card ${filtroStatus === 'todos' ? 'selected' : ''}`}
          onClick={() => setFiltroStatus('todos')}
        >
          <div className="ticket-kpi-icon icon-total">📋</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{resumo.total}</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Total de Chamados</div>
          </div>
        </div>

        <div
          className={`ticket-kpi-card ${filtroStatus === 'a_fazer' ? 'selected' : ''}`}
          onClick={() => setFiltroStatus('a_fazer')}
        >
          <div className="ticket-kpi-icon icon-afazer">⏳</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#b45309' }}>{resumo.a_fazer}</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>1. A Fazer</div>
          </div>
        </div>

        <div
          className={`ticket-kpi-card ${filtroStatus === 'em_andamento' ? 'selected' : ''}`}
          onClick={() => setFiltroStatus('em_andamento')}
        >
          <div className="ticket-kpi-icon icon-andamento">⚙️</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#0369a1' }}>{resumo.em_andamento}</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>2. Em Andamento</div>
          </div>
        </div>

        <div
          className={`ticket-kpi-card ${filtroStatus === 'finalizado' ? 'selected' : ''}`}
          onClick={() => setFiltroStatus('finalizado')}
        >
          <div className="ticket-kpi-icon icon-finalizado">✅</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#15803d' }}>{resumo.finalizado}</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>3. Finalizado</div>
          </div>
        </div>
      </div>

      {/* Barra de Ações em Lote quando há seleção */}
      {selecionados.length > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-count">
            <span>☑️ <strong>{selecionados.length}</strong> chamado(s) selecionado(s)</span>
            <button
              onClick={() => setSelecionados([])}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              Desmarcar
            </button>
          </div>

          <div className="bulk-buttons-group">
            <span style={{ fontSize: '12px', color: '#cbd5e1', marginRight: '4px' }}>Alterar status em lote:</span>
            <button
              onClick={() => handleAlterarStatusLote('a_fazer')}
              className="btn-bulk-status btn-status-afazer"
            >
              &rarr; A Fazer
            </button>
            <button
              onClick={() => handleAlterarStatusLote('em_andamento')}
              className="btn-bulk-status btn-status-andamento"
            >
              &rarr; Em Andamento
            </button>
            <button
              onClick={() => handleAlterarStatusLote('finalizado')}
              className="btn-bulk-status btn-status-finalizado"
            >
              &rarr; Finalizado
            </button>

            {/* Exportar em Modelo de Prompt para IA */}
            <button
              onClick={handleAbrirModalPrompt}
              className="btn-bulk-prompt"
              title="Gera prompt completo com os erros para colar no chat com a IA"
            >
              🤖 Exportar em Modelo de Prompt
            </button>

            <button
              onClick={handleExcluirLote}
              className="btn-bulk-delete"
            >
              🗑️ Excluir
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="tickets-filters-card">
        <form onSubmit={handleBuscar} className="tickets-filters-grid">
          <div className="audit-filter-group" style={{ gridColumn: 'span 2' }}>
            <label>Buscar por Texto</label>
            <input
              type="text"
              placeholder="Protocolo, título, mensagem de erro ou rota..."
              value={buscaTexto}
              onChange={e => setBuscaTexto(e.target.value)}
            />
          </div>

          <div className="audit-filter-group">
            <label>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos os Status</option>
              <option value="a_fazer">A Fazer</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>

          <div className="audit-filter-group">
            <label>Origem</label>
            <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}>
              <option value="todas">Todas as Origens</option>
              <option value="AUTOMATICO">Automático (Sistema)</option>
              <option value="MANUAL">Manual (Usuário)</option>
            </select>
          </div>

          <div className="audit-filter-group">
            <label>Prioridade</label>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div className="audit-filter-actions">
            <button type="submit" className="btn-primary-action">
              🔍 Filtrar
            </button>
            <button
              type="button"
              onClick={() => { setBuscaTexto(''); setFiltroStatus('todos'); setFiltroOrigem('todas'); setFiltroPrioridade('todas'); }}
              className="btn-secondary-action"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Chamados */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
          <p>Carregando chamados...</p>
        </div>
      ) : (
        <div className="tickets-table-card">
          <table className="tickets-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={chamados.length > 0 && selecionados.length === chamados.length}
                    onChange={handleSelecionarTodos}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Protocolo</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Título / Erro</th>
                <th>Tela / Rota</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {chamados.map(c => {
                const isSelected = selecionados.includes(c.id);
                return (
                  <tr key={c.id} className={isSelected ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelecionar(c.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', fontFamily: 'monospace', color: '#09339e' }}>
                        {c.protocolo}
                      </span>
                      {c.ocorrencias > 1 && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {c.ocorrencias}x
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-status badge-status-${c.status}`}>
                        {c.status === 'a_fazer' && '⏳ '}
                        {c.status === 'em_andamento' && '⚙️ '}
                        {c.status === 'finalizado' && '✅ '}
                        {formatarStatus(c.status)}
                      </span>
                    </td>
                    <td>
                      {c.origem === 'AUTOMATICO' ? (
                        <span className="badge-origem-auto">🤖 Auto</span>
                      ) : (
                        <span className="badge-origem-manual">👤 Manual</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.titulo}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.mensagem}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>
                      {c.url_tela || '/'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(c.data_criacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setModalDetalhes(c)}
                        style={{
                          padding: '6px 12px',
                          background: '#09339e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}

              {chamados.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum chamado encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Exportar em Modelo de Prompt para IA */}
      {modalPrompt && (
        <div className="audit-modal-backdrop" onClick={() => setModalPrompt(false)}>
          <div className="prompt-modal-content" onClick={e => e.stopPropagation()}>
            <div className="audit-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🤖</span>
                <div>
                  <h3 style={{ margin: 0 }}>Modelo de Prompt para IA / Antigravity</h3>
                  <small style={{ color: '#64748b' }}>{selecionados.length} chamado(s) exportado(s) e formatado(s)</small>
                </div>
              </div>
              <button className="btn-close-modal" onClick={() => setModalPrompt(false)}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
              Copie o prompt estruturado abaixo e cole diretamente aqui na nossa conversa para que possamos analisar a causa raiz e corrigir os arquivos do código automaticamente:
            </p>

            <textarea
              readOnly
              value={promptGerado}
              className="prompt-textarea"
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <div>
                {copiadoSucesso && (
                  <span className="prompt-copy-success">
                    ✅ Prompt copiado! Basta colar aqui no chat da IA (Ctrl+V).
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCopiarPrompt}
                  className="btn-primary-action"
                  style={{ backgroundColor: '#ff6700' }}
                >
                  📋 Copiar Prompt para Área de Transferência
                </button>
                <button
                  type="button"
                  onClick={() => setModalPrompt(false)}
                  className="btn-secondary-action"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Detalhes do Chamado Individual */}
      {modalDetalhes && (
        <div className="audit-modal-backdrop" onClick={() => setModalDetalhes(null)}>
          <div className="audit-modal-content" onClick={e => e.stopPropagation()}>
            <div className="audit-modal-header">
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#09339e', textTransform: 'uppercase' }}>
                  {modalDetalhes.protocolo}
                </span>
                <h3 style={{ margin: '4px 0 0' }}>{modalDetalhes.titulo}</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setModalDetalhes(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Alterar Status:</span>
              <button
                onClick={() => handleAtualizarStatusIndividual(modalDetalhes.id, 'a_fazer')}
                className={`btn-bulk-status btn-status-afazer ${modalDetalhes.status === 'a_fazer' ? 'active' : ''}`}
                style={{ opacity: modalDetalhes.status === 'a_fazer' ? 1 : 0.4 }}
              >
                A Fazer
              </button>
              <button
                onClick={() => handleAtualizarStatusIndividual(modalDetalhes.id, 'em_andamento')}
                className={`btn-bulk-status btn-status-andamento ${modalDetalhes.status === 'em_andamento' ? 'active' : ''}`}
                style={{ opacity: modalDetalhes.status === 'em_andamento' ? 1 : 0.4 }}
              >
                Em Andamento
              </button>
              <button
                onClick={() => handleAtualizarStatusIndividual(modalDetalhes.id, 'finalizado')}
                className={`btn-bulk-status btn-status-finalizado ${modalDetalhes.status === 'finalizado' ? 'active' : ''}`}
                style={{ opacity: modalDetalhes.status === 'finalizado' ? 1 : 0.4 }}
              >
                Finalizado
              </button>
            </div>

            <div className="modal-detail-row">
              <span className="label">Origem:</span>
              <span className="value">{modalDetalhes.origem}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Prioridade:</span>
              <span className="value">{(modalDetalhes.prioridade || 'media').toUpperCase()}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Tela / URL:</span>
              <span className="value">{modalDetalhes.url_tela || '/'}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Usuário:</span>
              <span className="value">{modalDetalhes.usuario_email}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Data de Registro:</span>
              <span className="value">{new Date(modalDetalhes.data_criacao).toLocaleString('pt-BR')}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Navegador:</span>
              <span className="value" style={{ fontSize: '11px', color: '#64748b' }}>{modalDetalhes.navegador}</span>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Mensagem de Erro:
              </label>
              <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '4px', color: '#991b1b', fontSize: '13px', margin: '6px 0 16px' }}>
                {modalDetalhes.mensagem || 'Sem mensagem adicional'}
              </div>
            </div>

            {modalDetalhes.stack && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                  Stack Trace:
                </label>
                <pre className="json-code-box" style={{ maxHeight: '180px' }}>
                  {modalDetalhes.stack}
                </pre>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelecionados([modalDetalhes.id]);
                  setModalDetalhes(null);
                  setTimeout(handleAbrirModalPrompt, 100);
                }}
                className="btn-primary-action"
                style={{ backgroundColor: '#ff6700' }}
              >
                🤖 Gerar Prompt deste Chamado
              </button>
              <button
                onClick={() => setModalDetalhes(null)}
                className="btn-secondary-action"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Novo Chamado Manual */}
      {modalNovoManual && (
        <div className="audit-modal-backdrop" onClick={() => setModalNovoManual(false)}>
          <div className="audit-modal-content" onClick={e => e.stopPropagation()}>
            <div className="audit-modal-header">
              <h3>✍️ Abrir Novo Chamado Manual</h3>
              <button className="btn-close-modal" onClick={() => setModalNovoManual(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarManual}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Título do Chamado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Falha ao carregar modelo de etiqueta Zebra"
                  value={formManual.titulo}
                  onChange={e => setFormManual({ ...formManual, titulo: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Prioridade
                </label>
                <select
                  value={formManual.prioridade}
                  onChange={e => setFormManual({ ...formManual, prioridade: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica (Notificação Emergencial)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  Descrição / Detalhes do Problema *
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="Descreva o que ocorreu, passos para reproduzir ou o que precisa ser ajustado..."
                  value={formManual.mensagem}
                  onChange={e => setFormManual({ ...formManual, mensagem: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="submit" className="btn-primary-action">
                  Salvar e Disparar E-mail
                </button>
                <button type="button" onClick={() => setModalNovoManual(false)} className="btn-secondary-action">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
