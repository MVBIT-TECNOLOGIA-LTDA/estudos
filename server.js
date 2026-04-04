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

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// DIAGNÓSTICO — GET /api/debug
// Mostra as colunas reais da tabela estudos
// =====================================================
app.get('/api/debug', async (req, res) => {
    const { data, error } = await supabase.from('estudos').select('*').limit(1);
    if (error) return res.status(500).json({ erro: error.message });
    res.json({
        colunas_disponiveis: data.length ? Object.keys(data[0]) : '(tabela vazia — sem colunas detectáveis)',
        exemplo: data[0] || null
    });
});

// =====================================================
// MATÉRIAS
// =====================================================

app.get('/api/materias', async (req, res) => {
    const { data, error } = await supabase
        .from('materias').select('*').order('nome', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/materias', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('materias')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

app.delete('/api/materias/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('estudos').delete().eq('materia_id', id);
    const { error } = await supabase.from('materias').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// =====================================================
// FORMAÇÕES
// =====================================================

app.get('/api/formacoes', async (req, res) => {
    const { data, error } = await supabase
        .from('formacoes').select('*').order('nome', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/formacoes', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('formacoes')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

app.delete('/api/formacoes/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('formacoes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// =====================================================
// ESTUDOS
// =====================================================

// Colunas obrigatórias que devem existir na tabela.
// Execute o SQL abaixo no Supabase SQL Editor caso
// alguma ainda não exista:
//
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS data_estudo   date;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS data_revisao  date;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS concluido     boolean DEFAULT false;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS quantidade    integer;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS total_acertos integer;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS unidade       text;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS conteudo      text;
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS materia_id    bigint REFERENCES materias(id);
//   ALTER TABLE estudos ADD COLUMN IF NOT EXISTS formacao_id   bigint REFERENCES formacoes(id);

app.get('/api/estudos', async (req, res) => {
    const { mes, ano } = req.query;

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
        query = query.gte('data_estudo', inicio).lte('data_estudo', fim);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[ESTUDOS GET]', error.message);
        return res.status(500).json({ error: error.message });
    }

    const normalized = data.map(e => ({
        ...e,
        materia_nome:  e.materias?.nome  || '',
        formacao_nome: e.formacoes?.nome || '',
    }));
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
    const { data, error } = await supabase
        .from('estudos')
        .insert([payload])
        .select('*, materias(nome), formacoes(nome)')
        .single();
    if (error) {
        console.error('[ESTUDOS POST]', error.message);
        return res.status(500).json({ error: error.message });
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
        data_revisao:  body.data_revisao  || null,
        concluido:     body.concluido !== undefined ? body.concluido : false,
    };
    const { data, error } = await supabase
        .from('estudos')
        .update(payload)
        .eq('id', id)
        .select('*, materias(nome), formacoes(nome)')
        .single();
    if (error) {
        console.error('[ESTUDOS PUT]', error.message);
        return res.status(500).json({ error: error.message });
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
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Fallback — SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Jornada Acadêmica rodando na porta ${PORT}`);
});
