const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Importar SDKs de pagamento
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');

const router = express.Router();

// Configuração PayPal
const paypalEnvironment = process.env.NODE_ENV === 'production'
  ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
  : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);

const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);

// Middleware de autenticação
router.use(authenticateToken);

// Validações
const subscriptionValidation = [
  body('planId')
    .notEmpty()
    .withMessage('ID do plano é obrigatório'),
  body('paymentMethod')
    .isIn(['stripe', 'paypal', 'pagseguro'])
    .withMessage('Método de pagamento inválido'),
  body('billingCycle')
    .optional()
    .isIn(['monthly', 'quarterly', 'yearly'])
    .withMessage('Ciclo de cobrança inválido')
];

const paymentValidation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Valor deve ser maior que 0'),
  body('currency')
    .optional()
    .isIn(['BRL', 'USD'])
    .withMessage('Moeda inválida'),
  body('description')
    .optional()
    .isString()
    .withMessage('Descrição deve ser uma string')
];

// Planos disponíveis
const PLANS = {
  basic: {
    id: 'basic',
    name: 'Plano Básico',
    description: 'Ideal para começar',
    features: [
      'Até 100 produtos',
      '1 marketplace',
      'Suporte básico',
      'Relatórios básicos'
    ],
    prices: {
      monthly: 29.90,
      quarterly: 79.90,
      yearly: 299.90
    },
    stripeIds: {
      monthly: 'price_basic_monthly',
      quarterly: 'price_basic_quarterly',
      yearly: 'price_basic_yearly'
    }
  },
  professional: {
    id: 'professional',
    name: 'Plano Profissional',
    description: 'Para negócios em crescimento',
    features: [
      'Até 1000 produtos',
      '3 marketplaces',
      'IA TaTa incluída',
      'Relatórios avançados',
      'Suporte prioritário'
    ],
    prices: {
      monthly: 79.90,
      quarterly: 219.90,
      yearly: 799.90
    },
    stripeIds: {
      monthly: 'price_pro_monthly',
      quarterly: 'price_pro_quarterly',
      yearly: 'price_pro_yearly'
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Plano Enterprise',
    description: 'Para grandes operações',
    features: [
      'Produtos ilimitados',
      'Marketplaces ilimitados',
      'Todas as IAs incluídas',
      'Relatórios personalizados',
      'Suporte 24/7',
      'API dedicada'
    ],
    prices: {
      monthly: 199.90,
      quarterly: 549.90,
      yearly: 1999.90
    },
    stripeIds: {
      monthly: 'price_enterprise_monthly',
      quarterly: 'price_enterprise_quarterly',
      yearly: 'price_enterprise_yearly'
    }
  }
};

// Função para criar assinatura no Stripe
const createStripeSubscription = async (customerId, priceId, userId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId.toString()
      }
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      status: subscription.status
    };
  } catch (error) {
    logger.error('Erro ao criar assinatura Stripe:', error);
    throw error;
  }
};

// Função para criar pagamento no PayPal
const createPayPalPayment = async (amount, currency, description) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        },
        description: description
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      }
    });
    
    const order = await paypalClient.execute(request);
    
    return {
      orderId: order.result.id,
      approvalUrl: order.result.links.find(link => link.rel === 'approve').href,
      status: order.result.status
    };
  } catch (error) {
    logger.error('Erro ao criar pagamento PayPal:', error);
    throw error;
  }
};

// Função para criar pagamento no PagSeguro
const createPagSeguroPayment = async (amount, description, userEmail) => {
  try {
    const paymentData = {
      reference_id: `place_ia_${Date.now()}`,
      description: description,
      amount: {
        value: Math.round(amount * 100), // PagSeguro usa centavos
        currency: 'BRL'
      },
      payment_method: {
        type: 'CREDIT_CARD',
        installments: 1
      },
      notification_urls: [
        `${process.env.API_URL}/webhooks/pagseguro`
      ],
      redirect_urls: {
        success: `${process.env.FRONTEND_URL}/payment/success`,
        failure: `${process.env.FRONTEND_URL}/payment/error`
      }
    };
    
    const response = await axios.post(
      `${process.env.PAGSEGURO_API_URL}/orders`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAGSEGURO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      orderId: response.data.id,
      paymentUrl: response.data.links.find(link => link.rel === 'PAYMENT').href,
      status: response.data.status
    };
  } catch (error) {
    logger.error('Erro ao criar pagamento PagSeguro:', error);
    throw error;
  }
};

// ROTA: Listar planos disponíveis
router.get('/plans', async (req, res) => {
  try {
    const plans = Object.values(PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      prices: plan.prices
    }));
    
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    logger.error('Erro ao listar planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Criar assinatura
router.post('/subscribe', subscriptionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { planId, paymentMethod, billingCycle = 'monthly' } = req.body;
    const userId = req.user.id;
    
    // Verificar se o plano existe
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }
    
    // Buscar usuário
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const amount = plan.prices[billingCycle];
    let paymentResult;
    
    try {
      switch (paymentMethod) {
        case 'stripe':
          // Criar ou buscar customer no Stripe
          let customerId = user.payments?.stripe?.customerId;
          
          if (!customerId) {
            const customer = await stripe.customers.create({
              email: user.email,
              name: user.name,
              metadata: {
                userId: userId.toString()
              }
            });
            customerId = customer.id;
            
            // Salvar customer ID
            await User.findByIdAndUpdate(userId, {
              'payments.stripe.customerId': customerId
            });
          }
          
          const priceId = plan.stripeIds[billingCycle];
          paymentResult = await createStripeSubscription(customerId, priceId, userId);
          
          // Atualizar dados da assinatura
          await User.findByIdAndUpdate(userId, {
            'subscription.plan': planId,
            'subscription.status': 'pending',
            'subscription.billingCycle': billingCycle,
            'subscription.amount': amount,
            'subscription.currency': 'BRL',
            'subscription.paymentMethod': paymentMethod,
            'subscription.stripeSubscriptionId': paymentResult.subscriptionId,
            'subscription.nextBilling': new Date(Date.now() + (billingCycle === 'monthly' ? 30 : billingCycle === 'quarterly' ? 90 : 365) * 24 * 60 * 60 * 1000)
          });
          
          break;
          
        case 'paypal':
          paymentResult = await createPayPalPayment(
            amount,
            'BRL',
            `${plan.name} - ${billingCycle}`
          );
          
          // Salvar dados temporários da assinatura
          await User.findByIdAndUpdate(userId, {
            'subscription.plan': planId,
            'subscription.status': 'pending',
            'subscription.billingCycle': billingCycle,
            'subscription.amount': amount,
            'subscription.currency': 'BRL',
            'subscription.paymentMethod': paymentMethod,
            'subscription.paypalOrderId': paymentResult.orderId
          });
          
          break;
          
        case 'pagseguro':
          paymentResult = await createPagSeguroPayment(
            amount,
            `${plan.name} - ${billingCycle}`,
            user.email
          );
          
          // Salvar dados temporários da assinatura
          await User.findByIdAndUpdate(userId, {
            'subscription.plan': planId,
            'subscription.status': 'pending',
            'subscription.billingCycle': billingCycle,
            'subscription.amount': amount,
            'subscription.currency': 'BRL',
            'subscription.paymentMethod': paymentMethod,
            'subscription.pagseguroOrderId': paymentResult.orderId
          });
          
          break;
      }
      
      logger.info('Assinatura criada', {
        userId,
        planId,
        paymentMethod,
        billingCycle,
        amount
      });
      
      res.json({
        success: true,
        message: 'Assinatura criada com sucesso',
        data: {
          plan: {
            id: planId,
            name: plan.name,
            billingCycle,
            amount
          },
          payment: paymentResult
        }
      });
      
    } catch (paymentError) {
      logger.error('Erro no processamento do pagamento:', paymentError);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar pagamento',
        code: 'PAYMENT_PROCESSING_ERROR'
      });
    }
    
  } catch (error) {
    logger.error('Erro ao criar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Cancelar assinatura
router.post('/cancel-subscription', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user || !user.subscription || user.subscription.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada'
      });
    }
    
    const { paymentMethod, stripeSubscriptionId } = user.subscription;
    
    try {
      // Cancelar no provedor de pagamento
      if (paymentMethod === 'stripe' && stripeSubscriptionId) {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true
        });
      }
      
      // Atualizar status da assinatura
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': new Date()
      });
      
      logger.info('Assinatura cancelada', {
        userId,
        paymentMethod
      });
      
      res.json({
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });
      
    } catch (cancelError) {
      logger.error('Erro ao cancelar assinatura:', cancelError);
      res.status(500).json({
        success: false,
        message: 'Erro ao cancelar assinatura'
      });
    }
    
  } catch (error) {
    logger.error('Erro no cancelamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Histórico de pagamentos
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    // Aqui você implementaria um modelo de Payment/Invoice
    // Por enquanto, retornar dados mockados
    const payments = {
      docs: [
        {
          id: '1',
          amount: 79.90,
          currency: 'BRL',
          status: 'paid',
          method: 'stripe',
          description: 'Plano Profissional - Mensal',
          createdAt: new Date(),
          paidAt: new Date()
        },
        {
          id: '2',
          amount: 79.90,
          currency: 'BRL',
          status: 'paid',
          method: 'stripe',
          description: 'Plano Profissional - Mensal',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
        payments: payments.docs,
        pagination: {
          currentPage: payments.page,
          totalPages: payments.totalPages,
          totalDocs: payments.totalDocs,
          hasNextPage: payments.hasNextPage,
          hasPrevPage: payments.hasPrevPage
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

// ROTA: Status da assinatura atual
router.get('/subscription/status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('subscription');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const subscription = user.subscription || {
      plan: 'free',
      status: 'inactive',
      billingCycle: null,
      amount: 0,
      currency: 'BRL',
      nextBilling: null
    };
    
    // Se há uma assinatura ativa, buscar detalhes do plano
    let planDetails = null;
    if (subscription.plan && PLANS[subscription.plan]) {
      planDetails = {
        id: subscription.plan,
        name: PLANS[subscription.plan].name,
        description: PLANS[subscription.plan].description,
        features: PLANS[subscription.plan].features
      };
    }
    
    res.json({
      success: true,
      data: {
        subscription: {
          ...subscription,
          plan: planDetails
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar status da assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Atualizar método de pagamento
router.post('/update-payment-method', async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = req.user.id;
    
    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'ID do método de pagamento é obrigatório'
      });
    }
    
    const user = await User.findById(userId);
    if (!user || !user.subscription || user.subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada'
      });
    }
    
    // Atualizar método de pagamento no Stripe
    if (user.subscription.paymentMethod === 'stripe' && user.subscription.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
          default_payment_method: paymentMethodId
        });
        
        logger.info('Método de pagamento atualizado', {
          userId,
          paymentMethodId
        });
        
        res.json({
          success: true,
          message: 'Método de pagamento atualizado com sucesso'
        });
        
      } catch (stripeError) {
        logger.error('Erro ao atualizar método no Stripe:', stripeError);
        res.status(500).json({
          success: false,
          message: 'Erro ao atualizar método de pagamento'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Método de pagamento não suportado para atualização'
      });
    }
    
  } catch (error) {
    logger.error('Erro ao atualizar método de pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Gerar fatura
router.post('/generate-invoice', async (req, res) => {
  try {
    const { items, customerData } = req.body;
    const userId = req.user.id;
    
    // Aqui você implementaria a geração de fatura
    // Por enquanto, retornar dados mockados
    const invoice = {
      id: `INV-${Date.now()}`,
      number: `2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      items: items || [],
      subtotal: 79.90,
      tax: 0,
      total: 79.90,
      currency: 'BRL',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      customer: customerData || {
        name: req.user.name,
        email: req.user.email
      }
    };
    
    res.json({
      success: true,
      message: 'Fatura gerada com sucesso',
      data: { invoice }
    });
    
  } catch (error) {
    logger.error('Erro ao gerar fatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;