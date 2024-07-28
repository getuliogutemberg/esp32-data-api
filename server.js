const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const mqtt = require('mqtt');
const WebSocket = require('ws');

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

// Configuração do cliente MQTT
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');

mqttClient.on('connect', () => {
  console.log('Conectado ao broker MQTT');
  mqttClient.subscribe('esp32/sensores', (err) => {
    if (err) {
      console.error('Erro ao se inscrever no tópico MQTT:', err);
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  try {
    // Verifique se a mensagem é uma string JSON válida
    const messageString = message.toString();
    let payload;

    try {
      payload = JSON.parse(messageString);
    } catch (jsonError) {
      console.error('Mensagem MQTT recebida não é um JSON válido:', messageString);
      return; // Retorna para evitar processamento adicional
    }

    let { umidade, temperatura, luz } = payload;
    const timestamp = new Date();

    // Substituir NaN por NULL para armazenar no banco de dados
    if (isNaN(umidade)) {
      umidade = null;
    }
    if (isNaN(temperatura)) {
      temperatura = null;
    }
    if (isNaN(luz)) {
      luz = null;
    }

    try {
      const result = await pool.query(
        'INSERT INTO data (timestamp, umidade, temperatura, luz) VALUES ($1, $2, $3, $4) RETURNING *',
        [timestamp, umidade, temperatura, luz]
      );
      const insertedData = result.rows[0];
      // Enviar dados para todos os clientes conectados via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(insertedData));
        }
      });
    } catch (err) {
      console.error('Erro ao inserir dados no banco de dados:', err);
    }
  } catch (err) {
    console.error('Erro ao processar mensagem MQTT:', err.message);
  }
});

// Configuração do WebSocket
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Novo cliente conectado via WebSocket');
  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

// Endpoints REST existentes

app.post('/test', async (req, res) => {
  let { umidade, temperatura, luz } = req.body;
  const timestamp = new Date();

  // Substituir NaN por NULL para armazenar no banco de dados
  if (isNaN(umidade)) {
    umidade = null;
  }
  if (isNaN(temperatura)) {
    temperatura = null;
  }
  if (isNaN(luz)) {
    luz = null;
  }

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
});

app.post('/data', async (req, res) => {
  let { umidade, temperatura, luz } = req.body;
  const timestamp = new Date();

  // Substituir NaN por NULL para armazenar no banco de dados
  if (isNaN(umidade)) {
    umidade = null;
  }
  if (isNaN(temperatura)) {
    temperatura = null;
  }
  if (isNaN(luz)) {
    luz = null;
  }

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
});

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

app.get('/esp32/ESP007', async (req, res) => {
  try {
    const result = 'Hello, 007!';
    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar última leitura:', err);
    res.status(500).json({ error: 'Erro ao buscar última leitura' });
  }
});

app.get('/data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data ORDER BY timestamp');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar todas as leituras:', err);
    res.status(500).json({ error: 'Erro ao buscar todas as leituras' });
  }
});

app.delete('/data', async (req, res) => {
  try {
    await pool.query('DELETE FROM data');
    res.sendStatus(204);
  } catch (err) {
    console.error('Erro ao apagar todas as leituras:', err);
    res.status(500).json({ error: 'Erro ao apagar todas as leituras' });
  }
});

app.get('/setup', async (req, res) => {
  try {
    const result = {
      wifi_credentials_str:"[{\"CLARO_2G287EF5\":\"AF287EF5\"},{\"CLARO_5G287EF5\":\"AF287EF5\"},{\"Getulio\":\"100200300\"}]",
      mqtt_server:"test.mosquitto.org",
      mqtt_port:"1883",
      mqtt_client: "ESP32Client",
      mqtt_topic: "esp32/sensores",
      id: 'ESP007',   
    };

    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar todas as leituras:', err);
    res.status(500).json({ error: 'Erro ao buscar todas as leituras' });
  }
});

// Inicia o servidor
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
