# Documentação Técnica - Sistema Place IA

## Visão Geral da API

A API do Sistema Place IA permite a integração completa com todas as funcionalidades da plataforma, possibilitando automação, personalização e extensão das capacidades do sistema.

### Versão Atual

`v1.0.0`

### URL Base

```
https://api.placeai.com.br/v1
```

### Autenticação

A API utiliza autenticação OAuth 2.0 com tokens JWT. Todas as requisições devem incluir um token de acesso válido no cabeçalho de autorização:

```
Authorization: Bearer {seu_token_de_acesso}
```

Para obter um token de acesso, utilize o endpoint de autenticação:

```
POST /auth/token
```

Corpo da requisição:

```json
{
  "client_id": "seu_client_id",
  "client_secret": "seu_client_secret",
  "grant_type": "client_credentials"
}
```

Resposta:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Endpoints Principais

### Marketplaces

#### Listar Marketplaces Integrados

```
GET /marketplaces
```

Resposta:

```json
{
  "marketplaces": [
    {
      "id": "mercadolivre",
      "name": "Mercado Livre",
      "status": "active",
      "connected": true,
      "last_sync": "2023-10-15T14:30:00Z"
    },
    {
      "id": "shopee",
      "name": "Shopee",
      "status": "active",
      "connected": true,
      "last_sync": "2023-10-15T14:35:00Z"
    },
    {
      "id": "amazon",
      "name": "Amazon",
      "status": "pending",
      "connected": false,
      "last_sync": null
    }
  ]
}
```

#### Conectar Marketplace

```
POST /marketplaces/{marketplace_id}/connect
```

Corpo da requisição:

```json
{
  "credentials": {
    "api_key": "sua_api_key",
    "api_secret": "seu_api_secret",
    "user_id": "seu_user_id"
  },
  "settings": {
    "auto_sync": true,
    "sync_interval": 30
  }
}
```

Resposta:

```json
{
  "status": "success",
  "message": "Marketplace conectado com sucesso",
  "connection_id": "conn_123456"
}
```

### Produtos

#### Listar Produtos

```
GET /products
```

Parâmetros de consulta:

- `marketplace_id` (opcional): Filtrar por marketplace
- `status` (opcional): Filtrar por status (active, inactive, pending)
- `page` (opcional): Número da página
- `limit` (opcional): Itens por página

Resposta:

```json
{
  "products": [
    {
      "id": "prod_123456",
      "sku": "SKU001",
      "title": "Smartphone XYZ 128GB",
      "description": "Smartphone com 128GB de armazenamento...",
      "price": 1299.90,
      "stock": 15,
      "marketplaces": [
        {
          "id": "mercadolivre",
          "listing_id": "ML12345",
          "status": "active",
          "url": "https://...",
          "performance": {
            "views": 1250,
            "sales": 8,
            "conversion_rate": 0.64
          }
        },
        {
          "id": "shopee",
          "listing_id": "SP12345",
          "status": "active",
          "url": "https://...",
          "performance": {
            "views": 980,
            "sales": 5,
            "conversion_rate": 0.51
          }
        }
      ],
      "created_at": "2023-09-01T10:00:00Z",
      "updated_at": "2023-10-15T08:30:00Z"
    }
    // Mais produtos...
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

#### Criar Produto com IA

```
POST /products/ai-create
```

Corpo da requisição:

```json
{
  "base_info": {
    "name": "Smartphone XYZ",
    "category": "electronics/smartphones",
    "brand": "XYZ",
    "attributes": {
      "storage": "128GB",
      "color": "Preto",
      "screen_size": "6.5 polegadas"
    },
    "price": 1299.90,
    "stock": 15
  },
  "ai_options": {
    "optimize_title": true,
    "generate_description": true,
    "suggest_keywords": true,
    "analyze_competition": true
  },
  "target_marketplaces": ["mercadolivre", "shopee"]
}
```

Resposta:

```json
{
  "task_id": "task_789012",
  "status": "processing",
  "estimated_completion": "2023-10-20T15:45:00Z",
  "preview": {
    "title_suggestions": [
      "Smartphone XYZ 128GB Preto Tela 6.5" Câmera Tripla",
      "XYZ Smartphone 128GB Memória 6GB RAM Tela 6.5 Polegadas"
    ]
  }
}
```

#### Verificar Status da Criação com IA

```
GET /tasks/{task_id}
```

Resposta:

```json
{
  "task_id": "task_789012",
  "status": "completed",
  "result": {
    "product_id": "prod_123456",
    "ai_generated": {
      "title": "Smartphone XYZ 128GB Preto Tela 6.5" Câmera Tripla",
      "description": "O Smartphone XYZ oferece uma experiência premium com seus 128GB de armazenamento...",
      "keywords": ["smartphone", "xyz", "128gb", "tela 6.5", "câmera tripla"],
      "market_analysis": {
        "average_price": 1350.00,
        "price_recommendation": 1299.90,
        "competition_level": "medium",
        "estimated_demand": "high"
      }
    },
    "marketplace_listings": [
      {
        "marketplace": "mercadolivre",
        "listing_id": "ML12345",
        "status": "active",
        "url": "https://..."
      },
      {
        "marketplace": "shopee",
        "listing_id": "SP12345",
        "status": "active",
        "url": "https://..."
      }
    ]
  }
}
```

### Análise de Performance

#### Obter Análise de Anúncios

```
GET /analytics/listings/{listing_id}
```

Resposta:

```json
{
  "listing_id": "ML12345",
  "marketplace": "mercadolivre",
  "product_id": "prod_123456",
  "performance": {
    "views": {
      "total": 1250,
      "daily": [45, 52, 48, 60, 55, 50, 58],
      "trend": "+5%"
    },
    "sales": {
      "total": 8,
      "daily": [0, 1, 2, 1, 0, 2, 2],
      "trend": "+15%"
    },
    "conversion_rate": 0.64,
    "average_position": 12.5,
    "click_through_rate": 3.2
  },
  "market_comparison": {
    "position_percentile": 75,
    "price_competitiveness": "medium",
    "visibility_score": 82
  },
  "ai_recommendations": [
    {
      "type": "title",
      "current": "Smartphone XYZ 128GB",
      "suggested": "Smartphone XYZ 128GB Preto Tela 6.5" Câmera Tripla",
      "impact_estimate": "+15% views"
    },
    {
      "type": "price",
      "current": 1299.90,
      "suggested": 1279.90,
      "impact_estimate": "+8% conversion"
    }
  ]
}
```

#### Obter Relatório de Vendas

```
GET /analytics/sales
```

Parâmetros de consulta:

- `start_date`: Data inicial (formato ISO)
- `end_date`: Data final (formato ISO)
- `marketplace_id` (opcional): Filtrar por marketplace
- `group_by` (opcional): Agrupar por (day, week, month)

Resposta:

```json
{
  "period": {
    "start": "2023-10-01T00:00:00Z",
    "end": "2023-10-15T23:59:59Z"
  },
  "summary": {
    "total_sales": 42,
    "total_revenue": 15780.50,
    "average_ticket": 375.73,
    "growth": "+12%"
  },
  "by_marketplace": [
    {
      "id": "mercadolivre",
      "sales": 25,
      "revenue": 9450.30,
      "growth": "+15%"
    },
    {
      "id": "shopee",
      "sales": 17,
      "revenue": 6330.20,
      "growth": "+8%"
    }
  ],
  "by_product": [
    {
      "id": "prod_123456",
      "name": "Smartphone XYZ 128GB",
      "sales": 8,
      "revenue": 10399.20,
      "growth": "+20%"
    },
    // Mais produtos...
  ],
  "time_series": {
    "labels": ["2023-10-01", "2023-10-02", /* ... */],
    "sales": [3, 2, 4, 3, 5, /* ... */],
    "revenue": [1125.50, 750.20, 1500.80, /* ... */]
  }
}
```

### TaTa IA

#### Enviar Consulta para TaTa

```
POST /tata/query
```

Corpo da requisição:

```json
{
  "query": "Quantas vendas eu fiz ontem no Mercado Livre?",
  "context": {
    "user_id": "user_123456",
    "session_id": "sess_789012"
  }
}
```

Resposta:

```json
{
  "response": {
    "text": "Bom dia, chefe! Ontem você fez 27 vendas no Mercado Livre, totalizando R$ 3.450,00. Isso representa um aumento de 15% em relação à média diária deste mês. Notei que o produto 'Fone Bluetooth XYZ' foi responsável por 40% dessas vendas. Quer que eu prepare uma estratégia para impulsionar ainda mais este item?",
    "data": {
      "sales_count": 27,
      "sales_total": 3450.00,
      "comparison": "+15%",
      "top_product": {
        "id": "prod_789012",
        "name": "Fone Bluetooth XYZ",
        "sales": 11,
        "percentage": 40
      }
    },
    "suggestions": [
      {
        "text": "Ver detalhes das vendas",
        "action": "view_sales_details",
        "params": {
          "date": "2023-10-19",
          "marketplace": "mercadolivre"
        }
      },
      {
        "text": "Preparar estratégia de impulsão",
        "action": "create_boost_strategy",
        "params": {
          "product_id": "prod_789012"
        }
      }
    ]
  },
  "conversation_id": "conv_345678"
}
```

#### Continuar Conversa com TaTa

```
POST /tata/conversations/{conversation_id}/reply
```

Corpo da requisição:

```json
{
  "message": "Sim, prepare uma estratégia para impulsionar o Fone Bluetooth XYZ"
}
```

Resposta:

```json
{
  "response": {
    "text": "Ótima escolha! Analisei o mercado e preparei 3 opções de estratégia para impulsionar o 'Fone Bluetooth XYZ':\n\n1. **Básica**: Otimização do anúncio no Mercado Livre com investimento de R$ 150,00 (estimativa de 500 visualizações)\n2. **Intermediária**: Anúncios no ML + Shopee com investimento de R$ 300,00 (estimativa de 1.200 visualizações)\n3. **Completa**: ML + Shopee + campanha no Instagram com investimento de R$ 500,00 (estimativa de 3.000 visualizações)\n\nQual estratégia você prefere? Posso personalizar qualquer uma delas conforme seu orçamento.",
    "data": {
      "strategies": [
        {
          "id": "strategy_basic",
          "name": "Básica",
          "platforms": ["mercadolivre"],
          "investment": 150.00,
          "estimated_views": 500
        },
        {
          "id": "strategy_intermediate",
          "name": "Intermediária",
          "platforms": ["mercadolivre", "shopee"],
          "investment": 300.00,
          "estimated_views": 1200
        },
        {
          "id": "strategy_complete",
          "name": "Completa",
          "platforms": ["mercadolivre", "shopee", "instagram"],
          "investment": 500.00,
          "estimated_views": 3000
        }
      ]
    },
    "suggestions": [
      {
        "text": "Escolher estratégia básica",
        "action": "select_strategy",
        "params": {
          "strategy_id": "strategy_basic",
          "product_id": "prod_789012"
        }
      },
      {
        "text": "Escolher estratégia intermediária",
        "action": "select_strategy",
        "params": {
          "strategy_id": "strategy_intermediate",
          "product_id": "prod_789012"
        }
      },
      {
        "text": "Escolher estratégia completa",
        "action": "select_strategy",
        "params": {
          "strategy_id": "strategy_complete",
          "product_id": "prod_789012"
        }
      },
      {
        "text": "Personalizar estratégia",
        "action": "customize_strategy",
        "params": {
          "product_id": "prod_789012"
        }
      }
    ]
  }
}
```

### Impulsão em Redes Sociais

#### Criar Campanha de Impulsão

```
POST /social/campaigns
```

Corpo da requisição:

```json
{
  "product_id": "prod_123456",
  "platforms": ["instagram", "facebook", "google_ads"],
  "budget": 500.00,
  "duration_days": 7,
  "target_audience": {
    "age_range": [18, 45],
    "genders": ["male", "female"],
    "interests": ["technology", "gadgets", "music"],
    "locations": ["São Paulo", "Rio de Janeiro", "Belo Horizonte"]
  },
  "ai_optimization": {
    "auto_adjust_budget": true,
    "performance_goal": "conversions",
    "generate_ad_variations": true
  }
}
```

Resposta:

```json
{
  "campaign_id": "camp_123456",
  "status": "creating",
  "estimated_reach": 15000,
  "estimated_clicks": 750,
  "estimated_conversions": 30,
  "platforms": [
    {
      "name": "instagram",
      "status": "pending",
      "ad_preview_url": "https://..."
    },
    {
      "name": "facebook",
      "status": "pending",
      "ad_preview_url": "https://..."
    },
    {
      "name": "google_ads",
      "status": "pending",
      "ad_preview_url": "https://..."
    }
  ],
  "ai_generated_content": {
    "headlines": [
      "Conheça o Smartphone XYZ: Potência e Estilo em Suas Mãos",
      "Smartphone XYZ com 128GB: Espaço de Sobra para Seus Momentos"
    ],
    "descriptions": [
      "Câmera tripla, tela de 6.5" e bateria que dura o dia todo. Aproveite!",
      "Performance excepcional com design premium. Conheça o XYZ agora!"
    ],
    "image_suggestions": [
      {
        "url": "https://...",
        "description": "Produto em destaque com fundo gradiente"
      },
      {
        "url": "https://...",
        "description": "Pessoa utilizando o produto em ambiente urbano"
      }
    ]
  }
}
```

---

## Webhooks

A API do Place IA suporta webhooks para notificações em tempo real sobre eventos importantes. Para configurar um webhook:

```
POST /webhooks
```

Corpo da requisição:

```json
{
  "url": "https://seu-servidor.com/webhook",
  "events": ["sale.created", "product.updated", "campaign.completed"],
  "secret": "seu_segredo_para_verificacao"
}
```

Resposta:

```json
{
  "webhook_id": "wh_123456",
  "status": "active",
  "url": "https://seu-servidor.com/webhook",
  "events": ["sale.created", "product.updated", "campaign.completed"]
}
```

### Formato de Payload de Webhook

```json
{
  "event": "sale.created",
  "timestamp": "2023-10-20T14:30:00Z",
  "data": {
    "sale_id": "sale_123456",
    "product_id": "prod_123456",
    "marketplace": "mercadolivre",
    "amount": 1299.90,
    "customer": {
      "id": "cust_789012",
      "name": "João Silva"
    }
  }
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|------------|
| 400 | Requisição inválida |
| 401 | Não autorizado |
| 403 | Acesso proibido |
| 404 | Recurso não encontrado |
| 429 | Limite de requisições excedido |
| 500 | Erro interno do servidor |

Exemplo de resposta de erro:

```json
{
  "error": {
    "code": 400,
    "message": "Parâmetros inválidos",
    "details": [
      {
        "field": "price",
        "message": "Deve ser um número positivo"
      }
    ]
  }
}
```

---

## Limites de Taxa

A API do Place IA implementa limites de taxa para garantir a estabilidade do serviço:

| Plano | Requisições por minuto | Requisições por dia |
|-------|------------------------|---------------------|
| Básico | 60 | 10.000 |
| Profissional | 120 | 50.000 |
| Empresarial | 300 | 150.000 |

Os limites de taxa são informados nos cabeçalhos de resposta:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1603123200
```

---

## Sistema de Pagamentos

A API do Place IA oferece integração completa com diversos gateways de pagamento para gerenciar assinaturas, cobranças recorrentes e transações únicas.

### Gateway Padrão

O Stripe é o gateway padrão do sistema, oferecendo suporte a múltiplas moedas, cobranças recorrentes e diversos métodos de pagamento.

#### Criar Assinatura

```
POST /payments/subscriptions
```

Corpo da requisição:

```json
{
  "plan_id": "plan_mensal",
  "customer": {
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "tax_id": "123.456.789-00"
  },
  "payment_method": {
    "type": "credit_card",
    "token": "tok_visa"
  },
  "gateway": "stripe"
}
```

Resposta:

```json
{
  "subscription_id": "sub_123456",
  "status": "active",
  "plan": {
    "id": "plan_mensal",
    "name": "Plano Mensal",
    "amount": 99.90,
    "currency": "BRL",
    "interval": "month"
  },
  "current_period": {
    "start": "2023-10-20T00:00:00Z",
    "end": "2023-11-20T00:00:00Z"
  },
  "payment_method": {
    "type": "credit_card",
    "brand": "visa",
    "last4": "4242"
  },
  "gateway": "stripe",
  "gateway_id": "sub_1234567890"
}
```

#### Listar Planos Disponíveis

```
GET /payments/plans
```

Resposta:

```json
{
  "plans": [
    {
      "id": "plan_gratuito",
      "name": "Plano Gratuito",
      "amount": 0,
      "currency": "BRL",
      "interval": null,
      "features": [
        "Acesso básico ao dashboard",
        "Limite de 50 produtos",
        "Suporte por email"
      ]
    },
    {
      "id": "plan_mensal",
      "name": "Plano Mensal",
      "amount": 99.90,
      "currency": "BRL",
      "interval": "month",
      "features": [
        "Acesso completo ao dashboard",
        "Produtos ilimitados",
        "Suporte prioritário",
        "Acesso à TaTa IA"
      ]
    },
    {
      "id": "plan_anual",
      "name": "Plano Anual",
      "amount": 999.00,
      "currency": "BRL",
      "interval": "year",
      "features": [
        "Acesso completo ao dashboard",
        "Produtos ilimitados",
        "Suporte prioritário",
        "Acesso à TaTa IA",
        "Relatórios avançados",
        "Economia de 16%"
      ]
    }
  ]
}
```

#### Gerenciar Assinatura

```
PUT /payments/subscriptions/{subscription_id}
```

Corpo da requisição (exemplo de upgrade):

```json
{
  "action": "upgrade",
  "plan_id": "plan_anual"
}
```

Resposta:

```json
{
  "subscription_id": "sub_123456",
  "status": "active",
  "plan": {
    "id": "plan_anual",
    "name": "Plano Anual",
    "amount": 999.00,
    "currency": "BRL",
    "interval": "year"
  },
  "current_period": {
    "start": "2023-10-20T00:00:00Z",
    "end": "2024-10-20T00:00:00Z"
  },
  "proration": {
    "credit_applied": 83.25,
    "amount_charged": 915.75
  }
}
```

### Gateways Alternativos

Além do Stripe, o sistema oferece suporte aos seguintes gateways de pagamento:

- **Pagar.me (Stone)**: Integração nacional com suporte a Pix, boleto e cartão
- **Asaas**: Ideal para cobranças recorrentes com integração ao WhatsApp
- **Iugu**: Especializado em modelos SaaS
- **Juno**: Suporte a Pix, boleto e cartão com checkout simplificado
- **Gerencianet**: Especializado em Pix automático e links de cobrança

Para utilizar um gateway alternativo, especifique o parâmetro `gateway` nas requisições de pagamento.

#### Exemplo com Pagar.me (Pix)

```
POST /payments/subscriptions
```

Corpo da requisição:

```json
{
  "plan_id": "plan_mensal",
  "customer": {
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "tax_id": "123.456.789-00"
  },
  "payment_method": {
    "type": "pix"
  },
  "gateway": "pagarme"
}
```

Resposta:

```json
{
  "subscription_id": "sub_123456",
  "status": "pending",
  "plan": {
    "id": "plan_mensal",
    "name": "Plano Mensal",
    "amount": 99.90,
    "currency": "BRL",
    "interval": "month"
  },
  "payment_method": {
    "type": "pix",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qr_code_text": "00020126580014BR.GOV.BCB.PIX0136a629532e-7693-4846-852d...",
    "expiration": "2023-10-20T16:30:00Z"
  },
  "gateway": "pagarme",
  "gateway_id": "sub_9876543210"
}
```

### Webhooks de Pagamento

Eventos relacionados a pagamentos são enviados através do sistema de webhooks com os seguintes tipos de evento:

- `payment.succeeded`: Pagamento realizado com sucesso
- `payment.failed`: Falha no processamento do pagamento
- `subscription.created`: Nova assinatura criada
- `subscription.updated`: Assinatura atualizada (upgrade/downgrade)
- `subscription.canceled`: Assinatura cancelada
- `subscription.renewed`: Assinatura renovada automaticamente

Exemplo de payload para `subscription.renewed`:

```json
{
  "event": "subscription.renewed",
  "timestamp": "2023-11-20T00:01:00Z",
  "data": {
    "subscription_id": "sub_123456",
    "customer_id": "cust_789012",
    "plan_id": "plan_mensal",
    "payment": {
      "id": "pay_345678",
      "amount": 99.90,
      "currency": "BRL",
      "status": "succeeded"
    },
    "current_period": {
      "start": "2023-11-20T00:00:00Z",
      "end": "2023-12-20T00:00:00Z"
    }
  }
}
```

---

## SDKs e Bibliotecas

A Place IA oferece SDKs oficiais para facilitar a integração:

- [JavaScript/Node.js](https://github.com/placeai/placeai-node)
- [PHP](https://github.com/placeai/placeai-php)
- [Python](https://github.com/placeai/placeai-python)
- [Java](https://github.com/placeai/placeai-java)

---

## Suporte e Contato

Para suporte técnico relacionado à API, entre em contato através de:

- Email: api-support@placeai.com.br
- Portal do Desenvolvedor: https://developers.placeai.com.br

---

© 2023 PLACE IA - Todos os direitos reservados