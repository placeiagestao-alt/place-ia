// Elementos DOM
const navItems = document.querySelectorAll('.nav-item');
const tataInput = document.getElementById('tataInput');
const tataSendBtn = document.getElementById('tataSendBtn');
const ctaButton = document.querySelector('.cta-button');
const planButtons = document.querySelectorAll('.plan-button');
const marketplaceLogos = document.querySelectorAll('.marketplace-logo');
const dashboardCards = document.querySelectorAll('.dashboard-card');

// Formulário de login
const loginForm = document.getElementById('client-login-form');
if (loginForm) {
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('client-email').value;
    const senha = document.getElementById('client-password').value;
    
    if(email && senha){
      alert(`Você tentou entrar com o e-mail: ${email}`);
    } else {
      alert('Preencha todos os campos!');
    }
  });
}

// Navegação
navItems.forEach(item => {
    item.addEventListener('click', function() {
        navItems.forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');
        
        const targetSection = this.getAttribute('data-section');
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
        
        if (targetSection) {
            const section = document.getElementById(targetSection);
            if (section) {
                section.style.display = 'block';
            }
        }
    });
});

// Funcionalidade da TaTa IA
if (tataInput && tataSendBtn) {
    tataSendBtn.addEventListener('click', sendMessageToTaTa);
    tataInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessageToTaTa();
        }
    });
}

function addMessageToChat(message, sender) {
    const tataChat = document.querySelector('.tata-chat');
    if (!tataChat) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `tata-message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${message}</p>
            <span class="message-time">${new Date().toLocaleTimeString()}</span>
        </div>
    `;
    
    tataChat.appendChild(messageDiv);
    tataChat.scrollTop = tataChat.scrollHeight;
}

function sendMessageToTaTa() {
    const message = tataInput.value.trim();
    if (message === '') return;
    
    addMessageToChat(message, 'user');
    tataInput.value = '';
    
    // Simula resposta da IA
    setTimeout(() => {
        addMessageToChat('Obrigada pela sua mensagem! Estou aqui para ajudar com suas vendas e produtos.', 'ai');
    }, 1000);
}

// Botões de Planos
if (planButtons.length > 0) {
    planButtons.forEach(button => {
        button.addEventListener('click', function() {
            planButtons.forEach(btn => btn.classList.remove('selected'));
            this.classList.add('selected');
            
            const planType = this.getAttribute('data-plan');
            const planPrices = {
                'basic': 'R$ 29,90/mês',
                'plus': 'R$ 59,90/mês',
                'premium': 'R$ 99,90/mês'
            };
            
            if (ctaButton) {
                ctaButton.textContent = `Começar com ${planType.charAt(0).toUpperCase() + planType.slice(1)} - ${planPrices[planType]}`;
            }
            
            if (planType === 'basic') {
                alert('Plano Básico selecionado! Ideal para começar.');
            } else if (planType === 'plus') {
                alert('Plano Plus selecionado! Mais popular entre nossos usuários.');
            } else if (planType === 'premium') {
                alert('Plano Premium selecionado! Máximo de recursos disponíveis.');
            }
        });
    });
}

// Formulário de teste
const trialForm = document.getElementById('trial-form');
if (trialForm) {
    trialForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            company: formData.get('company'),
            plan: document.querySelector('.plan-button.selected')?.getAttribute('data-plan') || 'basic'
        };
        
        showNotification('Cadastro realizado com sucesso! Redirecionando para o login...', 'success');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
        this.reset();
    });
}

// Animações e efeitos visuais
document.addEventListener('DOMContentLoaded', function() {
    const plusPlanButton = document.querySelector('[data-plan="plus"]');
    if (plusPlanButton) {
        setTimeout(() => {
            plusPlanButton.click();
        }, 1000);
    }
});

// Carrega notificações do sistema
document.addEventListener('DOMContentLoaded', function() {
    loadSystemNotifications();
});

function loadSystemNotifications() {
    showNotification('Bem-vindo ao Place IA!', 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-icon">ℹ️</div>
        <div class="notification-content">
            <p>${message}</p>
        </div>
        <div class="notification-close">×</div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }
    }, 5000);
}

// Estilos para notificações
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #00BFFF;
        border-left: 4px solid #FFFFFF;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        padding: 15px;
        display: flex;
        align-items: center;
        min-width: 300px;
        max-width: 400px;
        z-index: 1000;
        transform: translateX(120%);
        transition: transform 0.5s ease;
        border: 2px solid #FFFFFF;
    }
    .notification-icon {
        color: #FFFFFF;
        font-size: 20px;
        margin-right: 15px;
    }
    .notification-content {
        flex: 1;
    }
    .notification-content p {
        margin: 0;
        font-size: 14px;
        color: #FFFFFF;
    }
    .notification-close {
        color: #FFFFFF;
        cursor: pointer;
        padding: 5px;
    }
    .notification-close:hover {
        color: #000000;
        background-color: #FFFFFF;
        border-radius: 3px;
    }
`;

document.head.appendChild(notificationStyles);