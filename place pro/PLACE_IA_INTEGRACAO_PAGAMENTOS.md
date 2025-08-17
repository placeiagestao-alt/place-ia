start

# INTEGRAÇÃO DE PAGAMENTOS - PLACE IA

![Logo Place IA](logo_placeholder.png)

## DOCUMENTO TÉCNICO - SISTEMA DE PAGAMENTOS

*Este documento detalha a implementação técnica do sistema de pagamentos da Place IA, incluindo gateways, fluxos de processamento, gestão de assinaturas e integrações com o painel administrativo e do cliente.*

---

## ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Gateway Principal - Stripe](#gateway-principal---stripe)
3. [Gateways Alternativos](#gateways-alternativos)
4. [Planos e Assinaturas](#planos-e-assinaturas)
5. [Fluxo de Pagamento](#fluxo-de-pagamento)
6. [Gestão de Assinaturas](#gestão-de-assinaturas)
7. [Webhooks e Notificações](#webhooks-e-notificações)
8. [Integração com Painéis](#integração-com-painéis)
9. [Segurança e Conformidade](#segurança-e-conformidade)
10. [Relatórios e Reconciliação](#relatórios-e-reconciliação)

---

## VISÃO GERAL

### Arquitetura do Sistema de Pagamentos

O sistema de pagamentos da Place IA foi projetado para oferecer flexibilidade, segurança e uma experiência fluida tanto para clientes quanto para administradores. A arquitetura implementa um modelo de múltiplos gateways com Stripe como solução principal, complementado por alternativas nacionais para atender às preferências específicas do mercado brasileiro.

### Componentes Principais

- **Processador de Pagamentos**: Módulo central que coordena transações entre gateways
- **Gerenciador de Assinaturas**: Controle de ciclos de cobrança e renovações
- **Sistema de Notificações**: Alertas para clientes e administradores
- **Módulo de Relatórios**: Consolidação de dados financeiros
- **API de Integração**: Endpoints para comunicação com gateways

### Fluxo de Dados

```
Cliente → Seleção de Plano → Checkout → Gateway → Confirmação → Ativação de Acesso
```

---

## GATEWAY PRINCIPAL - STRIPE

### Justificativa da Escolha

O Stripe foi selecionado como gateway principal devido a:

- **Estabilidade**: Infraestrutura robusta com alta disponibilidade
- **API Completa**: Documentação extensa e recursos avançados
- **Suporte a Assinaturas**: Gerenciamento nativo de cobranças recorrentes
- **Flexibilidade de Moedas**: Suporte a BRL, USD e outras moedas
- **Segurança**: Conformidade com PCI DSS e padrões internacionais

### Implementação Técnica

#### Configuração Inicial

```javascript
// Inicialização do Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configuração de Webhook
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
```

#### Criação de Clientes

```javascript
// Criação de cliente no Stripe
async function createStripeCustomer(userData) {
  const customer = await stripe.customers.create({
    name: userData.name,
    email: userData.email,
    metadata: {
      user_id: userData.id,
      tax_id: userData.tax_id
    }
  });
  
  return customer.id;
}
```

#### Processamento de Pagamentos

```javascript
// Criação de sessão de checkout
async function createCheckoutSession(customerId, priceId) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.DOMAIN}/canceled`,
  });
  
  return session;
}
```

#### Integração com Pix

```javascript
// Criação de cobrança Pix
async function createPixPayment(amount, customerId, description) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'brl',
    customer: customerId,
    description: description,
    payment_method_types: ['pix'],
  });
  
  return paymentIntent;
}
```

---

## GATEWAYS ALTERNATIVOS

### Pagar.me (Stone)

#### Características Principais

- Foco no mercado nacional brasileiro
- Suporte nativo a Pix, boleto e cartão
- Documentação em português
- Suporte técnico nacional

#### Implementação

```javascript
// Inicialização do Pagar.me
const pagarme = require('pagarme');

async function createPagarmeClient() {
  const client = await pagarme.client.connect({
    api_key: process.env.PAGARME_API_KEY
  });
  
  return client;
}

// Criação de transação
async function createTransaction(client, paymentData) {
  const transaction = await client.transactions.create({
    amount: paymentData.amount,
    payment_method: paymentData.method,
    card_id: paymentData.card_id,
    customer: {
      name: paymentData.customer.name,
      email: paymentData.customer.email,
      external_id: paymentData.customer.id,
      documents: [
        {
          type: 'cpf',
          number: paymentData.customer.tax_id
        }
      ]
    }
  });
  
  return transaction;
}
```

### Asaas

#### Características Principais

- Integração simplificada
- Cobranças recorrentes com notificações via WhatsApp
- Gestão de inadimplência automatizada
- Emissão de boletos e links de pagamento

#### Implementação

```javascript
// Inicialização do Asaas
const axios = require('axios');
const asaasApi = axios.create({
  baseURL: 'https://www.asaas.com/api/v3',
  headers: {
    'access_token': process.env.ASAAS_API_KEY
  }
});

// Criação de cliente
async function createAsaasCustomer(userData) {
  const response = await asaasApi.post('/customers', {
    name: userData.name,
    email: userData.email,
    cpfCnpj: userData.tax_id,
    externalReference: userData.id
  });
  
  return response.data.id;
}

// Criação de assinatura
async function createAsaasSubscription(customerId, planData) {
  const response = await asaasApi.post('/subscriptions', {
    customer: customerId,
    billingType: planData.payment_method,
    value: planData.amount,
    nextDueDate: planData.start_date,
    cycle: planData.interval
  });
  
  return response.data;
}
```

### Iugu

#### Características Principais

- Especializado em modelos SaaS
- Painel intuitivo para gestão de assinaturas
- Suporte a cartão, Pix e boleto
- Ferramentas de análise de receita recorrente

### Juno

#### Características Principais

- Checkout simplificado
- Suporte a Pix, boleto e cartão
- Split de pagamentos para marketplace
- Antecipação de recebíveis

### Gerencianet

#### Características Principais

- Especializado em Pix automático
- Links de cobrança personalizáveis
- Integração fácil
- Notificações automáticas

---

## PLANOS E ASSINATURAS

### Estrutura de Planos

#### Plano Gratuito

- **Duração**: 7 dias (período de teste)
- **Recursos**: Acesso básico ao dashboard, limite de 50 produtos
- **Conversão**: Transição automática para plano pago ou limitação de funcionalidades

#### Plano Mensal

- **Valor**: R$ 99,90/mês
- **Ciclo de Cobrança**: Mensal
- **Recursos**: Acesso completo, produtos ilimitados, suporte prioritário

#### Plano Anual

- **Valor**: R$ 999,00/ano (economia de 16%)
- **Ciclo de Cobrança**: Anual
- **Recursos**: Todos os recursos do plano mensal + relatórios avançados

#### Plano Personalizado

- **Valor**: Negociado individualmente
- **Ciclo de Cobrança**: Flexível
- **Recursos**: Adaptados às necessidades específicas do cliente

### Implementação no Stripe

```javascript
// Criação de produtos e preços no Stripe
async function setupStripePlans() {
  // Produto base
  const product = await stripe.products.create({
    name: 'Place IA',
    description: 'Plataforma de gestão e impulsão para marketplaces',
  });
  
  // Plano mensal
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 9990, // R$ 99,90 em centavos
    currency: 'brl',
    recurring: {
      interval: 'month',
    },
    metadata: {
      plan_type: 'monthly'
    }
  });
  
  // Plano anual
  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 99900, // R$ 999,00 em centavos
    currency: 'brl',
    recurring: {
      interval: 'year',
    },
    metadata: {
      plan_type: 'yearly'
    }
  });
  
  return {
    product: product.id,
    monthly: monthlyPrice.id,
    yearly: yearlyPrice.id
  };
}
```

---

## FLUXO DE PAGAMENTO

### Processo de Checkout

1. **Seleção de Plano**: Usuário escolhe entre planos disponíveis
2. **Escolha de Gateway**: Seleção entre Stripe (padrão) ou alternativas
3. **Preenchimento de Dados**: Informações pessoais e de pagamento
4. **Processamento**: Envio seguro para o gateway selecionado
5. **Confirmação**: Validação da transação e feedback ao usuário
6. **Ativação**: Liberação imediata de acesso após confirmação

### Implementação de Interface

```javascript
// Frontend - Componente de seleção de plano
function PlanSelector({ onSelect }) {
  const plans = [
    { id: 'free', name: 'Gratuito', price: 0, interval: null, features: [...] },
    { id: 'monthly', name: 'Mensal', price: 99.90, interval: 'month', features: [...] },
    { id: 'yearly', name: 'Anual', price: 999.00, interval: 'year', features: [...] }
  ];
  
  return (
    <div className="plan-selector">
      {plans.map(plan => (
        <div key={plan.id} className="plan-card">
          <h3>{plan.name}</h3>
          <p className="price">
            {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
            {plan.interval && `/${plan.interval === 'month' ? 'mês' : 'ano'}`}
          </p>
          <ul className="features">
            {plan.features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
          <button onClick={() => onSelect(plan)}>Assinar agora</button>
        </div>
      ))}
    </div>
  );
}
```

### Integração com Backend

```javascript
// Rota de criação de checkout
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { planId, gatewayId = 'stripe' } = req.body;
    const userId = req.user.id;
    
    // Obter dados do usuário
    const user = await getUserById(userId);
    
    // Criar checkout baseado no gateway selecionado
    let checkoutData;
    
    switch (gatewayId) {
      case 'stripe':
        const stripeCustomerId = user.stripe_customer_id || await createStripeCustomer(user);
        checkoutData = await createStripeCheckout(stripeCustomerId, planId);
        break;
      case 'pagarme':
        checkoutData = await createPagarmeCheckout(user, planId);
        break;
      // Outros gateways...
      default:
        throw new Error('Gateway de pagamento não suportado');
    }
    
    res.json({ success: true, checkout: checkoutData });
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## GESTÃO DE ASSINATURAS

### Ciclo de Vida da Assinatura

1. **Criação**: Após confirmação do primeiro pagamento
2. **Ativa**: Durante período pago com acesso completo
3. **Pendente de Renovação**: Próximo do vencimento
4. **Falha de Pagamento**: Tentativas de recobrança
5. **Cancelada**: Por solicitação do cliente ou inadimplência
6. **Upgrade/Downgrade**: Mudança entre planos

### Implementação de Renovação Automática

```javascript
// Webhook para processar eventos do Stripe
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Processar eventos de assinatura
  switch (event.type) {
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      await handleSuccessfulPayment(invoice);
      break;
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      await handleFailedPayment(failedInvoice);
      break;
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await handleSubscriptionUpdate(subscription);
      break;
    case 'customer.subscription.deleted':
      const canceledSubscription = event.data.object;
      await handleSubscriptionCancellation(canceledSubscription);
      break;
  }
  
  res.json({received: true});
});
```

### Cancelamento Automático

```javascript
// Função para processar cancelamento após falhas recorrentes
async function handleFailedPayment(invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const customer = await stripe.customers.retrieve(invoice.customer);
  const userId = customer.metadata.user_id;
  
  // Verificar número de tentativas
  if (invoice.attempt_count >= 3) {
    // Cancelar assinatura após 3 tentativas
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });
    
    // Atualizar status no banco de dados
    await updateUserSubscriptionStatus(userId, 'canceling');
    
    // Enviar notificação ao usuário
    await sendSubscriptionCancellationNotice(userId, 'payment_failure');
  } else {
    // Notificar sobre falha de pagamento
    await sendPaymentFailureNotice(userId, invoice.attempt_count);
  }
}
```

### Upgrade e Downgrade

```javascript
// Função para processar mudança de plano
async function changeSubscriptionPlan(userId, newPlanId) {
  // Obter dados do usuário e assinatura atual
  const user = await getUserById(userId);
  const subscription = await stripe.subscriptions.retrieve(user.subscription_id);
  
  // Calcular ajuste proporcional
  const proration = calculateProration(subscription, newPlanId);
  
  // Atualizar assinatura
  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPlanId,
    }],
    proration_behavior: 'always_invoice'
  });
  
  // Atualizar registro no banco de dados
  await updateUserSubscription(userId, {
    plan_id: newPlanId,
    subscription_data: updatedSubscription
  });
  
  // Enviar confirmação ao usuário
  await sendPlanChangeConfirmation(userId, newPlanId, proration);
  
  return updatedSubscription;
}
```

---

## WEBHOOKS E NOTIFICAÇÕES

### Eventos Monitorados

- **payment.succeeded**: Pagamento realizado com sucesso
- **payment.failed**: Falha no processamento do pagamento
- **subscription.created**: Nova assinatura criada
- **subscription.updated**: Assinatura atualizada (upgrade/downgrade)
- **subscription.canceled**: Assinatura cancelada
- **subscription.renewed**: Assinatura renovada automaticamente

### Implementação de Notificações

```javascript
// Sistema de notificações
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Configuração de e-mail
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Configuração de SMS
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Envio de notificação de cobrança
async function sendPaymentReminder(userId, daysUntilRenewal) {
  const user = await getUserById(userId);
  
  // Enviar e-mail
  await emailTransporter.sendMail({
    from: '"Place IA" <financeiro@placeai.com.br>',
    to: user.email,
    subject: `Sua assinatura será renovada em ${daysUntilRenewal} dias`,
    html: generatePaymentReminderTemplate(user, daysUntilRenewal)
  });
  
  // Enviar SMS se estiver próximo do vencimento
  if (daysUntilRenewal <= 1 && user.phone) {
    await smsClient.messages.create({
      body: `Place IA: Sua assinatura será renovada amanhã. Valor: R$ ${user.subscription_amount.toFixed(2)}. Acesse sua conta para mais detalhes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phone
    });
  }
}
```

### Agendamento de Notificações

```javascript
// Agendador de notificações de cobrança
const cron = require('node-cron');

// Executa diariamente à meia-noite
cron.schedule('0 0 * * *', async () => {
  try {
    // Buscar assinaturas próximas do vencimento
    const subscriptions = await getUpcomingRenewals();
    
    for (const sub of subscriptions) {
      const daysUntilRenewal = calculateDaysUntilRenewal(sub.renewal_date);
      
      // Enviar lembretes em 7 dias e 1 dia antes
      if (daysUntilRenewal === 7 || daysUntilRenewal === 1) {
        await sendPaymentReminder(sub.user_id, daysUntilRenewal);
      }
    }
  } catch (error) {
    console.error('Erro ao processar notificações de renovação:', error);
  }
});
```

---

## INTEGRAÇÃO COM PAINÉIS

### Painel do Cliente

#### Visualização de Assinatura

```javascript
// API para obter detalhes da assinatura do cliente
app.get('/api/subscription', async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionData = await getUserSubscription(userId);
    
    // Formatar dados para exibição
    const formattedData = {
      plan: subscriptionData.plan,
      status: subscriptionData.status,
      current_period: {
        start: new Date(subscriptionData.current_period_start * 1000),
        end: new Date(subscriptionData.current_period_end * 1000)
      },
      payment_method: {
        type: subscriptionData.payment_method.type,
        last4: subscriptionData.payment_method.last4 || null,
        brand: subscriptionData.payment_method.brand || null
      },
      invoices: await getUserInvoices(userId)
    };
    
    res.json({ success: true, subscription: formattedData });
  } catch (error) {
    console.error('Erro ao obter dados da assinatura:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Interface de Gerenciamento

```javascript
// Componente de gerenciamento de assinatura
function SubscriptionManager({ subscription, onUpgrade, onDowngrade, onCancel }) {
  return (
    <div className="subscription-manager">
      <div className="current-plan">
        <h3>Seu Plano: {subscription.plan.name}</h3>
        <p className="status">Status: {formatStatus(subscription.status)}</p>
        <p className="period">
          Período atual: {formatDate(subscription.current_period.start)} a {formatDate(subscription.current_period.end)}
        </p>
        <p className="payment">
          Forma de pagamento: {formatPaymentMethod(subscription.payment_method)}
        </p>
      </div>
      
      <div className="actions">
        <button onClick={onUpgrade} disabled={subscription.plan.id === 'yearly'}>Fazer upgrade</button>
        <button onClick={onDowngrade} disabled={subscription.plan.id === 'monthly'}>Fazer downgrade</button>
        <button className="cancel" onClick={onCancel}>Cancelar assinatura</button>
      </div>
      
      <div className="invoices">
        <h4>Histórico de Pagamentos</h4>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Recibo</th>
            </tr>
          </thead>
          <tbody>
            {subscription.invoices.map(invoice => (
              <tr key={invoice.id}>
                <td>{formatDate(invoice.date)}</td>
                <td>R$ {invoice.amount.toFixed(2)}</td>
                <td>{formatInvoiceStatus(invoice.status)}</td>
                <td>
                  {invoice.receipt_url && (
                    <a href={invoice.receipt_url} target="_blank" rel="noopener noreferrer">Ver recibo</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Painel Administrativo

#### Visão Geral de Assinaturas

```javascript
// API para obter todas as assinaturas (admin)
app.get('/api/admin/subscriptions', async (req, res) => {
  try {
    // Verificar permissão de administrador
    if (!req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    }
    
    // Parâmetros de filtro e paginação
    const { status, plan, page = 1, limit = 20 } = req.query;
    
    // Buscar assinaturas com filtros
    const subscriptions = await getSubscriptions({ status, plan, page, limit });
    
    res.json({
      success: true,
      subscriptions: subscriptions.data,
      pagination: {
        total: subscriptions.total,
        pages: Math.ceil(subscriptions.total / limit),
        current: page
      }
    });
  } catch (error) {
    console.error('Erro ao obter assinaturas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Ações Administrativas

```javascript
// API para ações administrativas em assinaturas
app.post('/api/admin/subscriptions/:id/action', async (req, res) => {
  try {
    // Verificar permissão de administrador
    if (!req.user.is_admin) {
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    }
    
    const { id } = req.params;
    const { action, reason } = req.body;
    
    let result;
    
    switch (action) {
      case 'cancel':
        result = await adminCancelSubscription(id, reason);
        break;
      case 'pause':
        result = await adminPauseSubscription(id, reason);
        break;
      case 'resume':
        result = await adminResumeSubscription(id);
        break;
      case 'refund':
        result = await adminRefundSubscription(id, req.body.amount, reason);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Ação inválida' });
    }
    
    // Registrar ação administrativa
    await logAdminAction(req.user.id, action, id, reason);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Erro ao executar ação administrativa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## SEGURANÇA E CONFORMIDADE

### Proteção de Dados Sensíveis

- **Tokenização**: Armazenamento seguro de métodos de pagamento
- **Criptografia**: Proteção de dados em trânsito e em repouso
- **Acesso Limitado**: Restrição de visualização de dados financeiros
- **Mascaramento**: Exibição parcial de números de cartão e documentos

### Conformidade com Regulamentações

- **PCI DSS**: Conformidade com padrões de segurança de cartões
- **LGPD**: Proteção de dados pessoais conforme legislação brasileira
- **Termos de Serviço**: Documentação clara sobre cobranças e cancelamentos
- **Políticas de Reembolso**: Regras transparentes para devoluções

### Implementação de Segurança

```javascript
// Middleware de proteção de rotas sensíveis
function securePaymentRoute(req, res, next) {
  // Verificar autenticação
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  
  // Verificar CSRF token para operações sensíveis
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken || !validateCsrfToken(req.user.id, csrfToken)) {
    return res.status(403).json({ success: false, error: 'Token inválido' });
  }
  
  // Registrar tentativa de acesso para auditoria
  logSecurityEvent({
    user_id: req.user.id,
    action: 'payment_route_access',
    route: req.originalUrl,
    ip: req.ip
  });
  
  next();
}

// Aplicar middleware em rotas de pagamento
app.use('/api/payments', securePaymentRoute);
app.use('/api/subscriptions', securePaymentRoute);
```

---

## RELATÓRIOS E RECONCILIAÇÃO

### Relatórios Financeiros

- **Receita Recorrente**: MRR (Monthly Recurring Revenue) e ARR (Annual Recurring Revenue)
- **Churn Rate**: Taxa de cancelamento de assinaturas
- **LTV (Lifetime Value)**: Valor do cliente ao longo do tempo
- **Conversão de Trial**: Taxa de conversão do plano gratuito para pago

### Reconciliação Contábil

- **Conciliação Automática**: Verificação entre transações e pagamentos recebidos
- **Detecção de Discrepâncias**: Identificação de valores inconsistentes
- **Exportação para Contabilidade**: Geração de relatórios para integração contábil
- **Auditoria**: Trilha completa de transações para verificação

### Implementação de Relatórios

```javascript
// Geração de relatório financeiro
async function generateFinancialReport(period) {
  // Definir intervalo de datas
  const { startDate, endDate } = calculateReportPeriod(period);
  
  // Buscar dados de transações
  const transactions = await getTransactionsInPeriod(startDate, endDate);
  
  // Calcular métricas
  const metrics = {
    total_revenue: calculateTotalRevenue(transactions),
    mrr: calculateMRR(transactions),
    arr: calculateARR(transactions),
    new_subscriptions: countNewSubscriptions(transactions),
    cancellations: countCancellations(transactions),
    churn_rate: calculateChurnRate(transactions),
    average_ticket: calculateAverageTicket(transactions),
    revenue_by_plan: calculateRevenueByPlan(transactions),
    revenue_by_gateway: calculateRevenueByGateway(transactions)
  };
  
  // Gerar gráficos
  const charts = {
    revenue_trend: generateRevenueTrendChart(transactions),
    plan_distribution: generatePlanDistributionChart(transactions),
    gateway_distribution: generateGatewayDistributionChart(transactions)
  };
  
  return {
    period: {
      start: startDate,
      end: endDate
    },
    metrics,
    charts,
    transactions: formatTransactionsForReport(transactions)
  };
}
```

---

*Este documento deve ser revisado e atualizado trimestralmente pela equipe de desenvolvimento.*

**Última atualização:** [DATA]

**Versão:** 1.0

---

© 2023 PLACE IA - Todos os direitos reservados