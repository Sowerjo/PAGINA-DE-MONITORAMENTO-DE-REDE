const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ping = require('ping');
const multer = require('multer');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Configuração do multer para upload de ícones
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'segredo123', // Em produção, utilize um segredo forte e seguro
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do banco de dados SQLite
const dbFile = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Erro ao conectar com o banco de dados", err);
    } else {
        console.log("Conectado ao banco de dados SQLite");
    }
});

// Criação das tabelas (se não existirem)
// Tabela de usuários
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL
    )`);
    
    // Tabela de dispositivos com colunas adicionais
    db.run(`CREATE TABLE IF NOT EXISTS dispositivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        nome TEXT NOT NULL,
        ip TEXT NOT NULL,
        icone TEXT,
        intervalo INTEGER,
        status TEXT DEFAULT 'offline',
        ultima_verificacao DATETIME,
        alarm_enabled INTEGER DEFAULT 1,
        icon_offset_x INTEGER DEFAULT 0,
        icon_offset_y INTEGER DEFAULT 0,
        pos_x INTEGER DEFAULT 50,
        pos_y INTEGER DEFAULT 50,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    // Tabela de configurações para cada usuário
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        update_interval INTEGER DEFAULT 10,
        monitoring_panel_scale INTEGER DEFAULT 100,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    // (Opcional) Rotina de migração para colunas ausentes – se necessário
    db.all("PRAGMA table_info(dispositivos)", (err, columns) => {
        if (err) {
            console.error("Erro ao obter informações da tabela dispositivos:", err);
        } else {
            const columnNames = columns.map(col => col.name);
            if (!columnNames.includes("alarm_enabled")) {
                db.run("ALTER TABLE dispositivos ADD COLUMN alarm_enabled INTEGER DEFAULT 1", (err) => {
                    if (err) console.error("Erro ao adicionar coluna alarm_enabled:", err);
                    else console.log("Coluna alarm_enabled adicionada.");
                });
            }
            if (!columnNames.includes("icon_offset_x")) {
                db.run("ALTER TABLE dispositivos ADD COLUMN icon_offset_x INTEGER DEFAULT 0", (err) => {
                    if (err) console.error("Erro ao adicionar coluna icon_offset_x:", err);
                    else console.log("Coluna icon_offset_x adicionada.");
                });
            }
            if (!columnNames.includes("icon_offset_y")) {
                db.run("ALTER TABLE dispositivos ADD COLUMN icon_offset_y INTEGER DEFAULT 0", (err) => {
                    if (err) console.error("Erro ao adicionar coluna icon_offset_y:", err);
                    else console.log("Coluna icon_offset_y adicionada.");
                });
            }
            if (!columnNames.includes("pos_x")) {
                db.run("ALTER TABLE dispositivos ADD COLUMN pos_x INTEGER DEFAULT 50", (err) => {
                    if (err) console.error("Erro ao adicionar coluna pos_x:", err);
                    else console.log("Coluna pos_x adicionada.");
                });
            }
            if (!columnNames.includes("pos_y")) {
                db.run("ALTER TABLE dispositivos ADD COLUMN pos_y INTEGER DEFAULT 50", (err) => {
                    if (err) console.error("Erro ao adicionar coluna pos_y:", err);
                    else console.log("Coluna pos_y adicionada.");
                });
            }
        }
    });
});

// Middleware para autenticação
function authMiddleware(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Endpoints de configuração

// Recupera as configurações do usuário
app.get('/api/settings', authMiddleware, (req, res) => {
    const usuario_id = req.session.usuario.id;
    db.get("SELECT * FROM configuracoes WHERE usuario_id = ?", [usuario_id], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao carregar configurações" });
        }
        if (row) {
            res.json(row);
        } else {
            // Se não existir, insere os valores padrão
            db.run("INSERT INTO configuracoes (usuario_id) VALUES (?)", [usuario_id], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Erro ao criar configurações" });
                }
                db.get("SELECT * FROM configuracoes WHERE usuario_id = ?", [usuario_id], (err, newRow) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: "Erro ao carregar configurações" });
                    }
                    res.json(newRow);
                });
            });
        }
    });
});

// Atualiza as configurações do usuário
app.put('/api/settings', authMiddleware, (req, res) => {
    const usuario_id = req.session.usuario.id;
    const { update_interval, monitoring_panel_scale } = req.body;
    if (update_interval === undefined || monitoring_panel_scale === undefined) {
        return res.status(400).json({ error: "Parâmetros update_interval e monitoring_panel_scale são obrigatórios" });
    }
    db.run("UPDATE configuracoes SET update_interval = ?, monitoring_panel_scale = ? WHERE usuario_id = ?", 
           [update_interval, monitoring_panel_scale, usuario_id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao atualizar configurações" });
        }
        res.json({ success: true, message: "Configurações atualizadas com sucesso!" });
    });
});

// Endpoints já existentes (login, cadastro, dashboard, dispositivos, ping, posição, editar, deletar)

// Endpoint de login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error(err);
            return res.send("Erro no servidor");
        }
        if (row) {
            bcrypt.compare(senha, row.senha, (err, result) => {
                if (result) {
                    req.session.usuario = { id: row.id, nome: row.nome, email: row.email };
                    res.redirect('/dashboard.html');
                } else {
                    res.send("Senha incorreta. <a href='/login.html'>Tentar novamente</a>");
                }
            });
        } else {
            res.send("Usuário não encontrado. <a href='/register.html'>Cadastre-se</a>");
        }
    });
});

// Endpoint de cadastro
app.post('/register', (req, res) => {
    const { nome, email, senha } = req.body;
    bcrypt.hash(senha, 10, (err, hash) => {
        if (err) {
            return res.send("Erro ao cadastrar usuário");
        }
        db.run("INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)", [nome, email, hash], function(err) {
            if (err) {
                console.error(err);
                return res.send("Erro ao cadastrar usuário. Email pode já estar cadastrado.");
            }
            res.redirect('/login.html');
        });
    });
});

// Rota para o dashboard (apenas para usuários autenticados)
app.get('/dashboard', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Endpoint para adicionar dispositivo
app.post('/api/device', authMiddleware, upload.single('icone'), (req, res) => {
    const { nome, ip, intervalo } = req.body;
    const icone = req.file ? req.file.filename : null;
    const usuario_id = req.session.usuario.id;
    
    db.run("INSERT INTO dispositivos (usuario_id, nome, ip, icone, intervalo) VALUES (?, ?, ?, ?, ?)", 
        [usuario_id, nome, ip, icone, intervalo], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao cadastrar dispositivo' });
        }
        res.json({ success: true, message: 'Dispositivo cadastrado com sucesso!' });
    });
});

// Endpoint para listar dispositivos do usuário
app.get('/api/devices', authMiddleware, (req, res) => {
    const usuario_id = req.session.usuario.id;
    db.all("SELECT * FROM dispositivos WHERE usuario_id = ?", [usuario_id], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao buscar dispositivos' });
        }
        res.json(rows);
    });
});

// Endpoint para realizar ping
app.get('/api/ping/:ip', authMiddleware, (req, res) => {
    const ip = req.params.ip;
    ping.promise.probe(ip)
        .then(result => {
            const status = result.alive ? 'online' : 'offline';
            res.json({ ip, status });
        })
        .catch(err => {
            res.status(500).json({ error: 'Erro ao realizar o ping' });
        });
});

// Endpoint para atualizar a posição do dispositivo
app.put('/api/device/position/:id', authMiddleware, (req, res) => {
    const deviceId = req.params.id;
    const usuario_id = req.session.usuario.id;
    const { pos_x, pos_y } = req.body;
    if (pos_x === undefined || pos_y === undefined) {
        return res.status(400).json({ error: "Parâmetros pos_x e pos_y são obrigatórios" });
    }
    db.run("UPDATE dispositivos SET pos_x = ?, pos_y = ? WHERE id = ? AND usuario_id = ?", [pos_x, pos_y, deviceId, usuario_id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao atualizar posição" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Dispositivo não encontrado ou sem permissão" });
        }
        res.json({ success: true, message: "Posição atualizada com sucesso!" });
    });
});

// Endpoint para deletar dispositivo
app.delete('/api/device/:id', authMiddleware, (req, res) => {
    const deviceId = req.params.id;
    const usuario_id = req.session.usuario.id;
    
    db.run("DELETE FROM dispositivos WHERE id = ? AND usuario_id = ?", [deviceId, usuario_id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao deletar dispositivo' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Dispositivo não encontrado ou sem permissão' });
        }
        res.json({ success: true, message: 'Dispositivo deletado com sucesso!' });
    });
});

// Endpoint para editar dispositivo (PUT)
app.put('/api/device/:id', authMiddleware, upload.single('icone'), (req, res) => {
    const deviceId = req.params.id;
    const usuario_id = req.session.usuario.id;
    const { nome, ip, intervalo, alarm_enabled, icon_offset_x, icon_offset_y } = req.body;
    let icone = null;
    if (req.file) {
         icone = req.file.filename;
    }
    let query = "UPDATE dispositivos SET nome = ?, ip = ?, intervalo = ?, alarm_enabled = ?, icon_offset_x = ?, icon_offset_y = ?";
    let params = [nome, ip, intervalo, alarm_enabled, icon_offset_x, icon_offset_y];
    if (icone) {
         query += ", icone = ?";
         params.push(icone);
    }
    query += " WHERE id = ? AND usuario_id = ?";
    params.push(deviceId, usuario_id);
    db.run(query, params, function(err) {
         if(err) {
              console.error(err);
              return res.status(500).json({ error: "Erro ao editar dispositivo" });
         }
         if (this.changes === 0) {
              return res.status(404).json({ error: "Dispositivo não encontrado ou sem permissão" });
         }
         res.json({ success: true, message: "Dispositivo atualizado com sucesso!" });
    });
});

// Rota de logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
