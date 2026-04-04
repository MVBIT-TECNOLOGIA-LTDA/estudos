// =====================================================
// JORNADA ACADÊMICA — SCRIPT PRINCIPAL
// =====================================================

const API = '';  // vazio = mesmo host (serve estático pelo server.js)

let state = {
    studies:       [],
    subjects:      [],   // matérias
    formacoes:     [],   // formações
    filterSubject:  null,
    filterFormacao: null,
    filterStatus:   '',
    searchTerm:     '',
    currentMonth:   new Date(),
    isLoading:      false
};

let editingId    = null;
let deleteId     = null;
let currentTab   = 0;
const tabs       = ['tab-geral', 'tab-questoes', 'tab-revisao'];

// Variáveis globais usadas pelo calendar.js
let currentMonth      = new Date();
let currentDateFilter = null;
let licitacoes        = [];  // alias para estudos (calendar.js referencia esta variável)

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    updateMonthDisplay();
    setupConnectionStatus();
    setupUppercaseInputs();
    carregarTudo();
    setInterval(checkConnection, 15000);
});

// =====================================================
// FORÇAR CAIXA ALTA EM INPUTS DE TEXTO
// =====================================================
function forceUppercase(e) {
    const el    = e.target;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    el.value = el.value.toUpperCase();
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
    const selector = 'input[type="text"], input:not([type]), textarea';
    const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
    elements.forEach(el => {
        if (!el.dataset.uppercaseApplied) {
            el.addEventListener('input', forceUppercase);
            el.dataset.uppercaseApplied = 'true';
        }
    });
    if (root.matches && root.matches(selector) && !root.dataset.uppercaseApplied) {
        root.addEventListener('input', forceUppercase);
        root.dataset.uppercaseApplied = 'true';
    }
}

// =====================================================
// API HELPERS
// =====================================================
async function apiFetch(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
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

        licitacoes = state.studies.map(s => ({ ...s, data: s.data_estudo }));

        atualizarInterface();
        showToast('Dados atualizados', 'success');
    } catch (err) {
        showToast('Erro ao carregar dados: ' + err.message, 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(v) {
    state.isLoading = v;
}

// =====================================================
// INTERFACE
// =====================================================
function atualizarInterface() {
    populateSelects();
    updateTable();
    updateDashboard();
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
// FILTROS
// =====================================================
function filterStudies() {
    state.searchTerm     = document.getElementById('search').value.trim().toLowerCase();
    state.filterSubject  = document.getElementById('filterMateria').value || null;
    state.filterFormacao = document.getElementById('filterFormacao').value || null;
    state.filterStatus   = document.getElementById('filterStatus').value;
    updateTable();
}

function filterLicitacoes() {
    updateTable();
}

function changeMonth(direction) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + direction);
    currentMonth = state.currentMonth;
    currentDateFilter = null;
    updateMonthDisplay();
    const mes = state.currentMonth.getMonth() + 1;
    const ano = state.currentMonth.getFullYear();
    apiFetch(`/api/estudos?mes=${mes}&ano=${ano}`)
        .then(estudos => {
            state.studies = estudos;
            licitacoes = state.studies.map(s => ({ ...s, data: s.data_estudo }));
            updateTable();
            updateDashboard();
        })
        .catch(err => showToast('Erro: ' + err.message, 'error'));
}

function updateMonthDisplay() {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const el = document.getElementById('currentMonth');
    if (el) el.textContent = `${months[state.currentMonth.getMonth()]} ${state.currentMonth.getFullYear()}`;
}

// =====================================================
// REGRAS DE NEGÓCIO
// =====================================================

/**
 * Verifica se um estudo pode ser marcado como concluído.
 * Regra: só permite se tiver ao menos 1 questão registrada.
 */
function podeMarcarConcluido(study) {
    return study.quantidade && parseInt(study.quantidade) > 0;
}

/**
 * Calcula o desempenho percentual de um estudo (0–100).
 * Retorna null se não houver questões.
 */
function calcularDesempenho(study) {
    const qtd     = parseInt(study.quantidade)    || 0;
    const acertos = parseInt(study.total_acertos) || 0;
    if (qtd <= 0) return null;
    return (acertos / qtd) * 100;
}

/**
 * Verifica se o estudo exige data de revisão.
 * Regra: desempenho existente e abaixo de 85%.
 */
function exigeRevisao(study) {
    const desempenho = calcularDesempenho(study);
    return desempenho !== null && desempenho < 85;
}

// =====================================================
// TABELA
// =====================================================
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
            const haystack = [
                study.materia_nome  || '',
                study.formacao_nome || '',
                study.conteudo      || '',
                study.unidade       || ''
            ].join(' ').toLowerCase();
            if (!haystack.includes(state.searchTerm)) return false;
        }

        if (state.filterStatus) {
            if (getStudyStatus(study) !== state.filterStatus) return false;
        }

        return true;
    });

    filtered.sort((a, b) => (a.data_estudo > b.data_estudo ? -1 : 1));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Nenhum estudo encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(study => {
        const desempenhoNum = calcularDesempenho(study);
        const desempenhoStr = desempenhoNum !== null
            ? desempenhoNum.toFixed(0) + '%'
            : '-';

        // Cor do desempenho: vermelho < 85%, verde >= 85%
        const desempenhoColor = desempenhoNum === null
            ? ''
            : desempenhoNum < 85
                ? 'style="color:#dc2626;font-weight:700;"'
                : 'style="color:#16a34a;font-weight:700;"';

        const rowClass    = study.concluido ? 'row-fechada' : '';
        const status      = getStudyStatus(study);
        const statusClass = {
            'finalizado': 'status-finalizado',
            'fora-prazo': 'status-fora-prazo',
            'programado': 'status-programado',
            'revisao':    'status-revisao'
        }[status] || 'status-programado';
        const statusDisplay = status.replace('-', ' ').toUpperCase();

        const materiaDisplay  = (study.materia_nome  || '-').toUpperCase();
        const formacaoDisplay = (study.formacao_nome || '-').toUpperCase();
        const unidadeDisplay  = study.unidade  ? study.unidade.toUpperCase()  : '-';
        const conteudoDisplay = study.conteudo ? study.conteudo.toUpperCase() : '-';
        const dataDisplay     = study.data_estudo
            ? new Date(study.data_estudo + 'T00:00:00').toLocaleDateString('pt-BR')
            : '-';

        // Checkbox: desabilitado se não tiver questões
        const temQuestoes  = podeMarcarConcluido(study);
        const checkDisabled = temQuestoes ? '' : 'disabled';
        const checkTitle    = temQuestoes
            ? 'Marcar como concluído'
            : 'Registre questões antes de marcar como concluído';

        return `
        <tr class="${rowClass}" data-id="${study.id}">
            <td class="checkbox-col">
                <div class="checkbox-wrapper" title="${checkTitle}">
                    <input
                        type="checkbox"
                        id="check-${study.id}"
                        ${study.concluido ? 'checked' : ''}
                        ${checkDisabled}
                        onchange="toggleFinalizado('${study.id}', this.checked)"
                        class="styled-checkbox"
                    >
                    <label for="check-${study.id}" class="checkbox-label-styled ${!temQuestoes ? 'checkbox-disabled' : ''}"></label>
                </div>
            </td>
            <td>${formacaoDisplay}</td>
            <td>${materiaDisplay}</td>
            <td>${unidadeDisplay}</td>
            <td>${conteudoDisplay}</td>
            <td>${study.quantidade || '-'}</td>
            <td ${desempenhoColor}>${desempenhoStr}</td>
            <td><span class="status-badge ${statusClass}">${statusDisplay}</span></td>
            <td class="actions-cell">
                <button onclick="editStudy('${study.id}')" class="action-btn edit">Editar</button>
                <button onclick="openDeleteModal('${study.id}')" class="action-btn delete">Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

function getStudyStatus(study) {
    if (study.concluido) return 'finalizado';
    if (!study.data_estudo) return 'programado';
    const hoje = new Date().toISOString().split('T')[0];
    if (study.data_estudo < hoje) return 'fora-prazo';
    if (study.data_revisao && study.data_revisao.trim() !== '') return 'revisao';
    return 'programado';
}

// =====================================================
// DASHBOARD
// =====================================================
function updateDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    const ms   = getStudiesForCurrentMonth();

    const finalizados = ms.filter(s => s.concluido).length;
    const foraPrazo   = ms.filter(s => !s.concluido && s.data_estudo && s.data_estudo < hoje).length;
    const programados = ms.filter(s => !s.concluido && (!s.data_estudo || s.data_estudo >= hoje) && !(s.data_revisao && s.data_revisao.trim())).length;
    const revisao     = ms.filter(s => s.data_revisao && s.data_revisao.trim() !== '').length;

    document.getElementById('dashboardFinalizados').textContent = finalizados;
    document.getElementById('dashboardForaPrazo').textContent   = foraPrazo;
    document.getElementById('dashboardProgramados').textContent = programados;
    document.getElementById('dashboardRevisao').textContent     = revisao;

    atualizarPulseBadge(document.getElementById('cardForaPrazo'), foraPrazo);
    atualizarPulseBadge(document.getElementById('cardRevisao'),   revisao);
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
        badge.textContent = count;
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

// =====================================================
// MODAIS DE DASHBOARD
// =====================================================
function abrirModalDashboard(tipo) {
    const hoje = new Date().toISOString().split('T')[0];
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
    let html = '<table style="width:100%;"><thead><tr><th>Formação</th><th>Matéria</th><th>Conteúdo</th><th>Data</th></tr></thead><tbody>';
    lista.forEach(item => {
        const dataExibir = tipo === 'revisao'
            ? (item.data_revisao ? new Date(item.data_revisao + 'T00:00:00').toLocaleDateString('pt-BR') : '-')
            : (item.data_estudo  ? new Date(item.data_estudo  + 'T00:00:00').toLocaleDateString('pt-BR') : '-');
        html += `<tr>
            <td>${(item.formacao_nome || '-').toUpperCase()}</td>
            <td>${(item.materia_nome  || '-').toUpperCase()}</td>
            <td>${(item.conteudo      || '-').toUpperCase()}</td>
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
// FORMULÁRIO
// =====================================================
function toggleForm() {
    editingId  = null;
    currentTab = 0;
    document.getElementById('formTitle').textContent = 'Novo Estudo';
    document.getElementById('studyForm').reset();
    document.getElementById('editId').value = '';
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_estudo').value = hoje;
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

    document.getElementById('formTitle').textContent     = 'Editar Estudo';
    document.getElementById('editId').value              = study.id;
    populateSelects();
    document.getElementById('materia').value             = study.materia_id      || '';
    document.getElementById('formacao').value            = study.formacao_id     || '';
    document.getElementById('unidade').value             = study.unidade         || '';
    document.getElementById('conteudo').value            = study.conteudo        || '';
    document.getElementById('data_estudo').value         = study.data_estudo     || '';
    document.getElementById('quantidade').value          = study.quantidade      || '';
    document.getElementById('total_acertos').value       = study.total_acertos   || '';
    document.getElementById('data_revisao').value        = study.data_revisao    || '';

    setupFormListeners();
    atualizarHintRevisao();
    showTab(currentTab);
    updateNavigationButtons();
    document.getElementById('formModal').classList.add('show');
}

// ─────────────────────────────────────────────────────
// Listeners internos do formulário:
// atualiza o hint de revisão ao mudar questões/acertos
// ─────────────────────────────────────────────────────
function setupFormListeners() {
    const elQtd     = document.getElementById('quantidade');
    const elAcertos = document.getElementById('total_acertos');
    if (elQtd)     elQtd.addEventListener('input',     atualizarHintRevisao);
    if (elAcertos) elAcertos.addEventListener('input',  atualizarHintRevisao);
}

/**
 * Exibe (ou oculta) o aviso de revisão obrigatória na aba Revisão
 * e destaca o campo de data_revisao quando necessário.
 */
function atualizarHintRevisao() {
    const qtd     = parseInt(document.getElementById('quantidade')?.value)    || 0;
    const acertos = parseInt(document.getElementById('total_acertos')?.value) || 0;
    const hintEl  = document.getElementById('hintRevisao');
    const dataEl  = document.getElementById('data_revisao');

    if (!hintEl || !dataEl) return;

    if (qtd > 0) {
        const desempenho = (acertos / qtd) * 100;
        if (desempenho < 85) {
            hintEl.style.display = 'flex';
            hintEl.textContent   = `⚠️ Desempenho de ${desempenho.toFixed(0)}% — revisão obrigatória (mínimo 85%).`;
            dataEl.classList.add('input-required-highlight');
            dataEl.required = true;
        } else {
            hintEl.style.display = 'none';
            dataEl.classList.remove('input-required-highlight');
            dataEl.required = false;
        }
    } else {
        hintEl.style.display = 'none';
        dataEl.classList.remove('input-required-highlight');
        dataEl.required = false;
    }
}

async function saveStudy(event) {
    event.preventDefault();

    const materiaVal  = document.getElementById('materia').value;
    const formacaoVal = document.getElementById('formacao').value;
    const quantidade  = parseInt(document.getElementById('quantidade').value)    || null;
    const acertos     = parseInt(document.getElementById('total_acertos').value) || null;
    const dataRevisao = document.getElementById('data_revisao').value            || null;

    // ── Validação 1: acertos não podem exceder quantidade ──
    if (quantidade && acertos !== null && acertos > quantidade) {
        showToast('Acertos não podem ser maiores que a quantidade de questões.', 'error');
        switchTab('tab-questoes');
        return;
    }

    // ── Validação 2: revisão obrigatória se desempenho < 85% ──
    if (quantidade && acertos !== null) {
        const desempenho = (acertos / quantidade) * 100;
        if (desempenho < 85 && !dataRevisao) {
            showToast(`Desempenho de ${desempenho.toFixed(0)}% — informe uma data de revisão.`, 'error');
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
        concluido:     editingId ? (state.studies.find(s => s.id == editingId)?.concluido || false) : false,
    };

    try {
        const editId = document.getElementById('editId').value;
        let saved;
        if (editId) {
            saved = await apiFetch(`/api/estudos/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            const idx = state.studies.findIndex(s => s.id == editId);
            if (idx !== -1) state.studies[idx] = saved;
        } else {
            saved = await apiFetch('/api/estudos', { method: 'POST', body: JSON.stringify(payload) });
            state.studies.push(saved);
        }
        licitacoes = state.studies.map(s => ({ ...s, data: s.data_estudo }));
        closeFormModal();
        showToast(editId ? 'Estudo atualizado!' : 'Estudo cadastrado!', 'success');
        atualizarInterface();
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    }
}

// =====================================================
// TOGGLE FINALIZADO
// Regra: só permite marcar se houver questões registradas
// =====================================================
async function toggleFinalizado(id, checked) {
    const study = state.studies.find(s => s.id == id);
    if (!study) return;

    // Bloqueia se não tiver questões
    if (checked && !podeMarcarConcluido(study)) {
        showToast('Registre pelo menos 1 questão antes de marcar como concluído.', 'error');
        // Reverte o checkbox visualmente
        const chk = document.getElementById(`check-${id}`);
        if (chk) chk.checked = false;
        return;
    }

    // Bloqueia se tiver desempenho < 85% sem data de revisão
    if (checked && exigeRevisao(study) && (!study.data_revisao || !study.data_revisao.trim())) {
        const desempenho = calcularDesempenho(study).toFixed(0);
        showToast(`Desempenho de ${desempenho}% — informe uma data de revisão antes de concluir.`, 'error');
        const chk = document.getElementById(`check-${id}`);
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
        licitacoes = state.studies.map(s => ({ ...s, data: s.data_estudo }));
        atualizarInterface();
        showToast(checked ? 'Estudo finalizado!' : 'Estudo reaberto', 'success');
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
        atualizarInterface();
    }
}

// =====================================================
// ABAS
// =====================================================
function switchTab(tabId) {
    const idx = tabs.indexOf(tabId);
    if (idx !== -1) { currentTab = idx; showTab(currentTab); updateNavigationButtons(); }
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
    btnPrev.style.display = currentTab > 0 ? 'inline-flex' : 'none';
    if (currentTab < tabs.length - 1) {
        btnNext.style.display = 'inline-flex';
        btnSave.style.display = 'none';
    } else {
        btnNext.style.display = 'none';
        btnSave.style.display = 'inline-flex';
    }
}

function nextTab()     { if (currentTab < tabs.length - 1) { currentTab++; showTab(currentTab); updateNavigationButtons(); atualizarHintRevisao(); } }
function previousTab() { if (currentTab > 0)               { currentTab--; showTab(currentTab); updateNavigationButtons(); } }

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
        const nova = await apiFetch('/api/materias', { method: 'POST', body: JSON.stringify({ nome }) });
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
        const nova = await apiFetch('/api/formacoes', { method: 'POST', body: JSON.stringify({ nome }) });
        state.formacoes.push(nova);
        closeNewFormacaoModal();
        showToast(`Formação "${nome}" criada!`, 'success');
        populateSelects();
        const sel = document.getElementById('formacao');
        if (sel) sel.value = nova.id;
    } catch (err) {
        showToast('Erro: ' + err.message, 'error');
    }
}

// =====================================================
// EXCLUSÃO DE ESTUDO
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
        licitacoes = state.studies.map(s => ({ ...s, data: s.data_estudo }));
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
function showToast(message, type = 'success') {
    document.querySelectorAll('.floating-message').forEach(m => m.remove());
    const div = document.createElement('div');
    div.className = `floating-message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.animation = 'slideOutBottom 0.3s ease forwards';
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
    el.className = 'connection-status ' + (navigator.onLine ? 'online' : 'offline');
}
