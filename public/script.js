// =====================================================
// JORNADA ACADÊMICA — SCRIPT PRINCIPAL
// =====================================================

const API = '';

let state = {
    studies:        [],
    subjects:       [],
    formacoes:      [],
    filterSubject:  null,
    filterFormacao: null,
    filterStatus:   '',
    searchTerm:     '',
    currentMonth:   new Date(),
    currentPage:    'dashboard',
    isLoading:      false
};

let editingId         = null;
let deleteId          = null;
let currentTab        = 0;
const tabs            = ['tab-geral', 'tab-questoes', 'tab-revisao'];

let currentMonth      = new Date();
let currentDateFilter = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    currentDateFilter = null;
    updateMonthDisplay();
    setupConnectionStatus();
    setupUppercaseInputs();
    carregarTudo();
    setInterval(checkConnection, 15000);
});

function getTodayString() {
    const d   = new Date();
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// =====================================================
// NAVEGAÇÃO ENTRE PÁGINAS
// =====================================================
const PAGE_META = {
    dashboard:   { title: 'Dashboard',   context: 'Visão geral do mês',   showSearch: false, showFilters: false, showCalendar: false },
    hoje:        { title: 'Hoje',        context: '',                       showSearch: false, showFilters: false, showCalendar: false },
    programados: { title: 'Programados', context: '',                       showSearch: true,  showFilters: true,  showCalendar: true  },
    revisao:     { title: 'Revisão',     context: 'Pendentes de revisão',  showSearch: false, showFilters: false, showCalendar: false },
};

function navigateTo(page, navEl) {
    // Atualiza itens do nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navEl) navEl.classList.add('active');

    // Exibe a página correta
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    state.currentPage = page;

    // Topbar
    const meta = PAGE_META[page] || { title: page, context: '', showSearch: false, showFilters: false, showCalendar: false };
    document.getElementById('topbarPageTitle').textContent = meta.title;

    const searchWrap  = document.getElementById('topbarSearchWrap');
    const filtersWrap = document.getElementById('topbarFilters');
    const calBtn      = document.getElementById('calendarBtn');

    if (searchWrap)  searchWrap.style.display  = meta.showSearch  ? 'flex'  : 'none';
    if (filtersWrap) filtersWrap.style.display  = meta.showFilters ? 'flex'  : 'none';
    if (calBtn)      calBtn.style.display       = meta.showCalendar ? 'flex' : 'none';

    // Contexto dinâmico
    let contextText = meta.context;
    if (page === 'programados') {
        const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        contextText = `${months[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;
    } else if (page === 'hoje') {
        const hoje = new Date();
        contextText = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    }
    document.getElementById('topbarPageContext').textContent = contextText ? '· ' + contextText : '';

    // Renderiza conteúdo específico
    if (page === 'hoje')        renderHoje();
    if (page === 'revisao')     renderRevisao();
    if (page === 'dashboard')   updateDashboard();
    if (page === 'programados') updateTable();

    // Fecha sidebar em mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('mobile-open');
    }
}

// =====================================================
// SIDEBAR TOGGLE
// =====================================================
function toggleSidebar() {
    const sidebar    = document.getElementById('sidebar');
    const wrapper    = document.getElementById('appWrapper');
    const isMobile   = window.innerWidth <= 768;

    if (isMobile) {
        sidebar.classList.toggle('mobile-open');
    } else {
        sidebar.classList.toggle('collapsed');
        wrapper.classList.toggle('sidebar-collapsed');
    }
}

// =====================================================
// UPPERCASE
// =====================================================
function forceUppercase(e) {
    const el    = e.target;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    el.value    = el.value.toUpperCase();
    el.setSelectionRange(start, end);
}

function setupUppercaseInputs() {
    applyUppercaseToExisting(document);
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) applyUppercaseToExisting(node);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function applyUppercaseToExisting(root) {
    const sel  = 'input[type="text"], input:not([type]), textarea';
    const els  = root.querySelectorAll ? root.querySelectorAll(sel) : [];
    els.forEach(el => {
        if (!el.dataset.uppercaseApplied) {
            el.addEventListener('input', forceUppercase);
            el.dataset.uppercaseApplied = 'true';
        }
    });
    if (root.matches && root.matches(sel) && !root.dataset.uppercaseApplied) {
        root.addEventListener('input', forceUppercase);
        root.dataset.uppercaseApplied = 'true';
    }
}

// =====================================================
// API HELPERS
// =====================================================
async function apiFetch(path, options = {}) {
    const url = API + path;
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || res.statusText);
        }
        return res.json();
    } catch (err) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            throw new Error(`Não foi possível conectar ao servidor (${url}).`);
        }
        throw err;
    }
}

// =====================================================
// CARREGAR DADOS
// =====================================================
async function carregarTudo() {
    setLoading(true);
    try {
        const mes = state.currentMonth.getMonth() + 1;
        const ano = state.currentMonth.getFullYear();

        const [materias, formacoes, estudos] = await Promise.all([
            apiFetch('/api/materias'),
            apiFetch('/api/formacoes'),
            apiFetch(`/api/estudos?mes=${mes}&ano=${ano}`)
        ]);

        state.subjects  = materias;
        state.formacoes = formacoes;
        state.studies   = estudos;

        atualizarInterface();
        showToast('Dados atualizados', 'success');
    } catch (err) {
        showToast('Erro ao carregar dados: ' + err.message, 'error');
        console.error('[carregarTudo]', err);
    } finally {
        setLoading(false);
    }
}

function setLoading(v) {
    state.isLoading = v;
    const el = document.getElementById('loadingIndicator');
    if (el) el.style.display = v ? 'flex' : 'none';
}

// =====================================================
// INTERFACE GERAL
// =====================================================
function atualizarInterface() {
    populateSelects();
    updateDashboard();
    updateTable();
    renderHoje();
    renderRevisao();
    updateMonthDisplay();
    updateBadges();
}

function populateSelects() {
    const selMateria = document.getElementById('materia');
    if (selMateria) {
        const cur = selMateria.value;
        selMateria.innerHTML = '<option value="">Selecione uma matéria</option>';
        state.subjects.forEach(s => {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.nome;
            selMateria.appendChild(o);
        });
        selMateria.value = cur;
    }

    const selFormacao = document.getElementById('formacao');
    if (selFormacao) {
        const cur = selFormacao.value;
        selFormacao.innerHTML = '<option value="">Selecione uma formação</option>';
        state.formacoes.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id; o.textContent = f.nome;
            selFormacao.appendChild(o);
        });
        selFormacao.value = cur;
    }

    const fMateria = document.getElementById('filterMateria');
    if (fMateria) {
        const cur = fMateria.value;
        fMateria.innerHTML = '<option value="">Todas Matérias</option>';
        state.subjects.forEach(s => {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.nome;
            fMateria.appendChild(o);
        });
        fMateria.value = cur || state.filterSubject || '';
    }

    const fFormacao = document.getElementById('filterFormacao');
    if (fFormacao) {
        const cur = fFormacao.value;
        fFormacao.innerHTML = '<option value="">Todas Formações</option>';
        state.formacoes.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id; o.textContent = f.nome;
            fFormacao.appendChild(o);
        });
        fFormacao.value = cur || state.filterFormacao || '';
    }
}

// =====================================================
// BADGES DO NAV
// =====================================================
function updateBadges() {
    const hoje = getTodayString();

    // Badge "Hoje": estudos com data_estudo == hoje (não concluídos) + revisões com data_revisao == hoje
    const estudosHoje = state.studies.filter(s =>
        !s.concluido && s.data_estudo === hoje
    );
    const revisoesHoje = state.studies.filter(s =>
        s.data_revisao === hoje && !s.revisao_concluida
    );
    const totalHoje = estudosHoje.length + revisoesHoje.length;
    const bHoje = document.getElementById('badgeHoje');
    if (bHoje) {
        bHoje.textContent  = totalHoje;
        bHoje.style.display = totalHoje > 0 ? 'inline-block' : 'none';
    }

    // Badge "Revisão": revisões pendentes não concluídas
    const revisoesTotal = state.studies.filter(s =>
        s.data_revisao && s.data_revisao.trim() !== '' && !s.revisao_concluida
    ).length;
    const bRev = document.getElementById('badgeRevisao');
    if (bRev) {
        bRev.textContent  = revisoesTotal;
        bRev.style.display = revisoesTotal > 0 ? 'inline-block' : 'none';
    }
}

// =====================================================
// REGRAS DE NEGÓCIO
// =====================================================
function calcularDesempenho(study) {
    const qtd     = parseInt(study.quantidade)    || 0;
    const acertos = parseInt(study.total_acertos) || 0;
    if (qtd <= 0) return 100;
    return (acertos / qtd) * 100;
}

function exigeRevisao(study) {
    const qtd = parseInt(study.quantidade) || 0;
    if (qtd <= 0) return false;
    return calcularDesempenho(study) < 85;
}

function getStudyStatus(study) {
    if (study.concluido) return 'finalizado';
    if (!study.data_estudo) return 'programado';
    const hoje = getTodayString();
    if (study.data_estudo < hoje) return 'fora-prazo';
    if (study.data_revisao && study.data_revisao.trim() !== '') return 'revisao';
    return 'programado';
}

// =====================================================
// DASHBOARD
// =====================================================
function updateDashboard() {
    const hoje = getTodayString();
    const ms   = getStudiesForCurrentMonth();

    const finalizados = ms.filter(s => s.concluido).length;
    const foraPrazo   = ms.filter(s => !s.concluido && s.data_estudo && s.data_estudo < hoje).length;
    const programados = ms.filter(s => !s.concluido && (!s.data_estudo || s.data_estudo >= hoje) && !(s.data_revisao && s.data_revisao.trim())).length;
    const revisao     = ms.filter(s => s.data_revisao && s.data_revisao.trim() !== '').length;

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('dashboardFinalizados', finalizados);
    setEl('dashboardForaPrazo',   foraPrazo);
    setEl('dashboardProgramados', programados);
    setEl('dashboardRevisao',     revisao);

    atualizarPulseBadge(document.getElementById('cardForaPrazo'), foraPrazo);
    atualizarPulseBadge(document.getElementById('cardRevisao'),   revisao);

    renderDesempenhoTable(ms);
    renderPerfSummary(ms);
}

function atualizarPulseBadge(card, count) {
    if (!card) return;
    let badge = card.querySelector('.pulse-badge');
    if (count > 0) {
        card.classList.add('has-alert');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'pulse-badge';
            card.appendChild(badge);
        }
        badge.textContent   = count;
        badge.style.display = 'flex';
    } else {
        card.classList.remove('has-alert');
        if (badge) badge.style.display = 'none';
    }
}

function getStudiesForCurrentMonth() {
    return state.studies.filter(s => {
        if (!s.data_estudo) return false;
        const [y, m] = s.data_estudo.split('-').map(Number);
        return m === state.currentMonth.getMonth() + 1 && y === state.currentMonth.getFullYear();
    });
}

function renderDesempenhoTable(estudos) {
    const tbody = document.getElementById('desempenhoTableBody');
    if (!tbody) return;

    // Agrupa por matéria
    const byMateria = {};
    estudos.forEach(s => {
        const key = s.materia_id || 'sem-materia';
        if (!byMateria[key]) {
            byMateria[key] = {
                nome:     (s.materia_nome || 'Sem matéria').toUpperCase(),
                estudos:  0,
                questoes: 0,
                acertos:  0,
            };
        }
        byMateria[key].estudos++;
        const qtd     = parseInt(s.quantidade)    || 0;
        const acertos = parseInt(s.total_acertos) || 0;
        byMateria[key].questoes += qtd;
        byMateria[key].acertos  += acertos;
    });

    const entries = Object.values(byMateria);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum estudo neste mês.</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(e => {
        const perf = e.questoes > 0
            ? Math.round((e.acertos / e.questoes) * 100)
            : 100;
        const color = perf >= 85 ? '#16a34a' : perf >= 70 ? '#f59e0b' : '#dc2626';
        return `
        <tr>
            <td style="font-weight:500">${e.nome}</td>
            <td>${e.estudos}</td>
            <td>${e.questoes || '—'}</td>
            <td>${e.questoes > 0 ? e.acertos : '—'}</td>
            <td>
                <div class="perf-bar-wrap">
                    <div class="perf-bar">
                        <div class="perf-fill" style="width:${perf}%;background:${color}"></div>
                    </div>
                    <span class="perf-pct" style="color:${color}">${perf}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Atualiza sub-título
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const subEl = document.getElementById('dashPerfSub');
    if (subEl) subEl.textContent = `${months[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;
}

function renderPerfSummary(estudos) {
    const grid = document.getElementById('perfSummaryGrid');
    if (!grid) return;

    let totalQ = 0, totalA = 0;
    estudos.forEach(s => {
        totalQ += parseInt(s.quantidade)    || 0;
        totalA += parseInt(s.total_acertos) || 0;
    });
    const media = totalQ > 0 ? Math.round((totalA / totalQ) * 100) : 0;
    const mediaColor = media >= 85 ? '#16a34a' : media >= 70 ? '#f59e0b' : '#dc2626';

    grid.innerHTML = `
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:${mediaColor}">${media}%</div>
            <div class="perf-summary-lbl">Média geral do mês</div>
        </div>
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:var(--primary)">${totalQ}</div>
            <div class="perf-summary-lbl">Total de questões</div>
        </div>
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:var(--info)">${totalA}</div>
            <div class="perf-summary-lbl">Total de acertos</div>
        </div>`;
}

// =====================================================
// MODAIS DE DASHBOARD
// =====================================================
function abrirModalDashboard(tipo) {
    const hoje = getTodayString();
    const ms   = getStudiesForCurrentMonth();
    let title, lista;

    if (tipo === 'finalizados') {
        title = 'Estudos Finalizados';
        lista = ms.filter(s => s.concluido);
    } else if (tipo === 'fora-prazo') {
        title = 'Estudos Fora do Prazo';
        lista = ms.filter(s => !s.concluido && s.data_estudo && s.data_estudo < hoje);
    } else if (tipo === 'revisao') {
        title = 'Revisões Agendadas';
        lista = ms.filter(s => s.data_revisao && s.data_revisao.trim() !== '');
    } else {
        title = 'Estudos Programados';
        lista = ms.filter(s => !s.concluido && (!s.data_estudo || s.data_estudo >= hoje) && !(s.data_revisao && s.data_revisao.trim()));
    }

    if (lista.length === 0) { showToast('Nenhum item encontrado', 'error'); return; }

    const body = document.getElementById('dashboardModalBody');
    let html = `
        <table>
            <thead><tr>
                <th>Formação</th><th>Matéria</th><th>Conteúdo</th><th>Data</th>
            </tr></thead>
            <tbody>`;
    lista.forEach(item => {
        const dataExibir = tipo === 'revisao'
            ? formatDateBR(item.data_revisao)
            : formatDateBR(item.data_estudo);
        html += `<tr>
            <td>${(item.formacao_nome || '—').toUpperCase()}</td>
            <td>${(item.materia_nome  || '—').toUpperCase()}</td>
            <td>${(item.conteudo      || '—').toUpperCase()}</td>
            <td>${dataExibir}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    body.innerHTML = html;
    document.getElementById('dashboardModalTitle').textContent = title;
    document.getElementById('dashboardModal').classList.add('show');
}

function closeDashboardModal() {
    document.getElementById('dashboardModal').classList.remove('show');
}

// =====================================================
// TABELA PROGRAMADOS
// =====================================================
function filterStudies() {
    state.searchTerm     = (document.getElementById('search')?.value || '').trim().toLowerCase();
    state.filterSubject  = document.getElementById('filterMateria')?.value  || null;
    state.filterFormacao = document.getElementById('filterFormacao')?.value || null;
    state.filterStatus   = document.getElementById('filterStatus')?.value   || '';
    updateTable();
}

function updateTable() {
    const tbody = document.getElementById('estudosTableBody');
    if (!tbody) return;

    let filtered = state.studies.filter(study => {
        if (currentDateFilter) {
            if (study.data_estudo !== currentDateFilter) return false;
        } else {
            if (study.data_estudo) {
                const [y, m] = study.data_estudo.split('-').map(Number);
                if (m !== state.currentMonth.getMonth() + 1 || y !== state.currentMonth.getFullYear()) return false;
            }
        }
        if (state.filterSubject  && study.materia_id  != state.filterSubject)  return false;
        if (state.filterFormacao && study.formacao_id != state.filterFormacao)  return false;
        if (state.searchTerm) {
            const hay = [study.materia_nome||'', study.formacao_nome||'', study.conteudo||'', study.unidade||''].join(' ').toLowerCase();
            if (!hay.includes(state.searchTerm)) return false;
        }
        if (state.filterStatus && getStudyStatus(study) !== state.filterStatus) return false;
        return true;
    });

    filtered.sort((a, b) => a.id - b.id);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-row">Nenhum estudo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(study => {
        const semQ          = !study.quantidade || parseInt(study.quantidade) <= 0;
        const desNum        = calcularDesempenho(study);
        const desStr        = semQ ? '100%' : desNum.toFixed(0) + '%';
        const desColor      = semQ ? '#6b7280' : desNum < 85 ? '#dc2626' : '#16a34a';
        const rowClass      = study.concluido ? 'row-done' : '';
        const status        = getStudyStatus(study);
        const statusClass   = { 'finalizado':'s-finalizado','fora-prazo':'s-fora-prazo','programado':'s-programado','revisao':'s-revisao' }[status] || 's-programado';
        const statusDisplay = status.replace('-', ' ').toUpperCase();

        return `
        <tr class="${rowClass}" data-id="${study.id}">
            <td class="checkbox-col">
                <div class="checkbox-wrap">
                    <input type="checkbox" id="chk-${study.id}" ${study.concluido ? 'checked' : ''} onchange="toggleFinalizado('${study.id}', this.checked)" class="styled-check">
                    <label for="chk-${study.id}" class="check-label"></label>
                </div>
            </td>
            <td>${(study.formacao_nome || '—').toUpperCase()}</td>
            <td>${(study.materia_nome  || '—').toUpperCase()}</td>
            <td>${study.unidade  ? study.unidade.toUpperCase()  : '—'}</td>
            <td>${study.conteudo ? study.conteudo.toUpperCase() : '—'}</td>
            <td>${study.quantidade || '—'}</td>
            <td style="color:${desColor};font-weight:500;font-variant-numeric:tabular-nums">${desStr}</td>
            <td><span class="status-badge ${statusClass}">${statusDisplay}</span></td>
            <td class="actions-cell">
                <button onclick="editStudy('${study.id}')" class="action-btn edit">Editar</button>
                <button onclick="openDeleteModal('${study.id}')" class="action-btn delete">Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// PÁGINA HOJE
// =====================================================
function renderHoje() {
    const hoje    = getTodayString();
    const content = document.getElementById('hojeContent');
    const infoEl  = document.getElementById('hojeInfoText');
    if (!content) return;

    const estudosHoje = state.studies.filter(s =>
        s.data_estudo === hoje
    );
    const revisoesHoje = state.studies.filter(s =>
        s.data_revisao === hoje && !s.revisao_concluida
    );

    const hojeDate = new Date();
    const hojeLabel = hojeDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const capitalizado = hojeLabel.charAt(0).toUpperCase() + hojeLabel.slice(1);

    if (infoEl) {
        const total = estudosHoje.length + revisoesHoje.length;
        infoEl.textContent = `${capitalizado} · ${total} item${total !== 1 ? 'ns' : ''} para hoje`;
    }

    if (estudosHoje.length === 0 && revisoesHoje.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📅</span>
                Nenhum estudo ou revisão agendado para hoje.
            </div>`;
        return;
    }

    let html = '';

    if (estudosHoje.length > 0) {
        html += `<div class="hoje-sep hoje-sep-study">Estudos do dia</div>`;
        html += estudosHoje.map(s => buildHojeRow(s, 'study')).join('');
    }

    if (revisoesHoje.length > 0) {
        html += `<div class="hoje-sep hoje-sep-rev">Revisões agendadas</div>`;
        html += revisoesHoje.map(s => buildHojeRow(s, 'rev')).join('');
    }

    content.innerHTML = html;
}

function buildHojeRow(study, tipo) {
    const desNum   = calcularDesempenho(study);
    const semQ     = !study.quantidade || parseInt(study.quantidade) <= 0;
    const desStr   = semQ ? '—' : desNum.toFixed(0) + '%';
    const desColor = semQ ? 'var(--text2)' : desNum < 85 ? '#dc2626' : '#16a34a';
    const done     = tipo === 'study' ? study.concluido : study.revisao_concluida;
    const rowClass = `hoje-row ${tipo === 'rev' ? 'rev-row' : 'study-row'}${done ? ' done' : ''}`;
    const mat      = (study.materia_nome  || '—').toUpperCase();
    const form     = (study.formacao_nome || '—').toUpperCase();
    const cont     = (study.conteudo      || '—').toUpperCase();

    const subLabel = tipo === 'rev'
        ? `Revisão · desempenho anterior: ${desStr}`
        : `${form} — ${cont}`;

    const onchange = tipo === 'rev'
        ? `toggleRevisaoConcluida('${study.id}', this.checked)`
        : `toggleFinalizado('${study.id}', this.checked)`;

    const checkId  = `hoje-chk-${tipo}-${study.id}`;

    return `
    <div class="${rowClass}" id="hoje-row-${tipo}-${study.id}">
        <div class="hoje-check ${done ? 'checked' : ''}" onclick="handleHojeCheck(this, '${study.id}', '${tipo}')"></div>
        <div class="hoje-info">
            <div class="hoje-mat">${mat}</div>
            <div class="hoje-sub">${subLabel}</div>
        </div>
        <span class="hoje-perf" style="color:${desColor}">${desStr}</span>
    </div>`;
}

async function handleHojeCheck(el, id, tipo) {
    const checked = !el.classList.contains('checked');
    if (tipo === 'rev') {
        await toggleRevisaoConcluida(id, checked);
    } else {
        await toggleFinalizado(id, checked);
    }
}

// =====================================================
// PÁGINA REVISÃO
// =====================================================
function renderRevisao() {
    const tbody = document.getElementById('revisaoTableBody');
    const countEl = document.getElementById('revisaoPendentesCount');
    if (!tbody) return;

    const pendentes = state.studies.filter(s =>
        s.data_revisao && s.data_revisao.trim() !== '' && !s.revisao_concluida
    );

    if (countEl) {
        countEl.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;
    }

    if (pendentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Nenhuma revisão pendente. Bom trabalho! 🎉</td></tr>`;
        return;
    }

    pendentes.sort((a, b) => {
        if (a.data_revisao < b.data_revisao) return -1;
        if (a.data_revisao > b.data_revisao) return 1;
        return 0;
    });

    tbody.innerHTML = pendentes.map(s => {
        const desNum   = calcularDesempenho(s);
        const semQ     = !s.quantidade || parseInt(s.quantidade) <= 0;
        const desStr   = semQ ? '—' : desNum.toFixed(0) + '%';
        const desColor = semQ ? 'var(--text2)' : desNum < 85 ? '#dc2626' : '#f59e0b';
        const hoje     = getTodayString();
        const atrasada = s.data_revisao < hoje;

        return `
        <tr data-rev-id="${s.id}">
            <td class="checkbox-col">
                <div class="checkbox-wrap">
                    <input type="checkbox" id="rev-chk-${s.id}" class="styled-check" onchange="toggleRevisaoConcluida('${s.id}', this.checked)">
                    <label for="rev-chk-${s.id}" class="check-label" style="border-color:rgba(59,130,246,0.4)"></label>
                </div>
            </td>
            <td style="font-weight:500">${(s.materia_nome  || '—').toUpperCase()}</td>
            <td>${(s.formacao_nome || '—').toUpperCase()}</td>
            <td>${(s.conteudo      || '—').toUpperCase()}</td>
            <td style="color:${desColor};font-weight:500;font-variant-numeric:tabular-nums">${desStr}</td>
            <td>
                <span style="${atrasada ? 'color:#dc2626;font-weight:500' : ''}">${formatDateBR(s.data_revisao)}</span>
                ${atrasada ? '<br><span style="font-size:10px;color:#dc2626">Atrasada</span>' : ''}
            </td>
            <td class="actions-cell">
                <button class="action-btn conclude" onclick="toggleRevisaoConcluida('${s.id}', true)">Concluir</button>
                <button class="action-btn edit" onclick="editStudy('${s.id}')">Remarcar</button>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// TOGGLE FINALIZADO
// =====================================================
async function toggleFinalizado(id, checked) {
    const study = state.studies.find(s => s.id == id);
    if (!study) return;

    if (checked && exigeRevisao(study) && (!study.data_revisao || !study.data_revisao.trim())) {
        const perf = calcularDesempenho(study).toFixed(0);
        showToast(`Desempenho ${perf}% — informe uma data de revisão antes de concluir.`, 'error');
        const chk = document.getElementById(`chk-${id}`);
        if (chk) chk.checked = false;
        return;
    }

    try {
        const updated = await apiFetch(`/api/estudos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...study, concluido: checked })
        });
        const idx = state.studies.findIndex(s => s.id == id);
        if (idx !== -1) state.studies[idx] = updated;
        atualizarInterface();
        showToast(checked ? 'Estudo finalizado!' : 'Estudo reaberto', 'success');
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
        atualizarInterface();
    }
}

// =====================================================
// TOGGLE REVISÃO CONCLUÍDA
// =====================================================
async function toggleRevisaoConcluida(id, checked) {
    const study = state.studies.find(s => s.id == id);
    if (!study) return;

    try {
        const payload = { ...study, revisao_concluida: checked };
        const updated = await apiFetch(`/api/estudos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        const idx = state.studies.findIndex(s => s.id == id);
        if (idx !== -1) state.studies[idx] = updated;
        atualizarInterface();
        if (checked) showToast('Revisão concluída!', 'success');
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
        atualizarInterface();
    }
}

// =====================================================
// FILTROS & MÊS
// =====================================================
function changeMonth(direction) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + direction);
    currentMonth      = state.currentMonth;
    currentDateFilter = null;

    updateMonthDisplay();

    const mes = state.currentMonth.getMonth() + 1;
    const ano = state.currentMonth.getFullYear();

    apiFetch(`/api/estudos?mes=${mes}&ano=${ano}`)
        .then(estudos => {
            state.studies = estudos;
            atualizarInterface();
        })
        .catch(err => {
            showToast('Erro ao carregar mês: ' + err.message, 'error');
        });
}

function updateMonthDisplay() {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const el = document.getElementById('currentMonth');
    if (el) el.textContent = `${months[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;

    // Atualiza contexto do topbar se estiver na página programados
    if (state.currentPage === 'programados') {
        const ctx = document.getElementById('topbarPageContext');
        if (ctx) ctx.textContent = `· ${months[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;
    }
}

function clearDateFilter() {
    currentDateFilter = null;
    updateTable();
}

// =====================================================
// FORMULÁRIO
// =====================================================
function toggleForm() {
    editingId  = null;
    currentTab = 0;
    document.getElementById('formTitle').textContent     = 'Novo Estudo';
    document.getElementById('studyForm').reset();
    document.getElementById('editId').value              = '';
    document.getElementById('data_estudo').value         = getTodayString();
    populateSelects();
    setupFormListeners();
    showTab(currentTab);
    updateNavigationButtons();
    document.getElementById('formModal').classList.add('show');
}

function closeFormModal(canceled = false) {
    document.getElementById('formModal').classList.remove('show');
    if (canceled) showToast('Operação cancelada', 'error');
    editingId = null;
}

function editStudy(id) {
    const study = state.studies.find(s => s.id == id);
    if (!study) return;
    editingId  = id;
    currentTab = 0;

    document.getElementById('formTitle').textContent = 'Editar Estudo';
    document.getElementById('editId').value          = study.id;
    populateSelects();
    document.getElementById('materia').value          = study.materia_id    || '';
    document.getElementById('formacao').value         = study.formacao_id   || '';
    document.getElementById('unidade').value          = study.unidade       || '';
    document.getElementById('conteudo').value         = study.conteudo      || '';
    document.getElementById('data_estudo').value      = study.data_estudo   || '';
    document.getElementById('quantidade').value       = study.quantidade    || '';
    document.getElementById('total_acertos').value    = study.total_acertos || '';
    document.getElementById('data_revisao').value     = study.data_revisao  || '';

    setupFormListeners();
    atualizarHintRevisao();
    showTab(currentTab);
    updateNavigationButtons();
    document.getElementById('formModal').classList.add('show');
}

function setupFormListeners() {
    ['quantidade', 'total_acertos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.removeEventListener('input', atualizarHintRevisao);
            el.addEventListener('input', atualizarHintRevisao);
        }
    });
}

function atualizarHintRevisao() {
    const qtd     = parseInt(document.getElementById('quantidade')?.value)    || 0;
    const acertos = parseInt(document.getElementById('total_acertos')?.value) || 0;
    const hintEl  = document.getElementById('hintRevisao');
    const dataEl  = document.getElementById('data_revisao');
    if (!hintEl || !dataEl) return;

    if (qtd > 0) {
        const perf = (acertos / qtd) * 100;
        if (perf < 85) {
            hintEl.style.display = 'flex';
            hintEl.textContent   = `⚠️ Desempenho de ${perf.toFixed(0)}% — revisão obrigatória (mínimo 85%).`;
            dataEl.classList.add('input-required-highlight');
            dataEl.required = true;
            return;
        }
    }
    hintEl.style.display = 'none';
    dataEl.classList.remove('input-required-highlight');
    dataEl.required = false;
}

async function saveStudy(event) {
    event.preventDefault();

    const materiaVal  = document.getElementById('materia').value;
    const formacaoVal = document.getElementById('formacao').value;
    const quantidade  = parseInt(document.getElementById('quantidade').value)    || null;
    const acertos     = parseInt(document.getElementById('total_acertos').value) || null;
    const dataRevisao = document.getElementById('data_revisao').value            || null;

    if (quantidade && acertos !== null && acertos > quantidade) {
        showToast('Acertos não podem ser maiores que a quantidade de questões.', 'error');
        switchTab('tab-questoes');
        return;
    }

    if (quantidade && acertos !== null) {
        const perf = (acertos / quantidade) * 100;
        if (perf < 85 && !dataRevisao) {
            showToast(`Desempenho ${perf.toFixed(0)}% — informe uma data de revisão.`, 'error');
            switchTab('tab-revisao');
            document.getElementById('data_revisao').focus();
            return;
        }
    }

    const payload = {
        materia_id:    materiaVal  ? parseInt(materiaVal)  : null,
        formacao_id:   formacaoVal ? parseInt(formacaoVal) : null,
        unidade:       document.getElementById('unidade').value.trim().toUpperCase()  || null,
        conteudo:      document.getElementById('conteudo').value.trim().toUpperCase() || null,
        data_estudo:   document.getElementById('data_estudo').value || null,
        quantidade,
        total_acertos: acertos,
        data_revisao:  dataRevisao,
        revisao_concluida: false,
        concluido: editingId
            ? (state.studies.find(s => s.id == editingId)?.concluido || false)
            : false,
    };

    try {
        const editId = document.getElementById('editId').value;
        let saved;
        if (editId) {
            saved = await apiFetch(`/api/estudos/${editId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            const idx = state.studies.findIndex(s => s.id == editId);
            if (idx !== -1) state.studies[idx] = saved;
        } else {
            saved = await apiFetch('/api/estudos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            state.studies.push(saved);
        }
        closeFormModal();
        showToast(editId ? 'Estudo atualizado!' : 'Estudo cadastrado!', 'success');
        atualizarInterface();
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    }
}

// =====================================================
// TABS DO FORMULÁRIO
// =====================================================
function switchTab(tabId) {
    const idx = tabs.indexOf(tabId);
    if (idx !== -1) {
        currentTab = idx;
        showTab(currentTab);
        updateNavigationButtons();
    }
}

function showTab(index) {
    document.querySelectorAll('#formModal .tab-btn').forEach((b, i) =>
        b.classList.toggle('active', i === index));
    document.querySelectorAll('#formModal .tab-content').forEach((c, i) =>
        c.classList.toggle('active', i === index));
}

function updateNavigationButtons() {
    const btnPrev = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnSave = document.getElementById('btnSave');
    if (!btnPrev || !btnNext || !btnSave) return;

    btnPrev.style.display = currentTab > 0 ? 'inline-flex' : 'none';
    if (currentTab < tabs.length - 1) {
        btnNext.style.display = 'inline-flex';
        btnSave.style.display = 'none';
    } else {
        btnNext.style.display = 'none';
        btnSave.style.display = 'inline-flex';
    }
}

function nextTab() {
    if (currentTab < tabs.length - 1) {
        currentTab++;
        showTab(currentTab);
        updateNavigationButtons();
        atualizarHintRevisao();
    }
}

function previousTab() {
    if (currentTab > 0) {
        currentTab--;
        showTab(currentTab);
        updateNavigationButtons();
    }
}

// =====================================================
// GERENCIAR MATÉRIAS
// =====================================================
function openNewMateriaModal() {
    document.getElementById('nomeMateria').value = '';
    document.getElementById('newMateriaModal').classList.add('show');
}

function closeNewMateriaModal() {
    document.getElementById('newMateriaModal').classList.remove('show');
}

async function saveNewMateria() {
    const nome = document.getElementById('nomeMateria').value.trim().toUpperCase();
    if (!nome) { showToast('Informe o nome da matéria', 'error'); return; }
    try {
        const nova = await apiFetch('/api/materias', {
            method: 'POST',
            body: JSON.stringify({ nome })
        });
        state.subjects.push(nova);
        closeNewMateriaModal();
        showToast(`Matéria "${nome}" criada!`, 'success');
        populateSelects();
        const sel = document.getElementById('materia');
        if (sel) sel.value = nova.id;
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// =====================================================
// GERENCIAR FORMAÇÕES
// =====================================================
function openNewFormacaoModal() {
    document.getElementById('nomeFormacao').value = '';
    document.getElementById('newFormacaoModal').classList.add('show');
}

function closeNewFormacaoModal() {
    document.getElementById('newFormacaoModal').classList.remove('show');
}

async function saveNewFormacao() {
    const nome = document.getElementById('nomeFormacao').value.trim().toUpperCase();
    if (!nome) { showToast('Informe o nome da formação', 'error'); return; }
    try {
        const nova = await apiFetch('/api/formacoes', {
            method: 'POST',
            body: JSON.stringify({ nome })
        });
        state.formacoes.push(nova);
        closeNewFormacaoModal();
        showToast(`Formação "${nova.nome}" criada!`, 'success');
        populateSelects();
        const sel = document.getElementById('formacao');
        if (sel) sel.value = nova.id;
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// =====================================================
// EXCLUIR ESTUDO
// =====================================================
function openDeleteModal(id) {
    deleteId = id;
    document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir este estudo?';
    document.getElementById('deleteModal').classList.add('show');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    deleteId = null;
}

async function confirmDelete() {
    if (!deleteId) return;
    try {
        await apiFetch(`/api/estudos/${deleteId}`, { method: 'DELETE' });
        state.studies = state.studies.filter(s => s.id != deleteId);
        showToast('Estudo excluído!', 'success');
        atualizarInterface();
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
    closeDeleteModal();
}

// =====================================================
// UTILITÁRIOS
// =====================================================
function formatDateBR(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

function showToast(message, type = 'success') {
    document.querySelectorAll('.floating-message').forEach(m => m.remove());
    const div = document.createElement('div');
    div.className   = `floating-message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

function setupConnectionStatus() {
    checkConnection();
    window.addEventListener('online',  checkConnection);
    window.addEventListener('offline', checkConnection);
}

function checkConnection() {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.className = 'connection-pill ' + (navigator.onLine ? 'online' : 'offline');
    el.querySelector('.conn-text').textContent = navigator.onLine ? 'Online' : 'Offline';
}
