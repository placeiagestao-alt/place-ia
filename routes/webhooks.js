const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Sale = require('../models/Sale');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Middleware para raw body (necessário para verificação de assinatura)
const rawBodyMiddleware = (req, res, next) => {
  if (req.get('content-type') === 'application/json') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch (error) {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
};

// Função para verificar assinatura do Stripe
const verifyStripeSignature = (payload, signature, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
};

// Função para verificar assinatura do PayPal
const verifyPayPalSignature = (payload, headers) => {
  try {
    // Implementar verificação do PayPal
    // Por enquanto, retornar true (em produção, implementar corretamente)
    return true;
  } catch (error) {
    return false;
  }
};

// Função para verificar assinatura do PagSeguro
const verifyPagSeguroSignature = (payload, signature, token) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha1', token)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (error) {
    return false;
  }
};

// WEBHOOK: Stripe
router.post('/stripe', rawBodyMiddleware, async (req, res) => {
  try {
    const signature = req.get('stripe-signature');
    const payload = req.rawBody;
    
    // Verificar assinatura
    if (!verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
      logger.warn('Webhook Stripe com assinatura inválida', {
        signature,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = req.body;
    
    logger.info('Webhook Stripe recebido', {
      type: event.type,
      id: event.id
    });
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;
        
      default:
        logger.info('Evento Stripe não tratado', { type: event.type });
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Erro no webhook Stripe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBHOOK: PayPal
router.post('/paypal', rawBodyMiddleware, async (req, res) => {
  try {
    const payload = req.rawBody;
    const headers = req.headers;
    
    // Verificar assinatura
    if (!verifyPayPalSignature(payload, headers)) {
      logger.warn('Webhook PayPal com assinatura inválida', {
        ip: req.ip
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = req.body;
    
    logger.info('Webhook PayPal recebido', {
      event_type: event.event_type,
      id: event.id
    });
    
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        await handlePayPalSubscriptionCreated(event.resource);
        break;
        
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handlePayPalSubscriptionUpdated(event.resource);
        break;
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handlePayPalSubscriptionCancelled(event.resource);
        break;
        
      case 'PAYMENT.SALE.COMPLETED':
        await handlePayPalPaymentCompleted(event.resource);
        break;
        
      case 'PAYMENT.SALE.DENIED':
        await handlePayPalPaymentDenied(event.resource);
        break;
        
      default:
        logger.info('Evento PayPal não tratado', { type: event.event_type });
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Erro no webhook PayPal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBHOOK: PagSeguro
router.post('/pagseguro', rawBodyMiddleware, async (req, res) => {
  try {
    const payload = req.rawBody;
    const signature = req.get('x-pagseguro-signature');
    
    // Verificar assinatura
    if (!verifyPagSeguroSignature(payload, signature, process.env.PAGSEGURO_TOKEN)) {
      logger.warn('Webhook PagSeguro com assinatura inválida', {
        signature,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = req.body;
    
    logger.info('Webhook PagSeguro recebido', {
      notificationType: event.notificationType,
      notificationCode: event.notificationCode
    });
    
    switch (event.notificationType) {
      case 'transaction':
        await handlePagSeguroTransaction(event);
        break;
        
      case 'preApproval':
        await handlePagSeguroPreApproval(event);
        break;
        
      default:
        logger.info('Evento PagSeguro não tratado', { type: event.notificationType });
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Erro no webhook PagSeguro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBHOOK: Mercado Livre
router.post('/mercadolivre', rawBodyMiddleware, async (req, res) => {
  try {
    const event = req.body;
    
    logger.info('Webhook Mercado Livre recebido', {
      topic: event.topic,
      resource: event.resource,
      user_id: event.user_id
    });
    
    switch (event.topic) {
      case 'orders_v2':
        await handleMercadoLivreOrder(event);
        break;
        
      case 'items':
        await handleMercadoLivreItem(event);
        break;
        
      case 'questions':
        await handleMercadoLivreQuestion(event);
        break;
        
      default:
        logger.info('Evento Mercado Livre não tratado', { topic: event.topic });
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Erro no webhook Mercado Livre:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WEBHOOK: Amazon
router.post('/amazon', rawBodyMiddleware, async (req, res) => {
  try {
    const event = req.body;
    
    logger.info('Webhook Amazon recebido', {
      eventType: event.eventType,
      marketplaceId: event.marketplaceId
    });
    
    switch (event.eventType) {
      case 'ORDER_STATUS_CHANGE':
        await handleAmazonOrderStatusChange(event);
        break;
        
      case 'INVENTORY_UPDATE':
        await handleAmazonInventoryUpdate(event);
        break;
        
      default:
        logger.info('Evento Amazon não tratado', { type: event.eventType });
    }
    
    res.json({ received: true });
    
  } catch (error) {
    logger.error('Erro no webhook Amazon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handlers para eventos do Stripe
async function handleSubscriptionCreated(subscription) {
  try {
    const user = await User.findOne({ 'subscription.stripeCustomerId': subscription.customer });
    if (!user) {
      logger.warn('Usuário não encontrado para subscription criada', {
        customerId: subscription.customer,
        subscriptionId: subscription.id
      });
      return;
    }
    
    // Atualizar dados da assinatura
    user.subscription = {
      ...user.subscription,
      status: 'active',
      stripeSubscriptionId: subscription.id,
      plan: subscription.items.data[0].price.lookup_key || 'basic',
      amount: subscription.items.data[0].price.unit_amount / 100,
      currency: subscription.currency,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date()
    };
    
    await user.save();
    
    // Enviar email de confirmação
    await sendEmail({
      to: user.email,
      subject: 'Assinatura ativada - Place IA',
      template: 'subscription-activated',
      data: {
        name: user.name,
        plan: user.subscription.plan,
        amount: user.subscription.amount,
        nextBilling: user.subscription.currentPeriodEnd
      }
    });
    
    logger.info('Assinatura criada processada', {
      userId: user._id,
      subscriptionId: subscription.id,
      plan: user.subscription.plan
    });
    
  } catch (error) {
    logger.error('Erro ao processar subscription criada:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
    if (!user) {
      logger.warn('Usuário não encontrado para subscription atualizada', {
        subscriptionId: subscription.id
      });
      return;
    }
    
    const oldStatus = user.subscription.status;
    
    // Atualizar dados da assinatura
    user.subscription = {
      ...user.subscription,
      status: subscription.status,
      plan: subscription.items.data[0].price.lookup_key || user.subscription.plan,
      amount: subscription.items.data[0].price.unit_amount / 100,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date()
    };
    
    await user.save();
    
    // Enviar email se status mudou
    if (oldStatus !== subscription.status) {
      let template = 'subscription-updated';
      let subject = 'Assinatura atualizada - Place IA';
      
      if (subscription.status === 'canceled') {
        template = 'subscription-cancelled';
        subject = 'Assinatura cancelada - Place IA';
      } else if (subscription.status === 'past_due') {
        template = 'subscription-past-due';
        subject = 'Problema com pagamento - Place IA';
      }
      
      await sendEmail({
        to: user.email,
        subject,
        template,
        data: {
          name: user.name,
          plan: user.subscription.plan,
          status: subscription.status,
          nextBilling: user.subscription.currentPeriodEnd
        }
      });
    }
    
    logger.info('Assinatura atualizada processada', {
      userId: user._id,
      subscriptionId: subscription.id,
      oldStatus,
      newStatus: subscription.status
    });
    
  } catch (error) {
    logger.error('Erro ao processar subscription atualizada:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
    if (!user) {
      logger.warn('Usuário não encontrado para subscription deletada', {
        subscriptionId: subscription.id
      });
      return;
    }
    
    // Atualizar status da assinatura
    user.subscription.status = 'canceled';
    user.subscription.canceledAt = new Date();
    user.subscription.updatedAt = new Date();
    
    await user.save();
    
    // Enviar email de cancelamento
    await sendEmail({
      to: user.email,
      subject: 'Assinatura cancelada - Place IA',
      template: 'subscription-cancelled',
      data: {
        name: user.name,
        plan: user.subscription.plan,
        canceledAt: user.subscription.canceledAt
      }
    });
    
    logger.info('Assinatura deletada processada', {
      userId: user._id,
      subscriptionId: subscription.id
    });
    
  } catch (error) {
    logger.error('Erro ao processar subscription deletada:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const user = await User.findOne({ 'subscription.stripeCustomerId': invoice.customer });
    if (!user) {
      logger.warn('Usuário não encontrado para pagamento bem-sucedido', {
        customerId: invoice.customer,
        invoiceId: invoice.id
      });
      return;
    }
    
    // Registrar pagamento
    user.subscription.lastPayment = {
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      date: new Date(invoice.status_transitions.paid_at * 1000),
      invoiceId: invoice.id
    };
    
    user.subscription.updatedAt = new Date();
    await user.save();
    
    // Enviar email de confirmação
    await sendEmail({
      to: user.email,
      subject: 'Pagamento confirmado - Place IA',
      template: 'payment-confirmed',
      data: {
        name: user.name,
        amount: user.subscription.lastPayment.amount,
        currency: user.subscription.lastPayment.currency,
        date: user.subscription.lastPayment.date,
        invoiceUrl: invoice.hosted_invoice_url
      }
    });
    
    logger.info('Pagamento bem-sucedido processado', {
      userId: user._id,
      invoiceId: invoice.id,
      amount: invoice.amount_paid / 100
    });
    
  } catch (error) {
    logger.error('Erro ao processar pagamento bem-sucedido:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const user = await User.findOne({ 'subscription.stripeCustomerId': invoice.customer });
    if (!user) {
      logger.warn('Usuário não encontrado para pagamento falhado', {
        customerId: invoice.customer,
        invoiceId: invoice.id
      });
      return;
    }
    
    // Registrar falha no pagamento
    user.subscription.lastFailedPayment = {
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      date: new Date(),
      invoiceId: invoice.id,
      reason: 'payment_failed'
    };
    
    user.subscription.updatedAt = new Date();
    await user.save();
    
    // Enviar email de falha no pagamento
    await sendEmail({
      to: user.email,
      subject: 'Problema com pagamento - Place IA',
      template: 'payment-failed',
      data: {
        name: user.name,
        amount: user.subscription.lastFailedPayment.amount,
        currency: user.subscription.lastFailedPayment.currency,
        invoiceUrl: invoice.hosted_invoice_url,
        updatePaymentUrl: `${process.env.FRONTEND_URL}/dashboard/billing`
      }
    });
    
    logger.info('Pagamento falhado processado', {
      userId: user._id,
      invoiceId: invoice.id,
      amount: invoice.amount_due / 100
    });
    
  } catch (error) {
    logger.error('Erro ao processar pagamento falhado:', error);
  }
}

async function handleTrialWillEnd(subscription) {
  try {
    const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
    if (!user) {
      logger.warn('Usuário não encontrado para trial ending', {
        subscriptionId: subscription.id
      });
      return;
    }
    
    // Enviar email de aviso
    await sendEmail({
      to: user.email,
      subject: 'Seu período de teste está acabando - Place IA',
      template: 'trial-ending',
      data: {
        name: user.name,
        trialEnd: new Date(subscription.trial_end * 1000),
        upgradeUrl: `${process.env.FRONTEND_URL}/dashboard/billing`
      }
    });
    
    logger.info('Aviso de trial ending processado', {
      userId: user._id,
      subscriptionId: subscription.id,
      trialEnd: new Date(subscription.trial_end * 1000)
    });
    
  } catch (error) {
    logger.error('Erro ao processar trial ending:', error);
  }
}

// Handlers para eventos do PayPal
async function handlePayPalSubscriptionCreated(subscription) {
  // Implementar lógica similar ao Stripe
  logger.info('PayPal subscription created', { id: subscription.id });
}

async function handlePayPalSubscriptionUpdated(subscription) {
  // Implementar lógica similar ao Stripe
  logger.info('PayPal subscription updated', { id: subscription.id });
}

async function handlePayPalSubscriptionCancelled(subscription) {
  // Implementar lógica similar ao Stripe
  logger.info('PayPal subscription cancelled', { id: subscription.id });
}

async function handlePayPalPaymentCompleted(payment) {
  // Implementar lógica similar ao Stripe
  logger.info('PayPal payment completed', { id: payment.id });
}

async function handlePayPalPaymentDenied(payment) {
  // Implementar lógica similar ao Stripe
  logger.info('PayPal payment denied', { id: payment.id });
}

// Handlers para eventos do PagSeguro
async function handlePagSeguroTransaction(event) {
  // Implementar lógica do PagSeguro
  logger.info('PagSeguro transaction', { code: event.notificationCode });
}

async function handlePagSeguroPreApproval(event) {
  // Implementar lógica do PagSeguro
  logger.info('PagSeguro preApproval', { code: event.notificationCode });
}

// Handlers para eventos do Mercado Livre
async function handleMercadoLivreOrder(event) {
  try {
    // Buscar usuário pela configuração do Mercado Livre
    const user = await User.findOne({
      'marketplaceSettings.marketplace': 'mercadolivre',
      'marketplaceSettings.credentials.userId': event.user_id
    });
    
    if (!user) {
      logger.warn('Usuário não encontrado para pedido Mercado Livre', {
        userId: event.user_id,
        resource: event.resource
      });
      return;
    }
    
    // Aqui você faria uma chamada à API do Mercado Livre para buscar os detalhes do pedido
    // Por enquanto, apenas logar
    logger.info('Novo pedido Mercado Livre', {
      userId: user._id,
      resource: event.resource,
      mlUserId: event.user_id
    });
    
  } catch (error) {
    logger.error('Erro ao processar pedido Mercado Livre:', error);
  }
}

async function handleMercadoLivreItem(event) {
  logger.info('Item Mercado Livre atualizado', {
    resource: event.resource,
    userId: event.user_id
  });
}

async function handleMercadoLivreQuestion(event) {
  logger.info('Nova pergunta Mercado Livre', {
    resource: event.resource,
    userId: event.user_id
  });
}

// Handlers para eventos da Amazon
async function handleAmazonOrderStatusChange(event) {
  logger.info('Status de pedido Amazon alterado', {
    orderId: event.orderId,
    status: event.orderStatus
  });
}

async function handleAmazonInventoryUpdate(event) {
  logger.info('Estoque Amazon atualizado', {
    sku: event.sku,
    quantity: event.quantity
  });
}

// ROTA: Teste de webhook (apenas para desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req, res) => {
    try {
      const { type, data } = req.body;
      
      logger.info('Webhook de teste recebido', {
        type,
        data: JSON.stringify(data).substring(0, 200)
      });
      
      res.json({
        success: true,
        message: 'Webhook de teste processado',
        received: {
          type,
          timestamp: new Date(),
          ip: req.ip
        }
      });
      
    } catch (error) {
      logger.error('Erro no webhook de teste:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = router;