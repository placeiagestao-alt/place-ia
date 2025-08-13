const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Middleware de autenticação e autorização
router.use(authenticateToken);
router.use(requireAdmin);

// Validações
const userValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido'),
  body('userType')
    .optional()
    .isIn(['client', 'admin'])
    .withMessage('Tipo de usuário inválido'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'pending_verification'])
    .withMessage('Status inválido')
];

const createUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter pelo menos 8 caracteres'),
  body('userType')
    .isIn(['client', 'admin'])
    .withMessage('Tipo de usuário inválido')
];

const systemConfigValidation = [
  body('key')
    .notEmpty()
    .withMessage('Chave é obrigatória'),
  body('value')
    .notEmpty()
    .withMessage('Valor é obrigatório'),
  body('type')
    .optional()
    .isIn(['string', 'number', 'boolean', 'json'])
    .withMessage('Tipo inválido')
];

// ROTA: Dashboard administrativo
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calcular período
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    // Buscar estatísticas em paralelo
    const [userStats, salesStats, productStats, revenueStats] = await Promise.all([
      // Estatísticas de usuários
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            newUsers: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startDate] },
                  1,
                  0
                ]
              }
            },
            paidUsers: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.status', 'active'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      
      // Estatísticas de vendas
      Sale.aggregate([
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            periodSales: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$createdAt', startDate] },
                      { $lt: ['$createdAt', endDate] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            periodRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$createdAt', startDate] },
                      { $lt: ['$createdAt', endDate] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            }
          }
        }
      ]),
      
      // Estatísticas de produtos
      Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            newProducts: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startDate] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      
      // Receita por plano
      User.aggregate([
        {
          $match: {
            'subscription.status': 'active'
          }
        },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            revenue: { $sum: '$subscription.amount' }
          }
        }
      ])
    ]);
    
    // Usuários por período (últimos 30 dias)
    const usersByDay = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Vendas por período (últimos 30 dias)
    const salesByDay = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        period: {
          type: period,
          start: startDate,
          end: endDate
        },
        summary: {
          users: userStats[0] || {
            totalUsers: 0,
            activeUsers: 0,
            newUsers: 0,
            paidUsers: 0
          },
          sales: salesStats[0] || {
            totalSales: 0,
            totalRevenue: 0,
            periodSales: 0,
            periodRevenue: 0
          },
          products: productStats[0] || {
            totalProducts: 0,
            activeProducts: 0,
            newProducts: 0
          }
        },
        charts: {
          usersByDay,
          salesByDay,
          revenueByPlan: revenueStats
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no dashboard admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Listar usuários
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      userType,
      plan,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Construir filtros
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { cpf: { $regex: search, $options: 'i' } },
        { cnpj: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    if (userType) filter.userType = userType;
    if (plan) filter['subscription.plan'] = plan;
    
    // Opções de paginação
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      select: '-password -passwordResetToken -passwordResetExpires -emailVerificationToken'
    };
    
    const users = await User.paginate(filter, options);
    
    res.json({
      success: true,
      data: {
        users: users.docs,
        pagination: {
          currentPage: users.page,
          totalPages: users.totalPages,
          totalDocs: users.totalDocs,
          limit: users.limit,
          hasNextPage: users.hasNextPage,
          hasPrevPage: users.hasPrevPage
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Buscar usuário específico
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken')
      .populate('subscription.plan');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar estatísticas do usuário
    const [salesStats, productStats] = await Promise.all([
      Sale.aggregate([
        { $match: { owner: user._id } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageTicket: { $avg: '$totalAmount' }
          }
        }
      ]),
      Product.aggregate([
        { $match: { owner: user._id } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            }
          }
        }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        user,
        stats: {
          sales: salesStats[0] || { totalSales: 0, totalRevenue: 0, averageTicket: 0 },
          products: productStats[0] || { totalProducts: 0, activeProducts: 0 }
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Criar usuário
router.post('/users', createUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { name, email, password, userType, cpf, cnpj, phone, company } = req.body;
    
    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'E-mail já cadastrado'
      });
    }
    
    // Criar usuário
    const userData = {
      name,
      email,
      password,
      userType,
      status: 'active',
      emailVerified: true, // Admin pode criar usuários já verificados
      ...(cpf && { cpf }),
      ...(cnpj && { cnpj }),
      ...(phone && { phone }),
      ...(company && { company })
    };
    
    const user = new User(userData);
    await user.save();
    
    // Enviar email de boas-vindas
    try {
      await sendEmail({
        to: user.email,
        subject: 'Bem-vindo ao Place IA',
        template: 'welcome-admin-created',
        data: {
          name: user.name,
          email: user.email,
          temporaryPassword: password,
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao enviar email de boas-vindas:', emailError);
    }
    
    logger.info('Usuário criado pelo admin', {
      adminId: req.user.id,
      newUserId: user._id,
      email: user.email,
      userType: user.userType
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          status: user.status
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar usuário
router.put('/users/:id', userValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const allowedUpdates = [
      'name', 'email', 'userType', 'status', 'phone',
      'cpf', 'cnpj', 'company', 'address', 'subscription'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    // Se está alterando email, verificar se não existe
    if (updates.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: id }
      });
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'E-mail já está em uso'
        });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    logger.info('Usuário atualizado pelo admin', {
      adminId: req.user.id,
      userId: user._id,
      updates: Object.keys(updates)
    });
    
    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: { user }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Deletar usuário
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Não permitir deletar o próprio usuário
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar seu próprio usuário'
      });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se usuário tem dados importantes
    const [salesCount, productsCount] = await Promise.all([
      Sale.countDocuments({ owner: id }),
      Product.countDocuments({ owner: id })
    ]);
    
    if (salesCount > 0 || productsCount > 0) {
      // Ao invés de deletar, desativar o usuário
      await User.findByIdAndUpdate(id, {
        status: 'inactive',
        deletedAt: new Date(),
        deletedBy: req.user.id
      });
      
      logger.info('Usuário desativado pelo admin', {
        adminId: req.user.id,
        userId: id,
        reason: 'has_data'
      });
      
      res.json({
        success: true,
        message: 'Usuário desativado com sucesso (possui dados no sistema)'
      });
    } else {
      // Deletar completamente
      await User.findByIdAndDelete(id);
      
      logger.info('Usuário deletado pelo admin', {
        adminId: req.user.id,
        userId: id
      });
      
      res.json({
        success: true,
        message: 'Usuário deletado com sucesso'
      });
    }
    
  } catch (error) {
    logger.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Resetar senha de usuário
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha deve ter pelo menos 8 caracteres'
      });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar senha
    user.password = newPassword;
    await user.save();
    
    // Enviar email informando sobre a alteração
    try {
      await sendEmail({
        to: user.email,
        subject: 'Senha alterada - Place IA',
        template: 'password-changed-admin',
        data: {
          name: user.name,
          newPassword: newPassword,
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao enviar email de senha alterada:', emailError);
    }
    
    logger.info('Senha resetada pelo admin', {
      adminId: req.user.id,
      userId: id
    });
    
    res.json({
      success: true,
      message: 'Senha resetada com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao resetar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Logs do sistema
router.get('/logs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      level,
      startDate,
      endDate,
      search
    } = req.query;
    
    // Aqui você implementaria a busca nos logs
    // Por enquanto, retornar dados mockados
    const logs = {
      docs: [
        {
          id: '1',
          level: 'info',
          message: 'Usuário logado',
          timestamp: new Date(),
          userId: '507f1f77bcf86cd799439011',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...'
        },
        {
          id: '2',
          level: 'error',
          message: 'Erro na API de pagamento',
          timestamp: new Date(Date.now() - 3600000),
          error: 'Connection timeout',
          stack: 'Error: Connection timeout\n    at...'
        }
      ],
      totalDocs: 2,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    };
    
    res.json({
      success: true,
      data: {
        logs: logs.docs,
        pagination: {
          currentPage: logs.page,
          totalPages: logs.totalPages,
          totalDocs: logs.totalDocs,
          hasNextPage: logs.hasNextPage,
          hasPrevPage: logs.hasPrevPage
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Configurações do sistema
router.get('/settings', async (req, res) => {
  try {
    // Aqui você implementaria um modelo de configurações
    // Por enquanto, retornar configurações mockadas
    const settings = {
      general: {
        siteName: 'Place IA',
        siteUrl: process.env.FRONTEND_URL,
        supportEmail: 'placeiagestao@gmail.com',
        maxFileSize: '10MB',
        allowedFileTypes: ['jpg', 'png', 'pdf', 'xlsx']
      },
      payments: {
        stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
        paypalEnabled: !!process.env.PAYPAL_CLIENT_ID,
        pagseguroEnabled: !!process.env.PAGSEGURO_TOKEN
      },
      ai: {
        openaiEnabled: !!process.env.OPENAI_API_KEY,
        anthropicEnabled: !!process.env.ANTHROPIC_API_KEY,
        googleaiEnabled: !!process.env.GOOGLE_AI_API_KEY
      },
      email: {
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        fromEmail: process.env.EMAIL_FROM,
        enabled: !!process.env.EMAIL_HOST
      },
      security: {
        jwtExpiration: process.env.JWT_EXPIRES_IN || '24h',
        maxLoginAttempts: 5,
        lockoutDuration: '15m'
      }
    };
    
    res.json({
      success: true,
      data: { settings }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar configurações
router.put('/settings', systemConfigValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { key, value, type = 'string' } = req.body;
    
    // Aqui você salvaria a configuração no banco
    // Por enquanto, apenas simular
    
    logger.info('Configuração atualizada', {
      adminId: req.user.id,
      key,
      type
    });
    
    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: {
        key,
        value,
        type,
        updatedAt: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Backup do sistema
router.post('/backup', async (req, res) => {
  try {
    const { includeFiles = false } = req.body;
    
    // Aqui você implementaria o backup real
    // Por enquanto, simular
    const backupId = `backup_${Date.now()}`;
    
    logger.info('Backup iniciado', {
      adminId: req.user.id,
      backupId,
      includeFiles
    });
    
    // Simular processo de backup
    setTimeout(() => {
      logger.info('Backup concluído', {
        adminId: req.user.id,
        backupId
      });
    }, 5000);
    
    res.json({
      success: true,
      message: 'Backup iniciado com sucesso',
      data: {
        backupId,
        status: 'processing',
        estimatedTime: '5 minutos'
      }
    });
    
  } catch (error) {
    logger.error('Erro ao iniciar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Status do sistema
router.get('/system/status', async (req, res) => {
  try {
    const status = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform
      },
      database: {
        status: 'connected', // Verificar conexão real
        collections: {
          users: await User.countDocuments(),
          products: await Product.countDocuments(),
          sales: await Sale.countDocuments()
        }
      },
      services: {
        email: !!process.env.EMAIL_HOST,
        stripe: !!process.env.STRIPE_SECRET_KEY,
        paypal: !!process.env.PAYPAL_CLIENT_ID,
        openai: !!process.env.OPENAI_API_KEY
      },
      lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000), // Mock
      alerts: [
        // Alertas do sistema seriam listados aqui
      ]
    };
    
    res.json({
      success: true,
      data: { status }
    });
    
  } catch (error) {
    logger.error('Erro ao verificar status do sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;