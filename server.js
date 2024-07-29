const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const { type } = require('os');
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');
const dispositivos = [
  {
    id: 'ESP001',
    ativado: false,
    status: 'offline',
    nome: 'Dispositivo ESP001',
    descricao: 'Este é um dispositivo de exemplo.',
    mqtt_server: 'test.mosquitto.org',
    mqtt_port: '1883',
    mqtt_client: 'ESP32Client',
    mqtt_topic: 'esp32/ESP001',
    sensores: [
      {
        id: '1',
        porta: 33,
        nome: 'Sensor de Temperatura',
        tipo: 'temperatura',
        valor: '25°C',
        data: [
          { valor: '24°C', timestamp: '2024-07-27T10:00:00Z' },
          { valor: '25°C', timestamp: '2024-07-28T10:00:00Z' }
        ]
      },
      {
        id: '2',
        porta: 32,
        nome: 'Sensor de Umidade',
        tipo: 'umidade',
        valor: '60%',
        data: [
          { valor: '55%', timestamp: '2024-07-27T10:00:00Z' },
          { valor: '60%', timestamp: '2024-07-28T10:00:00Z' }
        ]
      }
    ]
  }
  // Adicione outros dispositivos aqui se necessário
];

const clients = new Map();

// Função para gerar o próximo ID disponível se o último dispositivo estiver ativado
const getNextId = () => {
  const lastDevice = dispositivos[dispositivos.length - 1];
  
  if (lastDevice && lastDevice.ativado) {
    const ids = dispositivos.map(d => d.id);
    let nextIdNumber = 1;
    
    while (ids.includes(`ESP${String(nextIdNumber).padStart(3, '0')}`)) {
      nextIdNumber++;
    }
    
    return `ESP${String(nextIdNumber).padStart(3, '0')}`;
  } else {
    return lastDevice.id;
  }
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = process.env.PORT || 3001;

// Substitua a URL pelo valor correto fornecido pelo seu serviço de hospedagem
const pool = new Pool({
  connectionString: 'postgresql://getuliogutemberg:D294PZMt05wGxfDX3izUdhMctWfX1IjM@dpg-cqjh5t8gph6c7396rjb0-a/memoria',
});

// Configurações do banco de dados
pool.on('connect', () => {
  console.log('Conectado ao banco de dados');
});

pool.on('error', (err) => {
  console.error('Erro no cliente do banco de dados:', err);
});

// Testar a conexão ao banco de dados
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao banco de dados:', err);
  }
  console.log('Conectado ao banco de dados com sucesso');
  release();
});

const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        umidade NUMERIC,
        temperatura NUMERIC,
        luz NUMERIC
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


mqttClient.on('connect', () => {
  console.log('Conectado ao broker MQTT');
  mqttClient.subscribe('esp32/ESP001', (err) => {
    if (err) {
      console.error('Erro ao se inscrever no tópico "esp32/ESP001" MQTT:', err);
    }
    console.log('Inscrito no tópico MQTT "esp32/ESP001"');
  });
});




// Configuração do WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server , path: '/ws' });

wss.on('connection', (ws) => {
  
  const id = Date.now();
  clients.set(id, ws);
  
  console.log('Novo cliente conectado: ', id);

  ws.on('message', (message) => {
      const data = JSON.parse(message);
      // Atualiza a posição do cliente
    if (data.type === 'mousemove') {
      const client = clients.get(id);
      if (client) {
        client.x = data.x;
        client.y = data.y;
      }
    }

    if (data.type === 'scroll') {
      const client = clients.get(id);
      if (client) {
        client.x = client.x + data.x; ;
        client.y = client.y + data.y;
        client.scroll = true;
        client.scrollX = data.x;
        client.scrollY = data.y;
      }
    }

    if (data.type === 'click') {
      const client = clients.get(id);
      if (client) {
        client.clickX = data.x;
        client.clickY = data.y;
        client.click = true;
      }
    }


     // Envia a atualização de todos os clientes
     const positions = Array.from(clients.entries()).map(([clientId, client]) => ({
      id: clientId,
      x: client.x,
      y: client.y,
      click: client.click,
      scroll: client.scroll,
      scrollX: client.scrollX,
      scrollY: client.scrollY,
      clickX: client.clickX,
      clickY: client.clickY
    }));

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update_positions', positions }));
      }
    });

      switch(data.type) {
          case 'mousemove':
              console.log(`${id} movimentou o mouse: X: ${data.x}, Y: ${data.y}`);
              positions.push({ id, x: data.x, y: data.y });
              wss.clients.forEach((client) => client.send(JSON.stringify({ type: 'update_positions', positions })));
              break;
          case 'click':
              console.log(`${id} clicou em: X: ${data.x}, Y: ${data.y}`);
              positions.push({ id, x: data.x, y: data.y, click: true });
              // wss.clients.forEach((client) => client.send(JSON.stringify({ type: 'update_positions', positions })));
              setTimeout(() => {
                  positions.push({ id, x: data.x, y: data.y, click: false });
                  // wss.clients.forEach((client) => client.send(JSON.stringify({ type: 'update_positions', positions })));
              }, 500);
              break;
          case 'scroll':
              
              console.log(`${id} rolou scroll: X: ${data.x}, Y: ${data.y}`);
              positions.push({ id, scroll: true ,scrollX: data.x, scrollY: data.y});
              // wss.clients.forEach((client) => client.send(JSON.stringify({ type: 'update_positions', positions })));
              setTimeout(() => {
                  positions.push({ id, scroll: false ,scrollX: data.x, scrollY: data.y});
                  // wss.clients.forEach((client) => client.send(JSON.stringify({ type: 'update_positions', positions })));
              }, 500);
              break;
          case 'keydown':
              console.log(`${id} teclou: ${data.key}`);
              break;
          case 'keyup':
              console.log(`${id} liberou: ${data.key}`);
              break;
          case 'touchstart':
              console.log(`${id} tocou em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'touchend':
              console.log(`${id} soltou toque em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'touchmove':
              console.log(`${id} movimentou o toque em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'touchcancel':
              console.log(`${id} cancelou o toque em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'touchleave':
              console.log(`${id} deixou o toque em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'touchenter':
              console.log(`${id} entrou no toque em: X: ${data.x}, Y: ${data.y}`);
              break;
          case 'div_click':
              console.log(`${id} clicou em: X: ${data.x}, Y: ${data.y}, Título: ${data.title}`);
              break;
          default:
              console.log(`${id} recebeu um evento desconhecido:`, data.type);
      }
  });

  ws.on('close', () => {
    console.log('Cliente ' + id + ' desconectado');
    clients.delete(id);
  });
});
    

mqttClient.on('message', async (topic, message) => {
  try {
    // console.log('Mensagem MQTT recebida:', topic, message.toString());

   

    // Remover caracteres de unidade antes de tentar fazer o parsing para JSON
    let cleanedMessage = message.toString()
      .replace(/%/g, '')
      .replace(/°C/g, '')
      .replace(/ L/g, '');

    // Verifique se a mensagem é uma string JSON válida
    let payload;
    try {
      payload = JSON.parse(cleanedMessage);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      });
    } catch (jsonError) {
      console.error('Mensagem MQTT recebida não é um JSON válido:', jsonError);
      return; // Retorna para evitar processamento adicional
    }

    // Extrair e limpar dados
    let { umidade, temperatura, luz } = payload;
    const timestamp = new Date();

    // Converter para números
    umidade = parseFloat(umidade);
    temperatura = parseFloat(temperatura);
    luz = parseFloat(luz);

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

    
    // try {
    //   const result = await pool.query(
    //     'INSERT INTO data (timestamp, umidade, temperatura, luz) VALUES ($1, $2, $3, $4) RETURNING *',
    //     [timestamp, umidade, temperatura, luz]
    //   );
    //   // const insertedData = result.rows[0];
      
    //   // // Enviar dados para todos os clientes conectados via WebSocket
    //   // wss.clients.forEach((client) => {
    //   //   if (client.readyState === WebSocket.OPEN) {
    //   //     client.send(JSON.stringify(insertedData));
    //   //   }
    //   // });
    // } catch (err) {
    //   console.error('Erro ao inserir dados no banco de dados:', err);
    // }
  } catch (err) {
    console.error('Erro ao processar mensagem MQTT:', err.message);
  }
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

// Rota para retornar as informações do dispositivo pelo ID e ativar o dispositivo
app.get('/esp32/:id', (req, res) => {
  const id = req.params.id;
  const dispositivo = dispositivos.find(d => d.id === id);

  if (dispositivo) {
    res.json(dispositivo);
  } else {
    res.status(404).json({ error: 'Dispositivo não encontrado' });
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

// Rota para retornar as configurações iniciais com o próximo ID disponível
app.get('/setup', async (req, res) => {
  try {
    const nextId = getNextId();

    // Criar um novo dispositivo com o próximo ID disponível
    const novoDispositivo = {
      id: nextId,
      ativado: false,
      status: 'OFFLINE',
      nome: `Dispositivo ${nextId}`,
      descricao: 'Descrição padrão do novo dispositivo.',
      mqtt_server: 'test.mosquitto.org',
      mqtt_port: '1883',
      mqtt_client: 'ESP32Client',
      mqtt_topic: `esp32/${nextId}`,
      sensores: []
    };

    // Adicionar o novo dispositivo à lista de dispositivos
    dispositivos.push(novoDispositivo);

    // Preparar a resposta JSON com as credenciais Wi-Fi e o novo ID
    const result = {
      wifi_credentials_str: "[{\"CLARO_2G287EF5\":\"AF287EF5\"},{\"CLARO_5G287EF5\":\"AF287EF5\"},{\"Getulio\":\"100200300\"}]",
      id: nextId,
      // mqtt_server: novoDispositivo.mqtt_server,
      // mqtt_port: novoDispositivo.mqtt_port,
      // mqtt_client: novoDispositivo.mqtt_client,
      // mqtt_topic: novoDispositivo.mqtt_topic
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
