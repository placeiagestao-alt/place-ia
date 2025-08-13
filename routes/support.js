const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para chat
const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // máximo 20 mensagens por minuto
  message: {
    success: false,
    message: 'Muitas mensagens enviadas. Tente novamente em alguns segundos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para criação de tickets
const ticketRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 3, // máximo 3 tickets por 5 minutos
  message: {
    success: false,
    message: 'Limite de tickets atingido. Aguarde alguns minutos antes de criar um novo ticket.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de autenticação (opcional para algumas rotas)
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    // Se tem token, usar autenticação normal
    authenticateToken(req, res, next);
  } else {
    // Se não tem token, continuar sem usuário
    req.user = null;
    next();
  }
};

// Validações
const chatMessageValidation = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Mensagem deve ter entre 1 e 1000 caracteres'),
  body('sessionId')
    .optional()
    .isLength({ min: 10, max: 50 })
    .withMessage('ID da sessão inválido')
];

const ticketValidation = [
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Assunto deve ter entre 5 e 200 caracteres'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Mensagem deve ter entre 10 e 5000 caracteres'),
  body('category')
    .isIn(['technical', 'billing', 'general', 'feature_request', 'bug_report'])
    .withMessage('Categoria inválida'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Prioridade inválida'),
  body('email')
    .if(body('email').exists())
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido'),
  body('name')
    .if(body('name').exists())
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
];

const ticketReplyValidation = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Mensagem deve ter entre 1 e 5000 caracteres'),
  body('isInternal')
    .optional()
    .isBoolean()
    .withMessage('isInternal deve ser boolean')
];

// Função para gerar resposta da IA de suporte
const generateSupportAIResponse = (message, userContext = null) => {
  const lowerMessage = message.toLowerCase();
  
  // Respostas baseadas em palavras-chave
  if (lowerMessage.includes('login') || lowerMessage.includes('entrar') || lowerMessage.includes('senha')) {
    return {
      message: "Entendo que você está com problemas de login. Aqui estão algumas soluções:\n\n" +
               "1. **Esqueceu a senha?** Use o link 'Esqueci minha senha' na tela de login\n" +
               "2. **E-mail não cadastrado?** Verifique se está usando o e-mail correto\n" +
               "3. **Conta bloqueada?** Aguarde 15 minutos após várias tentativas incorretas\n\n" +
               "Se o problema persistir, posso conectá-lo com um atendente humano. Deseja que eu faça isso?",
      suggestions: [
        "Esqueci minha senha",
        "Falar com atendente",
        "Verificar e-mail cadastrado"
      ],
      canEscalate: true
    };
  }
  
  if (lowerMessage.includes('pagamento') || lowerMessage.includes('cobrança') || lowerMessage.includes('plano')) {
    return {
      message: "Posso ajudar com questões de pagamento e planos! Aqui estão os tópicos mais comuns:\n\n" +
               "💳 **Problemas de pagamento:** Cartão recusado, falha na cobrança\n" +
               "📋 **Mudança de plano:** Upgrade ou downgrade\n" +
               "🧾 **Faturas:** Visualizar ou baixar comprovantes\n" +
               "❌ **Cancelamento:** Como cancelar sua assinatura\n\n" +
               "Sobre qual desses tópicos você gostaria de saber mais?",
      suggestions: [
        "Problema com pagamento",
        "Mudar plano",
        "Ver faturas",
        "Cancelar assinatura"
      ],
      canEscalate: true
    };
  }
  
  if (lowerMessage.includes('marketplace') || lowerMessage.includes('mercado livre') || lowerMessage.includes('amazon')) {
    return {
      message: "Vejo que você tem dúvidas sobre integração com marketplaces! 🛒\n\n" +
               "O Place IA se integra com:\n" +
               "• Mercado Livre\n" +
               "• Amazon\n" +
               "• Shopee\n" +
               "• Magazine Luiza\n" +
               "• Americanas\n\n" +
               "Para configurar, vá em **Painel > Marketplace** e siga o passo a passo.\n\n" +
               "Precisa de ajuda específica com algum marketplace?",
      suggestions: [
        "Configurar Mercado Livre",
        "Sincronizar produtos",
        "Problemas de integração",
        "Falar com especialista"
      ],
      canEscalate: true
    };
  }
  
  if (lowerMessage.includes('ia') || lowerMessage.includes('tata') || lowerMessage.includes('inteligencia')) {
    return {
      message: "A TaTa é nossa IA principal! 🤖✨\n\n" +
               "Ela pode ajudar você com:\n" +
               "📊 **Análise de dados:** Relatórios e insights\n" +
               "📈 **Marketing:** Sugestões de campanhas\n" +
               "📦 **Estoque:** Controle e reposição\n" +
               "🔧 **Técnico:** Diagnósticos e soluções\n\n" +
               "A TaTa está disponível 24/7 no seu painel. Já tentou conversar com ela?",
      suggestions: [
        "Como usar a TaTa",
        "TaTa não responde",
        "Recursos da IA",
        "Treinar a IA"
      ],
      canEscalate: false
    };
  }
  
  if (lowerMessage.includes('humano') || lowerMessage.includes('atendente') || lowerMessage.includes('pessoa')) {
    return {
      message: "Claro! Vou conectar você com um de nossos atendentes humanos. 👨‍💼👩‍💼\n\n" +
               "**Horário de atendimento:**\n" +
               "Segunda a Sexta: 8h às 18h\n" +
               "Sábado: 8h às 12h\n\n" +
               "Tempo médio de resposta: 5-10 minutos\n\n" +
               "Enquanto isso, pode me contar mais detalhes sobre seu problema?",
      suggestions: [
        "É urgente",
        "Pode aguardar",
        "Deixar recado"
      ],
      canEscalate: true,
      escalate: true
    };
  }
  
  if (lowerMessage.includes('bug') || lowerMessage.includes('erro') || lowerMessage.includes('problema')) {
    return {
      message: "Sinto muito que você esteja enfrentando problemas! 😔\n\n" +
               "Para me ajudar a entender melhor:\n" +
               "1. **Onde** o problema acontece? (tela específica)\n" +
               "2. **Quando** começou? (hoje, ontem, etc.)\n" +
               "3. **O que** você estava fazendo?\n" +
               "4. **Mensagem de erro** apareceu?\n\n" +
               "Com essas informações posso ajudar melhor ou encaminhar para nossa equipe técnica.",
      suggestions: [
        "Erro na tela de login",
        "Problema no dashboard",
        "Erro de sincronização",
        "Falar com técnico"
      ],
      canEscalate: true
    };
  }
  
  // Resposta padrão
  return {
    message: "Olá! Sou a IA de suporte do Place IA! 👋\n\n" +
             "Posso ajudar você com:\n" +
             "🔐 Problemas de login e senha\n" +
             "💳 Questões de pagamento e planos\n" +
             "🛒 Integração com marketplaces\n" +
             "🤖 Dúvidas sobre nossas IAs\n" +
             "🐛 Reportar bugs e problemas\n\n" +
             "Como posso ajudar você hoje?",
    suggestions: [
      "Problema de login",
      "Questão de pagamento",
      "Configurar marketplace",
      "Falar com humano"
    ],
    canEscalate: true
  };
};

// ROTA: Chat com IA de suporte
router.post('/chat', optionalAuth, chatRateLimit, chatMessageValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { message, sessionId } = req.body;
    const userId = req.user?.id || null;
    
    // Gerar ID da sessão se não fornecido
    const chatSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Buscar contexto do usuário se autenticado
    let userContext = null;
    if (userId) {
      userContext = await User.findById(userId)
        .select('name email subscription userType status');
    }
    
    // Gerar resposta da IA
    const aiResponse = generateSupportAIResponse(message, userContext);
    
    // Log da conversa
    logger.info('Chat de suporte', {
      userId,
      sessionId: chatSessionId,
      userMessage: message,
      aiResponse: aiResponse.message.substring(0, 100) + '...',
      canEscalate: aiResponse.canEscalate,
      escalate: aiResponse.escalate || false
    });
    
    // Resposta
    const response = {
      success: true,
      data: {
        sessionId: chatSessionId,
        message: aiResponse.message,
        suggestions: aiResponse.suggestions,
        canEscalate: aiResponse.canEscalate,
        timestamp: new Date(),
        ...(aiResponse.escalate && { escalateToHuman: true })
      }
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Erro no chat de suporte:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Criar ticket de suporte
router.post('/tickets', optionalAuth, ticketRateLimit, ticketValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { subject, message, category, priority = 'medium', email, name } = req.body;
    const userId = req.user?.id || null;
    
    // Se não autenticado, email e nome são obrigatórios
    if (!userId && (!email || !name)) {
      return res.status(400).json({
        success: false,
        message: 'E-mail e nome são obrigatórios para usuários não autenticados'
      });
    }
    
    // Gerar número do ticket
    const ticketNumber = `PLACE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
    
    // Dados do ticket (simulado - em produção salvaria no banco)
    const ticketData = {
      id: ticketNumber,
      number: ticketNumber,
      subject,
      message,
      category,
      priority,
      status: 'open',
      userId,
      userEmail: userId ? req.user.email : email,
      userName: userId ? req.user.name : name,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null,
      tags: [],
      replies: []
    };
    
    // Enviar email de confirmação
    try {
      await sendEmail({
        to: ticketData.userEmail,
        subject: `Ticket criado: ${ticketNumber}`,
        template: 'ticket-created',
        data: {
          ticketNumber,
          subject,
          userName: ticketData.userName,
          message,
          category,
          priority,
          supportUrl: `${process.env.FRONTEND_URL}/support/tickets/${ticketNumber}`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao enviar email de confirmação do ticket:', emailError);
    }
    
    // Notificar equipe de suporte (simulado)
    logger.info('Novo ticket criado', {
      ticketNumber,
      userId,
      category,
      priority,
      subject
    });
    
    res.status(201).json({
      success: true,
      message: 'Ticket criado com sucesso',
      data: {
        ticketNumber,
        status: 'open',
        estimatedResponse: '2-4 horas',
        createdAt: ticketData.createdAt
      }
    });
    
  } catch (error) {
    logger.error('Erro ao criar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Listar tickets do usuário
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      priority
    } = req.query;
    
    // Simular busca de tickets do usuário
    const mockTickets = {
      docs: [
        {
          id: 'PLACE-123456-ABC',
          number: 'PLACE-123456-ABC',
          subject: 'Problema com sincronização do Mercado Livre',
          category: 'technical',
          priority: 'high',
          status: 'in_progress',
          createdAt: new Date(Date.now() - 86400000),
          updatedAt: new Date(Date.now() - 3600000),
          lastReply: {
            message: 'Estamos investigando o problema...',
            isFromSupport: true,
            createdAt: new Date(Date.now() - 3600000)
          },
          repliesCount: 3
        },
        {
          id: 'PLACE-789012-DEF',
          number: 'PLACE-789012-DEF',
          subject: 'Dúvida sobre planos',
          category: 'billing',
          priority: 'medium',
          status: 'resolved',
          createdAt: new Date(Date.now() - 172800000),
          updatedAt: new Date(Date.now() - 86400000),
          lastReply: {
            message: 'Obrigado! Problema resolvido.',
            isFromSupport: false,
            createdAt: new Date(Date.now() - 86400000)
          },
          repliesCount: 5
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
        tickets: mockTickets.docs,
        pagination: {
          currentPage: mockTickets.page,
          totalPages: mockTickets.totalPages,
          totalDocs: mockTickets.totalDocs,
          hasNextPage: mockTickets.hasNextPage,
          hasPrevPage: mockTickets.hasPrevPage
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao listar tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Buscar ticket específico
router.get('/tickets/:ticketNumber', optionalAuth, async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const userId = req.user?.id || null;
    
    // Simular busca do ticket
    const mockTicket = {
      id: ticketNumber,
      number: ticketNumber,
      subject: 'Problema com sincronização do Mercado Livre',
      message: 'Estou tendo problemas para sincronizar meus produtos com o Mercado Livre. Os produtos não aparecem na plataforma.',
      category: 'technical',
      priority: 'high',
      status: 'in_progress',
      userId: userId,
      userEmail: 'usuario@email.com',
      userName: 'João Silva',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 3600000),
      assignedTo: {
        name: 'Maria Suporte',
        email: 'maria@placeia.com'
      },
      tags: ['marketplace', 'mercadolivre', 'sync'],
      replies: [
        {
          id: '1',
          message: 'Olá João! Recebemos seu ticket e estamos investigando o problema. Pode nos informar há quanto tempo isso está acontecendo?',
          isFromSupport: true,
          authorName: 'Maria Suporte',
          createdAt: new Date(Date.now() - 82800000),
          isInternal: false
        },
        {
          id: '2',
          message: 'Começou ontem à tarde. Tentei várias vezes mas não funciona.',
          isFromSupport: false,
          authorName: 'João Silva',
          createdAt: new Date(Date.now() - 79200000),
          isInternal: false
        },
        {
          id: '3',
          message: 'Verificando logs do sistema para este usuário.',
          isFromSupport: true,
          authorName: 'Maria Suporte',
          createdAt: new Date(Date.now() - 75600000),
          isInternal: true
        },
        {
          id: '4',
          message: 'Encontramos o problema! Era uma questão com a API do Mercado Livre. Já corrigimos. Pode tentar novamente?',
          isFromSupport: true,
          authorName: 'Maria Suporte',
          createdAt: new Date(Date.now() - 3600000),
          isInternal: false
        }
      ]
    };
    
    // Verificar se usuário tem acesso ao ticket
    if (userId && mockTicket.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }
    
    // Filtrar respostas internas se não for admin
    if (!req.user || req.user.userType !== 'admin') {
      mockTicket.replies = mockTicket.replies.filter(reply => !reply.isInternal);
    }
    
    res.json({
      success: true,
      data: { ticket: mockTicket }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Responder ticket
router.post('/tickets/:ticketNumber/replies', optionalAuth, ticketReplyValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { ticketNumber } = req.params;
    const { message, isInternal = false } = req.body;
    const userId = req.user?.id || null;
    
    // Verificar se ticket existe e usuário tem acesso
    // (simulado)
    
    const replyData = {
      id: `reply_${Date.now()}`,
      message,
      isFromSupport: req.user?.userType === 'admin',
      authorName: req.user?.name || 'Usuário',
      createdAt: new Date(),
      isInternal: isInternal && req.user?.userType === 'admin'
    };
    
    // Enviar notificação por email (simulado)
    logger.info('Nova resposta no ticket', {
      ticketNumber,
      userId,
      isFromSupport: replyData.isFromSupport,
      isInternal: replyData.isInternal
    });
    
    res.status(201).json({
      success: true,
      message: 'Resposta adicionada com sucesso',
      data: { reply: replyData }
    });
    
  } catch (error) {
    logger.error('Erro ao responder ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Fechar ticket
router.patch('/tickets/:ticketNumber/close', authenticateToken, async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { reason } = req.body;
    
    // Verificar se usuário tem acesso ao ticket
    // (simulado)
    
    logger.info('Ticket fechado', {
      ticketNumber,
      userId: req.user.id,
      reason
    });
    
    res.json({
      success: true,
      message: 'Ticket fechado com sucesso',
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: req.user.id
      }
    });
    
  } catch (error) {
    logger.error('Erro ao fechar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: FAQ
router.get('/faq', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    const faqData = [
      {
        id: '1',
        category: 'general',
        question: 'O que é o Place IA?',
        answer: 'O Place IA é uma plataforma completa de gestão e impulsionamento para e-commerce, com inteligência artificial integrada para otimizar suas vendas em marketplaces.',
        tags: ['geral', 'sobre', 'plataforma'],
        views: 1250,
        helpful: 45,
        notHelpful: 3
      },
      {
        id: '2',
        category: 'technical',
        question: 'Como configurar a integração com o Mercado Livre?',
        answer: 'Para configurar o Mercado Livre: 1) Acesse Painel > Marketplace, 2) Clique em "Configurar Mercado Livre", 3) Insira suas credenciais da API, 4) Teste a conexão, 5) Configure as opções de sincronização.',
        tags: ['mercadolivre', 'integração', 'configuração'],
        views: 890,
        helpful: 67,
        notHelpful: 5
      },
      {
        id: '3',
        category: 'billing',
        question: 'Como alterar meu plano?',
        answer: 'Você pode alterar seu plano a qualquer momento em Painel > Configurações > Plano. As alterações são aplicadas imediatamente e o valor é ajustado proporcionalmente.',
        tags: ['plano', 'pagamento', 'upgrade'],
        views: 567,
        helpful: 34,
        notHelpful: 2
      },
      {
        id: '4',
        category: 'technical',
        question: 'A TaTa IA não está respondendo, o que fazer?',
        answer: 'Se a TaTa não responder: 1) Verifique sua conexão com internet, 2) Atualize a página, 3) Limpe o cache do navegador, 4) Se persistir, entre em contato conosco.',
        tags: ['tata', 'ia', 'problema', 'chat'],
        views: 423,
        helpful: 28,
        notHelpful: 1
      },
      {
        id: '5',
        category: 'general',
        question: 'Quais marketplaces são suportados?',
        answer: 'Atualmente suportamos: Mercado Livre, Amazon, Shopee, Magazine Luiza e Americanas. Estamos constantemente adicionando novos marketplaces.',
        tags: ['marketplaces', 'integração', 'suporte'],
        views: 789,
        helpful: 52,
        notHelpful: 4
      }
    ];
    
    let filteredFaq = faqData;
    
    // Filtrar por categoria
    if (category) {
      filteredFaq = filteredFaq.filter(item => item.category === category);
    }
    
    // Filtrar por busca
    if (search) {
      const searchLower = search.toLowerCase();
      filteredFaq = filteredFaq.filter(item => 
        item.question.toLowerCase().includes(searchLower) ||
        item.answer.toLowerCase().includes(searchLower) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Ordenar por relevância (views + helpful)
    filteredFaq.sort((a, b) => (b.views + b.helpful * 10) - (a.views + a.helpful * 10));
    
    res.json({
      success: true,
      data: {
        faq: filteredFaq,
        categories: [
          { id: 'general', name: 'Geral', count: faqData.filter(f => f.category === 'general').length },
          { id: 'technical', name: 'Técnico', count: faqData.filter(f => f.category === 'technical').length },
          { id: 'billing', name: 'Pagamento', count: faqData.filter(f => f.category === 'billing').length }
        ]
      }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Avaliar resposta do FAQ
router.post('/faq/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;
    
    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Campo helpful deve ser boolean'
      });
    }
    
    // Aqui você salvaria o feedback no banco
    logger.info('Feedback do FAQ', {
      faqId: id,
      helpful,
      userId: req.user?.id || 'anonymous',
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Obrigado pelo seu feedback!'
    });
    
  } catch (error) {
    logger.error('Erro ao salvar feedback do FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ROTA: Status do suporte
router.get('/status', async (req, res) => {
  try {
    const status = {
      online: true,
      averageResponseTime: '5-10 minutos',
      currentQueue: 3,
      businessHours: {
        monday: '08:00-18:00',
        tuesday: '08:00-18:00',
        wednesday: '08:00-18:00',
        thursday: '08:00-18:00',
        friday: '08:00-18:00',
        saturday: '08:00-12:00',
        sunday: 'Fechado'
      },
      timezone: 'America/Sao_Paulo',
      emergencyContact: '(18) 99653-1491',
      email: 'placeiagestao@gmail.com'
    };
    
    res.json({
      success: true,
      data: { status }
    });
    
  } catch (error) {
    logger.error('Erro ao buscar status do suporte:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;