const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Importar clientes de IA
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Rate limiting para IA
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto
  message: {
    success: false,
    message: 'Muitas solicitações para IA. Tente novamente em 1 minuto.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  }
});

// Configurar clientes de IA
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Middleware de autenticação
router.use(authenticateToken);

// Validações
const chatValidation = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Mensagem deve ter entre 1 e 2000 caracteres'),
  body('context')
    .optional()
    .isString()
    .withMessage('Contexto deve ser uma string'),
  body('aiType')
    .optional()
    .isIn(['tata', 'marketing', 'technical', 'stock'])
    .withMessage('Tipo de IA inválido')
];

const analysisValidation = [
  body('type')
    .isIn(['product', 'sales', 'market', 'campaign'])
    .withMessage('Tipo de análise inválido'),
  body('data')
    .isObject()
    .withMessage('Dados são obrigatórios'),
  body('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year'])
    .withMessage('Período inválido')
];

// Função para escolher provedor de IA baseado na disponibilidade
const getAvailableAIProvider = async () => {
  const providers = [
    { name: 'openai', client: openai, available: !!process.env.OPENAI_API_KEY },
    { name: 'anthropic', client: anthropic, available: !!process.env.ANTHROPIC_API_KEY },
    { name: 'google', client: googleAI, available: !!process.env.GOOGLE_AI_API_KEY }
  ];
  
  // Retornar primeiro provedor disponível
  return providers.find(provider => provider.available) || null;
};

// Função para gerar resposta com fallback entre provedores
const generateAIResponse = async (prompt, context = '', aiType = 'tata') => {
  const providers = [
    { name: 'openai', client: openai, available: !!process.env.OPENAI_API_KEY },
    { name: 'anthropic', client: anthropic, available: !!process.env.ANTHROPIC_API_KEY },
    { name: 'google', client: googleAI, available: !!process.env.GOOGLE_AI_API_KEY }
  ];
  
  for (const provider of providers) {
    if (!provider.available) continue;
    
    try {
      let response;
      
      switch (provider.name) {
        case 'openai':
          const systemPrompt = getSystemPrompt(aiType);
          const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${context}\n\n${prompt}` }
            ],
            max_tokens: 1000,
            temperature: 0.7
          });
          response = completion.choices[0].message.content;
          break;
          
        case 'anthropic':
          const anthropicPrompt = `${getSystemPrompt(aiType)}\n\nContexto: ${context}\n\nUsuário: ${prompt}\n\nAssistente:`;
          const anthropicResponse = await anthropic.completions.create({
            model: 'claude-3-sonnet-20240229',
            prompt: anthropicPrompt,
            max_tokens: 1000,
            temperature: 0.7
          });
          response = anthropicResponse.completion;
          break;
          
        case 'google':
          const model = googleAI.getGenerativeModel({ model: 'gemini-pro' });
          const googlePrompt = `${getSystemPrompt(aiType)}\n\nContexto: ${context}\n\nUsuário: ${prompt}`;
          const result = await model.generateContent(googlePrompt);
          response = result.response.text();
          break;
      }
      
      return {
        success: true,
        response,
        provider: provider.name
      };
      
    } catch (error) {
      logger.error(`Erro no provedor ${provider.name}:`, error);
      continue; // Tentar próximo provedor
    }
  }
  
  // Se todos os provedores falharam
  throw new Error('Todos os provedores de IA estão indisponíveis');
};

// Função para obter prompt do sistema baseado no tipo de IA
const getSystemPrompt = (aiType) => {
  const basePrompt = `Você é uma assistente de IA especializada em e-commerce e marketplace, trabalhando para a Place IA. 
Sempre responda em português brasileiro de forma amigável e profissional.`;
  
  switch (aiType) {
    case 'tata':
      return `${basePrompt}

Você é a TaTa, uma assistente virtual amigável e carismática da Place IA. 
Sua personalidade é:
- Amigável e acolhedora
- Proativa em ajudar
- Conhecedora de e-commerce e marketplaces
- Sempre positiva e motivadora
- Usa emojis ocasionalmente para ser mais expressiva

Você ajuda os usuários com:
- Análise de vendas e produtos
- Sugestões de melhorias
- Dúvidas sobre a plataforma
- Estratégias de marketing
- Gestão de estoque

Sempre termine suas respostas perguntando se pode ajudar com mais alguma coisa.`;
      
    case 'marketing':
      return `${basePrompt}

Você é especialista em marketing digital e publicidade para e-commerce.
Foque em:
- Estratégias de anúncios (Google Ads, Meta, TikTok)
- Otimização de campanhas
- Análise de ROI e ROAS
- Segmentação de público
- Copy e criativos
- Tendências de mercado`;
      
    case 'technical':
      return `${basePrompt}

Você é especialista técnico em integrações e automações.
Foque em:
- Diagnóstico de problemas técnicos
- Integrações com marketplaces
- APIs e webhooks
- Automações de processos
- Sincronização de dados
- Troubleshooting`;
      
    case 'stock':
      return `${basePrompt}

Você é especialista em gestão de estoque e logística.
Foque em:
- Controle de estoque
- Previsão de demanda
- Reposição automática
- Análise de giro de produtos
- Otimização de armazenagem
- Gestão de fornecedores`;
      
    default:
      return basePrompt;
  }
};

// Função para obter contexto do usuário
const getUserContext = async (userId) => {
  try {
    const [user, recentSales, topProducts, lowStockProducts] = await Promise.all([
      User.findById(userId).select('name company subscription marketplace'),
      Sale.find({ owner: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('items.productId', 'name sku'),
      Product.find({ owner: userId })
        .sort({ 'metrics.totalSold': -1 })
        .limit(5)
        .select('name sku metrics'),
      Product.find({
        owner: userId,
        $expr: { $lte: ['$stock.quantity', '$stock.minQuantity'] }
      })
        .limit(5)
        .select('name sku stock')
    ]);
    
    return {
      user: {
        name: user.name,
        company: user.company?.name || 'Empresa',
        plan: user.subscription?.plan || 'Básico',
        marketplaces: user.marketplace?.connectedPlatforms || []
      },
      recentSales: recentSales.length,
      topProducts: topProducts.map(p => ({ name: p.name, sku: p.sku, sold: p.metrics.totalSold })),
      lowStockProducts: lowStockProducts.map(p => ({ name: p.name, sku: p.sku, stock: p.stock.quantity }))
    };
  } catch (error) {
    logger.error('Erro ao obter contexto do usuário:', error);
    return {};
  }
};

// ROTA: Chat com TaTa IA
router.post('/chat', aiLimiter, chatValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { message, context = '', aiType = 'tata' } = req.body;
    const userId = req.user.id;
    
    // Obter contexto do usuário
    const userContext = await getUserContext(userId);
    const fullContext = `${context}\n\nContexto do usuário: ${JSON.stringify(userContext, null, 2)}`;
    
    // Gerar resposta da IA
    const aiResponse = await generateAIResponse(message, fullContext, aiType);
    
    // Log da interação
    logger.info('Interação com IA', {
      userId,
      aiType,
      provider: aiResponse.provider,
      messageLength: message.length
    });
    
    res.json({
      success: true,
      data: {
        message: aiResponse.response,
        aiType,
        provider: aiResponse.provider,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro no chat com IA:', error);
    
    // Resposta de fallback
    const fallbackResponses = {
      tata: 'Oi! 😊 Desculpe, estou com um probleminha técnico no momento. Mas não se preocupe, nossa equipe já está cuidando disso! Enquanto isso, você pode verificar seu dashboard ou entrar em contato com nosso suporte. Posso ajudar com mais alguma coisa?',
      marketing: 'Desculpe, estou temporariamente indisponível. Para estratégias de marketing, recomendo verificar suas campanhas ativas no painel ou consultar nossos relatórios de performance.',
      technical: 'Sistema temporariamente indisponível. Para questões técnicas urgentes, consulte nossa documentação ou entre em contato com o suporte técnico.',
      stock: 'Serviço temporariamente indisponível. Para gestão de estoque, acesse o relatório de produtos no seu dashboard.'
    };
    
    res.json({
      success: true,
      data: {
        message: fallbackResponses[req.body.aiType] || fallbackResponses.tata,
        aiType: req.body.aiType || 'tata',
        provider: 'fallback',
        timestamp: new Date()
      }
    });
  }
});

// ROTA: Análise inteligente
router.post('/analyze', aiLimiter, analysisValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { type, data, period = 'month' } = req.body;
    const userId = req.user.id;
    
    let analysisPrompt = '';
    let context = '';
    
    switch (type) {
      case 'product':
        analysisPrompt = `Analise este produto e forneça insights sobre performance, otimizações e estratégias de venda:`;
        context = `Dados do produto: ${JSON.stringify(data, null, 2)}`;
        break;
        
      case 'sales':
        analysisPrompt = `Analise estes dados de vendas e forneça insights sobre tendências, oportunidades e recomendações:`;
        context = `Dados de vendas (${period}): ${JSON.stringify(data, null, 2)}`;
        break;
        
      case 'market':
        analysisPrompt = `Analise este mercado/categoria e forneça insights sobre concorrência, preços e oportunidades:`;
        context = `Dados de mercado: ${JSON.stringify(data, null, 2)}`;
        break;
        
      case 'campaign':
        analysisPrompt = `Analise esta campanha publicitária e forneça insights sobre performance e otimizações:`;
        context = `Dados da campanha: ${JSON.stringify(data, null, 2)}`;
        break;
    }
    
    // Gerar análise
    const aiResponse = await generateAIResponse(analysisPrompt, context, 'marketing');
    
    // Log da análise
    logger.info('Análise IA realizada', {
      userId,
      type,
      period,
      provider: aiResponse.provider
    });
    
    res.json({
      success: true,
      data: {
        analysis: aiResponse.response,
        type,
        period,
        provider: aiResponse.provider,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro na análise IA:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar análise'
    });
  }
});

// ROTA: Sugestões automáticas
router.get('/suggestions', async (req, res) => {
  try {
    const { type = 'general' } = req.query;
    const userId = req.user.id;
    
    // Obter dados do usuário para sugestões
    const userContext = await getUserContext(userId);
    
    let suggestionsPrompt = '';
    
    switch (type) {
      case 'marketing':
        suggestionsPrompt = 'Baseado nos dados do usuário, sugira 3 estratégias de marketing específicas e acionáveis:';
        break;
      case 'products':
        suggestionsPrompt = 'Baseado nos produtos e vendas, sugira 3 otimizações para melhorar a performance:';
        break;
      case 'stock':
        suggestionsPrompt = 'Baseado no estoque atual, sugira 3 ações para otimizar a gestão:';
        break;
      default:
        suggestionsPrompt = 'Baseado no perfil do usuário, sugira 3 ações prioritárias para melhorar os resultados:';
    }
    
    const context = `Dados do usuário: ${JSON.stringify(userContext, null, 2)}`;
    
    // Gerar sugestões
    const aiResponse = await generateAIResponse(suggestionsPrompt, context, 'tata');
    
    res.json({
      success: true,
      data: {
        suggestions: aiResponse.response,
        type,
        provider: aiResponse.provider,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Erro ao gerar sugestões:', error);
    
    // Sugestões de fallback
    const fallbackSuggestions = {
      general: [
        '📊 Analise seus produtos mais vendidos e invista em estoque',
        '🎯 Configure campanhas de remarketing para aumentar conversões',
        '📱 Otimize suas descrições de produtos com palavras-chave relevantes'
      ],
      marketing: [
        '🎯 Teste diferentes públicos-alvo em suas campanhas',
        '📸 Invista em imagens de alta qualidade para seus produtos',
        '💰 Ajuste seus lances baseado no ROI de cada campanha'
      ],
      products: [
        '🏷️ Revise os preços dos produtos com baixa conversão',
        '📝 Melhore as descrições dos produtos mais visualizados',
        '⭐ Incentive avaliações dos clientes satisfeitos'
      ],
      stock: [
        '📦 Configure alertas para produtos com estoque baixo',
        '📈 Analise a sazonalidade para planejar reposições',
        '🔄 Automatize pedidos para fornecedores confiáveis'
      ]
    };
    
    res.json({
      success: true,
      data: {
        suggestions: fallbackSuggestions[req.query.type] || fallbackSuggestions.general,
        type: req.query.type || 'general',
        provider: 'fallback',
        timestamp: new Date()
      }
    });
  }
});

// ROTA: Histórico de conversas
router.get('/chat/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, aiType } = req.query;
    const userId = req.user.id;
    
    // Aqui você implementaria um sistema de histórico de conversas
    // Por enquanto, retornar dados mockados
    const history = {
      docs: [
        {
          id: '1',
          message: 'Como estão minhas vendas este mês?',
          response: 'Suas vendas estão ótimas! 📈 Você vendeu 45 produtos este mês...',
          aiType: 'tata',
          timestamp: new Date()
        },
        {
          id: '2',
          message: 'Quais produtos estão com estoque baixo?',
          response: 'Identifiquei 3 produtos com estoque baixo que precisam de atenção...',
          aiType: 'stock',
          timestamp: new Date(Date.now() - 3600000)
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
        history: history.docs,
        pagination: {
          currentPage: history.page,
          totalPages: history.totalPages,
          totalDocs: history.totalDocs,
          hasNextPage: history.hasNextPage,
          hasPrevPage: history.hasPrevPage
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

// ROTA: Status dos provedores de IA
router.get('/status', async (req, res) => {
  try {
    const providers = [
      {
        name: 'OpenAI',
        key: 'openai',
        available: !!process.env.OPENAI_API_KEY,
        status: 'active'
      },
      {
        name: 'Anthropic',
        key: 'anthropic',
        available: !!process.env.ANTHROPIC_API_KEY,
        status: 'active'
      },
      {
        name: 'Google AI',
        key: 'google',
        available: !!process.env.GOOGLE_AI_API_KEY,
        status: 'active'
      }
    ];
    
    const activeProviders = providers.filter(p => p.available);
    
    res.json({
      success: true,
      data: {
        providers,
        activeCount: activeProviders.length,
        totalCount: providers.length,
        primaryProvider: activeProviders[0]?.key || null
      }
    });
    
  } catch (error) {
    logger.error('Erro ao verificar status dos provedores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;