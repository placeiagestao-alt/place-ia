const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');

const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads', req.user.id);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    };
    
    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Validações
const dashboardQueryValidation = [
  query('period')
    .optional()
    .isIn(['today', 'week', 'month', 'quarter', 'year', 'custom'])
    .withMessage('Período inválido'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data de início inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data de fim inválida'),
  query('marketplace')
    .optional()
    .isString()
    .withMessage('Marketplace inválido')
];

// Função para calcular período de datas
const calculateDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start, end;
  
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), quarter * 3 + 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'custom':
      if (!startDate || !endDate) {
        throw new Error('Datas de início e fim são obrigatórias para período customizado');
      }
      start = new Date(startDate);
      end = new Date(endDate);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  
  return { start, end };
};

// ROTA: Dashboard principal
router.get('/overview', dashboardQueryValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
    }
    
    const { period = 'month', startDate, endDate, marketplace } = req.query;
    const userId = req.user.id;
    
    // Calcular período
    const { start, end } = calculateDateRange(period, startDate, endDate);
    
    // Filtros base
    const baseFilter = {
      owner: userId,
      createdAt: { $gte: start, $lt: end }
    };
    
    if (marketplace) {
      baseFilter.marketplace = marketplace;
    }
    
    // Buscar dados em paralelo
    const [salesData, productsData, topProducts, lowStockProducts] = await Promise.all([
      // Dados de vendas
      Sale.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalProfit: { $sum: '$profit' },
            averageTicket: { $avg: '$totalAmount' }
          }
        }
      ]),
      
      // Dados de produtos
      Product.aggregate([
        { $match: { owner: userId } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: {
                $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
              }
            },
            totalStock: { $sum: '$stock.quantity' },
            lowStockCount: {
              $sum: {
                $cond: [
                  { $lte: ['$stock.quantity', '$stock.minQuantity'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      
      // Produtos mais vendidos
      Sale.aggregate([
        { $match: baseFilter },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            productId: '$_id',
            name: '$product.name',
            sku: '$product.sku',
            totalSold: 1,
            totalRevenue: 1,
            image: { $arrayElemAt: ['$product.images', 0] }
          }
        }
      ]),
      
      // Produtos com estoque baixo
      Product.find({
        owner: userId,
        $expr: { $lte: ['$stock.quantity', '$stock.minQuantity'] }
      })
      .select('name sku stock images')
      .limit(10)
    ]);
    
    // Vendas por período (últimos 30 dias)
    const salesByDay = await Sale.aggregate([
      {
        $match: {
          owner: userId,
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lt: new Date()
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
    
    // Vendas por marketplace
    const salesByMarketplace = await Sale.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$marketplace',
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);
    
    // Formatação dos dados
    const sales = salesData[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      averageTicket: 0
    };
    
    const products = productsData[0] || {
      totalProducts: 0,
      activeProducts: 0,
      totalStock: 0,
      lowStockCount: 0
    };
    
    res.json({
      success: true,
      data: {
        period: {
          type: period,
          start,
          end
        },
        summary: {
          sales: {
            total: sales.totalSales,
            revenue: sales.totalRevenue,
            profit: sales.totalProfit,
            averageTicket: sales.averageTicket
          },
          products: {
            total: products.totalProducts,
            active: products.activeProducts,
            totalStock: products.totalStock,
            lowStock: products.lowStockCount
          }
        },
        charts: {
          salesByDay,
          salesByMarketplace
        },
        topProducts,
        lowStockProducts
      }
    });
    
  } catch (error) {
    logger.error('Erro no dashboard overview:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Relatório de vendas detalhado
router.get('/sales', dashboardQueryValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
    }
    
    const {
      period = 'month',
      startDate,
      endDate,
      marketplace,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const userId = req.user.id;
    const { start, end } = calculateDateRange(period, startDate, endDate);
    
    // Filtros
    const filter = {
      owner: userId,
      createdAt: { $gte: start, $lt: end }
    };
    
    if (marketplace) filter.marketplace = marketplace;
    if (status) filter.status = status;
    
    // Opções de paginação e ordenação
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        {
          path: 'items.productId',
          select: 'name sku images'
        }
      ]
    };
    
    // Buscar vendas
    const sales = await Sale.paginate(filter, options);
    
    // Estatísticas do período
    const stats = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          averageTicket: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        sales: sales.docs,
        pagination: {
          currentPage: sales.page,
          totalPages: sales.totalPages,
          totalDocs: sales.totalDocs,
          limit: sales.limit,
          hasNextPage: sales.hasNextPage,
          hasPrevPage: sales.hasPrevPage
        },
        stats: stats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          averageTicket: 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no relatório de vendas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Relatório de produtos
router.get('/products', async (req, res) => {
  try {
    const {
      category,
      status,
      lowStock,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      search
    } = req.query;
    
    const userId = req.user.id;
    
    // Filtros
    const filter = { owner: userId };
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$stock.quantity', '$stock.minQuantity'] };
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Opções de paginação e ordenação
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };
    
    // Buscar produtos
    const products = await Product.paginate(filter, options);
    
    // Estatísticas
    const stats = await Product.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalStock: { $sum: '$stock.quantity' },
          lowStockCount: {
            $sum: {
              $cond: [
                { $lte: ['$stock.quantity', '$stock.minQuantity'] },
                1,
                0
              ]
            }
          },
          totalValue: {
            $sum: {
              $multiply: ['$stock.quantity', '$pricing.salePrice']
            }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        products: products.docs,
        pagination: {
          currentPage: products.page,
          totalPages: products.totalPages,
          totalDocs: products.totalDocs,
          limit: products.limit,
          hasNextPage: products.hasNextPage,
          hasPrevPage: products.hasPrevPage
        },
        stats: stats[0] || {
          totalProducts: 0,
          activeProducts: 0,
          totalStock: 0,
          lowStockCount: 0,
          totalValue: 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no relatório de produtos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Upload de nota fiscal
router.post('/upload-invoice', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo é obrigatório'
      });
    }
    
    const userId = req.user.id;
    const file = req.file;
    let extractedData = {};
    
    try {
      // Processar arquivo baseado no tipo
      if (file.mimetype.startsWith('image/')) {
        // Processar imagem (OCR seria implementado aqui)
        // Por enquanto, apenas salvar o arquivo
        extractedData = {
          type: 'image',
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          path: file.path
        };
        
      } else if (file.mimetype === 'application/pdf') {
        // Processar PDF
        const pdfBuffer = await fs.readFile(file.path);
        const pdfData = await pdfParse(pdfBuffer);
        
        extractedData = {
          type: 'pdf',
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          path: file.path,
          text: pdfData.text,
          pages: pdfData.numpages
        };
        
      } else if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        // Processar Excel/CSV
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        extractedData = {
          type: 'spreadsheet',
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          path: file.path,
          data: jsonData,
          rows: jsonData.length
        };
      }
      
      // Salvar informações no banco (você pode criar um modelo Invoice)
      // Por enquanto, apenas retornar os dados extraídos
      
      logger.info('Nota fiscal processada', {
        userId,
        filename: file.originalname,
        type: extractedData.type
      });
      
      res.json({
        success: true,
        message: 'Nota fiscal processada com sucesso',
        data: extractedData
      });
      
    } catch (processingError) {
      logger.error('Erro ao processar arquivo:', processingError);
      
      // Remover arquivo em caso de erro
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.error('Erro ao remover arquivo:', unlinkError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro ao processar arquivo'
      });
    }
    
  } catch (error) {
    logger.error('Erro no upload de nota fiscal:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Configurações do usuário
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken')
      .populate('subscription.plan');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          cpf: user.cpf,
          cnpj: user.cnpj,
          company: user.company,
          address: user.address,
          userType: user.userType,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          subscription: user.subscription,
          notifications: user.notifications,
          marketplace: user.marketplace,
          adAccounts: user.adAccounts,
          aiSettings: user.aiSettings,
          preferences: user.preferences,
          createdAt: user.createdAt
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar configurações do usuário
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const allowedUpdates = [
      'name', 'phone', 'address', 'company',
      'notifications', 'marketplace', 'adAccounts',
      'aiSettings', 'preferences'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    logger.info('Configurações atualizadas', {
      userId,
      updates: Object.keys(updates)
    });
    
    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: { user }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Notificações do usuário
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    // Aqui você implementaria um sistema de notificações
    // Por enquanto, retornar dados mockados
    const notifications = {
      docs: [
        {
          id: '1',
          title: 'Nova venda realizada',
          message: 'Você vendeu 1x Produto XYZ no Mercado Livre',
          type: 'sale',
          read: false,
          createdAt: new Date()
        },
        {
          id: '2',
          title: 'Estoque baixo',
          message: 'O produto ABC está com estoque baixo (5 unidades)',
          type: 'stock',
          read: true,
          createdAt: new Date(Date.now() - 3600000)
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
        notifications: notifications.docs,
        pagination: {
          currentPage: notifications.page,
          totalPages: notifications.totalPages,
          totalDocs: notifications.totalDocs,
          hasNextPage: notifications.hasNextPage,
          hasPrevPage: notifications.hasPrevPage
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar notificações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;