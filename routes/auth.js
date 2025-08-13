const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para reset de senha
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 tentativas por hora
  message: {
    success: false,
    message: 'Muitas tentativas de reset. Tente novamente em 1 hora.',
    code: 'RESET_RATE_LIMIT_EXCEEDED'
  }
});

// Validações
const registerValidation = [
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
    .withMessage('Senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  body('cpf')
    .optional()
    .matches(/^\d{11}$/)
    .withMessage('CPF deve ter 11 dígitos'),
  body('cnpj')
    .optional()
    .matches(/^\d{14}$/)
    .withMessage('CNPJ deve ter 14 dígitos'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Telefone inválido'),
  body('userType')
    .optional()
    .isIn(['client', 'admin'])
    .withMessage('Tipo de usuário inválido')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
];

const resetPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido')
];

const newPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token é obrigatório'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial')
];

// Função para gerar tokens JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Função para validar CPF
const isValidCPF = (cpf) => {
  if (!cpf || cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validar dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 > 9) digit1 = 0;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 > 9) digit2 = 0;
  
  return digit1 === parseInt(cpf.charAt(9)) && digit2 === parseInt(cpf.charAt(10));
};

// Função para validar CNPJ
const isValidCNPJ = (cnpj) => {
  if (!cnpj || cnpj.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Validar primeiro dígito verificador
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  
  // Validar segundo dígito verificador
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  
  return digit1 === parseInt(cnpj.charAt(12)) && digit2 === parseInt(cnpj.charAt(13));
};

// ROTA: Cadastro de usuário
router.post('/register', registerValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { name, email, password, cpf, cnpj, phone, userType, company } = req.body;
    
    // Validar CPF se fornecido
    if (cpf && !isValidCPF(cpf)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido',
        code: 'INVALID_CPF'
      });
    }
    
    // Validar CNPJ se fornecido
    if (cnpj && !isValidCNPJ(cnpj)) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido',
        code: 'INVALID_CNPJ'
      });
    }
    
    // Verificar se usuário já existe
    const existingUser = await User.findOne({
      $or: [
        { email },
        ...(cpf ? [{ cpf }] : []),
        ...(cnpj ? [{ cnpj }] : [])
      ]
    });
    
    if (existingUser) {
      let message = 'Usuário já existe';
      if (existingUser.email === email) message = 'E-mail já cadastrado';
      else if (existingUser.cpf === cpf) message = 'CPF já cadastrado';
      else if (existingUser.cnpj === cnpj) message = 'CNPJ já cadastrado';
      
      return res.status(409).json({
        success: false,
        message,
        code: 'USER_ALREADY_EXISTS'
      });
    }
    
    // Criar novo usuário
    const userData = {
      name,
      email,
      password,
      userType: userType || 'client',
      phone,
      ...(cpf && { cpf }),
      ...(cnpj && { cnpj }),
      ...(company && { company })
    };
    
    const user = new User(userData);
    
    // Gerar token de verificação de email
    const emailVerificationToken = user.createEmailVerificationToken();
    
    await user.save();
    
    // Enviar email de verificação
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verificação de E-mail - Place IA',
        template: 'email-verification',
        data: {
          name: user.name,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao enviar email de verificação:', emailError);
    }
    
    // Gerar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // Log da ação
    logger.info('Novo usuário registrado', {
      userId: user._id,
      email: user.email,
      userType: user.userType,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso. Verifique seu e-mail.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          status: user.status,
          emailVerified: user.emailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no cadastro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { email, password, userType } = req.body;
    
    // Buscar usuário com senha
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verificar se a conta está bloqueada
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Conta temporariamente bloqueada devido a muitas tentativas de login',
        code: 'ACCOUNT_LOCKED'
      });
    }
    
    // Verificar tipo de usuário se especificado
    if (userType && user.userType !== userType) {
      await user.incrementFailedLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verificar senha
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await user.incrementFailedLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verificar se a conta está ativa
    if (user.status !== 'active' && user.status !== 'pending_verification') {
      return res.status(403).json({
        success: false,
        message: 'Conta inativa ou suspensa',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Reset tentativas de login falhadas
    await user.resetFailedLoginAttempts();
    
    // Atualizar último login
    await user.updateLastLogin(req.ip, req.get('User-Agent'));
    
    // Gerar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // Log da ação
    logger.info('Login realizado', {
      userId: user._id,
      email: user.email,
      userType: user.userType,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          status: user.status,
          emailVerified: user.emailVerified,
          subscription: user.subscription,
          onboarding: user.onboarding
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token não fornecido',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }
    
    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Buscar usuário
    const user = await User.findById(decoded.userId);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Gerar novos tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    
    res.json({
      success: true,
      message: 'Tokens renovados com sucesso',
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        }
      }
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido ou expirado',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    logger.error('Erro no refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Solicitar reset de senha
router.post('/forgot-password', resetLimiter, resetPasswordValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'E-mail inválido',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { email } = req.body;
    
    // Buscar usuário
    const user = await User.findOne({ email });
    
    // Sempre retornar sucesso por segurança (não revelar se email existe)
    if (!user) {
      return res.json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, você receberá as instruções de reset'
      });
    }
    
    // Gerar token de reset
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Enviar email de reset
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset de Senha - Place IA',
        template: 'password-reset',
        data: {
          name: user.name,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
          expiresIn: '10 minutos'
        }
      });
      
      logger.info('Email de reset enviado', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
    } catch (emailError) {
      logger.error('Erro ao enviar email de reset:', emailError);
      
      // Limpar token se email falhou
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao enviar email. Tente novamente.',
        code: 'EMAIL_SEND_ERROR'
      });
    }
    
    res.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções de reset'
    });
    
  } catch (error) {
    logger.error('Erro no forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Reset de senha
router.post('/reset-password', newPasswordValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { token, password } = req.body;
    
    // Hash do token para comparar
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Buscar usuário com token válido
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Atualizar senha
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();
    
    // Log da ação
    logger.info('Senha resetada', {
      userId: user._id,
      email: user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro no reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Verificar email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token é obrigatório',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    // Hash do token para comparar
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Buscar usuário com token válido
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Verificar email
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.status = 'active';
    
    await user.save();
    
    // Log da ação
    logger.info('Email verificado', {
      userId: user._id,
      email: user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'E-mail verificado com sucesso'
    });
    
  } catch (error) {
    logger.error('Erro na verificação de email:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Reenviar verificação de email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-mail é obrigatório',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, você receberá o link de verificação'
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'E-mail já verificado',
        code: 'EMAIL_ALREADY_VERIFIED'
      });
    }
    
    // Gerar novo token
    const emailVerificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });
    
    // Enviar email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verificação de E-mail - Place IA',
        template: 'email-verification',
        data: {
          name: user.name,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao reenviar email de verificação:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Erro ao enviar email. Tente novamente.',
        code: 'EMAIL_SEND_ERROR'
      });
    }
    
    res.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, você receberá o link de verificação'
    });
    
  } catch (error) {
    logger.error('Erro ao reenviar verificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// ROTA: Logout
router.post('/logout', (req, res) => {
  // Em uma implementação mais robusta, você poderia invalidar o token
  // adicionando-o a uma blacklist no Redis ou banco de dados
  
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

module.exports = router;