const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
const port = 3000;

let dataStore = [];

// Middleware para analisar o corpo das requisições como JSON
app.use(bodyParser.json());

// Endpoint para adicionar novas leituras de dados
app.post('/data', (req, res) => {
    // Cria uma nova leitura de dados
    console.log('Data received:', req.body);
  const data = req.body;
  
  if (data) {
      data.timestamp = new Date();
      dataStore.push(data);
      res.status(201).json(data);

  } else {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Endpoint para obter a última leitura
app.get('/data/last', (req, res) => {
  console.log('Last data received:', dataStore[dataStore.length - 1]);
  if (dataStore.length > 0) {
    res.json(dataStore[dataStore.length - 1]);
  } else {
    res.status(404).json({ error: 'No data available' });
  }
});

// Endpoint para obter todas as leituras
app.get('/data', (req, res) => {
  console.log('All data received:', dataStore);
  res.json(dataStore);
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
