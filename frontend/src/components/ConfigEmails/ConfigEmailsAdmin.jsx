import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './ConfigEmailsAdmin.css';

export default function ConfigEmailsAdmin() {
  const { currentUser } = useAuth();

  const [regras, setRegras] = useState([]);
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    remetente_nome: '',
    remetente_email: '',
    tem_senha: false
  });
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  // Teste de Envio
  const [emailTeste, setEmailTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);

  // Feedback de Salvamento
  const [feedbackSalvo, setFeedbackSalvo] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resRegras, resSmtp, resHist] = await Promise.all([
        fetch('/api/notificacoes/regras'),
        fetch('/api/notificacoes/config-smtp'),
        fetch('/api/notificacoes/historico')
      ]);

      if (resRegras.ok) setRegras(await resRegras.json());
      if (resSmtp.ok) setSmtpConfig(await resSmtp.json());
      if (resHist.ok) setHistorico(await resHist.json());
    } catch (err) {
      console.error('Erro ao carregar configurações de e-mail:', err);
    }
    setLoading(false);
  };

  const handleToggleRegra = (id) => {
    setRegras(prev => prev.map(r => r.id === id ? { ...r, ativo: !r.ativo } : r));
  };

  const handleUpdateRegra = (id, campo, valor) => {
    setRegras(prev => prev.map(r => r.id === id ? { ...r, [campo]: valor } : r));
  };

  const handleSalvarRegras = async () => {
    try {
      const res = await fetch('/api/notificacoes/regras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regras,
          usuario_email: currentUser?.email || 'Administrador'
        })
      });

      if (res.ok) {
        setFeedbackSalvo(true);
        setTimeout(() => setFeedbackSalvo(false), 3000);
      } else {
        alert('Erro ao salvar regras.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao salvar regras.');
    }
  };

  const handleSalvarSmtp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/notificacoes/config-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...smtpConfig,
          usuario_email: currentUser?.email || 'Administrador'
        })
      });

      if (res.ok) {
        alert('Configurações do servidor SMTP salvas com sucesso!');
        carregarDados();
      } else {
        alert('Erro ao salvar SMTP.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispararTeste = async (e) => {
    e.preventDefault();
    if (!emailTeste) return;

    setEnviandoTeste(true);
    setResultadoTeste(null);
    try {
      const res = await fetch('/api/notificacoes/teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTeste })
      });
      const data = await res.json();
      setResultadoTeste(data);
      // Atualiza o histórico
      fetch('/api/notificacoes/historico').then(r => r.json()).then(setHistorico);
    } catch (err) {
      setResultadoTeste({ success: false, error: 'Erro de conexão no teste.' });
    }
    setEnviandoTeste(false);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando configurações...</div>;
  }

  return (
    <div className="emails-container">
      <div className="emails-header">
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Configuração de E-mails</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">Defina as regras automáticas de quem deve receber e-mails conforme a execução de processos e abertura de chamados.</p>
      </div>

      <div className="emails-grid">
        {/* Coluna Principal: Regras de Notificação */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', margin: 0, color: '#0f172a' }}>Regras de Disparo por Processo</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {feedbackSalvo && (
                <span style={{ color: '#166534', background: '#dcfce7', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                  ✅ Regras salvas!
                </span>
              )}
              <button onClick={handleSalvarRegras} className="btn-primary-action">
                💾 Salvar Todas as Regras
              </button>
            </div>
          </div>

          {regras.map(regra => (
            <div key={regra.id} className="email-rule-card">
              <div className="rule-header">
                <div className="rule-title">
                  <h3>{regra.nome}</h3>
                  <p>{regra.descricao}</p>
                </div>

                <label className="switch" title={regra.ativo ? 'Desativar regra' : 'Ativar regra'}>
                  <input
                    type="checkbox"
                    checked={regra.ativo}
                    onChange={() => handleToggleRegra(regra.id)}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {regra.ativo && (
                <div>
                  {/* Variadas Formas de Definir Quem Recebe o E-mail */}
                  <div className="recipients-box">
                    <div className="recipients-title">👥 Quem deve receber este e-mail?</div>

                    <div className="recipients-checkbox-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={regra.enviar_administradores}
                          onChange={e => handleUpdateRegra(regra.id, 'enviar_administradores', e.target.checked)}
                        />
                        Administradores do Sistema
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={regra.enviar_autor}
                          onChange={e => handleUpdateRegra(regra.id, 'enviar_autor', e.target.checked)}
                        />
                        Usuário Envolvido / Solicitante
                      </label>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                        E-mails Adicionais do TI / Suporte (separados por vírgula):
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: ti@ghlogistica.com.br, suporte@ghlogistica.com.br"
                        value={regra.emails_personalizados || ''}
                        onChange={e => handleUpdateRegra(regra.id, 'emails_personalizados', e.target.value)}
                        className="custom-emails-input"
                      />
                    </div>
                  </div>

                  {/* Assunto do E-mail */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Modelo do Assunto do E-mail:
                    </label>
                    <input
                      type="text"
                      value={regra.assunto || ''}
                      onChange={e => handleUpdateRegra(regra.id, 'assunto', e.target.value)}
                      className="custom-emails-input"
                    />
                    <small style={{ color: '#94a3b8', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Variáveis disponíveis: &#123;&#123;protocolo&#125;&#125;, &#123;&#123;titulo&#125;&#125;, &#123;&#123;status&#125;&#125;, &#123;&#123;tela&#125;&#125;, &#123;&#123;usuario&#125;&#125;
                    </small>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Coluna Lateral: Servidor Remetente Fixo & Teste de Disparo */}
        <div>
          {/* Cartão de Teste Imediato */}
          <div className="side-panel-card">
            <h3>🧪 Testar Disparo de E-mail</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Envie um e-mail de teste para verificar se o layout e o servidor estão respondendo:
            </p>

            <form onSubmit={handleDispararTeste}>
              <input
                type="email"
                required
                placeholder="Seu e-mail de destino..."
                value={emailTeste}
                onChange={e => setEmailTeste(e.target.value)}
                className="custom-emails-input"
                style={{ marginBottom: '10px' }}
              />
              <button
                type="submit"
                disabled={enviandoTeste}
                className="btn-primary-action"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {enviandoTeste ? 'Enviando...' : '🚀 Disparar Teste Agora'}
              </button>
            </form>

            {resultadoTeste && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '12px',
                backgroundColor: resultadoTeste.success ? '#dcfce7' : '#fee2e2',
                color: resultadoTeste.success ? '#166534' : '#991b1b'
              }}>
                {resultadoTeste.message || resultadoTeste.error}
              </div>
            )}
          </div>

          {/* Configuração do Servidor Remetente Fixo */}
          <div className="side-panel-card">
            <h3>⚙️ Remetente SMTP Fixo</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
              O e-mail de envio é sempre o mesmo definido aqui ou nas variáveis de ambiente.
            </p>

            <form onSubmit={handleSalvarSmtp}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569' }}>Host SMTP</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpConfig.host || ''}
                  onChange={e => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  className="custom-emails-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569' }}>Porta</label>
                  <input
                    type="number"
                    value={smtpConfig.port || 587}
                    onChange={e => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                    className="custom-emails-input"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
                  <label className="checkbox-label" style={{ fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={smtpConfig.secure}
                      onChange={e => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                    />
                    SSL/TLS
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nome Remetente</label>
                <input
                  type="text"
                  placeholder="GH Relatórios - Notificações"
                  value={smtpConfig.remetente_nome || ''}
                  onChange={e => setSmtpConfig({ ...smtpConfig, remetente_nome: e.target.value })}
                  className="custom-emails-input"
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569' }}>E-mail Remetente</label>
                <input
                  type="email"
                  placeholder="sistema@ghlogistica.com.br"
                  value={smtpConfig.remetente_email || ''}
                  onChange={e => setSmtpConfig({ ...smtpConfig, remetente_email: e.target.value })}
                  className="custom-emails-input"
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  Senha / App Key {smtpConfig.tem_senha && <span style={{ color: '#166534' }}>(✓ Configurada)</span>}
                </label>
                <input
                  type="password"
                  placeholder={smtpConfig.tem_senha ? '••••••••' : 'Chave de aplicativo'}
                  value={smtpConfig.pass || ''}
                  onChange={e => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                  className="custom-emails-input"
                />
              </div>

              <button
                type="submit"
                className="btn-secondary-action"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Salvar Dados do Remetente
              </button>
            </form>
          </div>

          {/* Histórico Recente de Disparos */}
          <div className="side-panel-card">
            <h3>📜 Histórico de Disparos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {historico.slice(0, 10).map((h, idx) => (
                <div key={idx} style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                    <span>{h.evento_nome || h.evento_id}</span>
                    <span style={{
                      color: h.status === 'ENVIADO' ? '#166534' : (h.status === 'SIMULADO_SEM_SMTP' ? '#b45309' : '#dc2626')
                    }}>
                      {h.status === 'ENVIADO' ? '✅ Enviado' : (h.status === 'SIMULADO_SEM_SMTP' ? '⚡ Simulado' : '❌ Falha')}
                    </span>
                  </div>
                  <div style={{ color: '#64748b', margin: '2px 0' }}>Para: {h.destinatarios?.join(', ')}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {new Date(h.data_envio).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}

              {historico.length === 0 && (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                  Nenhum e-mail disparado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
