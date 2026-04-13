// =====================================================
// JORNADA ACADÊMICA — SCRIPT PRINCIPAL v2
// =====================================================

const API = '';

let state = {
    studies:        [],
    subjects:       [],
    formacoes:      [],
    filterSubject:  null,
    filterFormacao: null,
    searchTerm:     '',
    currentPage:    'dashboard',
    isLoading:      false
};

let editingId = null;
let deleteId  = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
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
// NAVEGAÇÃO
// =====================================================
const PAGE_META = {
    dashboard: { title: 'Dashboard',  context: 'Desempenho geral', showSearch: false, showFilters: false },
    registros: { title: 'Registros',  context: '',                  showSearch: true,  showFilters: true  },
};

function navigateTo(page, navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navEl) navEl.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    state.currentPage = page;

    const meta = PAGE_META[page] || { title: page, context: '', showSearch: false, showFilters: false };
    document.getElementById('topbarPageTitle').textContent = meta.title;

    const searchWrap  = document.getElementById('topbarSearchWrap');
    const filtersWrap = document.getElementById('topbarFilters');
    const sep         = document.getElementById('topbarSep');
    const ctx         = document.getElementById('topbarPageContext');

    if (searchWrap)  searchWrap.style.display  = meta.showSearch  ? 'flex' : 'none';
    if (filtersWrap) filtersWrap.style.display  = meta.showFilters ? 'flex' : 'none';

    if (meta.context) {
        if (sep) sep.style.display = 'inline';
        if (ctx) ctx.textContent   = meta.context;
    } else {
        if (sep) sep.style.display = 'none';
        if (ctx) ctx.textContent   = '';
    }

    if (page === 'dashboard') updateDashboard();
    if (page === 'registros') updateTable();

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('mobile-open');
    }
}

// =====================================================
// SIDEBAR TOGGLE
// =====================================================
function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const wrapper  = document.getElementById('appWrapper');
    const isMobile = window.innerWidth <= 768;
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
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType === 1) applyUppercaseToExisting(node);
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
function applyUppercaseToExisting(root) {
    const sel = 'input[type="text"], input:not([type]), textarea';
    const els = root.querySelectorAll ? root.querySelectorAll(sel) : [];
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
        const [materias, formacoes, estudos] = await Promise.all([
            apiFetch('/api/materias'),
            apiFetch('/api/formacoes'),
            apiFetch('/api/estudos')
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

function setLoading(v) { state.isLoading = v; }

function atualizarInterface() {
    populateSelects();
    updateDashboard();
    updateTable();
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
// REGRAS DE NEGÓCIO
// =====================================================
function calcularDesempenho(study) {
    const qtd     = parseInt(study.quantidade)    || 0;
    const acertos = parseInt(study.total_acertos) || 0;
    if (qtd <= 0) return null;
    return (acertos / qtd) * 100;
}

function exigeRevisao(study) {
    const perf = calcularDesempenho(study);
    if (perf === null) return false;
    return perf < 85;
}

// =====================================================
// DASHBOARD
// =====================================================
function updateDashboard() {
    renderDesempenhoTable(state.studies);
    renderPerfSummary(state.studies);
}

function renderDesempenhoTable(estudos) {
    const tbody = document.getElementById('desempenhoTableBody');
    if (!tbody) return;

    const byMateria = {};
    estudos.forEach(s => {
        const key = s.materia_id || 'sem-materia';
        if (!byMateria[key]) {
            byMateria[key] = {
                nome: (s.materia_nome || 'Sem matéria').toUpperCase(),
                questoes: 0,
                acertos: 0,
                conteudos: new Set()
            };
        }
        byMateria[key].questoes += parseInt(s.quantidade)    || 0;
        byMateria[key].acertos  += parseInt(s.total_acertos) || 0;
        if (s.conteudo && s.conteudo.trim() !== '') {
            byMateria[key].conteudos.add(s.conteudo.trim().toUpperCase());
        }
    });

    const entries = Object.values(byMateria);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum estudo registrado.</td></tr>';
        return;
    }

    // Ordena do menor para o maior desempenho; sem questões vai para o final
    entries.sort((a, b) => {
        const pa = a.questoes > 0 ? (a.acertos / a.questoes) * 100 : 101;
        const pb = b.questoes > 0 ? (b.acertos / b.questoes) * 100 : 101;
        return pa - pb;
    });

    const abaixoMeta = [];

    tbody.innerHTML = entries.map(e => {
        const perf      = e.questoes > 0 ? Math.round((e.acertos / e.questoes) * 100) : null;
        const perfStr   = perf !== null ? perf + '%' : '—';
        const color     = perf === null ? '#6b7280' : perf >= 85 ? '#16a34a' : perf >= 70 ? '#f59e0b' : '#dc2626';
        const rowClass  = perf !== null && perf < 85 ? 'row-abaixo-meta' : '';
        if (perf !== null && perf < 85) abaixoMeta.push(e.nome);

        const conteudosStr = e.conteudos.size > 0
            ? [...e.conteudos].join(', ')
            : '—';

        const barHtml = perf !== null
            ? `<div class="perf-bar-wrap">
                <div class="perf-bar"><div class="perf-fill" style="width:${perf}%;background:${color}"></div></div>
                <span class="perf-pct" style="color:${color}">${perfStr}</span>
               </div>`
            : `<span style="color:var(--text3);font-size:12px">Sem questões</span>`;

        return `<tr class="${rowClass}">
            <td style="font-weight:500">${e.nome}</td>
            <td style="font-size:11.5px;color:var(--text2);max-width:220px;white-space:normal;line-height:1.5">${conteudosStr}</td>
            <td>${e.questoes || '—'}</td>
            <td>${e.questoes > 0 ? e.acertos : '—'}</td>
            <td>${barHtml}</td>
        </tr>`;
    }).join('');

    if (abaixoMeta.length > 0) {
        showToast(
            `${abaixoMeta.length} matéria${abaixoMeta.length > 1 ? 's' : ''} abaixo de 85%: ${abaixoMeta.join(', ')}`,
            'error'
        );
    }
}

function renderPerfSummary(estudos) {
    const grid = document.getElementById('perfSummaryGrid');
    if (!grid) return;

    let totalQ = 0, totalA = 0;
    estudos.forEach(s => {
        totalQ += parseInt(s.quantidade)    || 0;
        totalA += parseInt(s.total_acertos) || 0;
    });
    const media      = totalQ > 0 ? Math.round((totalA / totalQ) * 100) : 0;
    const mediaColor = totalQ > 0 ? (media >= 85 ? '#16a34a' : media >= 70 ? '#f59e0b' : '#dc2626') : 'var(--text2)';

    const totalReg = estudos.length;

    grid.innerHTML = `
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:${mediaColor}">${totalQ > 0 ? media + '%' : '—'}</div>
            <div class="perf-summary-lbl">Média geral de acertos</div>
        </div>
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:var(--primary)">${totalReg}</div>
            <div class="perf-summary-lbl">Total de registros</div>
        </div>
        <div class="perf-summary-card">
            <div class="perf-summary-big" style="color:var(--info)">${totalQ}</div>
            <div class="perf-summary-lbl">Total de questões</div>
        </div>`;
}

// =====================================================
// TABELA REGISTROS
// =====================================================
function filterStudies() {
    state.searchTerm     = (document.getElementById('search')?.value || '').trim().toLowerCase();
    state.filterSubject  = document.getElementById('filterMateria')?.value  || null;
    state.filterFormacao = document.getElementById('filterFormacao')?.value || null;
    updateTable();
}

function updateTable() {
    const tbody = document.getElementById('estudosTableBody');
    if (!tbody) return;

    let filtered = state.studies.filter(study => {
        if (state.filterSubject  && study.materia_id  != state.filterSubject)  return false;
        if (state.filterFormacao && study.formacao_id != state.filterFormacao)  return false;
        if (state.searchTerm) {
            const hay = [study.materia_nome||'', study.formacao_nome||'', study.conteudo||'', study.unidade||''].join(' ').toLowerCase();
            if (!hay.includes(state.searchTerm)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        const da = a.data_estudo || '';
        const db = b.data_estudo || '';
        return db.localeCompare(da) || b.id - a.id;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-row">Nenhum estudo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(study => {
        const perf     = calcularDesempenho(study);
        const semQ     = perf === null;
        const desStr   = semQ ? '—' : perf.toFixed(0) + '%';
        const desColor = semQ ? '#6b7280' : perf >= 85 ? '#16a34a' : perf >= 70 ? '#f59e0b' : '#dc2626';

        return `<tr data-id="${study.id}">
            <td>${(study.formacao_nome || '—').toUpperCase()}</td>
            <td style="font-weight:500">${(study.materia_nome || '—').toUpperCase()}</td>
            <td>${study.unidade  ? study.unidade.toUpperCase()  : '—'}</td>
            <td>${study.conteudo ? study.conteudo.toUpperCase() : '—'}</td>
            <td style="white-space:nowrap">${formatDateBR(study.data_estudo)}</td>
            <td>${study.quantidade || '—'}</td>
            <td style="color:${desColor};font-weight:500;font-variant-numeric:tabular-nums">${desStr}</td>
            <td class="actions-cell">
                <button onclick="editStudy('${study.id}')" class="action-btn edit">Editar</button>
                <button onclick="openDeleteModal('${study.id}')" class="action-btn delete">Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// FORMULÁRIO
// =====================================================
function toggleForm() {
    editingId = null;
    document.getElementById('formTitle').textContent  = 'Novo Estudo';
    document.getElementById('studyForm').reset();
    document.getElementById('editId').value           = '';
    document.getElementById('data_estudo').value      = getTodayString();
    populateSelects();
    atualizarHintRevisao();
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
    editingId = id;

    document.getElementById('formTitle').textContent  = 'Editar Estudo';
    document.getElementById('editId').value           = study.id;
    populateSelects();
    document.getElementById('materia').value          = study.materia_id    || '';
    document.getElementById('formacao').value         = study.formacao_id   || '';
    document.getElementById('unidade').value          = study.unidade       || '';
    document.getElementById('conteudo').value         = study.conteudo      || '';
    document.getElementById('data_estudo').value      = study.data_estudo   || '';
    document.getElementById('quantidade').value       = study.quantidade    || '';
    document.getElementById('total_acertos').value    = study.total_acertos || '';
    document.getElementById('data_revisao').value     = study.data_revisao  || '';

    atualizarHintRevisao();
    document.getElementById('formModal').classList.add('show');
}

function atualizarHintRevisao() {
    const qtd     = parseInt(document.getElementById('quantidade')?.value)    || 0;
    const acertos = parseInt(document.getElementById('total_acertos')?.value) || 0;
    const hintEl  = document.getElementById('hintRevisao');
    const hintOk  = document.getElementById('hintRevisaoOk');
    const dataEl  = document.getElementById('data_revisao');
    if (!hintEl || !dataEl) return;

    if (qtd > 0) {
        const perf = (acertos / qtd) * 100;
        if (perf < 85) {
            hintEl.style.display = 'flex';
            hintEl.textContent   = `⚠️ Desempenho de ${perf.toFixed(0)}% — revisão obrigatória (mínimo 85%).`;
            if (hintOk) hintOk.style.display = 'none';
            dataEl.classList.add('input-required-highlight');
            dataEl.required = true;
            return;
        } else {
            hintEl.style.display = 'none';
            if (hintOk) hintOk.style.display = 'flex';
            dataEl.classList.remove('input-required-highlight');
            dataEl.required = false;
            return;
        }
    }
    hintEl.style.display = 'none';
    if (hintOk) hintOk.style.display = 'none';
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
        return;
    }

    if (quantidade && acertos !== null) {
        const perf = (acertos / quantidade) * 100;
        if (perf < 85 && !dataRevisao) {
            showToast(`Desempenho ${perf.toFixed(0)}% — informe uma data de revisão.`, 'error');
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
        concluido:     false,
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
        closeFormModal();
        showToast(editId ? 'Estudo atualizado!' : 'Estudo registrado!', 'success');
        atualizarInterface();
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    }
}

// =====================================================
// GERENCIAR MATÉRIAS
// =====================================================
function openNewMateriaModal() {
    document.getElementById('nomeMateria').value = '';
    document.getElementById('newMateriaModal').classList.add('show');
}
function closeNewMateriaModal() { document.getElementById('newMateriaModal').classList.remove('show'); }
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
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
}

// =====================================================
// GERENCIAR FORMAÇÕES
// =====================================================
function openNewFormacaoModal() {
    document.getElementById('nomeFormacao').value = '';
    document.getElementById('newFormacaoModal').classList.add('show');
}
function closeNewFormacaoModal() { document.getElementById('newFormacaoModal').classList.remove('show'); }
async function saveNewFormacao() {
    const nome = document.getElementById('nomeFormacao').value.trim().toUpperCase();
    if (!nome) { showToast('Informe o nome da formação', 'error'); return; }
    try {
        const nova = await apiFetch('/api/formacoes', { method: 'POST', body: JSON.stringify({ nome }) });
        state.formacoes.push(nova);
        closeNewFormacaoModal();
        showToast(`Formação "${nova.nome}" criada!`, 'success');
        populateSelects();
        const sel = document.getElementById('formacao');
        if (sel) sel.value = nova.id;
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
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
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
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
