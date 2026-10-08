const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

const AUDIT_FILE = path.join(DATA_DIR, 'auditoria.json');

function readAuditSafe() {
    try {
        if (fs.existsSync(AUDIT_FILE)) {
            const content = fs.readFileSync(AUDIT_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn('[auditService] Erro ao ler auditoria.json:', e.message);
    }
    return [];
}

function writeAuditSafe(data) {
    try {
        fs.writeFileSync(AUDIT_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[auditService] Erro ao salvar auditoria.json:', e.message);
    }
}

// Registrar Ação de Auditoria
async function registrarAcao({
    tipo_processo,
    descricao,
    usuario_email = 'Anônimo',
    usuario_nome = '',
    detalhes = {},
    status = 'sucesso',
    ip = '',
    user_agent = ''
}, db = null) {
    const agora = new Date();
    const logItem = {
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        data_hora: agora.toISOString(),
        data_hora_formatada: agora.toLocaleString('pt-BR'),
        tipo_processo: tipo_processo || 'GERAL',
        descricao: descricao || 'Ação executada no sistema',
        usuario_email: usuario_email || 'Anônimo',
        usuario_nome: usuario_nome || usuario_email.split('@')[0],
        detalhes: detalhes || {},
        status: status || 'sucesso',
        ip: ip || '127.0.0.1',
        user_agent: user_agent || ''
    };

    // Salvar localmente
    const logs = readAuditSafe();
    logs.unshift(logItem);
    if (logs.length > 5000) logs.length = 5000; // Manter histórico de até 5000 registros locais
    writeAuditSafe(logs);

    // Salvar no Firestore se disponível
    if (db) {
        try {
            await db.collection('auditoria').add(logItem);
        } catch (e) {
            // fallback local já gravado
        }
    }

    return logItem;
}

// Listar Logs com Filtros
async function listarLogs(filtros = {}, db = null) {
    let todosLogs = [];

    if (db) {
        try {
            const snap = await db.collection('auditoria')
                .orderBy('data_hora', 'desc')
                .limit(1000)
                .get();
            if (!snap.empty) {
                todosLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        } catch (e) {
            // fallback local
        }
    }

    if (todosLogs.length === 0) {
        todosLogs = readAuditSafe();
    }

    const { data_inicio, data_fim, usuario_email, tipo_processo, status, limite = 100 } = filtros;

    let filtrados = todosLogs;

    if (data_inicio) {
        const dInicio = new Date(data_inicio);
        filtrados = filtrados.filter(l => new Date(l.data_hora) >= dInicio);
    }

    if (data_fim) {
        const dFim = new Date(data_fim);
        dFim.setHours(23, 59, 59, 999);
        filtrados = filtrados.filter(l => new Date(l.data_hora) <= dFim);
    }

    if (usuario_email && usuario_email !== 'todos') {
        const termo = usuario_email.toLowerCase();
        filtrados = filtrados.filter(l => l.usuario_email && l.usuario_email.toLowerCase().includes(termo));
    }

    if (tipo_processo && tipo_processo !== 'todos') {
        filtrados = filtrados.filter(l => l.tipo_processo === tipo_processo);
    }

    if (status && status !== 'todos') {
        filtrados = filtrados.filter(l => l.status === status);
    }

    return filtrados.slice(0, Number(limite));
}

// Calcular Indicadores / Estatísticas do Dashboard
async function obterIndicadores(filtros = {}, db = null) {
    const logs = await listarLogs({ ...filtros, limite: 5000 }, db);

    const totalAcoes = logs.length;
    let totalSucesso = 0;
    let totalFalha = 0;

    const contagemPorTipo = {};
    const contagemPorUsuario = {};
    const contagemPorDia = {};

    logs.forEach(l => {
        if (l.status === 'falha') totalFalha++;
        else totalSucesso++;

        // Tipo
        const tipo = l.tipo_processo || 'OUTROS';
        contagemPorTipo[tipo] = (contagemPorTipo[tipo] || 0) + 1;

        // Usuário
        const user = l.usuario_email || 'Anônimo';
        contagemPorUsuario[user] = (contagemPorUsuario[user] || 0) + 1;

        // Dia (YYYY-MM-DD)
        const dia = l.data_hora ? l.data_hora.split('T')[0] : 'Desconhecido';
        contagemPorDia[dia] = (contagemPorDia[dia] || 0) + 1;
    });

    // Ranking de Usuários
    const rankingUsuarios = Object.entries(contagemPorUsuario)
        .map(([email, total]) => ({ email, total }))
        .sort((a, b) => b.total - a.total);

    // Tipos de Processos
    const acoesPorTipo = Object.entries(contagemPorTipo)
        .map(([tipo, total]) => ({
            tipo,
            total,
            porcentagem: totalAcoes > 0 ? Math.round((total / totalAcoes) * 100) : 0
        }))
        .sort((a, b) => b.total - a.total);

    // Evolução por Dia (ordenado cronologicamente)
    const acoesPorDia = Object.entries(contagemPorDia)
        .map(([data, total]) => ({ data, total }))
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(-30); // Últimos 30 dias

    // Lista de usuários únicos e tipos únicos para os selects de filtro
    const listaUsuarios = Object.keys(contagemPorUsuario);
    const listaTipos = Object.keys(contagemPorTipo);

    return {
        totalAcoes,
        totalSucesso,
        totalFalha,
        taxaSucesso: totalAcoes > 0 ? Math.round((totalSucesso / totalAcoes) * 100) : 100,
        usuariosAtivosCount: listaUsuarios.length,
        rankingUsuarios: rankingUsuarios.slice(0, 10),
        acoesPorTipo,
        acoesPorDia,
        listaUsuarios,
        listaTipos,
        ultimosLogs: logs.slice(0, 15)
    };
}

module.exports = {
    registrarAcao,
    listarLogs,
    obterIndicadores
};
