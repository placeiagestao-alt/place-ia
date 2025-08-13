const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Dados pessoais
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'E-mail é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido']
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
    select: false // Não retornar senha por padrão
  },
  
  // Documentos
  cpf: {
    type: String,
    sparse: true,
    unique: true,
    match: [/^\d{11}$/, 'CPF deve ter 11 dígitos']
  },
  cnpj: {
    type: String,
    sparse: true,
    unique: true,
    match: [/^\d{14}$/, 'CNPJ deve ter 14 dígitos']
  },
  
  // Contato
  phone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Telefone inválido']
  },
  whatsapp: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'WhatsApp inválido']
  },
  
  // Endereço
  address: {
    street: String,
    number: String,
    complement: String,
    neighborhood: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Brasil' }
  },
  
  // Tipo de usuário
  userType: {
    type: String,
    enum: ['client', 'admin'],
    default: 'client'
  },
  
  // Status da conta
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    default: 'pending_verification'
  },
  
  // Verificações
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Tokens de verificação
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Dados da empresa (para clientes)
  company: {
    name: String,
    tradeName: String,
    segment: String,
    size: {
      type: String,
      enum: ['micro', 'pequena', 'media', 'grande']
    },
    monthlyRevenue: Number,
    employeeCount: Number
  },
  
  // Configurações de notificação
  notifications: {
    email: {
      marketing: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      support: { type: Boolean, default: true }
    },
    sms: {
      marketing: { type: Boolean, default: false },
      system: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      support: { type: Boolean, default: false }
    },
    push: {
      marketing: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      support: { type: Boolean, default: true }
    }
  },
  
  // Dados de assinatura
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'plus', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'canceled', 'past_due', 'trialing'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    trialEndDate: Date,
    autoRenew: { type: Boolean, default: true },
    
    // IDs dos gateways de pagamento
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    pagseguroCustomerId: String,
    paypalCustomerId: String
  },
  
  // Configurações de marketplace
  marketplaces: [{
    platform: {
      type: String,
      enum: ['mercadolivre', 'amazon', 'shopee', 'magazineluiza', 'americanas', 'casasbahia', 'extra']
    },
    accountId: String,
    accessToken: String,
    refreshToken: String,
    isActive: { type: Boolean, default: true },
    lastSync: Date,
    syncStatus: {
      type: String,
      enum: ['success', 'error', 'pending'],
      default: 'pending'
    }
  }],
  
  // Configurações de campanhas publicitárias
  adAccounts: [{
    platform: {
      type: String,
      enum: ['google_ads', 'facebook_ads', 'tiktok_ads']
    },
    accountId: String,
    accessToken: String,
    refreshToken: String,
    isActive: { type: Boolean, default: true },
    budget: {
      daily: Number,
      monthly: Number
    },
    targetRoas: Number // Return on Ad Spend
  }],
  
  // Configurações da IA
  aiSettings: {
    tataPersonality: {
      type: String,
      enum: ['friendly', 'professional', 'casual', 'formal'],
      default: 'friendly'
    },
    autoResponses: { type: Boolean, default: true },
    learningMode: { type: Boolean, default: true },
    customInstructions: String
  },
  
  // Métricas e analytics
  metrics: {
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    lastActivityDate: Date,
    loginCount: { type: Number, default: 0 },
    lastLoginDate: Date,
    lastLoginIP: String
  },
  
  // Configurações de segurança
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    backupCodes: [String],
    lastPasswordChange: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    accountLockedUntil: Date,
    trustedDevices: [{
      deviceId: String,
      deviceName: String,
      lastUsed: Date,
      ipAddress: String,
      userAgent: String
    }]
  },
  
  // Dados de onboarding
  onboarding: {
    completed: { type: Boolean, default: false },
    currentStep: { type: Number, default: 1 },
    completedSteps: [Number],
    skippedSteps: [Number]
  },
  
  // Preferências
  preferences: {
    language: { type: String, default: 'pt-BR' },
    timezone: { type: String, default: 'America/Sao_Paulo' },
    currency: { type: String, default: 'BRL' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' }
  },
  
  // Metadados
  metadata: {
    source: String, // Como o usuário chegou até nós
    referrer: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para performance
userSchema.index({ email: 1 });
userSchema.index({ cpf: 1 }, { sparse: true });
userSchema.index({ cnpj: 1 }, { sparse: true });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ status: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ createdAt: -1 });

// Virtual para nome completo
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual para verificar se é trial
userSchema.virtual('isTrialing').get(function() {
  return this.subscription.status === 'trialing' && 
         this.subscription.trialEndDate && 
         this.subscription.trialEndDate > new Date();
});

// Virtual para verificar se a assinatura está ativa
userSchema.virtual('hasActiveSubscription').get(function() {
  return ['active', 'trialing'].includes(this.subscription.status);
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  // Só fazer hash se a senha foi modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Hash da senha
    const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    
    // Atualizar data da última mudança de senha
    this.security.lastPasswordChange = new Date();
    
    next();
  } catch (error) {
    next(error);
  }
});

// Método para verificar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para gerar token de reset de senha
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  
  return resetToken;
};

// Método para gerar token de verificação de email
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
  
  return verificationToken;
};

// Método para verificar se a conta está bloqueada
userSchema.methods.isAccountLocked = function() {
  return this.security.accountLockedUntil && this.security.accountLockedUntil > Date.now();
};

// Método para incrementar tentativas de login falhadas
userSchema.methods.incrementFailedLoginAttempts = function() {
  // Se temos uma data de bloqueio anterior e ela passou, resetar
  if (this.security.accountLockedUntil && this.security.accountLockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.accountLockedUntil': 1 },
      $set: { 'security.failedLoginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'security.failedLoginAttempts': 1 } };
  
  // Bloquear conta após 5 tentativas
  if (this.security.failedLoginAttempts + 1 >= 5 && !this.security.accountLockedUntil) {
    updates.$set = { 'security.accountLockedUntil': Date.now() + 2 * 60 * 60 * 1000 }; // 2 horas
  }
  
  return this.updateOne(updates);
};

// Método para resetar tentativas de login
userSchema.methods.resetFailedLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.failedLoginAttempts': 1,
      'security.accountLockedUntil': 1
    }
  });
};

// Método para atualizar último login
userSchema.methods.updateLastLogin = function(ipAddress, userAgent) {
  return this.updateOne({
    $set: {
      'metrics.lastLoginDate': new Date(),
      'metrics.lastLoginIP': ipAddress
    },
    $inc: {
      'metrics.loginCount': 1
    }
  });
};

module.exports = mongoose.model('User', userSchema);