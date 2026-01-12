const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configurações de segurança
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors());
app.use(express.json());


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Configuração do MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatglobal');

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  banExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const ipBanSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  reason: { type: String, required: true },
  bannedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const IpBan = mongoose.model('IpBan', ipBanSchema);
const Message = mongoose.model('Message', messageSchema);

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err, user) => {
    if (err) return res.sendStatus(403);
    
    const userData = await User.findById(user.id);
    if (!userData || userData.isBanned) {
      return res.sendStatus(403);
    }
    
    req.user = userData;
    next();
  });
};

// Middleware para verificar ban de IP
const checkIpBan = async (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const ipBan = await IpBan.findOne({ 
    ip: clientIp, 
    expiresAt: { $gt: new Date() } 
  });
  
  if (ipBan) {
    return res.status(403).json({ 
      error: 'IP banido', 
      reason: ipBan.reason,
      expiresAt: ipBan.expiresAt 
    });
  }
  
  next();
};

// Upload de imagens
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Rotas de autenticação
app.post('/api/register', checkIpBan, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isAdmin = username === process.env.ADMIN_USERNAME;
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      isAdmin
    });

    await user.save();
    
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'secret'
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/login', checkIpBan, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    if (user.isBanned) {
      const now = new Date();
      if (user.banExpires && now < user.banExpires) {
        return res.status(403).json({ 
          error: 'Conta banida', 
          reason: user.banReason,
          expiresAt: user.banExpires 
        });
      } else if (user.banExpires && now >= user.banExpires) {
        user.isBanned = false;
        user.banReason = '';
        user.banExpires = null;
        await user.save();
      }
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'secret'
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas do usuário
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    profilePicture: req.user.profilePicture,
    isAdmin: req.user.isAdmin
  });
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = req.user;

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Nome de usuário já existe' });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email já existe' });
      }
      user.email = email;
    }

    if (newPassword && currentPassword) {
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Senha atual incorreta' });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ message: 'Perfil atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const user = req.user;
    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ profilePicture: user.profilePicture });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas administrativas
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/admin/ban-user', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const { userId, reason, duration } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    user.isBanned = true;
    user.banReason = reason;
    user.banExpires = new Date(Date.now() + duration * 60 * 1000);
    await user.save();

    io.emit('userBanned', { userId, reason });
    res.json({ message: 'Usuário banido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/admin/ban-ip', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const { ip, reason, duration } = req.body;
    
    const ipBan = new IpBan({
      ip,
      reason,
      expiresAt: new Date(Date.now() + duration * 60 * 1000)
    });

    await ipBan.save();
    res.json({ message: 'IP banido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Socket.IO para chat em tempo real
const connectedUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.id);
      
      if (!user || user.isBanned) {
        socket.disconnect();
        return;
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.isAdmin = user.isAdmin;
      
      connectedUsers.set(socket.userId, {
        username: user.username,
        isAdmin: user.isAdmin,
        socketId: socket.id
      });

      io.emit('userOnline', Array.from(connectedUsers.values()));
      
      const recentMessages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .sort({ timestamp: 1 });
      
      socket.emit('recentMessages', recentMessages);
    } catch (error) {
      socket.disconnect();
    }
  });

  socket.on('sendMessage', async (messageData) => {
    if (!socket.userId) return;

    try {
      const message = new Message({
        username: socket.username,
        message: messageData.message,
        isAdmin: socket.isAdmin
      });

      await message.save();
      io.emit('newMessage', message);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      io.emit('userOnline', Array.from(connectedUsers.values()));
    }
  });
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});