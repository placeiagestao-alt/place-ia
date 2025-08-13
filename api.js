// API Real da PLACE IA - Funcionalidades de Produção

// Configurações da API
const API_CONFIG = {
    baseURL: 'https://api.placeia.com.br',
    version: 'v1',
    timeout: 30000
};

// Classe para gerenciar autenticação
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('placeia_token');
        this.refreshToken = localStorage.getItem('placeia_refresh_token');
        this.userType = localStorage.getItem('placeia_user_type');
    }

    async login(email, password, userType = 'client', token = null) {
        try {
            const endpoint = userType === 'admin' ? '/auth/admin/login' : '/auth/client/login';
            const payload = { email, password };
            
            if (userType === 'admin' && token) {
                payload.admin_token = token;
            }

            const response = await this.makeRequest('POST', endpoint, payload);
            
            if (response.success) {
                this.token = response.data.access_token;
                this.refreshToken = response.data.refresh_token;
                this.userType = userType;
                
                localStorage.setItem('placeia_token', this.token);
                localStorage.setItem('placeia_refresh_token', this.refreshToken);
                localStorage.setItem('placeia_user_type', this.userType);
                localStorage.setItem('placeia_user_data', JSON.stringify(response.data.user));
                
                return { success: true, user: response.data.user };
            }
            
            return { success: false, message: response.message };
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro de conexão. Tente novamente.' };
        }
    }

    async logout() {
        try {
            await this.makeRequest('POST', '/auth/logout');
        } catch (error) {
            console.error('Erro no logout:', error);
        } finally {
            this.clearSession();
        }
    }

    clearSession() {
        this.token = null;
        this.refreshToken = null;
        this.userType = null;
        localStorage.removeItem('placeia_token');
        localStorage.removeItem('placeia_refresh_token');
        localStorage.removeItem('placeia_user_type');
        localStorage.removeItem('placeia_user_data');
    }

    isAuthenticated() {
        return !!this.token;
    }

    async refreshAccessToken() {
        try {
            const response = await this.makeRequest('POST', '/auth/refresh', {
                refresh_token: this.refreshToken
            });
            
            if (response.success) {
                this.token = response.data.access_token;
                localStorage.setItem('placeia_token', this.token);
                return true;
            }
            
            this.clearSession();
            return false;
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            this.clearSession();
            return false;
        }
    }

    async makeRequest(method, endpoint, data = null) {
        const url = `${API_CONFIG.baseURL}/${API_CONFIG.version}${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: API_CONFIG.timeout
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                options.headers['Authorization'] = `Bearer ${this.token}`;
                return await fetch(url, options).then(res => res.json());
            }
        }

        return await response.json();
    }
}

// Classe para gerenciar dados de vendas
class SalesManager {
    constructor(authManager) {
        this.auth = authManager;
    }

    async getSalesData(period = 'today') {
        try {
            const response = await this.auth.makeRequest('GET', `/sales/data?period=${period}`);
            return response;
        } catch (error) {
            console.error('Erro ao buscar dados de vendas:', error);
            return { success: false, message: 'Erro ao carregar dados de vendas' };
        }
    }

    async getSalesByMarketplace(marketplace = null) {
        try {
            const endpoint = marketplace ? `/sales/marketplace/${marketplace}` : '/sales/marketplace';
            const response = await this.auth.makeRequest('GET', endpoint);
            return response;
        } catch (error) {
            console.error('Erro ao buscar vendas por marketplace:', error);
            return { success: false, message: 'Erro ao carregar dados do marketplace' };
        }
    }

    async getTopProducts(limit = 10) {
        try {
            const response = await this.auth.makeRequest('GET', `/products/top?limit=${limit}`);
            return response;
        } catch (error) {
            console.error('Erro ao buscar produtos mais vendidos:', error);
            return { success: false, message: 'Erro ao carregar produtos' };
        }
    }
}

// Classe para gerenciar produtos
class ProductManager {
    constructor(authManager) {
        this.auth = authManager;
    }

    async getProducts(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await this.auth.makeRequest('GET', `/products?${queryParams}`);
            return response;
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            return { success: false, message: 'Erro ao carregar produtos' };
        }
    }

    async getProductById(productId) {
        try {
            const response = await this.auth.makeRequest('GET', `/products/${productId}`);
            return response;
        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            return { success: false, message: 'Erro ao carregar produto' };
        }
    }

    async updateProduct(productId, data) {
        try {
            const response = await this.auth.makeRequest('PUT', `/products/${productId}`, data);
            return response;
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            return { success: false, message: 'Erro ao atualizar produto' };
        }
    }

    async getStockAlerts() {
        try {
            const response = await this.auth.makeRequest('GET', '/products/stock-alerts');
            return response;
        } catch (error) {
            console.error('Erro ao buscar alertas de estoque:', error);
            return { success: false, message: 'Erro ao carregar alertas' };
        }
    }
}

// Classe para gerenciar IA (TaTa)
class AIManager {
    constructor(authManager) {
        this.auth = authManager;
    }

    async sendMessage(message) {
        try {
            const response = await this.auth.makeRequest('POST', '/ai/chat', {
                message: message,
                timestamp: new Date().toISOString()
            });
            return response;
        } catch (error) {
            console.error('Erro ao enviar mensagem para IA:', error);
            return { 
                success: false, 
                message: 'Desculpe, estou com dificuldades técnicas. Tente novamente em alguns instantes.' 
            };
        }
    }

    async getInsights() {
        try {
            const response = await this.auth.makeRequest('GET', '/ai/insights');
            return response;
        } catch (error) {
            console.error('Erro ao buscar insights da IA:', error);
            return { success: false, message: 'Erro ao carregar insights' };
        }
    }

    async generateOptimizations(productId) {
        try {
            const response = await this.auth.makeRequest('POST', '/ai/optimize', {
                product_id: productId
            });
            return response;
        } catch (error) {
            console.error('Erro ao gerar otimizações:', error);
            return { success: false, message: 'Erro ao gerar otimizações' };
        }
    }
}

// Classe para gerenciar assinaturas e planos
class SubscriptionManager {
    constructor(authManager) {
        this.auth = authManager;
    }

    async getPlans() {
        try {
            const response = await this.auth.makeRequest('GET', '/plans');
            return response;
        } catch (error) {
            console.error('Erro ao buscar planos:', error);
            return { success: false, message: 'Erro ao carregar planos' };
        }
    }

    async subscribeToPlan(planId, paymentData) {
        try {
            const response = await this.auth.makeRequest('POST', '/subscriptions', {
                plan_id: planId,
                payment_data: paymentData
            });
            return response;
        } catch (error) {
            console.error('Erro ao assinar plano:', error);
            return { success: false, message: 'Erro ao processar assinatura' };
        }
    }

    async getCurrentSubscription() {
        try {
            const response = await this.auth.makeRequest('GET', '/subscriptions/current');
            return response;
        } catch (error) {
            console.error('Erro ao buscar assinatura atual:', error);
            return { success: false, message: 'Erro ao carregar assinatura' };
        }
    }

    async startFreeTrial(userData) {
        try {
            const response = await this.auth.makeRequest('POST', '/subscriptions/free-trial', userData);
            return response;
        } catch (error) {
            console.error('Erro ao iniciar teste gratuito:', error);
            return { success: false, message: 'Erro ao iniciar teste gratuito' };
        }
    }
}

// Classe para gerenciar notificações
class NotificationManager {
    constructor(authManager) {
        this.auth = authManager;
        this.notifications = [];
    }

    async getNotifications() {
        try {
            const response = await this.auth.makeRequest('GET', '/notifications');
            if (response.success) {
                this.notifications = response.data;
            }
            return response;
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
            return { success: false, message: 'Erro ao carregar notificações' };
        }
    }

    async markAsRead(notificationId) {
        try {
            const response = await this.auth.makeRequest('PUT', `/notifications/${notificationId}/read`);
            return response;
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            return { success: false };
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${this.getIconForType(type)}"></i>
            </div>
            <div class="notification-content">
                <p>${message}</p>
            </div>
            <div class="notification-close">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
    }

    hideNotification(notification) {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 500);
    }

    getIconForType(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-bell';
    }
}

// Instâncias globais
const authManager = new AuthManager();
const salesManager = new SalesManager(authManager);
const productManager = new ProductManager(authManager);
const aiManager = new AIManager(authManager);
const subscriptionManager = new SubscriptionManager(authManager);
const notificationManager = new NotificationManager(authManager);

// Exportar para uso global
window.PlaceIA = {
    auth: authManager,
    sales: salesManager,
    products: productManager,
    ai: aiManager,
    subscriptions: subscriptionManager,
    notifications: notificationManager
};

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    if (authManager.isAuthenticated()) {
        // Usuário logado, carregar dados iniciais
        loadInitialData();
    } else {
        // Verificar se está em página que requer login
        const protectedPages = ['dashboard', 'admin', 'cliente'];
        const currentPage = window.location.pathname;
        
        if (protectedPages.some(page => currentPage.includes(page))) {
            window.location.href = '/login.html';
        }
    }
});

async function loadInitialData() {
    try {
        // Carregar notificações
        await notificationManager.getNotifications();
        
        // Carregar dados básicos se estiver no dashboard
        if (window.location.pathname.includes('dashboard')) {
            await Promise.all([
                salesManager.getSalesData('today'),
                productManager.getStockAlerts(),
                subscriptionManager.getCurrentSubscription()
            ]);
        }
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}