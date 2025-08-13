const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticateToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Rate limiting para operações sensíveis
const sensitiveOperationsLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiting geral
router.use(generalLimit);

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Configuração do nodemailer (mockado para desenvolvimento)
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@place.ia',
    pass: process.env.SMTP_PASS || 'senha_mock'
  }
});

// Função para validar CPF
const isValidCPF = (cpf) => {
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  return remainder === parseInt(cpf.charAt(10));
};

// Função para validar CNPJ
const isValidCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/[^\d]/g, '');
  
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }
  
  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  let digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(0))) return false;
  
  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += numbers.charAt(length - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  
  return result === parseInt(digits.charAt(1));
};

// ROTA: Obter perfil do usuário
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -refreshTokens -resetPasswordToken -emailVerificationToken')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Adicionar informações calculadas
    const profileData = {
      ...user,
      accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)), // dias
      isProfileComplete: !!(user.fullName && user.email && user.phone && user.document),
      hasActiveSubscription: user.subscription?.status === 'active',
      subscriptionDaysLeft: user.subscription?.endDate ? 
        Math.max(0, Math.floor((new Date(user.subscription.endDate) - Date.now()) / (1000 * 60 * 60 * 24))) : 0
    };
    
    res.json({
      success: true,
      data: { user: profileData }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar perfil básico
router.put('/profile', [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('phone')
    .optional()
    .matches(/^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/)
    .withMessage('Telefone inválido'),
  body('birthDate')
    .optional()
    .isISO8601()
    .withMessage('Data de nascimento inválida'),
  body('gender')
    .optional()
    .isIn(['masculino', 'feminino', 'outro', 'prefiro_nao_informar'])
    .withMessage('Gênero inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const {
      fullName,
      phone,
      birthDate,
      gender,
      bio,
      website,
      socialMedia
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar campos fornecidos
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (birthDate !== undefined) user.birthDate = new Date(birthDate);
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;
    if (socialMedia !== undefined) user.socialMedia = socialMedia;
    
    await user.save();
    
    logger.info('Perfil atualizado', {
      userId: req.user.id,
      updatedFields: Object.keys(req.body)
    });
    
    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          birthDate: user.birthDate,
          gender: user.gender,
          bio: user.bio,
          website: user.website,
          socialMedia: user.socialMedia,
          updatedAt: user.updatedAt
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar endereço
router.put('/address', [
  body('cep')
    .optional()
    .matches(/^\d{5}-?\d{3}$/)
    .withMessage('CEP inválido'),
  body('street')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Endereço deve ter entre 5 e 200 caracteres'),
  body('number')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Número inválido'),
  body('city')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Cidade deve ter entre 2 e 100 caracteres'),
  body('state')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Estado deve ter 2 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const {
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      country = 'Brasil'
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar endereço
    if (!user.address) user.address = {};
    
    if (cep !== undefined) user.address.cep = cep;
    if (street !== undefined) user.address.street = street;
    if (number !== undefined) user.address.number = number;
    if (complement !== undefined) user.address.complement = complement;
    if (neighborhood !== undefined) user.address.neighborhood = neighborhood;
    if (city !== undefined) user.address.city = city;
    if (state !== undefined) user.address.state = state;
    if (country !== undefined) user.address.country = country;
    
    await user.save();
    
    logger.info('Endereço atualizado', {
      userId: req.user.id,
      cep: user.address.cep
    });
    
    res.json({
      success: true,
      message: 'Endereço atualizado com sucesso',
      data: {
        address: user.address
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar endereço:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar dados da empresa
router.put('/company', [
  body('companyName')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Nome da empresa deve ter entre 2 e 200 caracteres'),
  body('cnpj')
    .optional()
    .custom((value) => {
      if (value && !isValidCNPJ(value)) {
        throw new Error('CNPJ inválido');
      }
      return true;
    }),
  body('stateRegistration')
    .optional()
    .isLength({ min: 5, max: 20 })
    .withMessage('Inscrição estadual inválida'),
  body('businessType')
    .optional()
    .isIn(['mei', 'me', 'epp', 'ltda', 'sa', 'outros'])
    .withMessage('Tipo de empresa inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const {
      companyName,
      cnpj,
      stateRegistration,
      municipalRegistration,
      businessType,
      businessActivity,
      foundedDate
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se CNPJ já está em uso
    if (cnpj && cnpj !== user.company?.cnpj) {
      const existingUser = await User.findOne({ 'company.cnpj': cnpj });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'CNPJ já está em uso'
        });
      }
    }
    
    // Atualizar dados da empresa
    if (!user.company) user.company = {};
    
    if (companyName !== undefined) user.company.companyName = companyName;
    if (cnpj !== undefined) user.company.cnpj = cnpj;
    if (stateRegistration !== undefined) user.company.stateRegistration = stateRegistration;
    if (municipalRegistration !== undefined) user.company.municipalRegistration = municipalRegistration;
    if (businessType !== undefined) user.company.businessType = businessType;
    if (businessActivity !== undefined) user.company.businessActivity = businessActivity;
    if (foundedDate !== undefined) user.company.foundedDate = new Date(foundedDate);
    
    await user.save();
    
    logger.info('Dados da empresa atualizados', {
      userId: req.user.id,
      companyName: user.company.companyName,
      cnpj: user.company.cnpj
    });
    
    res.json({
      success: true,
      message: 'Dados da empresa atualizados com sucesso',
      data: {
        company: user.company
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar dados da empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Alterar senha
router.put('/password', sensitiveOperationsLimit, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Nova senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Nova senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Confirmação de senha não confere');
      }
      return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar senha atual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }
    
    // Verificar se a nova senha é diferente da atual
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ser diferente da senha atual'
      });
    }
    
    // Atualizar senha
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    
    // Invalidar todos os refresh tokens
    user.refreshTokens = [];
    
    await user.save();
    
    // Enviar e-mail de notificação (mockado)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@place.ia',
        to: user.email,
        subject: 'Senha alterada - Place.IA',
        html: `
          <h2>Senha alterada com sucesso</h2>
          <p>Olá ${user.fullName || user.email},</p>
          <p>Sua senha foi alterada com sucesso em ${new Date().toLocaleString('pt-BR')}.</p>
          <p>Se você não fez esta alteração, entre em contato conosco imediatamente.</p>
          <p>Atenciosamente,<br>Equipe Place.IA</p>
        `
      });
    } catch (emailError) {
      logger.warn('Erro ao enviar e-mail de notificação de senha:', emailError);
    }
    
    logger.info('Senha alterada', {
      userId: req.user.id,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso. Faça login novamente.'
    });
    
  } catch (error) {
    logger.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar configurações de notificação
router.put('/notifications', [
  body('emailNotifications')
    .optional()
    .isObject()
    .withMessage('Configurações de e-mail devem ser um objeto'),
  body('pushNotifications')
    .optional()
    .isObject()
    .withMessage('Configurações de push devem ser um objeto'),
  body('smsNotifications')
    .optional()
    .isObject()
    .withMessage('Configurações de SMS devem ser um objeto')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar configurações de notificação
    if (!user.notificationSettings) user.notificationSettings = {};
    
    if (emailNotifications !== undefined) {
      user.notificationSettings.email = {
        ...user.notificationSettings.email,
        ...emailNotifications
      };
    }
    
    if (pushNotifications !== undefined) {
      user.notificationSettings.push = {
        ...user.notificationSettings.push,
        ...pushNotifications
      };
    }
    
    if (smsNotifications !== undefined) {
      user.notificationSettings.sms = {
        ...user.notificationSettings.sms,
        ...smsNotifications
      };
    }
    
    await user.save();
    
    logger.info('Configurações de notificação atualizadas', {
      userId: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Configurações de notificação atualizadas com sucesso',
      data: {
        notificationSettings: user.notificationSettings
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar configurações de notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar preferências
router.put('/preferences', [
  body('language')
    .optional()
    .isIn(['pt-BR', 'en-US', 'es-ES'])
    .withMessage('Idioma inválido'),
  body('timezone')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Timezone inválido'),
  body('currency')
    .optional()
    .isIn(['BRL', 'USD', 'EUR'])
    .withMessage('Moeda inválida'),
  body('theme')
    .optional()
    .isIn(['dark', 'light', 'auto'])
    .withMessage('Tema inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const {
      language,
      timezone,
      currency,
      theme,
      dateFormat,
      numberFormat
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Atualizar preferências
    if (!user.preferences) user.preferences = {};
    
    if (language !== undefined) user.preferences.language = language;
    if (timezone !== undefined) user.preferences.timezone = timezone;
    if (currency !== undefined) user.preferences.currency = currency;
    if (theme !== undefined) user.preferences.theme = theme;
    if (dateFormat !== undefined) user.preferences.dateFormat = dateFormat;
    if (numberFormat !== undefined) user.preferences.numberFormat = numberFormat;
    
    await user.save();
    
    logger.info('Preferências atualizadas', {
      userId: req.user.id,
      preferences: user.preferences
    });
    
    res.json({
      success: true,
      message: 'Preferências atualizadas com sucesso',
      data: {
        preferences: user.preferences
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Deletar conta
router.delete('/account', sensitiveOperationsLimit, [
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória para deletar a conta'),
  body('confirmation')
    .equals('DELETE_MY_ACCOUNT')
    .withMessage('Confirmação inválida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { password } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar senha
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    // Verificar se há assinatura ativa
    if (user.subscription?.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cancele sua assinatura antes de deletar a conta'
      });
    }
    
    // Marcar conta como deletada (soft delete)
    user.status = 'deleted';
    user.deletedAt = new Date();
    user.email = `deleted_${Date.now()}_${user.email}`;
    
    await user.save();
    
    // Enviar e-mail de confirmação (mockado)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@place.ia',
        to: user.email.replace(/^deleted_\d+_/, ''),
        subject: 'Conta deletada - Place.IA',
        html: `
          <h2>Conta deletada com sucesso</h2>
          <p>Sua conta foi deletada em ${new Date().toLocaleString('pt-BR')}.</p>
          <p>Sentiremos sua falta!</p>
          <p>Atenciosamente,<br>Equipe Place.IA</p>
        `
      });
    } catch (emailError) {
      logger.warn('Erro ao enviar e-mail de confirmação de deleção:', emailError);
    }
    
    logger.info('Conta deletada', {
      userId: req.user.id,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro ao deletar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Obter estatísticas do usuário
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('createdAt lastLogin loginAttempts metrics')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Calcular estatísticas
    const stats = {
      accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      lastLogin: user.lastLogin,
      totalLogins: user.metrics?.totalLogins || 0,
      failedLoginAttempts: user.loginAttempts?.count || 0,
      profileCompleteness: 0,
      securityScore: 0
    };
    
    // Calcular completude do perfil (mockado)
    const profileFields = ['fullName', 'phone', 'document', 'address'];
    const completedFields = profileFields.filter(field => {
      if (field === 'address') return user.address && user.address.street;
      return user[field];
    });
    stats.profileCompleteness = Math.round((completedFields.length / profileFields.length) * 100);
    
    // Calcular score de segurança (mockado)
    let securityScore = 0;
    if (user.emailVerified) securityScore += 25;
    if (user.phoneVerified) securityScore += 25;
    if (user.twoFactorEnabled) securityScore += 25;
    if (user.passwordChangedAt && (Date.now() - new Date(user.passwordChangedAt).getTime()) < 90 * 24 * 60 * 60 * 1000) {
      securityScore += 25; // Senha alterada nos últimos 90 dias
    }
    stats.securityScore = securityScore;
    
    res.json({
      success: true,
      data: { stats }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Exportar dados do usuário (LGPD)
router.get('/export', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -refreshTokens -resetPasswordToken -emailVerificationToken')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Preparar dados para exportação
    const exportData = {
      userData: user,
      exportedAt: new Date(),
      exportVersion: '1.0',
      note: 'Dados exportados conforme LGPD - Lei Geral de Proteção de Dados'
    };
    
    logger.info('Dados exportados', {
      userId: req.user.id,
      timestamp: new Date()
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="place_ia_dados_${user._id}_${Date.now()}.json"`);
    
    res.json(exportData);
    
  } catch (error) {
    logger.error('Erro ao exportar dados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;