const fs = require('fs');
const path = require('path');
const emailService = require('./emailService');
const auditService = require('./auditService');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

const TICKETS_FILE = path.join(DATA_DIR, 'chamados.json');

function readTicketsSafe() {
    try {
        if (fs.existsSync(TICKETS_FILE)) {
            const content = fs.readFileSync(TICKETS_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn('[ticketService] Erro ao ler chamados.json:', e.message);
    }
    return [];
}

function writeTicketsSafe(data) {
    try {
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[ticketService] Erro ao salvar chamados.json:', e.message);
    }
}

// Gerar número de protocolo sequencial legível
function gerarProtocolo(contador = 1) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `CHM-${ano}${mes}${dia}-${randomSuffix}`;
}

// Status válidos permitidos (conforme especificação)
const STATUS_VALIDOS = ['a_fazer', 'em_andamento', 'finalizado'];

// Criar Chamado (Automático ou Manual)
async function criarChamado(dados, db = null) {
    const todos = readTicketsSafe();
    const agora = new Date().toISOString();

    // Deduplicação inteligente de erros automáticos:
    // Se o mesmo erro (mesma mensagem + mesma tela) ocorreu nos últimos 30 segundos,
    // apenas incrementa o contador de ocorrências para evitar flood no banco e na caixa de e-mail.
    if (dados.origem === 'AUTOMATICO' && dados.mensagem) {
        const trintaSegundosAtras = new Date(Date.now() - 30 * 1000).toISOString();
        const existente = todos.find(c => 
            c.mensagem === dados.mensagem &&
            c.url_tela === dados.url_tela &&
            c.status !== 'finalizado' &&
            c.data_atualizacao >= trintaSegundosAtras
        );

        if (existente) {
            existente.ocorrencias = (existente.ocorrencias || 1) + 1;
            existente.data_atualizacao = agora;
            writeTicketsSafe(todos);
            return { ...existente, deduplicado: true };
        }
    }

    const statusInicial = STATUS_VALIDOS.includes(dados.status) ? dados.status : 'a_fazer';
    const protocolo = dados.protocolo || gerarProtocolo(todos.length + 1);

    const novoChamado = {
        id: 'chm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        protocolo,
        titulo: dados.titulo || `Falha capturada em ${dados.url_tela || 'sistema'}`,
        mensagem: dados.mensagem || '',
        stack: dados.stack || '',
        origem: dados.origem || 'AUTOMATICO', // 'AUTOMATICO' ou 'MANUAL'
        tipo_erro: dados.tipo_erro || 'RUNTIME_JAVASCRIPT',
        status: statusInicial, // 'a_fazer' | 'em_andamento' | 'finalizado'
        prioridade: dados.prioridade || (dados.origem === 'AUTOMATICO' ? 'alta' : 'media'),
        usuario_email: dados.usuario_email || 'Não autenticado',
        usuario_nome: dados.usuario_nome || '',
        url_tela: dados.url_tela || '/',
        navegador: dados.navegador || '',
        ocorrencias: 1,
        observacoes: dados.observacoes || '',
        data_criacao: agora,
        data_atualizacao: agora
    };

    // Salvar local
    todos.unshift(novoChamado);
    writeTicketsSafe(todos);

    // Salvar no Firestore se disponível
    if (db) {
        try {
            const ref = await db.collection('chamados').add(novoChamado);
            novoChamado.id = ref.id;
        } catch (e) {
            console.warn('[ticketService] Firestore indisponível para chamados, persistido localmente:', e.message);
        }
    }

    // 1. Auditoria
    try {
        await auditService.registrarAcao({
            tipo_processo: 'ABERTURA_CHAMADO',
            descricao: `Chamado ${novoChamado.protocolo} aberto (${novoChamado.origem}): ${novoChamado.titulo}`,
            usuario_email: novoChamado.usuario_email,
            detalhes: {
                protocolo: novoChamado.protocolo,
                origem: novoChamado.origem,
                prioridade: novoChamado.prioridade,
                url_tela: novoChamado.url_tela
            },
            status: 'sucesso'
        }, db);
    } catch (e) {
        // ignore
    }

    // 2. Disparo de E-mail automático para TI e destinatários configurados
    try {
        await emailService.dispararNotificacao('NOVO_CHAMADO', novoChamado, db);
        if (novoChamado.prioridade === 'critica') {
            await emailService.dispararNotificacao('ERRO_CRITICO', novoChamado, db);
        }
    } catch (errEmail) {
        console.error('[ticketService] Erro ao disparar e-mail de novo chamado:', errEmail.message);
    }

    return novoChamado;
}

// Listar Chamados com Filtros
async function listarChamados(filtros = {}, db = null) {
    let chamados = [];

    if (db) {
        try {
            const snap = await db.collection('chamados').orderBy('data_criacao', 'desc').get();
            if (!snap.empty) {
                chamados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        } catch (e) {
            // fallback local
        }
    }

    if (chamados.length === 0) {
        chamados = readTicketsSafe();
    }

    const { status, prioridade, origem, busca, data_inicio, data_fim, usuario_email } = filtros;

    let resultado = chamados;

    if (status && status !== 'todos') {
        resultado = resultado.filter(c => c.status === status);
    }

    if (prioridade && prioridade !== 'todas') {
        resultado = resultado.filter(c => c.prioridade === prioridade);
    }

    if (origem && origem !== 'todas') {
        resultado = resultado.filter(c => c.origem === origem);
    }

    if (usuario_email && usuario_email !== 'todos') {
        resultado = resultado.filter(c => c.usuario_email && c.usuario_email.toLowerCase().includes(usuario_email.toLowerCase()));
    }

    if (data_inicio) {
        const dIni = new Date(data_inicio);
        resultado = resultado.filter(c => new Date(c.data_criacao) >= dIni);
    }

    if (data_fim) {
        const dFim = new Date(data_fim);
        dFim.setHours(23, 59, 59, 999);
        resultado = resultado.filter(c => new Date(c.data_criacao) <= dFim);
    }

    if (busca) {
        const b = busca.toLowerCase();
        resultado = resultado.filter(c => 
            (c.protocolo && c.protocolo.toLowerCase().includes(b)) ||
            (c.titulo && c.titulo.toLowerCase().includes(b)) ||
            (c.mensagem && c.mensagem.toLowerCase().includes(b)) ||
            (c.url_tela && c.url_tela.toLowerCase().includes(b)) ||
            (c.usuario_email && c.usuario_email.toLowerCase().includes(b))
        );
    }

    return resultado;
}

// Obter Resumo de Chamados por Status (KPIs)
async function obterResumoChamados(db = null) {
    const chamados = await listarChamados({}, db);

    const resumo = {
        total: chamados.length,
        a_fazer: 0,
        em_andamento: 0,
        finalizado: 0,
        automaticos: 0,
        manuais: 0,
        criticos: 0
    };

    chamados.forEach(c => {
        if (c.status === 'a_fazer') resumo.a_fazer++;
        else if (c.status === 'em_andamento') resumo.em_andamento++;
        else if (c.status === 'finalizado') resumo.finalizado++;

        if (c.origem === 'AUTOMATICO') resumo.automaticos++;
        else resumo.manuais++;

        if (c.prioridade === 'critica') resumo.criticos++;
    });

    return resumo;
}

// Atualizar Chamado Individual
async function atualizarChamado(id, dados, usuarioEmail = '', db = null) {
    const todos = readTicketsSafe();
    const index = todos.findIndex(c => c.id === id);

    if (index === -1) {
        throw new Error('Chamado não encontrado');
    }

    const statusAnterior = todos[index].status;
    const atualizado = {
        ...todos[index],
        ...dados,
        data_atualizacao: new Date().toISOString()
    };

    // Validação de status
    if (dados.status && !STATUS_VALIDOS.includes(dados.status)) {
        throw new Error(`Status inválido. Deve ser um de: ${STATUS_VALIDOS.join(', ')}`);
    }

    todos[index] = atualizado;
    writeTicketsSafe(todos);

    if (db) {
        try {
            await db.collection('chamados').doc(id).set(atualizado, { merge: true });
        } catch (e) {
            // ignore
        }
    }

    // Se o status mudou, registrar e disparar notificação
    if (dados.status && dados.status !== statusAnterior) {
        await auditService.registrarAcao({
            tipo_processo: 'ATUALIZACAO_CHAMADO',
            descricao: `Status do chamado ${atualizado.protocolo} alterado de '${statusAnterior}' para '${dados.status}'`,
            usuario_email: usuarioEmail || atualizado.usuario_email,
            detalhes: {
                id,
                protocolo: atualizado.protocolo,
                status_anterior: statusAnterior,
                status_novo: dados.status
            }
        }, db);

        // Notificação de e-mail de mudança de status
        try {
            await emailService.dispararNotificacao('CHAMADO_STATUS_ALTERADO', {
                ...atualizado,
                status_anterior: statusAnterior
            }, db);
        } catch (e) {
            // ignore
        }
    }

    return atualizado;
}

// Alterar Status em Lote de Múltiplos Chamados
async function alterarStatusEmLote(ids, novoStatus, usuarioEmail = '', db = null) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Nenhum chamado informado para alteração em lote.');
    }

    if (!STATUS_VALIDOS.includes(novoStatus)) {
        throw new Error(`Status inválido: ${novoStatus}. Use: ${STATUS_VALIDOS.join(', ')}`);
    }

    const todos = readTicketsSafe();
    const agora = new Date().toISOString();
    const chamadosModificados = [];

    todos.forEach(c => {
        if (ids.includes(c.id)) {
            const statusAntigo = c.status;
            c.status = novoStatus;
            c.data_atualizacao = agora;
            chamadosModificados.push({ ...c, status_anterior: statusAntigo });
        }
    });

    writeTicketsSafe(todos);

    if (db) {
        try {
            const batch = db.batch();
            for (const id of ids) {
                const docRef = db.collection('chamados').doc(id);
                batch.update(docRef, {
                    status: novoStatus,
                    data_atualizacao: agora
                });
            }
            await batch.commit();
        } catch (e) {
            console.warn('[ticketService] Erro ao atualizar lote no Firestore:', e.message);
        }
    }

    // Registrar ação em lote na Auditoria
    await auditService.registrarAcao({
        tipo_processo: 'ATUALIZACAO_CHAMADO_LOTE',
        descricao: `Alteração em lote: ${ids.length} chamado(s) atualizado(s) para status '${novoStatus}'`,
        usuario_email: usuarioEmail || 'Sistema',
        detalhes: {
            quantidade: ids.length,
            ids,
            novo_status: novoStatus
        }
    }, db);

    // Disparar notificação por e-mail para a equipe
    if (chamadosModificados.length > 0) {
        try {
            await emailService.dispararNotificacao('CHAMADO_STATUS_ALTERADO', {
                protocolo: `${chamadosModificados.length} chamados em lote`,
                titulo: `Atualização em lote para status '${novoStatus}'`,
                status: novoStatus,
                usuario_email: usuarioEmail,
                url_tela: '/chamados'
            }, db);
        } catch (e) {
            // ignore
        }
    }

    return {
        success: true,
        quantidade_atualizada: chamadosModificados.length,
        novo_status: novoStatus
    };
}

// Excluir Chamado
async function excluirChamado(id, usuarioEmail = '', db = null) {
    const todos = readTicketsSafe();
    const ticket = todos.find(c => c.id === id);
    const filtrados = todos.filter(c => c.id !== id);

    writeTicketsSafe(filtrados);

    if (db) {
        try {
            await db.collection('chamados').doc(id).delete();
        } catch (e) {
            // ignore
        }
    }

    if (ticket) {
        await auditService.registrarAcao({
            tipo_processo: 'EXCLUSAO_CHAMADO',
            descricao: `Chamado ${ticket.protocolo} excluído`,
            usuario_email: usuarioEmail,
            detalhes: { id, protocolo: ticket.protocolo }
        }, db);
    }

    return { success: true };
}

// Excluir Múltiplos Chamados em Lote
async function excluirEmLote(ids, usuarioEmail = '', db = null) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Nenhum chamado informado para exclusão.');
    }

    const todos = readTicketsSafe();
    const filtrados = todos.filter(c => !ids.includes(c.id));
    writeTicketsSafe(filtrados);

    if (db) {
        try {
            const batch = db.batch();
            for (const id of ids) {
                batch.delete(db.collection('chamados').doc(id));
            }
            await batch.commit();
        } catch (e) {
            // ignore
        }
    }

    await auditService.registrarAcao({
        tipo_processo: 'EXCLUSAO_CHAMADO_LOTE',
        descricao: `Exclusão em lote de ${ids.length} chamado(s)`,
        usuario_email: usuarioEmail,
        detalhes: { ids, quantidade: ids.length }
    }, db);

    return { success: true, quantidade_excluida: ids.length };
}

module.exports = {
    criarChamado,
    listarChamados,
    obterResumoChamados,
    atualizarChamado,
    alterarStatusEmLote,
    excluirChamado,
    excluirEmLote,
    STATUS_VALIDOS
};
