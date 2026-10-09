import React, { useState, useEffect } from 'react';
import { Button, Modal, Badge } from '../ui';
import './AuditoriaAdmin.css';

export default function AuditoriaAdmin() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'historico'
  const [loading, setLoading] = useState(true);
  
  // Dados
  const [logs, setLogs] = useState([]);
  const [indicadores, setIndicadores] = useState(null);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    data_inicio: '',
    data_fim: '',
    usuario_email: 'todos',
    tipo_processo: 'todos',
    status: 'todos'
  });

  // Modal de detalhes
  const [logSelecionado, setLogSelecionado] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filtros.data_inicio) queryParams.append('data_inicio', filtros.data_inicio);
      if (filtros.data_fim) queryParams.append('data_fim', filtros.data_fim);
      if (filtros.usuario_email && filtros.usuario_email !== 'todos') queryParams.append('usuario_email', filtros.usuario_email);
      if (filtros.tipo_processo && filtros.tipo_processo !== 'todos') queryParams.append('tipo_processo', filtros.tipo_processo);
      if (filtros.status && filtros.status !== 'todos') queryParams.append('status', filtros.status);

      const [resLogs, resInd] = await Promise.all([
        fetch(`/api/auditoria?${queryParams.toString()}&limite=300`),
        fetch(`/api/auditoria/indicadores?${queryParams.toString()}`)
      ]);

      if (resLogs.ok) setLogs(await resLogs.json());
      if (resInd.ok) setIndicadores(await resInd.json());
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    }
    setLoading(false);
  };

  const aplicarFiltros = (e) => {
    if (e) e.preventDefault();
    carregarDados();
  };

  const limparFiltros = () => {
    setFiltros({
      data_inicio: '',
      data_fim: '',
      usuario_email: 'todos',
      tipo_processo: 'todos',
      status: 'todos'
    });
    setTimeout(() => {
      fetch('/api/auditoria?limite=300').then(r => r.json()).then(setLogs);
      fetch('/api/auditoria/indicadores').then(r => r.json()).then(setIndicadores);
    }, 50);
  };

  const aplicarAtalhoData = (dias) => {
    const hoje = new Date();
    const dataFimStr = hoje.toISOString().split('T')[0];

    if (dias === 0) {
      // Hoje
      setFiltros(f => ({ ...f, data_inicio: dataFimStr, data_fim: dataFimStr }));
    } else if (dias > 0) {
      const inicio = new Date();
      inicio.setDate(hoje.getDate() - dias);
      setFiltros(f => ({ ...f, data_inicio: inicio.toISOString().split('T')[0], data_fim: dataFimStr }));
    } else {
      // Todos
      setFiltros(f => ({ ...f, data_inicio: '', data_fim: '' }));
    }
  };

  // Exportar logs filtrados para CSV
  const exportarCSV = () => {
    if (logs.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const headers = ['Data e Hora', 'Usuário', 'Tipo de Processo', 'Status', 'Descrição', 'IP'];
    const rows = logs.map(l => [
      `"${l.data_hora_formatada || l.data_hora}"`,
      `"${l.usuario_email || ''}"`,
      `"${l.tipo_processo || ''}"`,
      `"${l.status || ''}"`,
      `"${(l.descricao || '').replace(/"/g, '""')}"`,
      `"${l.ip || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_gh_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProcessBadgeClass = (tipo) => {
    if (!tipo) return 'badge-default';
    if (tipo.includes('LOGIN')) return 'badge-login';
    if (tipo.includes('LOGOUT')) return 'badge-logout';
    if (tipo.includes('IMPRESSAO') || tipo.includes('PDF')) return 'badge-print';
    if (tipo.includes('MODELO') || tipo.includes('TEMPLATE')) return 'badge-template';
    if (tipo.includes('USUARIO') || tipo.includes('PERFIL')) return 'badge-user';
    if (tipo.includes('CHAMADO')) return 'badge-ticket';
    return 'badge-default';
  };

  return (
    <div className="audit-container">
      {/* Cabeçalho */}
      <div className="audit-header">
        <div className="audit-header-title">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Auditoria e Indicadores
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Rastreabilidade completa de todas as operações, impressões e acessos dos usuários.
          </p>
        </div>

        <div className="audit-tabs">
          <button
            className={`audit-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard & Indicadores
          </button>
          <button
            className={`audit-tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
            onClick={() => setActiveTab('historico')}
          >
            📋 Histórico Completo ({logs.length})
          </button>
        </div>
      </div>

      {/* Cartão de Filtros */}
      <div className="audit-filters-card">
        <form onSubmit={aplicarFiltros}>
          <div className="audit-filters-row">
            <div className="audit-filter-group">
              <label>Data Inicial</label>
              <input
                type="date"
                value={filtros.data_inicio}
                onChange={e => setFiltros({ ...filtros, data_inicio: e.target.value })}
              />
            </div>

            <div className="audit-filter-group">
              <label>Data Final</label>
              <input
                type="date"
                value={filtros.data_fim}
                onChange={e => setFiltros({ ...filtros, data_fim: e.target.value })}
              />
            </div>

            <div className="audit-filter-group">
              <label>Usuário</label>
              <select
                value={filtros.usuario_email}
                onChange={e => setFiltros({ ...filtros, usuario_email: e.target.value })}
              >
                <option value="todos">Todos os Usuários</option>
                {indicadores?.listaUsuarios?.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>

            <div className="audit-filter-group">
              <label>Tipo de Processo</label>
              <select
                value={filtros.tipo_processo}
                onChange={e => setFiltros({ ...filtros, tipo_processo: e.target.value })}
              >
                <option value="todos">Todos os Processos</option>
                <option value="LOGIN">Login no Sistema</option>
                <option value="LOGOUT">Logout</option>
                <option value="NAVEGACAO">Navegação de Telas</option>
                <option value="IMPRESSAO_OPERACIONAL">Impressão de Documento</option>
                <option value="GERACAO_PDF">Geração de PDF</option>
                <option value="CRIACAO_MODELO">Criação de Modelo</option>
                <option value="EDICAO_MODELO">Edição de Modelo</option>
                <option value="EXCLUSAO_MODELO">Exclusão de Modelo</option>
                <option value="CONEXAO_ERP">Conexões ERP</option>
                <option value="CADASTRO_CATEGORIA">Categorias</option>
                <option value="CADASTRO_PERFIL">Perfis de Acesso</option>
                <option value="CADASTRO_USUARIO">Gestão de Usuários</option>
                <option value="ABERTURA_CHAMADO">Abertura de Chamados</option>
                <option value="ATUALIZACAO_CHAMADO">Atualização de Chamados</option>
                <option value="CONFIGURACAO_EMAIL">Configuração de E-mails</option>
              </select>
            </div>

            <div className="audit-filter-actions">
              <button type="submit" className="btn-primary-action">
                🔍 Filtrar
              </button>
              <button type="button" onClick={limparFiltros} className="btn-secondary-action">
                Limpar
              </button>
              <button type="button" onClick={exportarCSV} className="btn-secondary-action" title="Exportar para Excel / CSV">
                📥 CSV
              </button>
            </div>
          </div>

          <div className="audit-quick-dates">
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Atalhos Rápidos:</span>
            <button type="button" className="quick-date-chip" onClick={() => { aplicarAtalhoData(0); carregarDados(); }}>Hoje</button>
            <button type="button" className="quick-date-chip" onClick={() => { aplicarAtalhoData(7); carregarDados(); }}>Últimos 7 Dias</button>
            <button type="button" className="quick-date-chip" onClick={() => { aplicarAtalhoData(30); carregarDados(); }}>Últimos 30 Dias</button>
            <button type="button" className="quick-date-chip" onClick={() => { aplicarAtalhoData(-1); carregarDados(); }}>Todo o Período</button>
          </div>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
          <p>Carregando registros de auditoria...</p>
        </div>
      ) : activeTab === 'dashboard' ? (
        /* --- VISÃO 1: DASHBOARD E INDICADORES --- */
        <>
          {/* Cartões de KPIs */}
          <div className="audit-kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-blue">📈</div>
              <div className="kpi-info">
                <h3>{indicadores?.totalAcoes || 0}</h3>
                <p>Total de Ações Registradas</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">👥</div>
              <div className="kpi-info">
                <h3>{indicadores?.usuariosAtivosCount || 0}</h3>
                <p>Usuários Ativos no Período</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-green">✅</div>
              <div className="kpi-info">
                <h3>{indicadores?.taxaSucesso || 100}%</h3>
                <p>Taxa de Sucesso Operacional</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap kpi-icon-red">⚠️</div>
              <div className="kpi-info">
                <h3>{indicadores?.totalFalha || 0}</h3>
                <p>Falhas / Erros Capturados</p>
              </div>
            </div>
          </div>

          {/* Gráficos e Distribuições */}
          <div className="audit-charts-grid">
            {/* Gráfico 1: Evolução Temporal */}
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <h3>📅 Volume de Ações por Dia</h3>
                <span className="chart-panel-badge">Últimos Dias</span>
              </div>

              {indicadores?.acoesPorDia && indicadores.acoesPorDia.length > 0 ? (
                <div className="bar-chart-container">
                  {(() => {
                    const maxVal = Math.max(...indicadores.acoesPorDia.map(d => d.total), 1);
                    return indicadores.acoesPorDia.map(item => {
                      const alturaPercent = Math.max((item.total / maxVal) * 100, 8);
                      const diaMes = item.data.split('-').slice(1).reverse().join('/');
                      return (
                        <div key={item.data} className="bar-column">
                          <div
                            className="bar-fill"
                            style={{ height: `${alturaPercent}%` }}
                            data-tooltip={`${diaMes}: ${item.total} ações`}
                          />
                          <span className="bar-label">{diaMes}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>Sem dados no período.</p>
              )}
            </div>

            {/* Gráfico 2: Distribuição por Tipo de Processo */}
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <h3>📊 Ações por Tipo de Processo</h3>
                <span className="chart-panel-badge">Participação %</span>
              </div>

              {indicadores?.acoesPorTipo && indicadores.acoesPorTipo.length > 0 ? (
                <div>
                  {indicadores.acoesPorTipo.slice(0, 6).map(item => (
                    <div key={item.tipo} className="dist-item">
                      <div className="dist-item-header">
                        <span className={`badge-process ${getProcessBadgeClass(item.tipo)}`}>
                          {item.tipo}
                        </span>
                        <span>{item.total} ({item.porcentagem}%)</span>
                      </div>
                      <div className="dist-bar-track">
                        <div
                          className="dist-bar-fill"
                          style={{ width: `${item.porcentagem}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>Sem registros.</p>
              )}
            </div>
          </div>

          {/* Ranking de Usuários e Feed Recente */}
          <div className="audit-charts-grid">
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <h3>🏆 Ranking dos Usuários Mais Ativos</h3>
                <span className="chart-panel-badge">Top Usuários</span>
              </div>

              <div className="ranking-list">
                {indicadores?.rankingUsuarios && indicadores.rankingUsuarios.length > 0 ? (
                  indicadores.rankingUsuarios.map((u, i) => (
                    <div key={u.email} className="ranking-item">
                      <div className="ranking-user-info">
                        <div className="user-avatar-circle">
                          {i === 0 ? '🥇' : (u.email[0] || 'U').toUpperCase()}
                        </div>
                        <span className="ranking-user-email">{u.email}</span>
                      </div>
                      <span className="ranking-count-badge">{u.total} ações</span>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Nenhum usuário ativo.</p>
                )}
              </div>
            </div>

            {/* Últimas Ações Registradas */}
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <h3>⚡ Atividades Recentes</h3>
                <button
                  onClick={() => setActiveTab('historico')}
                  style={{ background: 'none', border: 'none', color: '#09339e', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                >
                  Ver todas &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {indicadores?.ultimosLogs && indicadores.ultimosLogs.length > 0 ? (
                  indicadores.ultimosLogs.slice(0, 5).map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                      <div>
                        <strong>{l.usuario_email?.split('@')[0]}</strong>: {l.descricao}
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {l.data_hora_formatada?.split(' ')[1] || ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Nenhuma ação recente.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* --- VISÃO 2: TABELA DE HISTÓRICO COMPLETO --- */
        <div className="audit-table-card">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Data e Hora</th>
                <th>Usuário</th>
                <th>Tipo de Processo</th>
                <th>Descrição da Ação</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>
                    {log.data_hora_formatada || log.data_hora}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="user-avatar-circle" style={{ width: '26px', height: '26px', fontSize: '11px' }}>
                        {(log.usuario_email?.[0] || 'U').toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600' }}>{log.usuario_email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge-process ${getProcessBadgeClass(log.tipo_processo)}`}>
                      {log.tipo_processo}
                    </span>
                  </td>
                  <td style={{ maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.descricao}>
                    {log.descricao}
                  </td>
                  <td>
                    {log.status === 'falha' ? (
                      <span className="badge-status-falha">FALHA</span>
                    ) : (
                      <span className="badge-status-sucesso">SUCESSO</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => setLogSelecionado(log)}
                      style={{
                        padding: '5px 12px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#334155'
                      }}
                    >
                      Inspecionar
                    </button>
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum registro de auditoria encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalhes da Ação */}
      <Modal
        isOpen={!!logSelecionado}
        onClose={() => setLogSelecionado(null)}
        title="Detalhes da Ação de Auditoria"
        size="lg"
        footer={
          <Button
            variant="secondary"
            onClick={() => setLogSelecionado(null)}
          >
            Fechar
          </Button>
        }
      >
        {logSelecionado && (
          <div className="space-y-3">
            <div className="modal-detail-row">
              <span className="label">Data/Hora:</span>
              <span className="value">{logSelecionado.data_hora_formatada || logSelecionado.data_hora}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Usuário:</span>
              <span className="value">{logSelecionado.usuario_email} ({logSelecionado.usuario_nome || 'Sem nome'})</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Tipo Processo:</span>
              <span className="value">
                <span className={`badge-process ${getProcessBadgeClass(logSelecionado.tipo_processo)}`}>
                  {logSelecionado.tipo_processo}
                </span>
              </span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Descrição:</span>
              <span className="value">{logSelecionado.descricao}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">IP de Origem:</span>
              <span className="value">{logSelecionado.ip}</span>
            </div>
            <div className="modal-detail-row">
              <span className="label">Navegador:</span>
              <span className="value" style={{ fontSize: '11px', color: '#64748b' }}>{logSelecionado.user_agent}</span>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Metadados & Parâmetros (JSON):
              </label>
              <pre className="json-code-box max-h-48 overflow-auto">
                {JSON.stringify(logSelecionado.detalhes || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
