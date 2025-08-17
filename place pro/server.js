const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar configurações e utilitários
const { connectDB, disconnectDB } = require('./config/database');
const logger = require('./utils/logger');
const { httpLogger } = require('./utils/logger');

// Importar middlewares
const { checkMaintenance } = require('./middleware/auth');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payments');
const marketplaceRoutes = require('./routes/marketplace');
const adminRoutes = require('./routes/admin');
const supportRoutes = require('./routes/support');
const webhookRoutes = require('./routes/webhooks');
const uploadRoutes = require('./routes/upload');

// Criar aplicação Express
const app = express();

// Configurações básicas
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy (importante para rate limiting e logs)
app.set('trust proxy', 1);

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'https://place.ia',
      'https://www.place.ia',
      'https://app.place.ia'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compressão
app.use(compression());

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requisições por IP
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limiting para webhooks
    return req.path.startsWith('/api/webhooks');
  }
});
app.use(globalLimiter);

// Middleware de logs HTTP
app.use(httpLogger);

// Middleware de manutenção
app.use(checkMaintenance);

// Parsing de JSON (com limite de tamanho)
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '5mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitização de dados
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Criar diretórios necessários
const createDirectories = () => {
  const dirs = [
    'uploads',
    'uploads/profiles',
    'uploads/documents',
    'uploads/products',
    'uploads/invoices',
    'logs',
    'backups'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Diretório criado: ${dirPath}`);
    }
  });
};

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Place.IA API - Sistema de Gestão e Impulsão',
    version: process.env.APP_VERSION || '1.0.0',
    environment: NODE_ENV,
    documentation: '/api/docs',
    health: '/health'
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/upload', uploadRoutes);

// Documentação da API (mockada)
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Place.IA API Documentation',
    version: '1.0.0',
    description: 'API completa para o sistema Place.IA',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Registrar novo usuário',
        'POST /api/auth/login': 'Login de usuário',
        'POST /api/auth/refresh': 'Renovar token',
        'POST /api/auth/logout': 'Logout',
        'POST /api/auth/forgot-password': 'Recuperar senha',
        'POST /api/auth/reset-password': 'Redefinir senha'
      },
      users: {
        'GET /api/users/profile': 'Obter perfil do usuário',
        'PUT /api/users/profile': 'Atualizar perfil',
        'PUT /api/users/password': 'Alterar senha',
        'DELETE /api/users/account': 'Deletar conta'
      },
      dashboard: {
        'GET /api/dashboard/overview': 'Visão geral do dashboard',
        'GET /api/dashboard/sales': 'Relatório de vendas',
        'GET /api/dashboard/products': 'Relatório de produtos',
        'POST /api/dashboard/upload-invoice': 'Upload de nota fiscal'
      },
      ai: {
        'POST /api/ai/chat': 'Chat com TaTa IA',
        'POST /api/ai/analyze': 'Análise inteligente',
        'GET /api/ai/suggestions': 'Sugestões automáticas',
        'GET /api/ai/history': 'Histórico de conversas'
      },
      payments: {
        'GET /api/payments/plans': 'Listar planos',
        'POST /api/payments/subscribe': 'Criar assinatura',
        'GET /api/payments/subscription': 'Status da assinatura',
        'GET /api/payments/history': 'Histórico de pagamentos'
      },
      marketplace: {
        'GET /api/marketplace/configs': 'Configurações de marketplace',
        'POST /api/marketplace/connect': 'Conectar marketplace',
        'POST /api/marketplace/sync': 'Sincronizar dados',
        'GET /api/marketplace/status': 'Status das integrações'
      },
      support: {
        'POST /api/support/chat': 'Chat com suporte',
        'POST /api/support/ticket': 'Criar ticket',
        'GET /api/support/tickets': 'Listar tickets',
        'GET /api/support/faq': 'FAQ'
      }
    }
  });
});

// Middleware de erro 404
app.use('*', (req, res) => {
  logger.warn(`Rota não encontrada: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: 'Rota não encontrada',
    message: `A rota ${req.method} ${req.originalUrl} não existe`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  logger.error('Erro na aplicação:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Erro de validação do Mongoose
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      error: 'Erro de validação',
      message: errors.join(', '),
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Erro de cast do Mongoose (ID inválido)
  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'ID inválido',
      message: 'O ID fornecido não é válido',
      code: 'INVALID_ID'
    });
  }
  
  // Erro de duplicação (chave única)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      error: 'Dados duplicados',
      message: `${field} já está em uso`,
      code: 'DUPLICATE_ERROR'
    });
  }
  
  // Erro de JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'Token de autenticação inválido',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: 'Token de autenticação expirado',
      code: 'EXPIRED_TOKEN'
    });
  }
  
  // Erro de CORS
  if (error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origem não permitida',
      code: 'CORS_ERROR'
    });
  }
  
  // Erro genérico
  const statusCode = error.statusCode || 500;
  const message = NODE_ENV === 'production' 
    ? 'Erro interno do servidor' 
    : error.message;
  
  res.status(statusCode).json({
    error: 'Erro interno',
    message,
    code: 'INTERNAL_ERROR',
    ...(NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Função para inicializar o servidor
const startServer = async () => {
  try {
    // Criar diretórios necessários
    createDirectories();
    
    // Conectar ao banco de dados
    await connectDB();
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor Place.IA iniciado!`, {
        port: PORT,
        environment: NODE_ENV,
        pid: process.pid,
        timestamp: new Date().toISOString()
      });
      
      console.log(`\n🎯 Place.IA - Sistema de Gestão e Impulsão`);
      console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
      console.log(`🌍 Ambiente: ${NODE_ENV}`);
      console.log(`📚 Documentação: http://localhost:${PORT}/api/docs`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`\n🎨 Tema: Neon Futurista (Laranja #FF6B00 | Verde #39FF14)`);
      console.log(`\n📞 Suporte: placeiagestao@gmail.com | (18) 99653-1491`);
      console.log(`🏢 CNPJ: 11.111.111/0001-00 - Place Gestão e Impulsão`);
      console.log(`📍 Av. José Peres Vargas 319 - Presidente Prudente - SP\n`);
    });
    
    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Recebido sinal ${signal}. Iniciando shutdown graceful...`);
      
      server.close(async () => {
        logger.info('Servidor HTTP fechado.');
        
        try {
          await disconnectDB();
          logger.info('Conexão com banco de dados fechada.');
          
          logger.info('Shutdown graceful concluído.');
          process.exit(0);
        } catch (error) {
          logger.error('Erro durante shutdown:', error);
          process.exit(1);
        }
      });
      
      // Forçar saída após 30 segundos
      setTimeout(() => {
        logger.error('Forçando saída após timeout.');
        process.exit(1);
      }, 30000);
    };
    
    // Listeners para sinais de sistema
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Tratamento de exceções não capturadas
    process.on('uncaughtException', (error) => {
      logger.error('Exceção não capturada:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promise rejeitada não tratada:', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Erro ao inicializar servidor:', error);
    process.exit(1);
  }
};

// Inicializar servidor apenas se este arquivo for executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = app;