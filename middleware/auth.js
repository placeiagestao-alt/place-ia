const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'place_ia_secret_key');
    
    // Buscar usuário
    const user = await User.findById(decoded.id)
      .select('-password -refreshTokens')
      .lean();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se a conta está ativa
    if (user.status !== 'active') {
      let message = 'Conta inativa';
      
      switch (user.status) {
        case 'pending':
          message = 'Conta pendente de verificação';
          break;
        case 'suspended':
          message = 'Conta suspensa';
          break;
        case 'blocked':
          message = 'Conta bloqueada';
          break;
        case 'deleted':
          message = 'Conta deletada';
          break;
      }
      
      return res.status(403).json({
        success: false,
        message
      });
    }
    
    // Verificar se o token não foi emitido antes da última alteração de senha
    if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido. Faça login novamente.'
      });
    }
    
    // Adicionar usuário ao request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      role: user.role,
      subscription: user.subscription,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified
    };
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    logger.error('Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar refresh token
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }
    
    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'place_ia_refresh_secret_key');
    
    // Buscar usuário
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se o refresh token está na lista de tokens válidos
    const tokenExists = user.refreshTokens.some(token => 
      token.token === refreshToken && token.expiresAt > new Date()
    );
    
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido ou expirado'
      });
    }
    
    // Verificar se a conta está ativa
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Conta inativa'
      });
    }
    
    req.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      role: user.role
    };
    
    req.refreshToken = refreshToken;
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expirado'
      });
    }
    
    logger.error('Erro na autenticação do refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar role/permissão
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasPermission = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Permissão insuficiente'
      });
    }
    
    next();
  };
};

// Middleware para verificar tipo de usuário
const requireUserType = (types) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const allowedTypes = Array.isArray(types) ? types : [types];
    
    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Tipo de usuário não autorizado'
      });
    }
    
    next();
  };
};

// Middleware para verificar assinatura ativa
const requireActiveSubscription = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  
  const subscription = req.user.subscription;
  
  if (!subscription || subscription.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Assinatura ativa requerida',
      code: 'SUBSCRIPTION_REQUIRED'
    });
  }
  
  // Verificar se a assinatura não expirou
  if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
    return res.status(403).json({
      success: false,
      message: 'Assinatura expirada',
      code: 'SUBSCRIPTION_EXPIRED'
    });
  }
  
  next();
};

// Middleware para verificar verificação de e-mail
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Verificação de e-mail requerida',
      code: 'EMAIL_VERIFICATION_REQUIRED'
    });
  }
  
  next();
};

// Middleware para verificar verificação de telefone
const requirePhoneVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado'
    });
  }
  
  if (!req.user.phoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Verificação de telefone requerida',
      code: 'PHONE_VERIFICATION_REQUIRED'
    });
  }
  
  next();
};

// Middleware para verificar se o usuário é o proprietário do recurso
const requireOwnership = (resourceIdParam = 'id', userIdField = 'userId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Admins podem acessar qualquer recurso
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    try {
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'ID do recurso não fornecido'
        });
      }
      
      // Se o recurso está no body da requisição
      if (req.body && req.body[userIdField]) {
        if (req.body[userIdField] !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado: você não é o proprietário deste recurso'
          });
        }
        return next();
      }
      
      // Se precisar buscar o recurso no banco de dados
      // Isso seria implementado conforme o modelo específico
      // Por enquanto, assumimos que o middleware será usado após a busca
      
      next();
      
    } catch (error) {
      logger.error('Erro na verificação de propriedade:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  };
};

// Middleware para log de atividades
const logActivity = (action) => {
  return (req, res, next) => {
    // Interceptar a resposta para logar apenas em caso de sucesso
    const originalSend = res.send;
    
    res.send = function(data) {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (responseData.success && req.user) {
          logger.info('Atividade do usuário', {
            userId: req.user.id,
            action,
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
          });
        }
      } catch (error) {
        // Ignorar erros de parsing
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware para verificar rate limiting personalizado
const checkRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Limpar requests antigos
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    } else {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Muitas requisições. Tente novamente mais tarde.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Adicionar request atual
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

// Middleware para verificar manutenção
const checkMaintenance = (req, res, next) => {
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  
  if (maintenanceMode) {
    // Permitir acesso para admins durante manutenção
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
      return next();
    }
    
    return res.status(503).json({
      success: false,
      message: 'Sistema em manutenção. Tente novamente mais tarde.',
      code: 'MAINTENANCE_MODE'
    });
  }
  
  next();
};

module.exports = {
  authenticateToken,
  authenticateRefreshToken,
  requireRole,
  requireUserType,
  requireActiveSubscription,
  requireEmailVerification,
  requirePhoneVerification,
  requireOwnership,
  logActivity,
  checkRateLimit,
  checkMaintenance
};