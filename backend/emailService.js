const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Caminho para armazenamento local de regras e histórico se Firestore não estiver acessível
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

const REGRAS_FILE = path.join(DATA_DIR, 'regras_email.json');
const HISTORICO_FILE = path.join(DATA_DIR, 'historico_emails.json');
const SMTP_CONFIG_FILE = path.join(DATA_DIR, 'config_smtp.json');

// Regras padrão iniciais
const REGRAS_PADRAO = [
    {
        id: 'NOVO_CHAMADO',
        nome: 'Abertura de Chamado (Automático ou Manual)',
        descricao: 'Disparado assim que um novo chamado/erro é registrado no sistema.',
        ativo: true,
        enviar_administradores: true,
        enviar_autor: false,
        emails_personalizados: 'ti@ghlogistica.com.br',
        assunto: '[GH Relatórios - TI] Novo Chamado Aberto: {{protocolo}} - {{titulo}}',
        prioridade_minima: 'todas'
    },
    {
        id: 'CHAMADO_STATUS_ALTERADO',
        nome: 'Mudança de Status do Chamado',
        descricao: 'Disparado quando o status de um ou mais chamados é alterado (A Fazer, Em Andamento, Finalizado).',
        ativo: true,
        enviar_administradores: false,
        enviar_autor: true,
        emails_personalizados: '',
        assunto: '[GH Relatórios] Atualização de Status: Chamado {{protocolo}} ({{status}})',
        prioridade_minima: 'todas'
    },
    {
        id: 'ERRO_CRITICO',
        nome: 'Erro Crítico no Sistema',
        descricao: 'Disparado imediatamente quando um erro de severidade crítica ou falha de banco é capturado.',
        ativo: true,
        enviar_administradores: true,
        enviar_autor: false,
        emails_personalizados: 'ti@ghlogistica.com.br, suporte@ghlogistica.com.br',
        assunto: '[ALERTA CRÍTICO - GH Relatórios] Falha detectada em {{tela}}',
        prioridade_minima: 'critica'
    },
    {
        id: 'CONVITE_USUARIO',
        nome: 'Novo Usuário Convidado',
        descricao: 'Disparado quando um administrador convida um novo usuário para o sistema.',
        ativo: true,
        enviar_administradores: false,
        enviar_autor: true, // o usuário convidado
        emails_personalizados: '',
        assunto: 'Você foi convidado para acessar o GH Relatórios',
        prioridade_minima: 'todas'
    }
];

function readJsonSafe(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn(`[emailService] Falha ao ler ${filePath}:`, e.message);
    }
    return defaultValue;
}

function writeJsonSafe(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn(`[emailService] Falha ao salvar ${filePath}:`, e.message);
    }
}

// Obter configurações SMTP ativas
function getSmtpConfig() {
    const localConfig = readJsonSafe(SMTP_CONFIG_FILE, {});
    return {
        host: localConfig.host || process.env.SMTP_HOST || '',
        port: Number(localConfig.port || process.env.SMTP_PORT || 587),
        secure: (localConfig.secure !== undefined ? localConfig.secure : process.env.SMTP_SECURE) === 'true' || localConfig.secure === true,
        user: localConfig.user || process.env.SMTP_USER || '',
        pass: localConfig.pass || process.env.SMTP_PASS || '',
        remetente_nome: localConfig.remetente_nome || 'GH Relatórios - Sistema',
        remetente_email: localConfig.remetente_email || process.env.SMTP_USER || 'sistema@ghlogistica.com.br'
    };
}

// Salvar configurações SMTP
function saveSmtpConfig(config) {
    const current = getSmtpConfig();
    const updated = {
        host: config.host || current.host,
        port: Number(config.port || current.port),
        secure: config.secure === true || config.secure === 'true',
        user: config.user || current.user,
        pass: config.pass ? config.pass : current.pass, // mantém a senha atual se não enviada
        remetente_nome: config.remetente_nome || current.remetente_nome,
        remetente_email: config.remetente_email || current.remetente_email
    };
    writeJsonSafe(SMTP_CONFIG_FILE, updated);
    return {
        host: updated.host,
        port: updated.port,
        secure: updated.secure,
        user: updated.user,
        remetente_nome: updated.remetente_nome,
        remetente_email: updated.remetente_email,
        has_pass: Boolean(updated.pass)
    };
}

// Obter Regras
async function getRegras(db) {
    if (db) {
        try {
            const doc = await db.collection('configuracoes').doc('regras_email').get();
            if (doc.exists) {
                return doc.data().regras || REGRAS_PADRAO;
            }
        } catch (e) {
            console.warn('[emailService] Firestore offline/unauthenticated, usando fallback local para regras:', e.message);
        }
    }
    return readJsonSafe(REGRAS_FILE, REGRAS_PADRAO);
}

// Salvar Regras
async function saveRegras(regras, db) {
    writeJsonSafe(REGRAS_FILE, regras);
    if (db) {
        try {
            await db.collection('configuracoes').doc('regras_email').set({
                regras,
                data_atualizacao: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.warn('[emailService] Falha ao salvar regras no Firestore:', e.message);
        }
    }
    return regras;
}

// Obter Histórico de Disparos
async function getHistorico(db, limite = 50) {
    if (db) {
        try {
            const snap = await db.collection('historico_emails')
                .orderBy('data_envio', 'desc')
                .limit(limite)
                .get();
            if (!snap.empty) {
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
        } catch (e) {
            // fallback local
        }
    }
    const local = readJsonSafe(HISTORICO_FILE, []);
    return local.slice(0, limite);
}

// Registrar no Histórico
async function registrarHistorico(item, db) {
    const payload = {
        ...item,
        data_envio: new Date().toISOString()
    };
    
    // Local
    const local = readJsonSafe(HISTORICO_FILE, []);
    local.unshift(payload);
    if (local.length > 200) local.length = 200;
    writeJsonSafe(HISTORICO_FILE, local);

    // Firestore
    if (db) {
        try {
            await db.collection('historico_emails').add(payload);
        } catch (e) {
            // ignore
        }
    }
}

// Criar Transportador Nodemailer
function createTransporter() {
    const config = getSmtpConfig();
    if (!config.host || !config.user || !config.pass) {
        return null;
    }
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    });
}

// Buscar e-mails de administradores cadastrados
async function getAdminEmails(db) {
    const emails = [];
    try {
        if (db) {
            const perfisAdminSnap = await db.collection('perfis').where('isAdmin', '==', true).get();
            const adminProfileIds = perfisAdminSnap.docs.map(d => d.id);
            if (adminProfileIds.length > 0) {
                const usersSnap = await db.collection('usuarios').get();
                usersSnap.docs.forEach(doc => {
                    const u = doc.data();
                    if (adminProfileIds.includes(u.perfil_id) && u.email) {
                        emails.push(u.email);
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[emailService] Erro ao buscar administradores:', e.message);
    }
    
    // Garantir ao menos o e-mail padrão se não encontrou
    if (emails.length === 0) {
        emails.push('ana.araujo@ghlogistica.com.br');
    }
    return [...new Set(emails)];
}

// Gerador de Template HTML moderno
function renderHtmlEmail({ titulo, badge, badgeColor, subtitulo, tabelaDetalhes, mensagemDestaque, acaoUrl, acaoTexto }) {
    const rowsHtml = Object.entries(tabelaDetalhes || {}).map(([chave, valor]) => `
        <tr>
            <td style="padding: 10px 14px; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${chave}</td>
            <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${valor || '-'}</td>
        </tr>
    `).join('');

    const statusBadgeHtml = badge ? `
        <span style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor || '#09339e'}; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            ${badge}
        </span>
    ` : '';

    const btnHtml = acaoUrl ? `
        <div style="text-align: center; margin: 30px 0 10px;">
            <a href="${acaoUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #09339e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(9, 51, 158, 0.2);">
                ${acaoTexto || 'Acessar no Sistema'}
            </a>
        </div>
    ` : '';

    const destaqueHtml = mensagemDestaque ? `
        <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; font-family: monospace; font-size: 13px; color: #991b1b; white-space: pre-wrap; word-break: break-all;">
            ${mensagemDestaque}
        </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titulo}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
        <div style="max-width: 620px; margin: 30px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07);">
            <!-- Header Azul GH -->
            <div style="background-color: #09339e; padding: 25px 30px; text-align: left; border-bottom: 3px solid #ff6700;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td>
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">GH Relatórios</h1>
                            <p style="margin: 4px 0 0; color: #cbd5e1; font-size: 12px;">Notificação e Alertas Operacionais</p>
                        </td>
                        <td align="right">
                            <span style="display: inline-block; padding: 4px 8px; background-color: rgba(255,255,255,0.15); color: #fff; font-size: 11px; border-radius: 4px;">Monitoramento Automático</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Corpo -->
            <div style="padding: 30px;">
                ${statusBadgeHtml}
                <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 18px; font-weight: 600;">${titulo}</h2>
                ${subtitulo ? `<p style="margin: 0 0 20px; color: #64748b; font-size: 14px;">${subtitulo}</p>` : ''}

                ${destaqueHtml}

                <!-- Tabela de Detalhes -->
                <div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #ffffff;">
                        ${rowsHtml}
                    </table>
                </div>

                ${btnHtml}
            </div>

            <!-- Rodapé -->
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0 0 4px;">Este é um disparo automático gerado pelo sistema GH Relatórios.</p>
                <p style="margin: 0;">Para alterar quem recebe essas notificações, acesse o módulo de <strong>Configurações de E-mail</strong> no painel administrativo.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Disparar Notificação com base no evento
async function dispararNotificacao(eventoId, dadosContexto = {}, db = null) {
    try {
        const regras = await getRegras(db);
        const regra = regras.find(r => r.id === eventoId);

        if (!regra || !regra.ativo) {
            console.log(`[emailService] Regra '${eventoId}' desativada ou não configurada.`);
            return { enviado: false, motivo: 'REGRA_DESATIVADA' };
        }

        // Montar lista de destinatários conforme a configuração
        const destinatarios = new Set();

        // 1. Administradores
        if (regra.enviar_administradores) {
            const adminEmails = await getAdminEmails(db);
            adminEmails.forEach(e => destinatarios.add(e.trim().toLowerCase()));
        }

        // 2. Autor da ação / usuário envolvido
        if (regra.enviar_autor && dadosContexto.usuario_email) {
            destinatarios.add(dadosContexto.usuario_email.trim().toLowerCase());
        }

        // 3. E-mails personalizados adicionais
        if (regra.emails_personalizados) {
            const extras = regra.emails_personalizados.split(/[,;]/);
            extras.forEach(email => {
                const limpo = email.trim().toLowerCase();
                if (limpo && limpo.includes('@')) {
                    destinatarios.add(limpo);
                }
            });
        }

        const listaDestinatarios = Array.from(destinatarios);
        if (listaDestinatarios.length === 0) {
            console.log(`[emailService] Nenhum destinatário configurado para o evento ${eventoId}.`);
            return { enviado: false, motivo: 'SEM_DESTINATARIOS' };
        }

        // Montar Assunto com interpolação de variáveis
        let assunto = regra.assunto || `[GH Relatórios] Notificação de ${regra.nome}`;
        assunto = assunto
            .replace(/\{\{protocolo\}\}/g, dadosContexto.protocolo || '')
            .replace(/\{\{titulo\}\}/g, dadosContexto.titulo || '')
            .replace(/\{\{status\}\}/g, dadosContexto.status || '')
            .replace(/\{\{tela\}\}/g, dadosContexto.tela || dadosContexto.url_tela || '')
            .replace(/\{\{usuario\}\}/g, dadosContexto.usuario_email || '');

        // Montar Detalhes para o HTML
        const configSmtp = getSmtpConfig();
        const frontendUrl = process.env.FRONTEND_URL || 'https://geradorrelatorios-git-1086248605321.us-east1.run.app';

        let badgeColor = '#09339e';
        let badge = regra.nome;
        let mensagemDestaque = null;

        if (eventoId === 'NOVO_CHAMADO') {
            badgeColor = dadosContexto.prioridade === 'critica' ? '#ef4444' : '#f59e0b';
            badge = `CHAMADO ${dadosContexto.protocolo || ''}`;
            if (dadosContexto.mensagem || dadosContexto.stack) {
                mensagemDestaque = `Erro: ${dadosContexto.mensagem || ''}\n${dadosContexto.stack ? dadosContexto.stack.slice(0, 300) + '...' : ''}`;
            }
        } else if (eventoId === 'ERRO_CRITICO') {
            badgeColor = '#dc2626';
            badge = 'ALERTA CRÍTICO';
            mensagemDestaque = dadosContexto.stack || dadosContexto.mensagem;
        } else if (eventoId === 'CHAMADO_STATUS_ALTERADO') {
            badgeColor = '#10b981';
            badge = `STATUS: ${dadosContexto.status || ''}`;
        }

        const tabelaDetalhes = {
            'Evento': regra.nome,
            'Data e Hora': new Date().toLocaleString('pt-BR'),
            'Usuário / Solicitante': dadosContexto.usuario_email || 'Sistema (Automático)',
            'Tela / Contexto': dadosContexto.url_tela || dadosContexto.tela || 'Geral'
        };

        if (dadosContexto.protocolo) tabelaDetalhes['Protocolo'] = dadosContexto.protocolo;
        if (dadosContexto.titulo) tabelaDetalhes['Título'] = dadosContexto.titulo;
        if (dadosContexto.status) tabelaDetalhes['Status Atual'] = dadosContexto.status;
        if (dadosContexto.prioridade) tabelaDetalhes['Prioridade'] = dadosContexto.prioridade.toUpperCase();
        if (dadosContexto.origem) tabelaDetalhes['Origem'] = dadosContexto.origem;

        const html = renderHtmlEmail({
            titulo: dadosContexto.titulo || regra.nome,
            badge,
            badgeColor,
            subtitulo: regra.descricao,
            tabelaDetalhes,
            mensagemDestaque,
            acaoUrl: `${frontendUrl}/chamados`,
            acaoTexto: 'Visualizar no Painel de Chamados'
        });

        const transporter = createTransporter();
        const remetente = `"${configSmtp.remetente_nome}" <${configSmtp.remetente_email}>`;

        let statusEnvio = 'ENVIADO';
        let detalheEnvio = 'E-mail enviado com sucesso via SMTP.';

        if (transporter) {
            try {
                await transporter.sendMail({
                    from: remetente,
                    to: listaDestinatarios.join(', '),
                    subject: assunto,
                    html
                });
                console.log(`[emailService] E-mail enviado com sucesso para: ${listaDestinatarios.join(', ')}`);
            } catch (err) {
                console.error('[emailService] Erro ao disparar e-mail via SMTP:', err.message);
                statusEnvio = 'FALHA_SMTP';
                detalheEnvio = `Falha no envio SMTP: ${err.message}`;
            }
        } else {
            console.log(`[emailService] SMTP não configurado. Disparo simulado e registrado no histórico para: ${listaDestinatarios.join(', ')}`);
            statusEnvio = 'SIMULADO_SEM_SMTP';
            detalheEnvio = 'SMTP não configurado. O disparo foi processado e simulado com sucesso.';
        }

        // Registrar no histórico
        await registrarHistorico({
            evento_id: eventoId,
            evento_nome: regra.nome,
            assunto,
            destinatarios: listaDestinatarios,
            remetente: configSmtp.remetente_email,
            status: statusEnvio,
            detalhes: detalheEnvio,
            dados_contexto: dadosContexto
        }, db);

        return {
            enviado: statusEnvio === 'ENVIADO' || statusEnvio === 'SIMULADO_SEM_SMTP',
            status: statusEnvio,
            destinatarios: listaDestinatarios,
            assunto
        };

    } catch (error) {
        console.error('[emailService] Erro fatal ao disparar notificação:', error);
        return { enviado: false, error: error.message };
    }
}

// Testar Disparo de E-mail
async function testarDisparo(destinatario, db) {
    const config = getSmtpConfig();
    const transporter = createTransporter();
    
    const subject = '[TESTE] GH Relatórios - Teste de Disparo de E-mail';
    const html = renderHtmlEmail({
        titulo: 'Teste de Configuração de E-mail',
        badge: 'TESTE DE SISTEMA',
        badgeColor: '#10b981',
        subtitulo: 'Este e-mail confirma que as credenciais e o processo de disparo automático estão funcionando perfeitamente.',
        tabelaDetalhes: {
            'Data e Hora': new Date().toLocaleString('pt-BR'),
            'Servidor SMTP': config.host || 'Não definido',
            'Porta SMTP': config.port || '587',
            'Remetente': config.remetente_email,
            'Destinatário': destinatario
        },
        mensagemDestaque: null,
        acaoUrl: process.env.FRONTEND_URL || 'https://geradorrelatorios-git-1086248605321.us-east1.run.app',
        acaoTexto: 'Acessar Sistema GH Relatórios'
    });

    if (transporter) {
        await transporter.sendMail({
            from: `"${config.remetente_nome}" <${config.remetente_email}>`,
            to: destinatario,
            subject,
            html
        });
        await registrarHistorico({
            evento_id: 'TESTE',
            evento_nome: 'Teste de Envio de E-mail',
            assunto: subject,
            destinatarios: [destinatario],
            remetente: config.remetente_email,
            status: 'ENVIADO',
            detalhes: 'Teste disparado manualmente pelo usuário.'
        }, db);
        return { success: true, message: `E-mail de teste enviado para ${destinatario}!` };
    } else {
        await registrarHistorico({
            evento_id: 'TESTE',
            evento_nome: 'Teste de Envio de E-mail (Simulado)',
            assunto: subject,
            destinatarios: [destinatario],
            remetente: config.remetente_email,
            status: 'SIMULADO_SEM_SMTP',
            detalhes: 'Configuração SMTP ausente. Simulação concluída.'
        }, db);
        return { 
            success: true, 
            simulado: true, 
            message: `SMTP não configurado no servidor, mas a regra e o layout foram gerados com sucesso para ${destinatario}. Configure o Host/Usuário/Senha SMTP para envio real.` 
        };
    }
}

module.exports = {
    getRegras,
    saveRegras,
    getSmtpConfig,
    saveSmtpConfig,
    getHistorico,
    dispararNotificacao,
    testarDisparo
};
