const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Identificadores
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Proprietário da venda
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Marketplace onde foi realizada a venda
  marketplace: {
    platform: {
      type: String,
      enum: ['mercadolivre', 'amazon', 'shopee', 'magazineluiza', 'americanas', 'casasbahia', 'extra', 'loja_propria'],
      required: true
    },
    orderId: String, // ID do pedido no marketplace
    orderUrl: String // URL do pedido no marketplace
  },
  
  // Dados do cliente
  customer: {
    name: String,
    email: String,
    phone: String,
    document: String, // CPF/CNPJ
    address: {
      street: String,
      number: String,
      complement: String,
      neighborhood: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'Brasil' }
    }
  },
  
  // Itens da venda
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    sku: String,
    name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    cost: Number, // Custo unitário do produto
    totalCost: Number, // Custo total do item
    variation: {
      name: String,
      value: String
    }
  }],
  
  // Valores da venda
  totals: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    profitMargin: {
      type: Number,
      default: 0
    }
  },
  
  // Status da venda
  status: {
    type: String,
    enum: [
      'pending',           // Pendente
      'confirmed',         // Confirmada
      'processing',        // Processando
      'shipped',          // Enviada
      'delivered',        // Entregue
      'canceled',         // Cancelada
      'refunded',         // Reembolsada
      'returned'          // Devolvida
    ],
    default: 'pending'
  },
  
  // Método de pagamento
  payment: {
    method: {
      type: String,
      enum: ['credit_card', 'debit_card', 'pix', 'boleto', 'bank_transfer', 'wallet', 'other'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'refunded'],
      default: 'pending'
    },
    installments: {
      type: Number,
      default: 1,
      min: 1
    },
    transactionId: String,
    gatewayFee: {
      type: Number,
      default: 0
    },
    netAmount: Number // Valor líquido após taxas
  },
  
  // Dados de entrega
  shipping: {
    method: String,
    carrier: String,
    trackingCode: String,
    estimatedDelivery: Date,
    actualDelivery: Date,
    cost: {
      type: Number,
      default: 0
    },
    address: {
      street: String,
      number: String,
      complement: String,
      neighborhood: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'Brasil' }
    }
  },
  
  // Datas importantes
  dates: {
    ordered: {
      type: Date,
      default: Date.now
    },
    confirmed: Date,
    shipped: Date,
    delivered: Date,
    canceled: Date
  },
  
  // Notas fiscais
  invoices: [{
    number: String,
    series: String,
    date: Date,
    value: Number,
    xml: String, // Caminho para o arquivo XML
    pdf: String, // Caminho para o arquivo PDF
    status: {
      type: String,
      enum: ['pending', 'issued', 'canceled'],
      default: 'pending'
    }
  }],
  
  // Campanhas publicitárias relacionadas
  campaigns: [{
    platform: String,
    campaignId: String,
    campaignName: String,
    adGroupId: String,
    keywordId: String,
    cost: Number,
    attribution: {
      type: String,
      enum: ['first_click', 'last_click', 'linear'],
      default: 'last_click'
    }
  }],
  
  // Origem da venda
  source: {
    type: {
      type: String,
      enum: ['organic', 'paid_ads', 'social_media', 'email', 'direct', 'referral'],
      default: 'organic'
    },
    campaign: String,
    medium: String,
    content: String,
    term: String
  },
  
  // Avaliação do cliente
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    date: Date,
    response: String, // Resposta do vendedor
    responseDate: Date
  },
  
  // Histórico de status
  statusHistory: [{
    status: String,
    date: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Comunicações com o cliente
  communications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'marketplace_message']
    },
    subject: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    }
  }],
  
  // Dados de análise
  analytics: {
    deviceType: String, // mobile, desktop, tablet
    browser: String,
    os: String,
    location: {
      country: String,
      state: String,
      city: String
    },
    sessionDuration: Number, // em segundos
    pageViews: Number,
    referrer: String
  },
  
  // Metadados
  metadata: {
    importedFrom: String,
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'synced'
    },
    lastSync: Date,
    notes: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
saleSchema.index({ userId: 1 });
saleSchema.index({ saleNumber: 1 });
saleSchema.index({ 'marketplace.platform': 1 });
saleSchema.index({ 'marketplace.orderId': 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ 'payment.status': 1 });
saleSchema.index({ 'dates.ordered': -1 });
saleSchema.index({ 'totals.total': -1 });
saleSchema.index({ 'customer.email': 1 });
saleSchema.index({ createdAt: -1 });

// Índice composto para relatórios
saleSchema.index({ userId: 1, 'dates.ordered': -1 });
saleSchema.index({ userId: 1, status: 1, 'dates.ordered': -1 });
saleSchema.index({ userId: 1, 'marketplace.platform': 1, 'dates.ordered': -1 });

// Virtual para ROI da campanha
saleSchema.virtual('campaignROI').get(function() {
  const totalCampaignCost = this.campaigns.reduce((sum, campaign) => sum + (campaign.cost || 0), 0);
  if (totalCampaignCost === 0) return 0;
  return ((this.totals.profit || 0) / totalCampaignCost) * 100;
});

// Virtual para verificar se está atrasada
saleSchema.virtual('isDelayed').get(function() {
  if (!this.shipping.estimatedDelivery) return false;
  return new Date() > this.shipping.estimatedDelivery && this.status !== 'delivered';
});

// Virtual para dias desde o pedido
saleSchema.virtual('daysSinceOrder').get(function() {
  const now = new Date();
  const orderDate = this.dates.ordered;
  return Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
});

// Middleware para gerar número da venda
saleSchema.pre('save', async function(next) {
  if (this.isNew && !this.saleNumber) {
    const count = await this.constructor.countDocuments({ userId: this.userId });
    const year = new Date().getFullYear();
    this.saleNumber = `${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Middleware para calcular totais
saleSchema.pre('save', function(next) {
  // Calcular subtotal
  this.totals.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calcular total
  this.totals.total = this.totals.subtotal + this.totals.shipping + this.totals.tax - this.totals.discount;
  
  // Calcular custo total
  this.totals.totalCost = this.items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  
  // Calcular lucro
  this.totals.profit = this.totals.total - this.totals.totalCost - (this.payment.gatewayFee || 0);
  
  // Calcular margem de lucro
  if (this.totals.total > 0) {
    this.totals.profitMargin = (this.totals.profit / this.totals.total) * 100;
  }
  
  // Calcular valor líquido
  this.payment.netAmount = this.totals.total - (this.payment.gatewayFee || 0);
  
  next();
});

// Middleware para adicionar ao histórico de status
saleSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      note: `Status alterado para ${this.status}`
    });
    
    // Atualizar datas específicas
    switch (this.status) {
      case 'confirmed':
        this.dates.confirmed = new Date();
        break;
      case 'shipped':
        this.dates.shipped = new Date();
        break;
      case 'delivered':
        this.dates.delivered = new Date();
        break;
      case 'canceled':
        this.dates.canceled = new Date();
        break;
    }
  }
  next();
});

// Método para adicionar comunicação
saleSchema.methods.addCommunication = function(type, subject, message) {
  this.communications.push({
    type,
    subject,
    message,
    sentAt: new Date()
  });
};

// Método para atualizar status
saleSchema.methods.updateStatus = function(newStatus, note, updatedBy) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    date: new Date(),
    note: note || `Status alterado para ${newStatus}`,
    updatedBy
  });
};

// Método estático para vendas por período
saleSchema.statics.findByPeriod = function(userId, startDate, endDate) {
  return this.find({
    userId: userId,
    'dates.ordered': {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ 'dates.ordered': -1 });
};

// Método estático para relatório de vendas
saleSchema.statics.getSalesReport = function(userId, filters = {}) {
  const pipeline = [
    { $match: { userId: mongoose.Types.ObjectId(userId), ...filters } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totals.total' },
        totalProfit: { $sum: '$totals.profit' },
        averageOrderValue: { $avg: '$totals.total' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Método estático para top produtos
saleSchema.statics.getTopProducts = function(userId, limit = 10) {
  const pipeline = [
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' },
        salesCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Sale', saleSchema);