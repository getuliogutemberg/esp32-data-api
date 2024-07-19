const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3000;

const pool = new Pool({
  connectionString: 'postgresql://memory_sp7i_user:hHkqDGZF86grDUhAWYQ77JvyDrB4FhTA@dpg-cqbq5qmehbks73dt9mu0-a/memory_sp7i'
});

pool.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados');
  }
});

const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP,
        umidade REAL,
        temperatura REAL,
        luz REAL
      )
    `);
    console.log('Tabela criada ou já existe');
  } catch (err) {
    console.error('Erro ao criar tabela:', err);
  }
};

// Cria a tabela ao iniciar o servidor
createTable();

// Endpoint para adicionar novas leituras de dados
app.post('/data', async (req, res) => {
  const { umidade, temperatura, luz } = req.body;
  
  if (umidade !== undefined && temperatura !== undefined && luz !== undefined) {
    const timestamp = new Date();
    
    try {
      const result = await pool.query(
        'INSERT INTO data (timestamp, umidade, temperatura, luz) VALUES ($1, $2, $3, $4) RETURNING *',
        [timestamp, umidade, temperatura, luz]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao inserir dados:', err);
      res.status(500).json({ error: 'Erro ao inserir dados' });
    }
  } else {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Endpoint para obter a última leitura
app.get('/data/last', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'No data available' });
    }
  } catch (err) {
    console.error('Erro ao buscar última leitura:', err);
    res.status(500).json({ error: 'Erro ao buscar última leitura' });
  }
});

// Endpoint para obter todas as leituras
app.get('/data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data ORDER BY timestamp');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar todas as leituras:', err);
    res.status(500).json({ error: 'Erro ao buscar todas as leituras' });
  }
});

// Endpoint para apagar todas as leituras
app.delete('/data', async (req, res) => {
  try {
    await pool.query('DELETE FROM data');
    res.sendStatus(204);
  } catch (err) {
    console.error('Erro ao apagar todas as leituras:', err);
    res.status(500).json({ error: 'Erro ao apagar todas as leituras' });
  }
});

// Endpoint para coletar token
app.get('/token', async (req, res) => {
  try {
    const result = '70yrmv'
    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar token:', err);
    res.status(500).json({ error: 'Erro ao buscar token' });
  }
});


// Inicia o servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
