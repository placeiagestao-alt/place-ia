// Elementos DOM
const navItems = document.querySelectorAll('.nav-item');
const tataInput = document.getElementById('tataInput');
const tataSendBtn = document.getElementById('tataSendBtn');
const ctaButton = document.querySelector('.cta-button');
const planButtons = document.querySelectorAll('.plan-button');
const marketplaceLogos = document.querySelectorAll('.marketplace-logo');
const dashboardCards = document.querySelectorAll('.dashboard-card');

// Navegação
navItems.forEach(item => {
    item.addEventListener('click', function() {
        // Remove a classe active de todos os itens
        navItems.forEach(nav => nav.classList.remove('active'));
        // Adiciona a classe active ao item clicado
        this.classList.add('active');
        
        // Aqui você pode adicionar lógica para mudar de página/seção
        const section = this.textContent.trim().replace(/^\s*\S+\s*/, '').toLowerCase();
        console.log(`Navegando para: ${section}`);
        
        // Simulação de mudança de página (pode ser implementado com rotas reais)
        if (section === 'dashboard') {
            alert('Redirecionando para o Dashboard...');
        } else if (section === 'minha loja') {
            alert('Redirecionando para Minha Loja...');
        } else if (section === 'tata ia') {
            // Scroll para a seção da TaTa
            const tataSection = document.querySelector('.tata-section');
            if (tataSection) {
                tataSection.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (section === 'configurações') {
            alert('Redirecionando para Configurações...');
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

function sendMessageToTaTa() {
    const message = tataInput.value.trim();
    if (message === '') return;
    
    // Adiciona a mensagem do usuário ao chat
    addMessageToChat(message, 'user');
    
    // Limpa o input
    tataInput.value = '';
    
    // Simula resposta da IA (em uma aplicação real, isso seria uma chamada de API)
    setTimeout(() => {
        const response = generateTaTaResponse(message);
        addMessageToChat(response, 'ai');
    }, 1000);
}

function addMessageToChat(message, sender) {
    const tataChat = document.querySelector('.tata-chat');
    if (!tataChat) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `tata-message tata-message-${sender}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'tata-avatar';
    
    const icon = document.createElement('i');
    icon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    avatarDiv.appendChild(icon);
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'tata-bubble';
    bubbleDiv.textContent = message;
    
    if (sender === 'user') {
        messageDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(avatarDiv);
    } else {
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
    }
    
    tataChat.appendChild(messageDiv);
    
    // Scroll para a última mensagem
    tataChat.scrollTop = tataChat.scrollHeight;
}

function generateTaTaResponse(message) {
    // Simulação de respostas da TaTa baseadas em palavras-chave
    message = message.toLowerCase();
    
    if (message.includes('vendas') && (message.includes('hoje') || message.includes('dia'))) {
        return 'Hoje você já fez 24 vendas totalizando R$ 2.450,00. Isso representa um aumento de 25% em relação a ontem! Seus melhores marketplaces hoje são: Mercado Livre (12 vendas), Shopee (8 vendas) e Amazon (3 vendas). Quer que eu detalhe algum marketplace específico?';
    } 
    else if (message.includes('vendas') && message.includes('ontem')) {
        return 'Parabéns, chefe! Ontem você fez 18 vendas totalizando R$ 1.960,30. Isso representa um aumento de 22% em relação ao mesmo dia da semana passada! O Mercado Livre foi seu melhor canal com 10 vendas (R$ 1.250,00).';
    }
    else if (message.includes('vendas') && message.includes('semana')) {
        return 'Esta semana você já fez 85 vendas totalizando R$ 9.780,50. Estamos 28% acima da meta semanal! Seus produtos mais vendidos da semana são: Fone de Ouvido Bluetooth (15 unidades), Smartwatch XYZ (8 unidades) e Carregador Portátil (6 unidades).';
    }
    else if (message.includes('produtos') && message.includes('parados')) {
        return 'Você tem 8 produtos sem vendas há mais de 10 dias. Analisei esses itens e identifiquei os seguintes problemas: 3 com preços acima da concorrência, 2 com fotos de baixa qualidade e 3 com títulos pouco otimizados. Quer que eu sugira melhorias específicas para cada um?';
    }
    else if (message.includes('melhor') && message.includes('produto')) {
        return 'Seu melhor produto este mês é "Fone de Ouvido Bluetooth XYZ" com 15 vendas e faturamento de R$ 1.875,00. A taxa de conversão deste produto é de 4.2%, bem acima da média da sua loja (2.8%). Recomendo aumentar o estoque, pois restam apenas 5 unidades.';
    }
    else if (message.includes('mercado livre') || message.includes('ml')) {
        return 'Sua loja no Mercado Livre teve 42 vendas este mês, totalizando R$ 5.340,50. A taxa de conversão está em 2.8% (aumento de 0.3% em relação ao mês anterior). Você tem 65 produtos ativos e sua avaliação média é 4.8/5.0. Quer que eu analise oportunidades de melhoria?';
    }
    else if (message.includes('shopee')) {
        return 'Sua loja na Shopee teve 28 vendas este mês, totalizando R$ 2.980,30. A taxa de conversão está em 2.1% (aumento de 0.2% em relação ao mês anterior). Você tem 58 produtos ativos e sua avaliação média é 4.6/5.0. Identifiquei 5 produtos com potencial para impulsionamento.';
    }
    else if (message.includes('amazon')) {
        return 'Sua loja na Amazon teve 15 vendas este mês, totalizando R$ 1.875,20. A taxa de conversão está em 1.9%. Você tem 42 produtos ativos e sua avaliação média é 4.5/5.0. Recomendo melhorar as palavras-chave de 8 produtos para aumentar a visibilidade na busca.';
    }
    else if (message.includes('magalu') || message.includes('magazine luiza')) {
        return 'Sua loja na Magalu teve 10 vendas este mês, totalizando R$ 1.250,00. A taxa de conversão está em 2.0%. Você tem 35 produtos ativos e sua avaliação média é 4.7/5.0. Este marketplace está crescendo 15% ao mês em suas vendas.';
    }
    else if (message.includes('americanas')) {
        return 'Sua loja nas Americanas teve 8 vendas este mês, totalizando R$ 980,00. A taxa de conversão está em 1.8%. Você tem 30 produtos ativos e sua avaliação média é 4.4/5.0. Esta é sua integração mais recente e ainda tem potencial de crescimento.';
    }
    else if (message.includes('visitantes') || message.includes('tráfego')) {
        return 'Este mês, suas lojas receberam 1.245 visitantes únicos (+18% vs. mês anterior). As visualizações de página chegaram a 3.780 com tempo médio de 3:45 min. A origem do tráfego é: 45% orgânico, 25% direto, 20% redes sociais e 10% email marketing.';
    }
    else if (message.includes('plano') || message.includes('assinatura')) {
        return 'Você está no período de teste gratuito de 7 dias. Temos dois planos disponíveis: Mensal (R$ 99,90/mês) e Anual (R$ 999,00/ano, economia de R$ 199,80). Ambos incluem todas as funcionalidades da plataforma. Quer que eu detalhe os benefícios de cada plano?';
    }
    else if (message.includes('ajuda') || message.includes('ajudar')) {
        return 'Posso te ajudar com informações sobre vendas, produtos, performance, sugestões de otimização, análise de concorrência, tendências de mercado e muito mais. Também posso criar campanhas de impulsionamento e otimizar seus anúncios automaticamente. O que você precisa?';
    }
    else if (message.includes('obrigado') || message.includes('obrigada')) {
        return 'Sempre às ordens, chefe! Estou aqui para ajudar você a vender mais e melhor! Lembre-se que estou constantemente analisando seus dados para identificar oportunidades de crescimento para o seu negócio.';
    }
    else {
        return 'Desculpe, não entendi completamente. Você pode perguntar sobre suas vendas, produtos, performance, marketplaces específicos (Mercado Livre, Shopee, Amazon, Magalu, Americanas), visitantes, planos ou pedir sugestões de otimização.';
    }
}

// Botões de Planos
if (planButtons.length > 0) {
    planButtons.forEach(button => {
        button.addEventListener('click', function() {
            const plan = this.getAttribute('data-plan');
            
            // Definir informações dos planos
            const planInfo = {
                'free': { name: 'Grátis', price: 'R$ 0,00/mês', action: 'Começar teste gratuito' },
                'essential': { name: 'Essencial', price: 'R$ 97,00/mês', action: 'Assinar plano' },
                'plus': { name: 'Plus', price: 'R$ 197,00/mês', action: 'Assinar plano' },
                'scale': { name: 'Escala', price: 'R$ 297,00/mês', action: 'Assinar plano' },
                'supreme': { name: 'Supreme', price: 'R$ 497,00/mês', action: 'Assinar plano' },
                'unlimited': { name: 'Ilimitado', price: 'R$ 997,00/mês', action: 'Assinar plano' }
            };
            
            // Destaca o plano selecionado
            const planCards = document.querySelectorAll('.plan-card');
            planCards.forEach(card => card.classList.remove('selected'));
            this.closest('.plan-card').classList.add('selected');
            
            const selectedPlan = planInfo[plan];
            if (selectedPlan) {
                // Atualiza o texto do botão CTA se existir
                if (ctaButton) {
                    ctaButton.textContent = `${selectedPlan.action} - ${selectedPlan.name}`;
                }
                
                if (plan === 'free') {
                    alert(`${selectedPlan.action} - Plano ${selectedPlan.name}!\nVocê terá acesso completo por 7 dias.`);
                    // Redirecionar para cadastro gratuito
                    // window.location.href = 'cadastro-gratuito.html';
                } else {
                    alert(`Você selecionou o Plano ${selectedPlan.name} (${selectedPlan.price}).\nClique em "Começar Teste Gratuito" para prosseguir com 7 dias grátis.`);
                }
            }
        });
    });
}

// Adicionar funcionalidade ao formulário de contato
const trialForm = document.getElementById('trial-form');
if (trialForm) {
    trialForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Impedir o envio padrão do formulário
        
        // Coletar dados do formulário
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const marketplace = document.getElementById('marketplace').value;
        
        // Verificar qual plano foi selecionado
        const selectedPlanCard = document.querySelector('.plan-card.selected');
        let planType = 'Plus'; // Plano padrão se nenhum for selecionado
        let planPrice = 'R$ 197,00/mês';
        let planData = 'plus';
        
        if (selectedPlanCard) {
            const planButton = selectedPlanCard.querySelector('.plan-button');
            if (planButton) {
                planData = planButton.getAttribute('data-plan');
                const planInfo = {
                    'free': { name: 'Grátis', price: 'R$ 0,00/mês' },
                    'essential': { name: 'Essencial', price: 'R$ 97,00/mês' },
                    'plus': { name: 'Plus', price: 'R$ 197,00/mês' },
                    'scale': { name: 'Escala', price: 'R$ 297,00/mês' },
                    'supreme': { name: 'Supreme', price: 'R$ 497,00/mês' },
                    'unlimited': { name: 'Ilimitado', price: 'R$ 997,00/mês' }
                };
                
                if (planInfo[planData]) {
                    planType = planInfo[planData].name;
                    planPrice = planInfo[planData].price;
                }
            }
        }
        
        // Simular o envio dos dados para um servidor (em produção, isso seria uma chamada AJAX)
        console.log('Dados do formulário:', { name, email, phone, marketplace, planType, planPrice, planData });
        
        // Mostrar mensagem de sucesso
        const successMessage = planData === 'free' ? 
            `Olá ${name}! Seu acesso gratuito ao Plano ${planType} foi iniciado com sucesso.` :
            `Olá ${name}! Seu teste gratuito de 7 dias do Plano ${planType} foi iniciado com sucesso.`;
        
        showNotification(successMessage, 'success');
        
        // Mensagem detalhada
        setTimeout(() => {
            const detailedMessage = planData === 'free' ?
                `Parabéns, ${name}! Seu acesso ao Plano ${planType} foi iniciado com sucesso.\n\nEnviamos um e-mail para ${email} com instruções de acesso.\n\nAproveite as funcionalidades básicas do Place IA para o seu marketplace ${marketplace}!` :
                `Parabéns, ${name}! Seu teste gratuito de 7 dias do Plano ${planType} (${planPrice}) foi iniciado com sucesso.\n\nEnviamos um e-mail para ${email} com instruções de acesso.\n\nAproveite todas as funcionalidades do Place IA para o seu marketplace ${marketplace}!`;
            
            alert(detailedMessage);
            
            // Limpar o formulário
            trialForm.reset();
            
            // Remover seleção de plano
            const planCards = document.querySelectorAll('.plan-card');
            planCards.forEach(card => card.classList.remove('selected'));
        }, 1000);
    });
}

// Animações e efeitos visuais
document.addEventListener('DOMContentLoaded', function() {
    // Destacar o plano Plus como recomendado por padrão
    const plusPlanButton = document.querySelector('[data-plan="plus"]');
    if (plusPlanButton) {
        // Simular clique no plano Plus (mais popular)
        setTimeout(() => {
            plusPlanButton.click();
        }, 1000);
    }
    
    // Animação de entrada para os cards de features
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100);
        }, index * 200);
    });
    
    // Animação para os cards do dashboard
    dashboardCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, 100);
        }, 500 + index * 200);
        
        // Adiciona interatividade aos cards do dashboard
        card.addEventListener('click', function() {
            const cardType = this.classList.contains('sales-card') ? 'vendas' : 
                            this.classList.contains('products-card') ? 'produtos' : 
                            this.classList.contains('performance-card') ? 'performance' : 'visitantes';
            
            let detailMessage = '';
            
            switch(cardType) {
                case 'vendas':
                    detailMessage = 'Detalhamento de Vendas:\n\n' +
                                   '- Mercado Livre: R$ 1.250,00 (12 vendas)\n' +
                                   '- Shopee: R$ 780,00 (8 vendas)\n' +
                                   '- Amazon: R$ 320,00 (3 vendas)\n' +
                                   '- Magalu: R$ 100,00 (1 venda)\n\n' +
                                   'Total: R$ 2.450,00 (24 vendas)';
                    break;
                case 'produtos':
                    detailMessage = 'Detalhamento de Produtos:\n\n' +
                                   '- Ativos: 68 produtos\n' +
                                   '- Pausados: 12 produtos\n' +
                                   '- Em análise: 5 produtos\n' +
                                   '- Com estoque baixo: 8 produtos\n\n' +
                                   'Produtos mais vendidos:\n' +
                                   '1. Fone de Ouvido Bluetooth (15 unidades)\n' +
                                   '2. Smartwatch XYZ (8 unidades)\n' +
                                   '3. Carregador Portátil (6 unidades)';
                    break;
                case 'performance':
                    detailMessage = 'Detalhamento de Performance:\n\n' +
                                   '- Taxa de conversão: 3.2%\n' +
                                   '- CTR médio: 4.8%\n' +
                                   '- Tempo médio de entrega: 2.3 dias\n' +
                                   '- Avaliação média: 4.7/5.0\n\n' +
                                   'Oportunidades de melhoria:\n' +
                                   '- Otimizar títulos de 12 produtos\n' +
                                   '- Melhorar fotos de 8 produtos\n' +
                                   '- Revisar preços de 5 produtos';
                    break;
                case 'visitantes':
                    detailMessage = 'Detalhamento de Visitantes:\n\n' +
                                   '- Visitantes únicos: 1.245\n' +
                                   '- Visualizações de página: 3.780\n' +
                                   '- Tempo médio no site: 3:45 min\n' +
                                   '- Taxa de rejeição: 32%\n\n' +
                                   'Origem do tráfego:\n' +
                                   '- Orgânico: 45%\n' +
                                   '- Direto: 25%\n' +
                                   '- Redes sociais: 20%\n' +
                                   '- Email: 10%';
                    break;
            }
            
            alert(detailMessage);
        });
    });
    
    // Adiciona interatividade aos logos dos marketplaces
    marketplaceLogos.forEach(logo => {
        logo.addEventListener('click', function() {
            const marketplace = this.textContent.trim();
            let marketplaceInfo = '';
            
            switch(marketplace) {
                case 'Mercado Livre':
                    marketplaceInfo = 'Mercado Livre:\n\n' +
                                     '- Vendas este mês: 42 (R$ 5.340,50)\n' +
                                     '- Taxa de conversão: 2.8%\n' +
                                     '- Produtos ativos: 65\n' +
                                     '- Avaliação da loja: 4.8/5.0';
                    break;
                case 'Shopee':
                    marketplaceInfo = 'Shopee:\n\n' +
                                     '- Vendas este mês: 28 (R$ 2.980,30)\n' +
                                     '- Taxa de conversão: 2.1%\n' +
                                     '- Produtos ativos: 58\n' +
                                     '- Avaliação da loja: 4.6/5.0';
                    break;
                case 'Amazon':
                    marketplaceInfo = 'Amazon:\n\n' +
                                     '- Vendas este mês: 15 (R$ 1.875,20)\n' +
                                     '- Taxa de conversão: 1.9%\n' +
                                     '- Produtos ativos: 42\n' +
                                     '- Avaliação da loja: 4.5/5.0';
                    break;
                case 'Magalu':
                    marketplaceInfo = 'Magalu:\n\n' +
                                     '- Vendas este mês: 10 (R$ 1.250,00)\n' +
                                     '- Taxa de conversão: 2.0%\n' +
                                     '- Produtos ativos: 35\n' +
                                     '- Avaliação da loja: 4.7/5.0';
                    break;
                case 'Americanas':
                    marketplaceInfo = 'Americanas:\n\n' +
                                     '- Vendas este mês: 8 (R$ 980,00)\n' +
                                     '- Taxa de conversão: 1.8%\n' +
                                     '- Produtos ativos: 30\n' +
                                     '- Avaliação da loja: 4.4/5.0';
                    break;
            }
            
            alert(marketplaceInfo);
        });
    });
});

// Simulação de notificações do sistema
setTimeout(() => {
    showNotification('Nova venda realizada! Fone de Ouvido Bluetooth por R$ 129,90');
}, 10000);

setTimeout(() => {
    showNotification('Produto "Smartwatch XYZ" precisa de reposição de estoque.');
}, 25000);

function showNotification(message) {
    // Cria o elemento de notificação
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-bell"></i>
        </div>
        <div class="notification-content">
            <p>${message}</p>
        </div>
        <div class="notification-close">
            <i class="fas fa-times"></i>
        </div>
    `;
    
    // Adiciona ao corpo do documento
    document.body.appendChild(notification);
    
    // Animação de entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Configura o botão de fechar
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            notification.remove();
        }, 500);
    });
    
    // Auto-fechar após 5 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
}

// Adiciona estilos CSS para notificações dinamicamente
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: white;
        border-left: 4px solid var(--primary-color);
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
    }
    
    .notification-icon {
        color: var(--primary-color);
        font-size: 20px;
        margin-right: 15px;
    }
    
    .notification-content {
        flex: 1;
    }
    
    .notification-content p {
        margin: 0;
        font-size: 14px;
    }
    
    .notification-close {
        color: #999;
        cursor: pointer;
        padding: 5px;
    }
    
    .notification-close:hover {
        color: #333;
    }
`;

document.head.appendChild(notificationStyles);