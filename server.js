// =====================================================
// JORNADA ACADÊMICA — SERVER
// =====================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// DIAGNÓSTICO — acesse GET /api/debug no navegador
// para ver exatamente o que está falhando
// =====================================================
app.get('/api/debug', async (req, res) => {
    const result = {};

    // 1) Tenta buscar sem join
    const { data: d1, error: e1 } = await supabase
        .from('estudos').select('*').limit(1);

    if (e1) {
        return res.status(500).json({
            passo: 'select * sem join',
            erro: e1.message,
            detalhes: e1
        });
    }
    result.colunas_estudos = d1.length ? Object.keys(d1[0]) : '(tabela vazia)';
    result.exemplo_sem_join = d1[0] || null;

    // 2) Tenta com join em materias
    const { data: d2, error: e2 } = await supabase
        .from('estudos').select('*, materias(nome)').limit(1);
    if (e2) {
        result.erro_join_materias = e2.message;
    } else {
        result.join_materias_ok = true;
    }

    // 3) Tenta com join em formacoes
    const { data: d3, error: e3 } = await supabase
        .from('estudos').select('*, formacoes(nome)').limit(1);
    if (e3) {
        result.erro_join_formacoes = e3.message;
    } else {
        result.join_formacoes_ok = true;
    }

    // 4) Tenta com ambos os joins
    const { data: d4, error: e4 } = await supabase
        .from('estudos').select('*, materias(nome), formacoes(nome)').limit(1);
    if (e4) {
        result.erro_join_completo = e4.message;
        result.detalhes_join_completo = e4;
    } else {
        result.join_completo_ok = true;
        result.exemplo_com_join = d4[0] || null;
    }

    res.json(result);
});

// =====================================================
// MATÉRIAS
// =====================================================

app.get('/api/materias', async (req, res) => {
    const { data, error } = await supabase
        .from('materias')
        .select('*')
        .order('nome', { ascending: true });
    if (error) { console.error('[MATERIAS GET]', error); return res.status(500).json({ error: error.message }); }
    res.json(data);
});

app.post('/api/materias', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('materias')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select().single();
    if (error) { console.error('[MATERIAS POST]', error); return res.status(500).json({ error: error.message }); }
    res.status(201).json(data);
});

app.delete('/api/materias/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('estudos').delete().eq('materia_id', id);
    const { error } = await supabase.from('materias').delete().eq('id', id);
    if (error) { console.error('[MATERIAS DELETE]', error); return res.status(500).json({ error: error.message }); }
    res.json({ success: true });
});

// =====================================================
// FORMAÇÕES
// =====================================================

app.get('/api/formacoes', async (req, res) => {
    const { data, error } = await supabase
        .from('formacoes')
        .select('*')
        .order('nome', { ascending: true });
    if (error) { console.error('[FORMACOES GET]', error); return res.status(500).json({ error: error.message }); }
    res.json(data);
});

app.post('/api/formacoes', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('formacoes')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select().single();
    if (error) { console.error('[FORMACOES POST]', error); return res.status(500).json({ error: error.message }); }
    res.status(201).json(data);
});

app.delete('/api/formacoes/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('formacoes').delete().eq('id', id);
    if (error) { console.error('[FORMACOES DELETE]', error); return res.status(500).json({ error: error.message }); }
    res.json({ success: true });
});

// =====================================================
// ESTUDOS
// =====================================================

app.get('/api/estudos', async (req, res) => {
    const { mes, ano } = req.query;
    console.log('[ESTUDOS GET] params recebidos:', { mes, ano });

    let query = supabase
        .from('estudos')
        .select('*, materias(nome), formacoes(nome)')
        .order('data_estudo', { ascending: false });

    if (mes && ano) {
        const mesInt = parseInt(mes, 10);
        const anoInt = parseInt(ano, 10);
        const inicio    = `${anoInt}-${String(mesInt).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anoInt, mesInt, 0).getDate();
        const fim       = `${anoInt}-${String(mesInt).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        console.log('[ESTUDOS GET] filtro:', { inicio, fim });
        query = query.gte('data_estudo', inicio).lte('data_estudo', fim);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[ESTUDOS GET] erro completo:', JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message, codigo: error.code, detalhes: error });
    }

    const normalized = data.map(e => ({
        ...e,
        materia_nome:  e.materias?.nome  || '',
        formacao_nome: e.formacoes?.nome || '',
    }));

    console.log('[ESTUDOS GET] sucesso, registros:', normalized.length);
    res.json(normalized);
});

app.post('/api/estudos', async (req, res) => {
    const body = req.body;
    const payload = {
        materia_id:    body.materia_id    || null,
        formacao_id:   body.formacao_id   || null,
        unidade:       body.unidade       ? body.unidade.toUpperCase()  : null,
        conteudo:      body.conteudo      ? body.conteudo.toUpperCase() : null,
        data_estudo:   body.data_estudo   || null,
        quantidade:    body.quantidade    || null,
        total_acertos: body.total_acertos || null,
        data_revisao:  body.data_revisao  || null,
        concluido:     body.concluido     || false,
    };
    console.log('[ESTUDOS POST] payload:', payload);
    const { data, error } = await supabase
        .from('estudos')
        .insert([payload])
        .select('*, materias(nome), formacoes(nome)')
        .single();
    if (error) {
        console.error('[ESTUDOS POST] erro:', JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message, detalhes: error });
    }
    res.status(201).json({
        ...data,
        materia_nome:  data.materias?.nome  || '',
        formacao_nome: data.formacoes?.nome || '',
    });
});

app.put('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const payload = {
        materia_id:    body.materia_id    || null,
        formacao_id:   body.formacao_id   || null,
        unidade:       body.unidade       ? body.unidade.toUpperCase()  : null,
        conteudo:      body.conteudo      ? body.conteudo.toUpperCase() : null,
        data_estudo:   body.data_estudo   || null,
        quantidade:    body.quantidade    || null,
        total_acertos: body.total_acertos || null,
        concluido:     body.concluido !== undefined ? body.concluido : false,
    };
    const { data, error } = await supabase
        .from('estudos')
        .update(payload)
        .eq('id', id)
        .select('*, materias(nome), formacoes(nome)')
        .single();
    if (error) {
        console.error('[ESTUDOS PUT]', error);
        return res.status(500).json({ error: error.message, detalhes: error });
    }
    res.json({
        ...data,
        materia_nome:  data.materias?.nome  || '',
        formacao_nome: data.formacoes?.nome || '',
    });
});

app.delete('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('estudos').delete().eq('id', id);
    if (error) { console.error('[ESTUDOS DELETE]', error); return res.status(500).json({ error: error.message }); }
    res.json({ success: true });
});

// Fallback — SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`→ Diagnóstico: GET /api/debug`);
});
