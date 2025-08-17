# Place.IA - Sistema Completo de Gestão e Impulsão

![Place.IA Logo]://via.placeholder.com/200x80/FF6B0(https0/FFFFFF?text=Place.IA)

## 🎯 Sobre o Projeto

O Place.IA é um sistema completo de gestão e impulsão para e-commerce, integrando inteligência artificial, automação de vendas, gestão de marketplaces e muito mais. O sistema oferece uma solução completa para empresários que desejam otimizar suas vendas online.

### 🌟 Principais Funcionalidades

- **Dashboard Completo**: Visão geral de vendas, produtos e performance
- **IA Integrada (TaTa)**: Assistente virtual inteligente para suporte e análises
- **Gestão de Marketplaces**: Integração com Mercado Livre, Amazon, Shopee, Magazine Luiza
- **Automação de Anúncios**: Google Ads, Meta Ads, TikTok Ads
- **Sistema de Pagamentos**: Stripe, PayPal, PagSeguro
- **Upload de Notas Fiscais**: Processamento automático via foto ou planilha
- **Relatórios Avançados**: Analytics detalhados e insights de IA
- **Sistema de Suporte**: Chat com IA e tickets de atendimento
- **Painel Administrativo**: Gestão completa de usuários e sistema

## 🎨 Design System

### Paleta de Cores (Tema Neon Futurista)
- **Laranja Neon**: `#FF6B00`
- **Verde Neon**: `#39FF14`
- **Branco**: `#FFFFFF`
- **Fundo**: `#000000` (Preto profundo)

## 🏗️ Arquitetura do Sistema

```
place_ia/
├── config/
│   └── database.js          # Configuração MongoDB
├── middleware/
│   └── auth.js              # Middlewares de autenticação
├── models/
│   ├── User.js              # Modelo de usuário
│   ├── Product.js           # Modelo de produto
│   └── Sale.js              # Modelo de venda
├── routes/
│   ├── auth.js              # Rotas de autenticação
│   ├── users.js             # Rotas de usuários
│   ├── dashboard.js         # Rotas do dashboard
│   ├── ai.js                # Rotas da IA (TaTa)
│   ├── payments.js          # Rotas de pagamento
│   ├── marketplace.js       # Rotas de marketplace
│   ├── admin.js             # Rotas administrativas
│   ├── support.js           # Rotas de suporte
│   ├── webhooks.js          # Webhooks externos
│   └── upload.js            # Upload de arquivos
├── utils/
│   └── logger.js            # Sistema de logs
├── uploads/                 # Arquivos enviados
├── logs/                    # Logs do sistema
├── .env.example             # Variáveis de ambiente
├── package.json             # Dependências
├── server.js                # Servidor principal
└── README.md                # Este arquivo
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- **Node.js** (versão 16 ou superior)
- **MongoDB** (versão 4.4 ou superior)
- **NPM** ou **Yarn**

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/place-ia.git
cd place-ia
```

### 2. Instale as Dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure as Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configurações Gerais
NODE_ENV=development
PORT=3000
APP_NAME=Place.IA
APP_VERSION=1.0.0
APP_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/place_ia
# ou configure individualmente:
# MONGODB_HOST=localhost
# MONGODB_PORT=27017
# MONGODB_DATABASE=place_ia
# MONGODB_USERNAME=
# MONGODB_PASSWORD=

# JWT
JWT_SECRET=sua_chave_secreta_jwt_muito_segura
JWT_REFRESH_SECRET=sua_chave_refresh_muito_segura
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# E-mail (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
SMTP_FROM=noreply@place.ia

# APIs de IA
OPENAI_API_KEY=sua_chave_openai
ANTHROPIC_API_KEY=sua_chave_anthropic
GOOGLE_AI_API_KEY=sua_chave_google_ai

# Pagamentos
STRIPE_SECRET_KEY=sua_chave_stripe
STRIPE_WEBHOOK_SECRET=seu_webhook_stripe
PAYPAL_CLIENT_ID=seu_client_paypal
PAYPAL_CLIENT_SECRET=seu_secret_paypal
PAGSEGURO_TOKEN=seu_token_pagseguro
```

### 4. Configure o MongoDB

#### Opção A: MongoDB Local

1. Instale o MongoDB Community Edition
2. Inicie o serviço MongoDB
3. Crie o banco de dados:

```bash
mongo
use place_ia
```

#### Opção B: MongoDB Atlas (Cloud)

1. Crie uma conta no [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crie um cluster gratuito
3. Configure o acesso de rede (IP whitelist)
4. Obtenha a string de conexão e configure no `.env`

### 5. Execute o Projeto

#### Desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

#### Produção

```bash
npm start
# ou
yarn start
```

O servidor estará rodando em `http://localhost:3000`

## 📋 Scripts Disponíveis

```bash
# Desenvolvimento com auto-reload
npm run dev

# Produção
npm start

# Testes
npm test

# Linting
npm run lint

# Criar índices do banco
npm run create-indexes

# Backup do banco
npm run backup

# Limpeza de dados antigos
npm run cleanup
```

## 🔧 Configuração de Desenvolvimento

### Estrutura de Logs

O sistema gera logs em diferentes categorias:

- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros
- `logs/access.log` - Logs de acesso
- `logs/security.log` - Logs de segurança
- `logs/audit.log` - Logs de auditoria
- `logs/performance.log` - Logs de performance

### Níveis de Log

- `error` - Erros críticos
- `warn` - Avisos
- `info` - Informações gerais
- `debug` - Informações de debug (apenas desenvolvimento)

## 🔐 Segurança

### Recursos de Segurança Implementados

- **Autenticação JWT** com refresh tokens
- **Rate Limiting** para prevenir ataques de força bruta
- **Validação de entrada** em todas as rotas
- **Sanitização de dados** para prevenir XSS
- **Proteção CSRF** com tokens
- **Criptografia de senhas** com bcrypt
- **Logs de segurança** detalhados
- **Validação de CPF/CNPJ**
- **Upload seguro de arquivos**

### Configurações de Segurança

```env
# Segurança
SECRET_KEY=sua_chave_secreta_geral
ENCRYPTION_KEY=sua_chave_criptografia
SESSION_SECRET=sua_chave_sessao
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_SPECIAL=true
```

## 🌐 APIs e Integrações

### APIs de IA

- **OpenAI GPT** - IA principal
- **Anthropic Claude** - IA de backup
- **Google AI** - IA alternativa

### Marketplaces

- **Mercado Livre** - API de produtos e pedidos
- **Amazon** - Seller Central API
- **Shopee** - Open Platform API
- **Magazine Luiza** - Marketplace API

### Pagamentos

- **Stripe** - Cartões e assinaturas
- **PayPal** - Pagamentos internacionais
- **PagSeguro** - Pagamentos nacionais

### Anúncios

- **Google Ads** - Campanhas de busca
- **Meta Ads** - Facebook e Instagram
- **TikTok Ads** - Anúncios no TikTok

## 📊 Monitoramento e Analytics

### Métricas Coletadas

- **Performance de requisições**
- **Uso de memória e CPU**
- **Estatísticas de banco de dados**
- **Logs de erro e segurança**
- **Atividades de usuário**

### Dashboards

- **Dashboard do Cliente** - Vendas, produtos, campanhas
- **Dashboard Administrativo** - Usuários, sistema, métricas
- **Dashboard de Performance** - Velocidade, uptime, recursos

## 🔄 Backup e Recuperação

### Backup Automático

```bash
# Backup manual
npm run backup

# Backup agendado (configurar cron)
0 2 * * * cd /path/to/place-ia && npm run backup
```

### Restauração

```bash
# Restaurar backup
npm run restore backup_2024-01-01.json
```

## 🚀 Deploy

### Deploy Local (Desenvolvimento)

```bash
# Clone e configure
git clone https://github.com/seu-usuario/place-ia.git
cd place-ia
npm install
cp .env.example .env
# Configure o .env
npm run dev
```

### Deploy em Produção

#### Usando PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name "place-ia"

# Configurar auto-start
pm2 startup
pm2 save
```

#### Usando Docker

```dockerfile
# Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build e run
docker build -t place-ia .
docker run -p 3000:3000 --env-file .env place-ia
```

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- --grep "auth"

# Coverage
npm run test:coverage
```

### Estrutura de Testes

```
tests/
├── unit/
│   ├── models/
│   ├── routes/
│   └── utils/
├── integration/
│   ├── auth.test.js
│   ├── api.test.js
│   └── database.test.js
└── e2e/
    ├── user-flow.test.js
    └── admin-flow.test.js
```

## 📱 Aplicativo Mobile

### React Native (Em desenvolvimento)

```bash
# Instalar React Native CLI
npm install -g @react-native-community/cli

# Criar projeto mobile
react-native init PlaceIAMobile
cd PlaceIAMobile

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## 🖥️ Aplicativo Desktop

### Electron (Em desenvolvimento)

```bash
# Instalar Electron
npm install -g electron

# Criar aplicativo desktop
electron-builder
```

## 🤝 Contribuição

### Como Contribuir

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- Use ESLint e Prettier
- Siga os padrões de commit convencionais
- Escreva testes para novas funcionalidades
- Documente APIs e funções complexas

## 📞 Suporte

### Contato

- **E-mail**: placeiagestao@gmail.com
- **Telefone**: (18) 99653-1491
- **Endereço**: Av. José Peres Vargas 319 - Bairro Novo Prudentino - Presidente Prudente - SP
- **CNPJ**: 11.111.111/0001-00

### Documentação

- [API Documentation](./docs/api.md)
- [User Guide](./docs/user-guide.md)
- [Admin Guide](./docs/admin-guide.md)
- [Developer Guide](./docs/developer-guide.md)

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🔄 Changelog

### v1.0.0 (2024-01-01)

- ✨ Lançamento inicial
- 🔐 Sistema de autenticação completo
- 📊 Dashboard com métricas
- 🤖 Integração com IA (TaTa)
- 💳 Sistema de pagamentos
- 🛒 Integração com marketplaces
- 📱 API REST completa
- 🔒 Recursos de segurança avançados

## 🎯 Roadmap

### v1.1.0 (Próxima versão)

- [ ] Aplicativo mobile (React Native)
- [ ] Aplicativo desktop (Electron)
- [ ] Mais integrações de marketplace
- [ ] IA de análise de mercado
- [ ] Sistema de notificações push
- [ ] Relatórios avançados

### v1.2.0 (Futuro)

- [ ] Machine Learning para previsões
- [ ] Automação completa de estoque
- [ ] Integração com ERPs
- [ ] Multi-idioma
- [ ] Tema claro/escuro
- [ ] PWA (Progressive Web App)

---

**Place.IA** - Transformando o futuro do e-commerce com inteligência artificial 🚀

*Desenvolvido com ❤️ pela equipe Place.IA*