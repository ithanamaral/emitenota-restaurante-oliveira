const { ipcRenderer } = require('electron');
const db = require('./database.js');
let appData = db.readDB();

// Garante que o array de impressões exista
if (!appData.impressoes) {
    appData.impressoes = [];
}

let ordersQueue = []; // Buffer para guardar até 6 pedidos
let editingOrderId = null; // Guarda o ID do pedido que está sendo editado
let isViewingHistory = false; // Indica se estamos visualizando uma impressão do histórico
let currentHistoryOrders = []; // Guarda os pedidos da folha histórica sendo visualizada
let hasSavedCurrentQueue = false; // Evita salvar a mesma fila de impressão múltiplas vezes na mesma sessão


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

    //Captura a sobremesa
    const sobremesa = document.getElementById('sobremesa-input').value;
    
    // Pega o valor formatado do input
    const baseAmountStr = document.getElementById('pricevalue').value;
    const freteStr = document.getElementById('fretevalue').value;

    let amountStr = baseAmountStr;
    const isEntrega = (entrega === 'Entrega');
    if (isEntrega && freteStr) {
        const baseAmount = parseBRL(baseAmountStr);
        const frete = parseBRL(freteStr);
        amountStr = formatBRL(baseAmount + frete);
    }

    if (editingOrderId === null && ordersQueue.length >= 6) {
        alert("A folha já está cheia (6/6)! Imprima ou limpe a folha primeiro.");
        return;
    }

    // Cria o objeto do pedido e adiciona à fila
    const order = {
        sender, receiver, phone, 
        carnes: carnesValues, 
        acompanhamentos: acompValues, 
        bebidas: bebidaValues,
        pagamento, tamanho, quantity, entrega, talher, observacoes, sobremesa,
        baseAmount: baseAmountStr,
        frete: isEntrega ? freteStr : "",
        amount: amountStr,
        date: new Date().toLocaleString('pt-BR'),
        id: Math.floor(Math.random() * 1000000)
    };

    const wasEditing = (editingOrderId !== null);

    if (wasEditing) {
        const index = ordersQueue.findIndex(o => o.id === editingOrderId);
        if (index !== -1) {
            order.id = editingOrderId; // preserva o ID original
            order.date = ordersQueue[index].date; // preserva a data original
            ordersQueue[index] = order; // atualiza na mesma posição
        } else {
            ordersQueue.push(order);
        }
        editingOrderId = null;
    } else {
        ordersQueue.push(order);
    }

    // Salva automaticamente o cliente se for novo
    const clientExists = appData.clientes.some(c => c.nome.toLowerCase() === sender.toLowerCase());
    if (!clientExists && sender && receiver && phone) {
        appData.clientes.push({
            id: Date.now(),
            nome: sender,
            endereco: receiver,
            telefone: phone
        });
        db.writeDB(appData);
        updateClientsDatalist();
    }

    updateQueueUI();
    setEditMode(false);
    
    // Limpa o formulário e remove os selects extras
    e.target.reset();
    toggleFreteVisibility();
    document.querySelectorAll('.btn-remove').forEach(btn => btn.parentElement.remove());

    if (wasEditing) {
        document.getElementById('btnShowSheet').click();
    }
});

function updateQueueUI() {
    const el = document.getElementById('queue-count');
    if (el) el.innerText = ordersQueue.length;
}

// Controla a visibilidade e os textos dos botões na tela de formulário conforme o modo de edição
function setEditMode(isEditing) {
    const btnQuickFill = document.getElementById('btnQuickFill');
    const btnShowSheet = document.getElementById('btnShowSheet');
    const btnTestLayout = document.getElementById('btnTestLayout');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const btnAddToList = document.getElementById('btnAddToList');

    if (isEditing) {
        btnQuickFill.classList.add('hidden');
        btnShowSheet.classList.add('hidden');
        btnTestLayout.classList.add('hidden');
        btnCancelEdit.classList.remove('hidden');
        btnAddToList.innerHTML = `➕ Atualizar na Folha`;
    } else {
        btnQuickFill.classList.remove('hidden');
        btnShowSheet.classList.remove('hidden');
        btnTestLayout.classList.remove('hidden');
        btnCancelEdit.classList.add('hidden');
        btnAddToList.innerHTML = `➕ Adicionar à Folha (<span id="queue-count">${ordersQueue.length}</span>/6)`;
    }
}

// Função para renderizar a grade de notas (suporta ativa e histórica)
function renderReceiptGrid(orders, isHistory = false) {
    const grid = document.getElementById('receipt-grid');
    grid.innerHTML = ''; // Limpa a grade antes de renderizar

    orders.forEach(order => {
        grid.innerHTML += `
            <div class="receipt-container">
                ${!isHistory ? `
                <div class="receipt-actions no-print">
                    <button class="btn-edit" onclick="editOrder(${order.id})">✏️ Editar</button>
                    <button class="btn-delete" onclick="deleteOrder(${order.id})">🗑️ Excluir</button>
                </div>
                ` : ''}
                <div class="receipt-header">
                    <img src="public/logo-oliveira.png" style="width: 40px !important;">
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
                                <div class="info-value indent-list">${order.carnes.map(i => `• ${i}`).join('<br>')}</div>
                            </div>` : ''}
                            ${order.acompanhamentos.length > 0 ? `
                            <div class="info-row">
                                <span class="info-label">ACOMPANHAMENTOS:</span>
                                <br>
                                <div class="info-value indent-list">${order.acompanhamentos.map(i => `• ${i}`).join('<br>')}</div>
                            </div>` : ''}
                            ${order.bebidas.length > 0 ? `
                            <div class="info-row">
                                <span class="info-label">BEBIDAS:</span>
                                <br>
                                <div class="info-value indent-list">${order.bebidas.map(i => `• ${i}`).join('<br>')}</div>
                            </div>` : ''}
                            ${order.sobremesa ? `<div style="background:#fffaf0; padding:4px; font-size:9px; border-radius:4px; margin-top:5px; border-left: 2px solid var(--accent-color);"><strong>Sobremesa:</strong> ${order.sobremesa}</div>` : ''}
                            ${order.observacoes ? `<div style="background:#f7f7f7; padding:4px; font-size:9px; border-radius:4px; margin-top:5px;"><strong>Obs:</strong> ${order.observacoes}</div>` : ''}
                        </div>
                    </div>
                <div class="total-section">
                    ${order.frete ? `
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#718096; margin-bottom:1px;">
                        <span>SUBTOTAL</span>
                        <span>R$ ${order.baseAmount || order.amount}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#718096; margin-bottom:2px; border-bottom:1px dashed #e2e8f0; padding-bottom:2px;">
                        <span>FRETE</span>
                        <span>R$ ${order.frete}</span>
                    </div>
                    ` : ''}
                    <div class="total-row">
                        <span style="font-weight:700; color:#718096;">TOTAL</span>
                        <span class="total-value">R$ ${order.amount}</span>
                    </div>
                    <div class="payment-badge">${order.pagamento} • ${order.entrega}</div>
                </div>
            </div>`;
    });
}

// Botão para mostrar a grade de 6 notas
document.getElementById('btnShowSheet').addEventListener('click', () => {
    if (ordersQueue.length === 0) {
        alert("Adicione pelo menos um pedido à folha.");
        return;
    }
    
    isViewingHistory = false;
    hasSavedCurrentQueue = false; // Permite salvar a fila ao clicar em Imprimir
    renderReceiptGrid(ordersQueue, false);

    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');
});

document.getElementById('btnClearQueue').addEventListener('click', () => {
    if(confirm("Deseja realmente limpar toda a folha?")) {
        ordersQueue = [];
        updateQueueUI();
        editingOrderId = null;
        setEditMode(false);
        document.getElementById('btnBack').click();
    }
});

// Botão de cancelar edição e voltar para a visualização da impressão
document.getElementById('btnCancelEdit').addEventListener('click', () => {
    editingOrderId = null;
    setEditMode(false);
    
    // Limpa o formulário e remove os selects extras
    document.getElementById('remessaForm').reset();
    toggleFreteVisibility();
    document.querySelectorAll('.btn-remove').forEach(btn => btn.parentElement.remove());

    // Volta para o preview de impressão
    document.getElementById('btnShowSheet').click();
});

// Funções auxiliares para manipulação de moeda BRL (ex: "20,00" <-> 20.0)
function parseBRL(valueStr) {
    if (!valueStr) return 0;
    const cleanStr = valueStr.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(cleanStr);
    return isNaN(val) ? 0 : val;
}

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
}

// Lógica de visibilidade do campo de frete dependendo da forma de entrega
const deliverySelect = document.getElementById('delivery-select');
const freteGroup = document.getElementById('frete-group');
const freteInput = document.getElementById('fretevalue');

function toggleFreteVisibility() {
    if (deliverySelect.value === 'Entrega') {
        freteGroup.style.display = 'block';
    } else {
        freteGroup.style.display = 'none';
        freteInput.value = ''; // Limpa o frete caso mude para Retirada
    }
}

// Inicializa a visibilidade e adiciona listener
deliverySelect.addEventListener('change', toggleFreteVisibility);
toggleFreteVisibility();

// Máscara para o campo de valor do frete (Moeda R$) em tempo real
freteInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (value === "") return;
    const result = formatBRL(parseFloat(value) / 100);
    e.target.value = result;
});

// Máscara para o campo de valor (Moeda R$) em tempo real
document.getElementById('pricevalue').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (value === "") {
        e.target.value = "";
        return;
    }
    
    // Formata o número para o padrão brasileiro (ex: 1.250,50)
    const result = formatBRL(parseFloat(value) / 100);
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

    // Se não estiver visualizando o histórico, salva a folha atual no JSON do banco de dados
    if (!isViewingHistory && !hasSavedCurrentQueue && ordersQueue.length > 0) {
        const printSession = {
            id: Date.now(),
            date: new Date().toLocaleString('pt-BR'),
            orders: JSON.parse(JSON.stringify(ordersQueue))
        };
        appData.impressoes.push(printSession);
        db.writeDB(appData);
        hasSavedCurrentQueue = true; // Marca como salvo para não duplicar nesta mesma visualização
    }

    await ipcRenderer.invoke('print-to-pdf');

    btn.innerText = originalText;
    btn.disabled = false;
});

// Botão Voltar (Na pré-visualização)
document.getElementById('btnBack').addEventListener('click', () => {
    document.getElementById('receipt-area').classList.add('hidden');
    if (isViewingHistory) {
        document.getElementById('history-container').classList.remove('hidden');
        isViewingHistory = false;
        // Restaura as configurações originais da área de comprovante
        document.getElementById('btnBack').innerText = "✏️ Voltar / Editar";
        document.getElementById('btnClearQueue').classList.remove('hidden');
    } else {
        document.getElementById('form-container').classList.remove('hidden');
    }
});

// Função para editar um pedido da fila
window.editOrder = (orderId) => {
    const orderIndex = ordersQueue.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = ordersQueue[orderIndex];
    editingOrderId = orderId; // guarda o ID sendo editado

    // Preenche campos de texto e selects simples
    document.getElementById('senderName').value = order.sender;
    document.getElementById('receiverName').value = order.receiver;
    document.getElementById('receiverPhone').value = order.phone;
    document.getElementById('tamanho-select').value = order.tamanho;
    document.getElementById('quantity-input').value = order.quantity;
    document.getElementById('pricevalue').value = order.baseAmount || order.amount;
    document.getElementById('fretevalue').value = order.frete || "";
    document.getElementById('pagamento-select').value = order.pagamento;
    document.getElementById('delivery-select').value = order.entrega;
    document.getElementById('talher-select').value = order.talher;
    document.getElementById('observation-input').value = order.observacoes;
    document.getElementById('sobremesa-input').value = order.sobremesa || "";

    // Atualiza a visibilidade do frete baseado no que foi restaurado
    toggleFreteVisibility();

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

    // Entra no modo de edição na UI
    setEditMode(true);

    // Volta para a tela de formulário
    document.getElementById('btnBack').click();
};

// Função para excluir um pedido da fila
window.deleteOrder = (orderId) => {
    if (confirm("Deseja realmente excluir este pedido?")) {
        const orderIndex = ordersQueue.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;

        ordersQueue.splice(orderIndex, 1); // Remove da fila atual
        updateQueueUI();

        // Se a fila ficar vazia, volta para a tela de formulário
        if (ordersQueue.length === 0) {
            document.getElementById('btnBack').click();
        } else {
            // Caso contrário, reconstrói o grid com os pedidos restantes
            document.getElementById('btnShowSheet').click();
        }
    }
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

    // Sorteia forma de entrega: Entrega ou Retirada
    const deliverySelect = document.getElementById('delivery-select');
    deliverySelect.value = Math.random() > 0.4 ? "Entrega" : "Retirada";
    toggleFreteVisibility();

    // Se for entrega, gera valor de frete aleatório
    if (deliverySelect.value === "Entrega") {
        const freteInput = document.getElementById('fretevalue');
        freteInput.value = Math.floor(400 + Math.random() * 800); // R$ 4,00 a R$ 11,99
        freteInput.dispatchEvent(new Event('input'));
    }

    // Sorteia forma de pagamento
    const pagamentoSelect = document.getElementById('pagamento-select');
    const pagamentos = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Dinheiro"];
    pagamentoSelect.value = pagamentos[Math.floor(Math.random() * pagamentos.length)];

    // Sorteia tamanho da marmita
    const tamanhoSelect = document.getElementById('tamanho-select');
    const tamanhos = ["Pequena", "Média", "Grande"];
    tamanhoSelect.value = tamanhos[Math.floor(Math.random() * tamanhos.length)];

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
    
    const desserts = ["Pudim de Leite", "Mousse de Maracujá", "Gelatina Colorida", "Salada de Frutas", "Brownie de Chocolate", "Pavê de Baunilha", "Nenhuma (Sem Sobremesa)"];
    const randomDessert = desserts[Math.floor(Math.random() * desserts.length)];
    document.getElementById('sobremesa-input').value = randomDessert === "Nenhuma (Sem Sobremesa)" ? "" : randomDessert;
    
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

// POPULAR SELECTS E DATALIST DO BANCO DE DADOS
function populateSelectOptions() {
    // Carnes
    const carnesSelects = document.querySelectorAll('.carne-select');
    carnesSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="" disabled selected>Selecione uma carne...</option>';
        appData.carnes.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
        select.value = currentValue;
    });

    // Acompanhamentos
    const acompSelects = document.querySelectorAll('.acomp-select');
    acompSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="" disabled selected>Selecione um acompanhamento...</option>';
        appData.acompanhamentos.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
        select.value = currentValue;
    });

    // Bebidas
    const bebidaSelects = document.querySelectorAll('.bebida-select');
    bebidaSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="" disabled selected>Selecione uma bebida...</option>';
        appData.bebidas.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
        select.value = currentValue;
    });
}

function updateClientsDatalist() {
    const datalist = document.getElementById('clientes-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    appData.clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        datalist.appendChild(opt);
    });
}

// Preenchimento automático ao digitar/selecionar cliente
document.getElementById('senderName').addEventListener('input', (e) => {
    const name = e.target.value.trim();
    const client = appData.clientes.find(c => c.nome.toLowerCase() === name.toLowerCase());
    if (client) {
        document.getElementById('receiverName').value = client.endereco;
        document.getElementById('receiverPhone').value = client.telefone;
        document.getElementById('receiverPhone').dispatchEvent(new Event('input')); // Máscara
    }
});

// LÓGICA DO MODAL DO BANCO DE DADOS
const dbModal = document.getElementById('db-modal');
let editingDbClientId = null;
let editingDbItemIndex = null;

document.getElementById('btnOpenDBManager').addEventListener('click', () => {
    dbModal.classList.remove('hidden');
    renderClientsTable();
    renderItemsTable();
});

document.getElementById('btnCloseDBManager').addEventListener('click', () => {
    dbModal.classList.add('hidden');
});

document.getElementById('btnBottomCloseDB').addEventListener('click', () => {
    dbModal.classList.add('hidden');
});

// Tabs do modal
const tabClientes = document.getElementById('tabClientes');
const tabItens = document.getElementById('tabItens');
const contentClientes = document.getElementById('contentClientes');
const contentItens = document.getElementById('contentItens');

tabClientes.addEventListener('click', () => {
    tabClientes.classList.add('active-tab');
    tabClientes.style.backgroundColor = '';
    tabItens.classList.remove('active-tab');
    tabItens.style.backgroundColor = '#718096';
    contentClientes.classList.remove('hidden');
    contentItens.classList.add('hidden');
});

tabItens.addEventListener('click', () => {
    tabItens.classList.add('active-tab');
    tabItens.style.backgroundColor = '';
    tabClientes.classList.remove('active-tab');
    tabClientes.style.backgroundColor = '#718096';
    contentItens.classList.remove('hidden');
    contentClientes.classList.add('hidden');
});

// Renderizar Clientes no Modal
function renderClientsTable() {
    const tbody = document.getElementById('dbClientsTableBody');
    tbody.innerHTML = '';
    appData.clientes.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 10px;">${c.nome}</td>
            <td style="padding: 10px;">${c.endereco}</td>
            <td style="padding: 10px;">${c.telefone}</td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">
                <button type="button" class="btn-edit" onclick="editClient(${c.id})" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;">✏️ Editar</button>
                <button type="button" class="btn-remove" onclick="deleteClient(${c.id})" style="padding: 4px 8px; font-size: 11px;">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Carrega os dados do cliente no formulário para edição
window.editClient = (id) => {
    const client = appData.clientes.find(c => c.id === id);
    if (!client) return;

    document.getElementById('dbClientName').value = client.nome;
    document.getElementById('dbClientAddress').value = client.endereco;
    document.getElementById('dbClientPhone').value = client.telefone;

    editingDbClientId = id;

    const submitBtn = document.getElementById('formAddClient').querySelector('button[type="submit"]');
    submitBtn.innerHTML = '🔄 Atualizar';
    submitBtn.style.backgroundColor = '#3182ce';
};

window.deleteClient = (id) => {
    if (confirm("Deseja realmente excluir este cliente?")) {
        appData.clientes = appData.clientes.filter(c => c.id !== id);
        db.writeDB(appData);
        updateClientsDatalist();
        renderClientsTable();
    }
};

// Formulário de adicionar/atualizar cliente no modal
document.getElementById('formAddClient').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('dbClientName').value.trim();
    const endereco = document.getElementById('dbClientAddress').value.trim();
    const telefone = document.getElementById('dbClientPhone').value.trim();
    
    if (editingDbClientId !== null) {
        // Modo de atualização
        const client = appData.clientes.find(c => c.id === editingDbClientId);
        if (client) {
            client.nome = nome;
            client.endereco = endereco;
            client.telefone = telefone;
        }
        editingDbClientId = null;
    } else {
        // Modo de criação
        if (appData.clientes.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
            alert("Já existe um cliente com este nome!");
            return;
        }
        appData.clientes.push({
            id: Date.now(),
            nome,
            endereco,
            telefone
        });
    }
    db.writeDB(appData);
    e.target.reset(); // Aciona automaticamente o evento 'reset' abaixo para restaurar o botão
    updateClientsDatalist();
    renderClientsTable();
});

// Limpa/Cancela o estado de edição do cliente
document.getElementById('formAddClient').addEventListener('reset', (e) => {
    editingDbClientId = null;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '💾 Adicionar';
    submitBtn.style.backgroundColor = '';
});

// Aplicar máscara de telefone no modal
document.getElementById('dbClientPhone').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value.substring(0, 15);
});

// Itens (Carnes, Acomp, Bebidas) no Modal
const dbItemListSelector = document.getElementById('dbItemListSelector');
dbItemListSelector.addEventListener('change', () => {
    renderItemsTable();
});

function renderItemsTable() {
    const tbody = document.getElementById('dbItemsTableBody');
    tbody.innerHTML = '';
    const listName = dbItemListSelector.value;
    const items = appData[listName];
    
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 10px;">${item}</td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">
                <button type="button" class="btn-edit" onclick="editItem('${listName}', ${index})" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;">✏️ Editar</button>
                <button type="button" class="btn-remove" onclick="deleteItem('${listName}', ${index})" style="padding: 4px 8px; font-size: 11px;">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Carrega o item no formulário para edição
window.editItem = (listName, index) => {
    const item = appData[listName][index];
    document.getElementById('dbItemName').value = item;

    editingDbItemIndex = { listName, index };

    const submitBtn = document.getElementById('formAddItem').querySelector('button[type="submit"]');
    submitBtn.innerHTML = '🔄 Atualizar';
    submitBtn.style.backgroundColor = '#3182ce';

    // Desativa a mudança de lista para evitar inconsistência na atualização
    document.getElementById('dbItemListSelector').disabled = true;
};

window.deleteItem = (listName, index) => {
    if (confirm(`Deseja realmente excluir este item da lista de ${listName}?`)) {
        appData[listName].splice(index, 1);
        db.writeDB(appData);
        renderItemsTable();
        populateSelectOptions();
    }
};

document.getElementById('formAddItem').addEventListener('submit', (e) => {
    e.preventDefault();
    const itemName = document.getElementById('dbItemName').value.trim();
    const listName = dbItemListSelector.value;
    
    if (editingDbItemIndex !== null) {
        // Modo de atualização
        const { listName: oldListName, index } = editingDbItemIndex;
        appData[oldListName][index] = itemName;
        editingDbItemIndex = null;
    } else {
        // Modo de criação
        if (appData[listName].some(item => item.toLowerCase() === itemName.toLowerCase())) {
            alert("Este item já existe nesta lista!");
            return;
        }
        appData[listName].push(itemName);
    }
    db.writeDB(appData);
    e.target.reset(); // Aciona automaticamente o reset abaixo
    renderItemsTable();
    populateSelectOptions();
});

// Limpa/Cancela o estado de edição do item
document.getElementById('formAddItem').addEventListener('reset', (e) => {
    editingDbItemIndex = null;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '💾 Adicionar';
    submitBtn.style.backgroundColor = '';
    document.getElementById('dbItemListSelector').disabled = false;
});

// Inicialização dos dados na interface
populateSelectOptions();
updateClientsDatalist();

// ==========================================
// NAVEGAÇÃO & HISTÓRICO DE IMPRESSÕES
// ==========================================

// Listener dos botões do Menu Principal
document.getElementById('btnMenuCriarNotas').addEventListener('click', () => {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('form-container').classList.remove('hidden');
});

document.getElementById('btnMenuDBManager').addEventListener('click', () => {
    document.getElementById('btnOpenDBManager').click();
});

document.getElementById('btnMenuHistory').addEventListener('click', () => {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('history-container').classList.remove('hidden');
    renderHistory();
});

// Voltar ao Menu Principal a partir do Histórico
document.getElementById('btnBackToMenuFromHistory').addEventListener('click', () => {
    document.getElementById('history-container').classList.add('hidden');
    document.getElementById('menu-container').classList.remove('hidden');
});

// Voltar ao Menu Principal a partir da Criação de Notas
document.getElementById('btnBackToMenu').addEventListener('click', () => {
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('menu-container').classList.remove('hidden');
});

// Função para listar as impressões salvas
function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    const emptyDiv = document.getElementById('history-empty');
    tbody.innerHTML = '';

    if (!appData.impressoes || appData.impressoes.length === 0) {
        emptyDiv.classList.remove('hidden');
        return;
    }
    emptyDiv.classList.add('hidden');

    // Ordena para exibir as mais recentes no topo
    const impressoes = [...appData.impressoes].reverse();

    impressoes.forEach(imp => {
        const row = document.createElement('tr');
        
        let totalVal = 0;
        imp.orders.forEach(o => {
            totalVal += parseBRL(o.amount);
        });
        const totalBRL = formatBRL(totalVal);

        row.innerHTML = `
            <td>${imp.date}</td>
            <td><span class="history-badge-count">${imp.orders.length} pedidos</span></td>
            <td><span class="history-total-amount">R$ ${totalBRL}</span></td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn-edit" onclick="viewHistoryItem(${imp.id})" style="margin-right: 6px;">🔍 Visualizar</button>
                <button type="button" class="btn-delete" onclick="deleteHistoryItem(${imp.id})">🗑️ Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Visualizar um item do histórico
window.viewHistoryItem = (id) => {
    const imp = appData.impressoes.find(i => i.id === id);
    if (!imp) return;

    isViewingHistory = true;
    currentHistoryOrders = imp.orders;

    renderReceiptGrid(currentHistoryOrders, true);

    document.getElementById('history-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');

    // Configura botões de controle na visualização
    document.getElementById('btnClearQueue').classList.add('hidden');
    const btnBack = document.getElementById('btnBack');
    btnBack.innerText = "⬅️ Voltar para Histórico";
};

// Excluir um item do histórico
window.deleteHistoryItem = (id) => {
    if (confirm("Deseja realmente excluir esta folha de impressão do histórico?")) {
        appData.impressoes = appData.impressoes.filter(i => i.id !== id);
        db.writeDB(appData);
        renderHistory();
    }
};


// Oculta a tela de carregamento inicial (Splash Screen) após 2.5 segundos
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        // Remove o elemento do DOM após o término da transição CSS (600ms)
        setTimeout(() => {
            splash.remove();
        }, 600);
    }
}, 2500);