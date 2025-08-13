const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuração de formatos
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadados se existirem
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Configuração de transports
const transports = [
  // Arquivo para todos os logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Arquivo apenas para erros
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Arquivo para logs de acesso/atividade
  new winston.transports.File({
    filename: path.join(logsDir, 'access.log'),
    level: 'info',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true
  })
];

// Adicionar console apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug'
    })
  );
}

// Criar logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'place-ia',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  
  // Configurações adicionais
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test'
});

// Logger específico para segurança
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: {
    service: 'place-ia-security',
    type: 'security'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exitOnError: false
});

// Logger específico para auditoria
const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: {
    service: 'place-ia-audit',
    type: 'audit'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 20,
      tailable: true
    })
  ],
  exitOnError: false
});

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: {
    service: 'place-ia-performance',
    type: 'performance'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      format: logFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  exitOnError: false
});

// Funções auxiliares para logs estruturados
const loggers = {
  // Log principal
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  error: (message, error = null, meta = {}) => {
    const logData = { ...meta };
    
    if (error) {
      if (error instanceof Error) {
        logData.error = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      } else {
        logData.error = error;
      }
    }
    
    logger.error(message, logData);
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
  
  // Logs de segurança
  security: {
    loginAttempt: (userId, ip, userAgent, success = true, reason = null) => {
      securityLogger.info('Login attempt', {
        userId,
        ip,
        userAgent,
        success,
        reason,
        timestamp: new Date().toISOString()
      });
    },
    
    passwordChange: (userId, ip, userAgent) => {
      securityLogger.info('Password changed', {
        userId,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
      });
    },
    
    suspiciousActivity: (userId, activity, ip, userAgent, details = {}) => {
      securityLogger.warn('Suspicious activity detected', {
        userId,
        activity,
        ip,
        userAgent,
        details,
        timestamp: new Date().toISOString()
      });
    },
    
    dataAccess: (userId, resource, action, ip, success = true) => {
      securityLogger.info('Data access', {
        userId,
        resource,
        action,
        ip,
        success,
        timestamp: new Date().toISOString()
      });
    },
    
    rateLimitExceeded: (userId, ip, endpoint, attempts) => {
      securityLogger.warn('Rate limit exceeded', {
        userId,
        ip,
        endpoint,
        attempts,
        timestamp: new Date().toISOString()
      });
    }
  },
  
  // Logs de auditoria
  audit: {
    userAction: (userId, action, resource, details = {}) => {
      auditLogger.info('User action', {
        userId,
        action,
        resource,
        details,
        timestamp: new Date().toISOString()
      });
    },
    
    adminAction: (adminId, action, target, details = {}) => {
      auditLogger.info('Admin action', {
        adminId,
        action,
        target,
        details,
        timestamp: new Date().toISOString()
      });
    },
    
    systemEvent: (event, details = {}) => {
      auditLogger.info('System event', {
        event,
        details,
        timestamp: new Date().toISOString()
      });
    },
    
    dataModification: (userId, table, recordId, changes, operation) => {
      auditLogger.info('Data modification', {
        userId,
        table,
        recordId,
        changes,
        operation,
        timestamp: new Date().toISOString()
      });
    }
  },
  
  // Logs de performance
  performance: {
    requestTime: (method, url, duration, statusCode, userId = null) => {
      performanceLogger.info('Request performance', {
        method,
        url,
        duration,
        statusCode,
        userId,
        timestamp: new Date().toISOString()
      });
    },
    
    databaseQuery: (query, duration, collection = null) => {
      performanceLogger.info('Database query performance', {
        query: query.substring(0, 200), // Limitar tamanho
        duration,
        collection,
        timestamp: new Date().toISOString()
      });
    },
    
    apiCall: (service, endpoint, duration, success = true, error = null) => {
      performanceLogger.info('External API call', {
        service,
        endpoint,
        duration,
        success,
        error,
        timestamp: new Date().toISOString()
      });
    },
    
    memoryUsage: () => {
      const usage = process.memoryUsage();
      performanceLogger.info('Memory usage', {
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Middleware para log de requisições HTTP
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Interceptar o final da resposta
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    // Log da requisição
    loggers.performance.requestTime(
      req.method,
      req.originalUrl,
      duration,
      res.statusCode,
      req.user ? req.user.id : null
    );
    
    // Log de acesso
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user ? req.user.id : null,
      timestamp: new Date().toISOString()
    });
    
    originalSend.call(this, data);
  };
  
  next();
};

// Função para limpar logs antigos
const cleanOldLogs = () => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
  const now = Date.now();
  
  fs.readdir(logsDir, (err, files) => {
    if (err) {
      logger.error('Erro ao ler diretório de logs:', err);
      return;
    }
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error('Erro ao deletar log antigo:', err);
            } else {
              logger.info('Log antigo deletado:', { file });
            }
          });
        }
      });
    });
  });
};

// Executar limpeza de logs diariamente
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

// Exportar logger principal e funções auxiliares
module.exports = {
  ...loggers,
  httpLogger,
  cleanOldLogs,
  
  // Loggers específicos para uso direto
  mainLogger: logger,
  securityLogger,
  auditLogger,
  performanceLogger
};