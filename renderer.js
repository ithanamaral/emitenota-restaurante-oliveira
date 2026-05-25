const { ipcRenderer } = require('electron');

let ordersQueue = []; // Buffer para guardar até 6 pedidos

document.getElementById('remessaForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // Captura os dados
    const sender = document.getElementById('senderName').value;
    const receiver = document.getElementById('receiverName').value;
    const phone = document.getElementById('receiverPhone').value;

    // Pega todas as opções selecionadas e as formata como tópicos (bullets)
    const carnesSelects = document.querySelectorAll('.carne-select');
    const carnesValues = Array.from(carnesSelects)
        .map(select => select.value)
        .filter(val => val !== "");

    const acompSelects = document.querySelectorAll('.acomp-select');
    const acompValues = Array.from(acompSelects)
        .map(select => select.value)
        .filter(val => val !== "");

    const bebidaSelects = document.querySelectorAll('.bebida-select');
    const bebidaValues = Array.from(bebidaSelects)
        .map(select => select.value)
        .filter(val => val !== "");

    //Captura forma de pagamento
    const pagamento = document.getElementById('pagamento-select').value;

    //Captura tamanho da marmita
    const tamanho = document.getElementById('tamanho-select').value;

    // Captura quantidade de marmitas
    const quantity = document.getElementById('quantity-input').value;

    //Captura forma de entrega
    const entrega = document.getElementById('delivery-select').value;

    //Captura Talher ou não
    const talher = document.getElementById('talher-select').value;

    //Captura as observações
    const observacoes = document.getElementById('observation-input').value;
    
    // Pega o valor formatado do input
    const amountStr = document.getElementById('pricevalue').value;

    if (ordersQueue.length >= 6) {
        alert("A folha já está cheia (6/6)! Imprima ou limpe a folha primeiro.");
        return;
    }

    // Cria o objeto do pedido e adiciona à fila
    const order = {
        sender, receiver, phone, 
        carnes: carnesValues, 
        acompanhamentos: acompValues, 
        bebidas: bebidaValues,
        pagamento, tamanho, quantity, entrega, talher, observacoes,
        amount: amountStr,
        date: new Date().toLocaleString('pt-BR'),
        id: Math.floor(Math.random() * 1000000)
    };

    ordersQueue.push(order);
    updateQueueUI();
    
    // Limpa o formulário e remove os selects extras
    e.target.reset();
    document.querySelectorAll('.btn-remove').forEach(btn => btn.parentElement.remove());
});

function updateQueueUI() {
    document.getElementById('queue-count').innerText = ordersQueue.length;
}

// Botão para mostrar a grade de 6 notas
document.getElementById('btnShowSheet').addEventListener('click', () => {
    if (ordersQueue.length === 0) {
        alert("Adicione pelo menos um pedido à folha.");
        return;
    }
    
    const grid = document.getElementById('receipt-grid');
    grid.innerHTML = ''; // Limpa a grade antes de renderizar

    ordersQueue.forEach(order => {
        grid.innerHTML += `
            <div class="receipt-container">
                <div class="receipt-actions no-print">
                    <button class="btn-edit" onclick="editOrder(${order.id})">✏️ Editar</button>
                </div>
                <div class="receipt-header">
                    <img src="public/logo Restaurante oliveira.png" style="width: 40px !important;">
                    <div class="header-titles">
                        <h1>RESTAURANTE OLIVEIRA REAL</h1>
                        <p class="receipt-id">#${order.id} • ${order.date.split(',')[0]}</p>
                    </div>
                </div>
                <div class="receipt-body">
                        <div class="info-row">
                            <span class="info-label">CLIENTE:</span>
                            <span class="info-value highlight">${order.sender}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">ENDEREÇO:</span>
                            <span class="info-value">${order.receiver}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">TELEFONE:</span>
                            <span class="info-value">${order.phone}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">TAMANHO / QTD:</span>
                            <span class="info-value">${order.tamanho} (${order.quantity}x)</span>
                        </div>
                    ${order.carnes.length > 0 ? `
                    <div class="info-section">
                            <div class="info-row">
                                <span class="info-label">CARNES:</span>
                                <br>
                                <span class="info-value indent-list">${order.carnes.map(i => `• ${i}`).join('<br>')}</span>
                            </div>` : ''}
                            ${order.acompanhamentos.length > 0 ? `
                            <div class="info-row">
                                <span class="info-label">ACOMPANHAMENTOS:</span>
                                <br>
                                <span class="info-value indent-list">${order.acompanhamentos.map(i => `• ${i}`).join('<br>')}</span>
                            </div>` : ''}
                            ${order.bebidas.length > 0 ? `
                            <div class="info-row">
                                <span class="info-label">BEBIDAS:</span>
                                <br>
                                <span class="info-value indent-list">${order.bebidas.map(i => `• ${i}`).join('<br>')}</span>
                            </div>` : ''}
                            ${order.observacoes ? `<div style="background:#f7f7f7; padding:4px; font-size:9px; border-radius:4px; margin-top:5px;"><strong>Obs:</strong> ${order.observacoes}</div>` : ''}
                        </div>
                    </div>
                <div class="total-section">
                    <div class="total-row">
                        <span style="font-weight:700; color:#718096;">TOTAL</span>
                        <span class="total-value">R$ ${order.amount}</span>
                    </div>
                    <div class="payment-badge">${order.pagamento} • ${order.entrega}</div>
                </div>
            </div>`;
    });

    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');
});

document.getElementById('btnClearQueue').addEventListener('click', () => {
    if(confirm("Deseja realmente limpar toda a folha?")) {
        ordersQueue = [];
        updateQueueUI();
        document.getElementById('btnBack').click();
    }
});

// Máscara para o campo de valor (Moeda R$) em tempo real
document.getElementById('pricevalue').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (value === "") return;
    
    // Formata o número para o padrão brasileiro (ex: 1.250,50)
    const result = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(value) / 100);
    e.target.value = result;
});

// Lógica para máscara de telefone (00) 00000-0000
document.getElementById('receiverPhone').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2"); // Coloca parênteses no DDD
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");    // Coloca hífen antes dos últimos 4 dígitos
    
    e.target.value = value.substring(0, 15); // Limita o tamanho máximo
});

// Botão Imprimir (Na pré-visualização)
document.getElementById('btnPrint').addEventListener('click', async () => {
    const btn = document.getElementById('btnPrint');
    const originalText = btn.innerText;
    
    btn.innerText = "Gerando PDF...";
    btn.disabled = true;

    await ipcRenderer.invoke('print-to-pdf');

    btn.innerText = originalText;
    btn.disabled = false;
});

// Botão Voltar (Na pré-visualização)
document.getElementById('btnBack').addEventListener('click', () => {
    document.getElementById('receipt-area').classList.add('hidden');
    document.getElementById('form-container').classList.remove('hidden');
});

// Função para editar um pedido da fila
window.editOrder = (orderId) => {
    const orderIndex = ordersQueue.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = ordersQueue[orderIndex];
    ordersQueue.splice(orderIndex, 1); // Remove da fila atual
    updateQueueUI();

    // Preenche campos de texto e selects simples
    document.getElementById('senderName').value = order.sender;
    document.getElementById('receiverName').value = order.receiver;
    document.getElementById('receiverPhone').value = order.phone;
    document.getElementById('tamanho-select').value = order.tamanho;
    document.getElementById('quantity-input').value = order.quantity;
    document.getElementById('pricevalue').value = order.amount;
    document.getElementById('pagamento-select').value = order.pagamento;
    document.getElementById('delivery-select').value = order.entrega;
    document.getElementById('talher-select').value = order.talher;
    document.getElementById('observation-input').value = order.observacoes;

    // Reconstrói as linhas dinâmicas (Carnes, Acomp, Bebidas)
    const rebuildDynamic = (containerId, selectClass, values) => {
        const container = document.getElementById(containerId);
        const templateHTML = container.querySelector('.' + selectClass).outerHTML;
        container.innerHTML = '';

        values.forEach(val => {
            const row = document.createElement('div');
            row.className = 'dynamic-row';
            row.innerHTML = templateHTML;
            const select = row.querySelector('.' + selectClass);
            select.value = val;
            const btnRemove = document.createElement('button');
            btnRemove.type = 'button'; btnRemove.className = 'btn-remove'; btnRemove.innerText = 'X';
            btnRemove.onclick = () => row.remove();
            row.appendChild(btnRemove);
            container.appendChild(row);
        });

        const emptyRow = document.createElement('div');
        emptyRow.className = 'dynamic-row'; emptyRow.innerHTML = templateHTML;
        emptyRow.querySelector('.' + selectClass).value = "";
        container.appendChild(emptyRow);
    };

    rebuildDynamic('carnes-container', 'carne-select', order.carnes);
    rebuildDynamic('acompanhamentos-container', 'acomp-select', order.acompanhamentos);
    rebuildDynamic('bebidas-container', 'bebida-select', order.bebidas);

    // Volta para a tela de formulário
    document.getElementById('btnBack').click();
};

// Função para exibir o modal de confirmação assíncrono
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const msgEl = document.getElementById('confirm-message');
        const btnYes = document.getElementById('confirm-yes');
        const btnNo = document.getElementById('confirm-no');

        msgEl.innerText = message;
        modal.classList.remove('hidden');

        const handleResponse = (response) => {
            modal.classList.add('hidden');
            btnYes.removeEventListener('click', onYes);
            btnNo.removeEventListener('click', onNo);
            resolve(response);
        };

        const onYes = () => handleResponse(true);
        const onNo = () => handleResponse(false);

        btnYes.addEventListener('click', onYes);
        btnNo.addEventListener('click', onNo);
    });
}

// Lógica para adicionar selects dinamicamente
function handleDynamicSelects(containerId, selectClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // NOVO: Garante que qualquer campo deste grupo, ao ser clicado, 
    // se centralize na tela de forma suave.
    container.addEventListener('focusin', (e) => {
        if (e.target.classList.contains(selectClass)) {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    container.addEventListener('change', async (e) => {
        const select = e.target;
        if (select.classList.contains(selectClass)) {
            const newValue = select.value;
            if (newValue === "") return;

            // Verifica duplicatas
            const allSelects = container.querySelectorAll('.' + selectClass);
            let duplicateCount = 0;
            allSelects.forEach(s => {
                if (s.value === newValue) duplicateCount++;
            });

            if (duplicateCount > 1) {
                select.style.borderColor = "var(--accent-color)"; // Destaca o campo com erro
                const keep = await showCustomConfirm(`O item "${newValue}" já foi selecionado. Deseja manter a duplicata?`);
                if (!keep) {
                    select.value = "";
                    select.style.borderColor = "";
                    return;
                }
                select.style.borderColor = "";
            }

            const rows = container.querySelectorAll('.dynamic-row');
            const currentRow = select.closest('.dynamic-row');
            const isLast = currentRow === rows[rows.length - 1];
            
            if (isLast) {
                const btnRemove = document.createElement('button');
                btnRemove.type = 'button';
                btnRemove.className = 'btn-remove';
                btnRemove.innerText = 'X';
                btnRemove.onclick = () => currentRow.remove();
                currentRow.appendChild(btnRemove);

                const newRow = document.createElement('div');
                newRow.className = 'dynamic-row';
                const newSelect = select.cloneNode(true);
                newSelect.value = "";
                newRow.appendChild(newSelect);
                container.appendChild(newRow);
            }
        }
    });
}

handleDynamicSelects('carnes-container', 'carne-select');
handleDynamicSelects('acompanhamentos-container', 'acomp-select');
handleDynamicSelects('bebidas-container', 'bebida-select');

// Função para preencher o formulário com dados aleatórios
function fillFormWithRandomData() {
    const names = ["Íthan Amaral", "Ana Souza", "Carlos Alberto", "Beatriz Lima", "Ricardo Santos", "Mariana Costa"];
    const addresses = ["Rua das Flores, 123", "Av. Principal, 500", "Praça da Matriz, 10", "Alameda das Palmeiras, 88"];
    
    // Preenche campos básicos
    const name = names[Math.floor(Math.random() * names.length)];
    const address = addresses[Math.floor(Math.random() * addresses.length)];
    
    document.getElementById('senderName').value = name;
    document.getElementById('receiverName').value = address;
    
    // Simula digitação para a máscara de telefone funcionar
    const phoneInput = document.getElementById('receiverPhone');
    phoneInput.value = "319" + Math.floor(10000000 + Math.random() * 90000000);
    phoneInput.dispatchEvent(new Event('input'));

    // Simula digitação para a máscara de valor funcionar
    const priceInput = document.getElementById('pricevalue');
    priceInput.value = Math.floor(2500 + Math.random() * 5000);
    priceInput.dispatchEvent(new Event('input'));

    // Sorteia itens nos selects (Carnes e Acompanhamentos)
    const pickRandomOption = (containerId, selectClass) => {
        const container = document.getElementById(containerId);
        const selects = container.querySelectorAll('.' + selectClass);
        const lastSelect = selects[selects.length - 1];
        
        const options = Array.from(lastSelect.options).filter(opt => opt.value !== "");
        const randomOpt = options[Math.floor(Math.random() * options.length)];
        
        lastSelect.value = randomOpt.value;
        lastSelect.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Seleciona 2 carnes e 2 acompanhamentos aleatórios
    pickRandomOption('carnes-container', 'carne-select');
    setTimeout(() => pickRandomOption('carnes-container', 'carne-select'), 200); // Espera a nova linha ser criada
    pickRandomOption('acompanhamentos-container', 'acomp-select');
    
    // Adiciona uma bebida aleatória
    pickRandomOption('bebidas-container', 'bebida-select');
    
    document.getElementById('observation-input').value = "Caprichar no feijão! Teste automático.";
}

// Evento do botão "Mágico" de preenchimento
document.getElementById('btnQuickFill').addEventListener('click', fillFormWithRandomData);

// Melhora o "Testar Layout" para simular o processo real de 6 notas
document.getElementById('btnTestLayout').addEventListener('click', async () => {
    if(!confirm("Isso irá limpar sua fila e gerar 6 pedidos reais para teste. Continuar?")) return;
    
    ordersQueue = [];
    updateQueueUI();

    for(let i = 0; i < 6; i++) {
        fillFormWithRandomData();
        // Aguarda um pouco para os processos dinâmicos e envia o formulário
        await new Promise(r => setTimeout(r, 300));
        document.getElementById('remessaForm').dispatchEvent(new Event('submit'));
    }
    
    document.getElementById('btnShowSheet').click();
});