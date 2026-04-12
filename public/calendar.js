// ============================================
// CALENDAR MODAL — dias do mês com registros
// ============================================

let calendarYear  = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

// Cache dos estudos por mes/ano para mostrar bolinhas sem sobrescrever state
let _calendarCache = {};

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear  = state.currentMonth.getFullYear();
        calendarMonth = state.currentMonth.getMonth();
        // Garante que o mês atual já está no cache
        const key = `${calendarYear}-${calendarMonth + 1}`;
        if (!_calendarCache[key]) {
            _calendarCache[key] = licitacoes || [];
        }
        renderCalendarDays();
        modal.classList.add('show');
    }
}

function changeCalendarMonth(direction) {
    calendarMonth += direction;
    if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0;  calendarYear++; }

    const key = `${calendarYear}-${calendarMonth + 1}`;
    if (_calendarCache[key]) {
        renderCalendarDays();
    } else {
        // Busca dados do mês navegado para mostrar bolinhas corretamente
        apiFetch(`/api/estudos?mes=${calendarMonth + 1}&ano=${calendarYear}`)
            .then(estudos => {
                _calendarCache[key] = estudos.map(s => ({ ...s, data: s.data_estudo }));
                renderCalendarDays();
            })
            .catch(() => renderCalendarDays());
    }
}

function renderCalendarDays() {
    const monthYearEl   = document.getElementById('calendarMonthYear');
    const daysContainer = document.getElementById('calendarDays');
    if (!monthYearEl || !daysContainer) return;

    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    monthYearEl.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    // Usa cache do mês visualizado no calendário para as bolinhas
    const key = `${calendarYear}-${calendarMonth + 1}`;
    const fonte = _calendarCache[key] || licitacoes || [];

    const diasComRegistros = new Set();
    fonte.forEach(l => {
        if (l.data) {
            const [y, m, d] = l.data.split('-').map(Number);
            if (y === calendarYear && (m - 1) === calendarMonth) diasComRegistros.add(d);
        }
    });

    // Dia selecionado
    let selectedDay = null;
    if (currentDateFilter) {
        const [fy, fm, fd] = currentDateFilter.split('-').map(Number);
        if (fy === calendarYear && (fm - 1) === calendarMonth) selectedDay = fd;
    }

    const firstDay    = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today       = new Date();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const hasRecord  = diasComRegistros.has(d);
        const isToday    = calendarYear === today.getFullYear() &&
                           calendarMonth === today.getMonth()   &&
                           d === today.getDate();
        const isSelected = d === selectedDay;

        html += `<div class="calendar-day ${hasRecord ? 'has-record' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected-day' : ''}"
                      onclick="selectDay(${d})">${d}</div>`;
    }
    daysContainer.innerHTML = html;
}

function selectDay(day) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Toggle: clique no mesmo dia remove o filtro
    if (currentDateFilter === dateStr) {
        currentDateFilter = null;
    } else {
        currentDateFilter = dateStr;
    }

    // Fecha o calendário
    const modal = document.getElementById('calendarModal');
    if (modal) modal.classList.remove('show');

    // Compara com o mês atual ANTES de atualizar state
    const mesAtual = state.currentMonth.getMonth() + 1;
    const anoAtual = state.currentMonth.getFullYear();
    const mesSelecionado = calendarMonth + 1;
    const anoSelecionado = calendarYear;
    const mudouDeMes = mesSelecionado !== mesAtual || anoSelecionado !== anoAtual;

    // Navega para o mês do dia selecionado
    state.currentMonth = new Date(anoSelecionado, calendarMonth, 1);
    currentMonth = state.currentMonth;
    updateMonthDisplay();

    if (mudouDeMes) {
        const key = `${anoSelecionado}-${mesSelecionado}`;
        if (_calendarCache[key]) {
            // Já temos os dados no cache
            state.studies = _calendarCache[key].map(l => ({ ...l, data_estudo: l.data_estudo || l.data }));
            licitacoes = _calendarCache[key];
            updateTable();
            updateDashboard();
        } else {
            apiFetch(`/api/estudos?mes=${mesSelecionado}&ano=${anoSelecionado}`)
                .then(estudos => {
                    state.studies = estudos;
                    licitacoes = estudos.map(s => ({ ...s, data: s.data_estudo }));
                    _calendarCache[key] = licitacoes;
                    updateTable();
                    updateDashboard();
                })
                .catch(err => showToast('Erro: ' + err.message, 'error'));
        }
    } else {
        filterLicitacoes();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
});
