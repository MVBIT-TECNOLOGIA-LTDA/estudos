// =====================================================
// JORNADA ACADÊMICA — CALENDAR
// =====================================================

let calendarViewMonth = new Date();
let calendarOpen      = false;

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;

    if (calendarOpen) {
        modal.classList.remove('show');
        calendarOpen = false;
        return;
    }

    // Sincroniza o mês do calendário com o mês atual
    calendarViewMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth(), 1);
    renderCalendar();
    modal.classList.add('show');
    calendarOpen = true;

    // Fecha ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', closeCalendarOutside, { once: true });
    }, 50);
}

function closeCalendarOutside(e) {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    const box = modal.querySelector('.calendar-box');
    if (box && !box.contains(e.target)) {
        modal.classList.remove('show');
        calendarOpen = false;
    }
}

function changeCalendarMonth(dir) {
    calendarViewMonth.setMonth(calendarViewMonth.getMonth() + dir);
    renderCalendar();
}

function renderCalendar() {
    const monthNames = [
        'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
    ];

    const y   = calendarViewMonth.getFullYear();
    const m   = calendarViewMonth.getMonth();
    const hoje = getTodayString();

    document.getElementById('calendarMonthYear').textContent = `${monthNames[m]} ${y}`;

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    // Datas com registro neste mês
    const datesWithStudy = new Set(
        state.studies
            .filter(s => s.data_estudo)
            .map(s => {
                const [sy, sm] = s.data_estudo.split('-').map(Number);
                return (sm - 1 === m && sy === y) ? s.data_estudo : null;
            })
            .filter(Boolean)
    );

    // Também marca datas de revisão
    state.studies
        .filter(s => s.data_revisao && !s.revisao_concluida)
        .forEach(s => {
            const [sy, sm] = s.data_revisao.split('-').map(Number);
            if (sm - 1 === m && sy === y) datesWithStudy.add(s.data_revisao);
        });

    const container = document.getElementById('calendarDays');
    if (!container) return;

    let html = '';

    // Células vazias antes do primeiro dia
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr   = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday  = dayStr === hoje;
        const hasRec   = datesWithStudy.has(dayStr);
        const isSel    = dayStr === currentDateFilter;

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (hasRec)  classes += ' has-record';
        if (isSel)   classes += ' selected-day';

        html += `<div class="${classes}" onclick="selectCalendarDay('${dayStr}')">${d}</div>`;
    }

    container.innerHTML = html;
}

function selectCalendarDay(dateStr) {
    if (currentDateFilter === dateStr) {
        // Clique duplo: remove filtro
        currentDateFilter = null;
    } else {
        currentDateFilter = dateStr;

        // Se o mês do dia clicado for diferente do mês atual, muda o mês
        const [y, m] = dateStr.split('-').map(Number);
        if (
            m !== state.currentMonth.getMonth() + 1 ||
            y !== state.currentMonth.getFullYear()
        ) {
            state.currentMonth = new Date(y, m - 1, 1);
            currentMonth       = state.currentMonth;
            updateMonthDisplay();

            apiFetch(`/api/estudos?mes=${m}&ano=${y}`)
                .then(estudos => {
                    state.studies = estudos;
                    atualizarInterface();
                })
                .catch(err => showToast('Erro: ' + err.message, 'error'));
        }
    }

    // Navega para programados ao selecionar uma data
    const navItem = document.querySelector('[data-page="programados"]');
    navigateTo('programados', navItem);

    updateTable();
    renderCalendar();

    // Fecha o modal
    document.getElementById('calendarModal').classList.remove('show');
    calendarOpen = false;
}
