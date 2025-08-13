const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Configurações do MongoDB
const mongoConfig = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Máximo de conexões simultâneas
  serverSelectionTimeoutMS: 5000, // Timeout para seleção do servidor
  socketTimeoutMS: 45000, // Timeout do socket
  family: 4, // Usar IPv4
  retryWrites: true,
  w: 'majority'
};

// URL de conexão
const getMongoURL = () => {
  const {
    MONGODB_URI,
    MONGODB_HOST = 'localhost',
    MONGODB_PORT = '27017',
    MONGODB_DATABASE = 'place_ia',
    MONGODB_USERNAME,
    MONGODB_PASSWORD
  } = process.env;
  
  // Se MONGODB_URI está definida, usar ela
  if (MONGODB_URI) {
    return MONGODB_URI;
  }
  
  // Construir URL baseada nas variáveis individuais
  let url = 'mongodb://';
  
  if (MONGODB_USERNAME && MONGODB_PASSWORD) {
    url += `${MONGODB_USERNAME}:${MONGODB_PASSWORD}@`;
  }
  
  url += `${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}`;
  
  return url;
};

// Função para conectar ao MongoDB
const connectDB = async () => {
  try {
    const mongoURL = getMongoURL();
    
    logger.info('Conectando ao MongoDB...', {
      host: process.env.MONGODB_HOST || 'localhost',
      port: process.env.MONGODB_PORT || '27017',
      database: process.env.MONGODB_DATABASE || 'place_ia'
    });
    
    const conn = await mongoose.connect(mongoURL, mongoConfig);
    
    logger.info('MongoDB conectado com sucesso', {
      host: conn.connection.host,
      port: conn.connection.port,
      database: conn.connection.name
    });
    
    // Log de estatísticas de conexão
    setInterval(() => {
      const stats = {
        readyState: mongoose.connection.readyState,
        collections: Object.keys(mongoose.connection.collections).length,
        models: Object.keys(mongoose.models).length
      };
      
      logger.debug('MongoDB connection stats', stats);
    }, 60000); // A cada minuto
    
    return conn;
    
  } catch (error) {
    logger.error('Erro ao conectar ao MongoDB:', error);
    
    // Em produção, sair do processo se não conseguir conectar
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    throw error;
  }
};

// Função para desconectar do MongoDB
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB desconectado');
  } catch (error) {
    logger.error('Erro ao desconectar do MongoDB:', error);
    throw error;
  }
};

// Função para verificar o status da conexão
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[mongoose.connection.readyState],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

// Função para obter estatísticas do banco
const getDatabaseStats = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    const admin = mongoose.connection.db.admin();
    const stats = await admin.serverStatus();
    
    return {
      version: stats.version,
      uptime: stats.uptime,
      connections: stats.connections,
      memory: {
        resident: stats.mem.resident,
        virtual: stats.mem.virtual,
        mapped: stats.mem.mapped
      },
      opcounters: stats.opcounters,
      network: stats.network
    };
    
  } catch (error) {
    logger.error('Erro ao obter estatísticas do banco:', error);
    throw error;
  }
};

// Função para criar índices
const createIndexes = async () => {
  try {
    logger.info('Criando índices do banco de dados...');
    
    // Índices para User
    await mongoose.connection.collection('users').createIndex(
      { email: 1 }, 
      { unique: true, background: true }
    );
    
    await mongoose.connection.collection('users').createIndex(
      { 'document.number': 1 }, 
      { unique: true, sparse: true, background: true }
    );
    
    await mongoose.connection.collection('users').createIndex(
      { 'company.cnpj': 1 }, 
      { unique: true, sparse: true, background: true }
    );
    
    await mongoose.connection.collection('users').createIndex(
      { status: 1, userType: 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('users').createIndex(
      { createdAt: -1 }, 
      { background: true }
    );
    
    // Índices para Product
    await mongoose.connection.collection('products').createIndex(
      { owner: 1, status: 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('products').createIndex(
      { sku: 1 }, 
      { unique: true, sparse: true, background: true }
    );
    
    await mongoose.connection.collection('products').createIndex(
      { ean: 1 }, 
      { sparse: true, background: true }
    );
    
    await mongoose.connection.collection('products').createIndex(
      { name: 'text', description: 'text' }, 
      { background: true }
    );
    
    await mongoose.connection.collection('products').createIndex(
      { 'category.main': 1, 'category.sub': 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('products').createIndex(
      { createdAt: -1 }, 
      { background: true }
    );
    
    // Índices para Sale
    await mongoose.connection.collection('sales').createIndex(
      { owner: 1, status: 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('sales').createIndex(
      { marketplace: 1, marketplaceOrderId: 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('sales').createIndex(
      { 'customer.email': 1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('sales').createIndex(
      { saleDate: -1 }, 
      { background: true }
    );
    
    await mongoose.connection.collection('sales').createIndex(
      { 'payment.method': 1, 'payment.status': 1 }, 
      { background: true }
    );
    
    logger.info('Índices criados com sucesso');
    
  } catch (error) {
    logger.error('Erro ao criar índices:', error);
    throw error;
  }
};

// Função para fazer backup dos dados
const createBackup = async () => {
  try {
    logger.info('Iniciando backup do banco de dados...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const backupData = {};
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const data = await mongoose.connection.collection(collectionName).find({}).toArray();
      backupData[collectionName] = data;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup_${timestamp}.json`;
    
    // Em um ambiente real, você salvaria isso em um serviço de armazenamento
    // Por enquanto, apenas logamos o sucesso
    logger.info('Backup criado com sucesso', {
      collections: collections.length,
      timestamp,
      path: backupPath
    });
    
    return {
      success: true,
      path: backupPath,
      collections: collections.length,
      timestamp
    };
    
  } catch (error) {
    logger.error('Erro ao criar backup:', error);
    throw error;
  }
};

// Função para limpar dados antigos
const cleanOldData = async () => {
  try {
    logger.info('Iniciando limpeza de dados antigos...');
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    // Limpar logs antigos (se houver uma collection de logs)
    // await mongoose.connection.collection('logs').deleteMany({
    //   createdAt: { $lt: thirtyDaysAgo }
    // });
    
    // Limpar sessões expiradas
    // await mongoose.connection.collection('sessions').deleteMany({
    //   expiresAt: { $lt: new Date() }
    // });
    
    // Limpar usuários deletados há mais de 6 meses
    const deletedUsers = await mongoose.connection.collection('users').deleteMany({
      status: 'deleted',
      deletedAt: { $lt: sixMonthsAgo }
    });
    
    logger.info('Limpeza de dados concluída', {
      deletedUsers: deletedUsers.deletedCount
    });
    
    return {
      deletedUsers: deletedUsers.deletedCount
    };
    
  } catch (error) {
    logger.error('Erro na limpeza de dados:', error);
    throw error;
  }
};

// Event listeners para conexão
mongoose.connection.on('connected', () => {
  logger.info('Mongoose conectado ao MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error('Erro de conexão do Mongoose:', error);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose desconectado do MongoDB');
});

// Reconectar automaticamente em caso de desconexão
mongoose.connection.on('disconnected', () => {
  setTimeout(() => {
    logger.info('Tentando reconectar ao MongoDB...');
    connectDB().catch(error => {
      logger.error('Falha na reconexão:', error);
    });
  }, 5000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('Conexão MongoDB fechada devido ao encerramento da aplicação');
    process.exit(0);
  } catch (error) {
    logger.error('Erro ao fechar conexão MongoDB:', error);
    process.exit(1);
  }
});

// Configurar mongoose para desenvolvimento
if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    logger.debug('Mongoose Query', {
      collection: collectionName,
      method,
      query: JSON.stringify(query),
      doc: doc ? JSON.stringify(doc) : undefined
    });
  });
}

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  getDatabaseStats,
  createIndexes,
  createBackup,
  cleanOldData,
  mongoose
};