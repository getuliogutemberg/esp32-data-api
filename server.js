const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3000;

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE data (timestamp TEXT, umidade REAL, temperatura REAL, luz REAL)");
});

// Endpoint para adicionar novas leituras de dados
app.post('/data', (req, res) => {
  const data = req.body;
  
  if (data) {
    const stmt = db.prepare("INSERT INTO data (timestamp, umidade, temperatura, luz) VALUES (?, ?, ?, ?)");
    stmt.run(new Date().toISOString(), data.umidade, data.temperatura, data.luz);
    stmt.finalize();
    res.status(201).json(data);
  } else {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Endpoint para obter a última leitura
app.get('/data/last', (req, res) => {
  db.get("SELECT * FROM data ORDER BY rowid DESC LIMIT 1", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'No data available' });
    }
  });
});

// Endpoint para obter todas as leituras
app.get('/data', (req, res) => {
  db.all("SELECT * FROM data", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
