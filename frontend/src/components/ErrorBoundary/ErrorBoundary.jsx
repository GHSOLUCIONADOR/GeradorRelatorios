import React from 'react';
import { reportarErroSistema } from '../../services/monitorService';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, ticketOpened: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Registra chamado automaticamente no backend
    reportarErroSistema({
      titulo: `Falha na renderização de tela: ${error.name || 'ComponentError'}`,
      mensagem: error.message || 'Erro inesperado no componente React',
      stack: (error.stack || '') + '\n' + (errorInfo?.componentStack || ''),
      tipo_erro: 'INTERFACE_USUARIO',
      prioridade: 'alta',
      origem: 'AUTOMATICO'
    });
    this.setState({ ticketOpened: true });
  }

  handleRecarregar = () => {
    window.location.reload();
  };

  handleVoltarInicio = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '560px',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '36px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderTop: '4px solid #ef4444'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#0f172a', margin: '0 0 10px', fontSize: '22px' }}>
              Ops! Ocorreu uma instabilidade nesta tela
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Não se preocupe! O sistema de <strong>auto-monitoramento do GH Relatórios</strong> já detectou este problema e 
              <strong> registrou um chamado automaticamente para a equipe de TI</strong> com os detalhes técnicos da falha.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              color: '#334155',
              textAlign: 'left',
              fontFamily: 'monospace',
              maxHeight: '120px',
              overflowY: 'auto',
              marginBottom: '24px'
            }}>
              <strong>Erro:</strong> {this.state.error?.message || 'Falha não identificada'}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRecarregar}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#09339e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 Recarregar Página
              </button>
              <button
                onClick={this.handleVoltarInicio}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
