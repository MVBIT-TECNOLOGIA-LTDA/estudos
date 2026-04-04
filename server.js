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
// MATÉRIAS
// =====================================================

// GET /api/materias
app.get('/api/materias', async (req, res) => {
    const { data, error } = await supabase
        .from('materias')
        .select('*')
        .order('nome', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/materias
app.post('/api/materias', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('materias')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// DELETE /api/materias/:id
app.delete('/api/materias/:id', async (req, res) => {
    const { id } = req.params;
    // Remove estudos vinculados primeiro (cascade no SQL já faz isso, mas por segurança)
    await supabase.from('estudos').delete().eq('materia_id', id);
    const { error } = await supabase.from('materias').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// =====================================================
// FORMAÇÕES
// =====================================================

// GET /api/formacoes
app.get('/api/formacoes', async (req, res) => {
    const { data, error } = await supabase
        .from('formacoes')
        .select('*')
        .order('nome', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/formacoes
app.post('/api/formacoes', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { data, error } = await supabase
        .from('formacoes')
        .insert([{ nome: nome.trim().toUpperCase() }])
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// DELETE /api/formacoes/:id
app.delete('/api/formacoes/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('formacoes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// =====================================================
// ESTUDOS
// =====================================================

// GET /api/estudos?mes=MM&ano=YYYY
app.get('/api/estudos', async (req, res) => {
    const { mes, ano } = req.query;
    let query = supabase
        .from('estudos')
        .select(`
            *,
            materias(nome),
            formacoes(nome)
        `)
        .order('data_estudo', { ascending: false });

    if (mes && ano) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0]; // último dia do mês
        query = query.gte('data_estudo', inicio).lte('data_estudo', fim);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Normalizar nomes das relações
    const normalized = data.map(e => ({
        ...e,
        materia_nome: e.materias?.nome || '',
        formacao_nome: e.formacoes?.nome || '',
    }));
    res.json(normalized);
});

// POST /api/estudos
app.post('/api/estudos', async (req, res) => {
    const body = req.body;
    const payload = {
        materia_id: body.materia_id || null,
        formacao_id: body.formacao_id || null,
        unidade: body.unidade || null,
        conteudo: body.conteudo || null,
        data_estudo: body.data_estudo || null,
        quantidade: body.quantidade || null,
        total_acertos: body.total_acertos || null,
        data_revisao: body.data_revisao || null,
        concluido: body.concluido || false,
    };
    const { data, error } = await supabase
        .from('estudos')
        .insert([payload])
        .select(`*, materias(nome), formacoes(nome)`)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({
        ...data,
        materia_nome: data.materias?.nome || '',
        formacao_nome: data.formacoes?.nome || '',
    });
});

// PUT /api/estudos/:id
app.put('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const payload = {
        materia_id: body.materia_id || null,
        formacao_id: body.formacao_id || null,
        unidade: body.unidade || null,
        conteudo: body.conteudo || null,
        data_estudo: body.data_estudo || null,
        quantidade: body.quantidade || null,
        total_acertos: body.total_acertos || null,
        concluido: body.concluido !== undefined ? body.concluido : false,
    };
    const { data, error } = await supabase
        .from('estudos')
        .update(payload)
        .eq('id', id)
        .select(`*, materias(nome), formacoes(nome)`)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({
        ...data,
        materia_nome: data.materias?.nome || '',
        formacao_nome: data.formacoes?.nome || '',
    });
});

// DELETE /api/estudos/:id
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
