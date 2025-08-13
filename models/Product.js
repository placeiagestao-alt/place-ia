const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Dados básicos do produto
  name: {
    type: String,
    required: [true, 'Nome do produto é obrigatório'],
    trim: true,
    maxlength: [200, 'Nome não pode ter mais de 200 caracteres']
  },
  description: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    maxlength: [5000, 'Descrição não pode ter mais de 5000 caracteres']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Descrição curta não pode ter mais de 500 caracteres']
  },
  
  // Identificadores
  sku: {
    type: String,
    required: [true, 'SKU é obrigatório'],
    unique: true,
    trim: true,
    uppercase: true
  },
  ean: {
    type: String,
    match: [/^\d{8,14}$/, 'EAN deve ter entre 8 e 14 dígitos']
  },
  ncm: {
    type: String,
    match: [/^\d{8}$/, 'NCM deve ter 8 dígitos']
  },
  
  // Proprietário
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Categoria e classificação
  category: {
    main: { type: String, required: true },
    subcategory: String,
    tags: [String]
  },
  
  // Preços e custos
  pricing: {
    cost: {
      type: Number,
      required: [true, 'Custo é obrigatório'],
      min: [0, 'Custo não pode ser negativo']
    },
    price: {
      type: Number,
      required: [true, 'Preço é obrigatório'],
      min: [0, 'Preço não pode ser negativo']
    },
    salePrice: {
      type: Number,
      min: [0, 'Preço promocional não pode ser negativo']
    },
    margin: {
      type: Number,
      min: [0, 'Margem não pode ser negativa'],
      max: [100, 'Margem não pode ser maior que 100%']
    },
    currency: {
      type: String,
      default: 'BRL'
    }
  },
  
  // Estoque
  inventory: {
    quantity: {
      type: Number,
      required: [true, 'Quantidade em estoque é obrigatória'],
      min: [0, 'Quantidade não pode ser negativa'],
      default: 0
    },
    minStock: {
      type: Number,
      default: 5,
      min: [0, 'Estoque mínimo não pode ser negativo']
    },
    maxStock: {
      type: Number,
      min: [0, 'Estoque máximo não pode ser negativo']
    },
    location: String,
    supplier: {
      name: String,
      contact: String,
      leadTime: Number // dias
    }
  },
  
  // Dimensões e peso
  dimensions: {
    length: Number, // cm
    width: Number,  // cm
    height: Number, // cm
    weight: Number  // kg
  },
  
  // Imagens
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'out_of_stock', 'discontinued'],
    default: 'draft'
  },
  
  // Configurações de marketplace
  marketplaces: [{
    platform: {
      type: String,
      enum: ['mercadolivre', 'amazon', 'shopee', 'magazineluiza', 'americanas', 'casasbahia', 'extra']
    },
    productId: String,
    url: String,
    isActive: { type: Boolean, default: true },
    lastSync: Date,
    syncStatus: {
      type: String,
      enum: ['success', 'error', 'pending'],
      default: 'pending'
    },
    customPrice: Number,
    customTitle: String,
    customDescription: String
  }],
  
  // Configurações de anúncios
  advertising: {
    isActive: { type: Boolean, default: false },
    budget: {
      daily: Number,
      monthly: Number
    },
    targetKeywords: [String],
    targetAudience: {
      ageRange: {
        min: Number,
        max: Number
      },
      gender: {
        type: String,
        enum: ['all', 'male', 'female']
      },
      interests: [String],
      locations: [String]
    },
    campaigns: [{
      platform: String,
      campaignId: String,
      status: String,
      budget: Number,
      performance: {
        impressions: Number,
        clicks: Number,
        conversions: Number,
        cost: Number,
        roas: Number
      }
    }]
  },
  
  // Métricas de performance
  metrics: {
    views: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    lastSaleDate: Date,
    bestSellingPeriod: {
      start: Date,
      end: Date,
      salesCount: Number
    }
  },
  
  // SEO
  seo: {
    title: String,
    metaDescription: String,
    keywords: [String],
    slug: String
  },
  
  // Variações do produto
  variations: [{
    name: String, // ex: "Cor", "Tamanho"
    values: [{
      value: String, // ex: "Azul", "M"
      sku: String,
      price: Number,
      quantity: Number,
      images: [String]
    }]
  }],
  
  // Produtos relacionados
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Histórico de preços
  priceHistory: [{
    price: Number,
    date: { type: Date, default: Date.now },
    reason: String // ex: "promoção", "ajuste de mercado"
  }],
  
  // Notas fiscais relacionadas
  invoices: [{
    invoiceNumber: String,
    date: Date,
    quantity: Number,
    unitCost: Number,
    totalCost: Number,
    supplier: String,
    documentUrl: String
  }],
  
  // Configurações de IA
  aiSettings: {
    autoOptimizeTitle: { type: Boolean, default: true },
    autoOptimizeDescription: { type: Boolean, default: true },
    autoOptimizeKeywords: { type: Boolean, default: true },
    autoAdjustPrice: { type: Boolean, default: false },
    priceAdjustmentRange: {
      min: Number, // % mínimo de desconto
      max: Number  // % máximo de aumento
    }
  },
  
  // Metadados
  metadata: {
    source: String, // Como o produto foi adicionado
    importedFrom: String,
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
productSchema.index({ userId: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ ean: 1 });
productSchema.index({ status: 1 });
productSchema.index({ 'category.main': 1 });
productSchema.index({ 'pricing.price': 1 });
productSchema.index({ 'inventory.quantity': 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ 'metrics.sales': -1 });
productSchema.index({ 'metrics.revenue': -1 });

// Índice de texto para busca
productSchema.index({
  name: 'text',
  description: 'text',
  'category.main': 'text',
  'category.tags': 'text'
});

// Virtual para verificar se está em estoque
productSchema.virtual('inStock').get(function() {
  return this.inventory.quantity > 0;
});

// Virtual para verificar se precisa repor estoque
productSchema.virtual('needsRestock').get(function() {
  return this.inventory.quantity <= this.inventory.minStock;
});

// Virtual para calcular margem de lucro
productSchema.virtual('profitMargin').get(function() {
  if (this.pricing.cost === 0) return 0;
  return ((this.pricing.price - this.pricing.cost) / this.pricing.cost) * 100;
});

// Virtual para URL da imagem principal
productSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// Virtual para verificar se está em promoção
productSchema.virtual('onSale').get(function() {
  return this.pricing.salePrice && this.pricing.salePrice < this.pricing.price;
});

// Middleware para atualizar slug antes de salvar
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Middleware para atualizar margem antes de salvar
productSchema.pre('save', function(next) {
  if (this.isModified('pricing.cost') || this.isModified('pricing.price')) {
    if (this.pricing.cost > 0) {
      this.pricing.margin = ((this.pricing.price - this.pricing.cost) / this.pricing.cost) * 100;
    }
  }
  next();
});

// Método para adicionar ao histórico de preços
productSchema.methods.addPriceHistory = function(newPrice, reason) {
  this.priceHistory.push({
    price: newPrice,
    date: new Date(),
    reason: reason || 'Ajuste manual'
  });
  
  // Manter apenas os últimos 50 registros
  if (this.priceHistory.length > 50) {
    this.priceHistory = this.priceHistory.slice(-50);
  }
};

// Método para atualizar métricas
productSchema.methods.updateMetrics = function(saleData) {
  this.metrics.sales += saleData.quantity || 1;
  this.metrics.revenue += saleData.amount || this.pricing.price;
  this.metrics.lastSaleDate = new Date();
  
  // Atualizar taxa de conversão se houver dados de visualizações
  if (this.metrics.views > 0) {
    this.metrics.conversionRate = (this.metrics.sales / this.metrics.views) * 100;
  }
};

// Método para verificar disponibilidade em marketplace
productSchema.methods.isAvailableInMarketplace = function(platform) {
  const marketplace = this.marketplaces.find(mp => mp.platform === platform);
  return marketplace && marketplace.isActive && marketplace.syncStatus === 'success';
};

// Método estático para buscar produtos em baixo estoque
productSchema.statics.findLowStock = function(userId) {
  return this.find({
    userId: userId,
    status: 'active',
    $expr: { $lte: ['$inventory.quantity', '$inventory.minStock'] }
  });
};

// Método estático para produtos mais vendidos
productSchema.statics.findBestSellers = function(userId, limit = 10) {
  return this.find({ userId: userId, status: 'active' })
    .sort({ 'metrics.sales': -1 })
    .limit(limit);
};

module.exports = mongoose.model('Product', productSchema);