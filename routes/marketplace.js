const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Middleware de autenticação
router.use(authenticateToken);

// Configuração do multer para upload de planilhas
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/marketplace');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use apenas .xlsx, .xls ou .csv'));
    }
  }
});

// Validações
const marketplaceConfigValidation = [
  body('marketplace')
    .isIn(['mercadolivre', 'amazon', 'shopee', 'magazineluiza', 'americanas'])
    .withMessage('Marketplace inválido'),
  body('credentials.apiKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('API Key deve ter pelo menos 10 caracteres'),
  body('credentials.secretKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Secret Key deve ter pelo menos 10 caracteres'),
  body('settings.autoSync')
    .optional()
    .isBoolean()
    .withMessage('Auto sync deve ser boolean'),
  body('settings.syncInterval')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Intervalo de sync deve ser entre 5 e 1440 minutos')
];

const productSyncValidation = [
  body('products')
    .isArray({ min: 1 })
    .withMessage('Lista de produtos é obrigatória'),
  body('products.*.productId')
    .isMongoId()
    .withMessage('ID do produto inválido'),
  body('marketplace')
    .isIn(['mercadolivre', 'amazon', 'shopee', 'magazineluiza', 'americanas'])
    .withMessage('Marketplace inválido')
];

// ROTA: Listar configurações de marketplace
router.get('/config', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('marketplaceSettings');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Mascarar credenciais sensíveis
    const maskedSettings = user.marketplaceSettings.map(setting => ({
      ...setting.toObject(),
      credentials: {
        ...setting.credentials,
        apiKey: setting.credentials.apiKey ? 
          setting.credentials.apiKey.substring(0, 4) + '****' : null,
        secretKey: setting.credentials.secretKey ? 
          setting.credentials.secretKey.substring(0, 4) + '****' : null
      }
    }));
    
    res.json({
      success: true,
      data: {
        marketplaces: maskedSettings
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar configurações de marketplace:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Configurar marketplace
router.post('/config', marketplaceConfigValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { marketplace, credentials, settings } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se já existe configuração para este marketplace
    const existingIndex = user.marketplaceSettings.findIndex(
      setting => setting.marketplace === marketplace
    );
    
    const marketplaceConfig = {
      marketplace,
      credentials: {
        apiKey: credentials.apiKey,
        secretKey: credentials.secretKey,
        userId: credentials.userId,
        storeId: credentials.storeId
      },
      settings: {
        autoSync: settings?.autoSync || false,
        syncInterval: settings?.syncInterval || 60,
        syncProducts: settings?.syncProducts || true,
        syncStock: settings?.syncStock || true,
        syncPrices: settings?.syncPrices || true,
        syncOrders: settings?.syncOrders || true
      },
      status: 'pending_verification',
      lastSync: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (existingIndex >= 0) {
      // Atualizar configuração existente
      user.marketplaceSettings[existingIndex] = {
        ...user.marketplaceSettings[existingIndex].toObject(),
        ...marketplaceConfig,
        createdAt: user.marketplaceSettings[existingIndex].createdAt
      };
    } else {
      // Adicionar nova configuração
      user.marketplaceSettings.push(marketplaceConfig);
    }
    
    await user.save();
    
    // Testar conexão com o marketplace (simulado)
    setTimeout(async () => {
      try {
        const updatedUser = await User.findById(req.user.id);
        const configIndex = updatedUser.marketplaceSettings.findIndex(
          setting => setting.marketplace === marketplace
        );
        
        if (configIndex >= 0) {
          updatedUser.marketplaceSettings[configIndex].status = 'connected';
          updatedUser.marketplaceSettings[configIndex].lastSync = new Date();
          await updatedUser.save();
        }
      } catch (error) {
        logger.error('Erro ao verificar conexão do marketplace:', error);
      }
    }, 2000);
    
    logger.info('Marketplace configurado', {
      userId: req.user.id,
      marketplace,
      action: existingIndex >= 0 ? 'updated' : 'created'
    });
    
    res.json({
      success: true,
      message: `${marketplace} configurado com sucesso`,
      data: {
        marketplace,
        status: 'pending_verification'
      }
    });
    
  } catch (error) {
    logger.error('Erro ao configurar marketplace:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Testar conexão com marketplace
router.post('/test-connection/:marketplace', async (req, res) => {
  try {
    const { marketplace } = req.params;
    
    const user = await User.findById(req.user.id);
    const config = user.marketplaceSettings.find(
      setting => setting.marketplace === marketplace
    );
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração do marketplace não encontrada'
      });
    }
    
    // Simular teste de conexão
    const testResult = {
      marketplace,
      status: 'success',
      message: 'Conexão estabelecida com sucesso',
      details: {
        apiVersion: '2.0',
        permissions: ['read_products', 'write_products', 'read_orders'],
        rateLimit: {
          remaining: 4950,
          total: 5000,
          resetTime: new Date(Date.now() + 3600000)
        }
      },
      testedAt: new Date()
    };
    
    // Atualizar status da configuração
    config.status = 'connected';
    config.lastSync = new Date();
    await user.save();
    
    logger.info('Teste de conexão realizado', {
      userId: req.user.id,
      marketplace,
      status: testResult.status
    });
    
    res.json({
      success: true,
      data: testResult
    });
    
  } catch (error) {
    logger.error('Erro ao testar conexão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Sincronizar produtos
router.post('/sync/products', productSyncValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { products, marketplace } = req.body;
    
    // Verificar se marketplace está configurado
    const user = await User.findById(req.user.id);
    const config = user.marketplaceSettings.find(
      setting => setting.marketplace === marketplace
    );
    
    if (!config || config.status !== 'connected') {
      return res.status(400).json({
        success: false,
        message: 'Marketplace não configurado ou não conectado'
      });
    }
    
    // Buscar produtos
    const productIds = products.map(p => p.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      owner: req.user.id
    });
    
    if (dbProducts.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Alguns produtos não foram encontrados'
      });
    }
    
    // Simular sincronização
    const syncResults = dbProducts.map(product => {
      const success = Math.random() > 0.1; // 90% de sucesso
      
      return {
        productId: product._id,
        sku: product.sku,
        title: product.title,
        status: success ? 'synced' : 'error',
        marketplaceId: success ? `${marketplace}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null,
        message: success ? 'Produto sincronizado com sucesso' : 'Erro na sincronização',
        syncedAt: success ? new Date() : null
      };
    });
    
    // Atualizar produtos com IDs do marketplace
    for (const result of syncResults) {
      if (result.status === 'synced') {
        await Product.findByIdAndUpdate(result.productId, {
          $set: {
            [`marketplaceSettings.${marketplace}.id`]: result.marketplaceId,
            [`marketplaceSettings.${marketplace}.status`]: 'active',
            [`marketplaceSettings.${marketplace}.lastSync`]: result.syncedAt
          }
        });
      }
    }
    
    // Atualizar última sincronização
    config.lastSync = new Date();
    await user.save();
    
    const successCount = syncResults.filter(r => r.status === 'synced').length;
    const errorCount = syncResults.filter(r => r.status === 'error').length;
    
    logger.info('Sincronização de produtos realizada', {
      userId: req.user.id,
      marketplace,
      total: syncResults.length,
      success: successCount,
      errors: errorCount
    });
    
    res.json({
      success: true,
      message: `Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`,
      data: {
        results: syncResults,
        summary: {
          total: syncResults.length,
          success: successCount,
          errors: errorCount
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro na sincronização de produtos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Sincronizar pedidos
router.post('/sync/orders/:marketplace', async (req, res) => {
  try {
    const { marketplace } = req.params;
    const { startDate, endDate } = req.body;
    
    // Verificar configuração
    const user = await User.findById(req.user.id);
    const config = user.marketplaceSettings.find(
      setting => setting.marketplace === marketplace
    );
    
    if (!config || config.status !== 'connected') {
      return res.status(400).json({
        success: false,
        message: 'Marketplace não configurado ou não conectado'
      });
    }
    
    // Simular busca de pedidos
    const mockOrders = [
      {
        marketplaceOrderId: `${marketplace}_order_${Date.now()}_1`,
        status: 'paid',
        customer: {
          name: 'João Silva',
          email: 'joao@email.com',
          phone: '(11) 99999-9999'
        },
        items: [
          {
            sku: 'PROD001',
            title: 'Produto Exemplo',
            quantity: 2,
            price: 99.90
          }
        ],
        totalAmount: 199.80,
        shippingAmount: 15.00,
        createdAt: new Date(),
        marketplace
      },
      {
        marketplaceOrderId: `${marketplace}_order_${Date.now()}_2`,
        status: 'shipped',
        customer: {
          name: 'Maria Santos',
          email: 'maria@email.com',
          phone: '(11) 88888-8888'
        },
        items: [
          {
            sku: 'PROD002',
            title: 'Outro Produto',
            quantity: 1,
            price: 149.90
          }
        ],
        totalAmount: 149.90,
        shippingAmount: 12.00,
        createdAt: new Date(Date.now() - 86400000),
        marketplace
      }
    ];
    
    // Salvar pedidos no banco
    const savedOrders = [];
    for (const orderData of mockOrders) {
      // Verificar se pedido já existe
      const existingOrder = await Sale.findOne({
        marketplaceOrderId: orderData.marketplaceOrderId,
        owner: req.user.id
      });
      
      if (!existingOrder) {
        const sale = new Sale({
          ...orderData,
          owner: req.user.id,
          source: 'marketplace_sync'
        });
        
        await sale.save();
        savedOrders.push(sale);
      }
    }
    
    // Atualizar última sincronização
    config.lastSync = new Date();
    await user.save();
    
    logger.info('Sincronização de pedidos realizada', {
      userId: req.user.id,
      marketplace,
      newOrders: savedOrders.length,
      totalFound: mockOrders.length
    });
    
    res.json({
      success: true,
      message: `${savedOrders.length} novos pedidos sincronizados`,
      data: {
        newOrders: savedOrders.length,
        totalFound: mockOrders.length,
        orders: savedOrders
      }
    });
    
  } catch (error) {
    logger.error('Erro na sincronização de pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Upload de planilha de produtos
router.post('/upload/products', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo é obrigatório'
      });
    }
    
    const { marketplace } = req.body;
    
    if (!marketplace) {
      return res.status(400).json({
        success: false,
        message: 'Marketplace é obrigatório'
      });
    }
    
    // Aqui você processaria a planilha
    // Por enquanto, simular o processamento
    const mockResults = {
      totalRows: 150,
      processed: 145,
      errors: 5,
      products: [
        {
          row: 1,
          sku: 'PROD001',
          title: 'Produto 1',
          status: 'success',
          message: 'Produto criado com sucesso'
        },
        {
          row: 2,
          sku: 'PROD002',
          title: 'Produto 2',
          status: 'error',
          message: 'SKU já existe'
        }
      ]
    };
    
    // Remover arquivo após processamento
    setTimeout(async () => {
      try {
        await fs.unlink(req.file.path);
      } catch (error) {
        logger.error('Erro ao remover arquivo:', error);
      }
    }, 5000);
    
    logger.info('Upload de planilha processado', {
      userId: req.user.id,
      marketplace,
      filename: req.file.originalname,
      results: mockResults
    });
    
    res.json({
      success: true,
      message: 'Planilha processada com sucesso',
      data: mockResults
    });
    
  } catch (error) {
    logger.error('Erro no upload de planilha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Histórico de sincronizações
router.get('/sync/history', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      marketplace,
      type,
      status
    } = req.query;
    
    // Aqui você buscaria o histórico real do banco
    // Por enquanto, retornar dados mockados
    const mockHistory = {
      docs: [
        {
          id: '1',
          marketplace: 'mercadolivre',
          type: 'products',
          status: 'completed',
          itemsProcessed: 25,
          itemsSuccess: 23,
          itemsError: 2,
          startedAt: new Date(Date.now() - 3600000),
          completedAt: new Date(Date.now() - 3500000),
          duration: 300000, // 5 minutos
          details: {
            errors: [
              { sku: 'PROD001', message: 'Título muito longo' },
              { sku: 'PROD002', message: 'Categoria inválida' }
            ]
          }
        },
        {
          id: '2',
          marketplace: 'amazon',
          type: 'orders',
          status: 'completed',
          itemsProcessed: 12,
          itemsSuccess: 12,
          itemsError: 0,
          startedAt: new Date(Date.now() - 7200000),
          completedAt: new Date(Date.now() - 7100000),
          duration: 100000
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
        history: mockHistory.docs,
        pagination: {
          currentPage: mockHistory.page,
          totalPages: mockHistory.totalPages,
          totalDocs: mockHistory.totalDocs,
          hasNextPage: mockHistory.hasNextPage,
          hasPrevPage: mockHistory.hasPrevPage
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Remover configuração de marketplace
router.delete('/config/:marketplace', async (req, res) => {
  try {
    const { marketplace } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const configIndex = user.marketplaceSettings.findIndex(
      setting => setting.marketplace === marketplace
    );
    
    if (configIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }
    
    // Remover configuração
    user.marketplaceSettings.splice(configIndex, 1);
    await user.save();
    
    logger.info('Configuração de marketplace removida', {
      userId: req.user.id,
      marketplace
    });
    
    res.json({
      success: true,
      message: 'Configuração removida com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao remover configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Status geral dos marketplaces
router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('marketplaceSettings');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar estatísticas de produtos por marketplace
    const productStats = await Product.aggregate([
      { $match: { owner: user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          mercadolivre: {
            $sum: {
              $cond: [
                { $ne: ['$marketplaceSettings.mercadolivre.id', null] },
                1,
                0
              ]
            }
          },
          amazon: {
            $sum: {
              $cond: [
                { $ne: ['$marketplaceSettings.amazon.id', null] },
                1,
                0
              ]
            }
          },
          shopee: {
            $sum: {
              $cond: [
                { $ne: ['$marketplaceSettings.shopee.id', null] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Buscar estatísticas de vendas por marketplace
    const salesStats = await Sale.aggregate([
      { $match: { owner: user._id } },
      {
        $group: {
          _id: '$marketplace',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const status = {
      marketplaces: user.marketplaceSettings.map(setting => ({
        marketplace: setting.marketplace,
        status: setting.status,
        lastSync: setting.lastSync,
        autoSync: setting.settings.autoSync
      })),
      products: productStats[0] || {
        total: 0,
        mercadolivre: 0,
        amazon: 0,
        shopee: 0
      },
      sales: salesStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          revenue: stat.revenue
        };
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      data: { status }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar status dos marketplaces:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;