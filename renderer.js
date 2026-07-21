const { ipcRenderer } = require('electron');
const fs = require('fs');
const db = require('./database.js');
let appData = db.readDB();

// Observar mudanças no arquivo do banco de dados (a cada 500ms)
fs.watchFile(db.getActiveDbPath(), { interval: 500 }, (curr, prev) => {
    // Se a data de modificação mudou, significa que o arquivo foi salvo (local ou externamente)
    if (curr.mtimeMs !== prev.mtimeMs) {
        appData = db.readDB();
        
        // Atualiza as listas e selects visíveis na tela silenciosamente
        populateSelectOptions();
        updateClientsDatalist();
        
        // Se a tela de configuração estiver aberta, atualiza a tabela também
        const dbModal = document.getElementById('db-modal');
        if (dbModal && !dbModal.classList.contains('hidden')) {
            renderClientsTable();
            renderItemsTable();
            renderGruposSelector();
        }
        
        // Se a tela de histórico estiver aberta, atualiza a tabela
        const historyContainer = document.getElementById('history-container');
        if (historyContainer && !historyContainer.classList.contains('hidden')) {
            renderHistory();
        }
    }
});

// Garante que o array de impressões exista
if (!appData.impressoes) {
    appData.impressoes = [];
}

if (!appData.nextOrderId) {
    appData.nextOrderId = 1;
}

let ordersQueue = []; // Buffer para guardar até 6 pedidos
let editingOrderId = null; // Guarda o ID do pedido que está sendo editado
let isViewingHistory = false; // Indica se estamos visualizando uma impressão do histórico
let currentHistoryOrders = []; // Guarda os pedidos da folha histórica sendo visualizada
let hasSavedCurrentQueue = false; // Evita salvar a mesma fila de impressão múltiplas vezes na mesma sessão


document.getElementById('remessaForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Captura os dados
    const sender = document.getElementById('senderName').value;
    const receiver = document.getElementById('receiverName').value;
    const phone = document.getElementById('receiverPhone').value;
    
    // Captura se é pedido de grupo
    const isGroupOrder = document.getElementById('isGroupOrder').checked;
    let groupName = "";
    if (isGroupOrder) {
        const orderGrupoSelector = document.getElementById('orderGrupoSelector');
        if (orderGrupoSelector.selectedIndex > 0) {
            groupName = orderGrupoSelector.options[orderGrupoSelector.selectedIndex].text;
        }
    }

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
    
    // Atualiza o banco antes de manipular ids e clientes
    appData = db.readDB();
    if (isEntrega && freteStr) {
        const baseAmount = parseBRL(baseAmountStr);
        const frete = parseBRL(freteStr);
        amountStr = formatBRL(baseAmount + frete);
    }

    const ps = appData.printSettings || {};
    const isThermal = ps.pageSize === 'Thermal';
    const maxOrders = ps.maxOrdersPerSheet || 6;
    
    // Bloqueia se a folha estiver cheia e NÃO for térmica
    if (editingOrderId === null && !isThermal && ordersQueue.length >= maxOrders) {
        await showCustomAlert(`A folha já está cheia (${maxOrders}/${maxOrders})! Imprima ou limpe a folha primeiro.`);
        return;
    }

    const wasEditing = (editingOrderId !== null);

    // Cria o objeto do pedido e adiciona à fila
    const order = {
        sender, receiver, phone, groupName,
        carnes: carnesValues, 
        acompanhamentos: acompValues, 
        bebidas: bebidaValues,
        pagamento, tamanho, quantity, entrega, talher, observacoes, sobremesa,
        baseAmount: baseAmountStr,
        frete: isEntrega ? freteStr : "",
        amount: amountStr,
        date: new Date().toLocaleString('pt-BR')
    };

    if (wasEditing) {
        const index = ordersQueue.findIndex(o => o.id === editingOrderId);
        if (index !== -1) {
            order.id = editingOrderId; // preserva o ID original
            order.date = ordersQueue[index].date; // preserva a data original
            ordersQueue[index] = order; // atualiza na mesma posição
        } else {
            order.id = appData.nextOrderId++;
            db.writeDB(appData);
            ordersQueue.push(order);
        }
        editingOrderId = null;
    } else {
        order.id = appData.nextOrderId++;
        db.writeDB(appData);
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
        appData.clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
        if (btnQuickFill) btnQuickFill.classList.add('hidden');
        btnShowSheet.classList.add('hidden');
        if (btnTestLayout) btnTestLayout.classList.add('hidden');
        btnCancelEdit.classList.remove('hidden');
        btnAddToList.innerHTML = `➕ Atualizar na Folha`;
    } else {
        if (btnQuickFill) btnQuickFill.classList.remove('hidden');
        btnShowSheet.classList.remove('hidden');
        if (btnTestLayout) btnTestLayout.classList.remove('hidden');
        btnCancelEdit.classList.add('hidden');
        btnAddToList.innerHTML = `➕ Adicionar à Folha (<span id="queue-count">${ordersQueue.length}</span>/6)`;
    }
}

// Função para renderizar a grade de notas (suporta ativa e histórica)
function renderReceiptGrid(orders, isHistory = false) {
    const grid = document.getElementById('receipt-grid');
    grid.innerHTML = ''; // Limpa a grade antes de renderizar

    // Aplica o layout configurado
    const ps = appData.printSettings || { pageSize: "A4" };
    grid.className = 'receipt-grid';
    grid.classList.add(`layout-${ps.pageSize.toLowerCase()}`);
    
    // Se for custom, define dinamicamente a largura/altura
    if (ps.pageSize === 'Custom') {
        grid.style.width = ps.customWidth + 'mm';
        grid.style.height = ps.customHeight + 'mm';
    } else {
        grid.style.width = '';
        grid.style.height = '';
    }

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
                        ${order.groupName ? `
                        <div class="info-row">
                            <span class="info-label">GRUPO/OBRA:</span>
                            <span class="info-value"><strong>${order.groupName}</strong></span>
                        </div>` : ''}
                        <div class="info-row">
                            <span class="info-label">ENDEREÇO:</span>
                            <span class="info-value">${order.receiver}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">TELEFONE:</span>
                            <span class="info-value">${order.phone}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">TAMANHO / Quantidade:</span>
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
document.getElementById('btnShowSheet').addEventListener('click', async () => {
    if (ordersQueue.length === 0) {
        await showCustomAlert("Adicione pelo menos um pedido à folha.");
        return;
    }
    
    isViewingHistory = false;
    hasSavedCurrentQueue = false; // Permite salvar a fila ao clicar em Imprimir
    renderReceiptGrid(ordersQueue, false);

    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');
});

document.getElementById('btnClearQueue').addEventListener('click', async () => {
    const keep = await showCustomConfirm("Deseja realmente limpar toda a folha?", "Sim", "Não");
    if(keep) {
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
    appData = db.readDB(); // Atualiza o banco
    const btn = document.getElementById('btnPrint');
    const receiptArea = document.getElementById('receipt-area');
    const originalText = btn.innerText;
    
    btn.innerText = "Gerando PDF...";
    btn.disabled = true;
    receiptArea.classList.add('printing');

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

    const ps = appData.printSettings || { pageSize: "A4" };
    
    // Injeta estilo dinâmico de @page para forçar as dimensões físicas exatas no PDF gerado pelo Chromium
    let dynamicStyle = document.getElementById('dynamic-page-size');
    if (!dynamicStyle) {
        dynamicStyle = document.createElement('style');
        dynamicStyle.id = 'dynamic-page-size';
        document.head.appendChild(dynamicStyle);
    }

    let pageCSS = '@page { margin: 0mm !important; }';
    if (ps.pageSize === 'A4') {
        pageCSS = '@page { size: 210mm 297mm; margin: 0mm !important; }';
    } else if (ps.pageSize === 'A5') {
        pageCSS = '@page { size: 148mm 210mm; margin: 0mm !important; }';
    } else if (ps.pageSize === 'Thermal') {
        // Pega a altura real do conteúdo para não deixar um espaço em branco infinito no final da bobina
        const gridHeight = document.getElementById('receipt-grid').offsetHeight;
        pageCSS = `@page { size: 80mm ${gridHeight + 40}px; margin: 0mm !important; }`;
    } else if (ps.pageSize === 'Custom') {
        pageCSS = `@page { size: ${ps.customWidth}mm ${ps.customHeight}mm; margin: 0mm !important; }`;
    }
    dynamicStyle.innerHTML = pageCSS;
    
    // Dispara a impressão
    const success = await ipcRenderer.invoke('print-to-pdf', ps);

    receiptArea.classList.remove('printing');
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

    if (order.groupName) {
        document.getElementById('isGroupOrder').checked = true;
        document.getElementById('groupOrderContainer').classList.remove('hidden');
        populateOrderGrupoSelector();
        const selector = document.getElementById('orderGrupoSelector');
        for (let i = 0; i < selector.options.length; i++) {
            if (selector.options[i].text === order.groupName) {
                selector.selectedIndex = i;
                break;
            }
        }
    } else {
        document.getElementById('isGroupOrder').checked = false;
        document.getElementById('groupOrderContainer').classList.add('hidden');
        document.getElementById('orderGrupoSelector').value = '';
    }
    updateClientsDatalist();

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
window.deleteOrder = async (orderId) => {
    const keep = await showCustomConfirm("Deseja realmente excluir este pedido?", "Sim", "Não");
    if (keep) {
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
function showCustomConfirm(message, yesText = "Sim, manter", noText = "Não, remover") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const msgEl = document.getElementById('confirm-message');
        const btnYes = document.getElementById('confirm-yes');
        const btnNo = document.getElementById('confirm-no');

        msgEl.innerText = message;
        btnYes.innerText = yesText;
        btnNo.innerText = noText;
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

// Função para exibir o modal de alerta assíncrono
function showCustomAlert(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert');
        const msgEl = document.getElementById('alert-message');
        const btnOk = document.getElementById('alert-ok');

        msgEl.innerText = message;
        modal.classList.remove('hidden');

        const handleResponse = () => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', onOk);
            resolve();
        };

        const onOk = () => handleResponse();

        btnOk.addEventListener('click', onOk);
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
    const pagamentos = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Voucher Alimentação/Refeição", "Delivery"];
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
document.getElementById('btnQuickFill')?.addEventListener('click', fillFormWithRandomData);

// Melhora o "Testar Layout" para simular o processo real de 6 notas
document.getElementById('btnTestLayout')?.addEventListener('click', async () => {
    const keep = await showCustomConfirm("Isso irá limpar sua fila e gerar 6 pedidos reais para teste. Continuar?", "Sim", "Não");
    if(!keep) return;
    
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
    appData = db.readDB(); // Atualiza o banco
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

function getAllClients() {
    appData = db.readDB();
    let all = [...(appData.clientes || [])];
    if (appData.grupos) {
        appData.grupos.forEach(g => {
            if (g.clientes) {
                // Injetamos o endereço do grupo no cliente temporariamente para o autocomplete
                const clientesComEndereco = g.clientes.map(c => ({
                    ...c,
                    endereco: g.endereco,
                    _isGrupoClient: true,
                    _grupoId: g.id
                }));
                all = all.concat(clientesComEndereco);
            }
        });
    }
    return all;
}

function getAvailableClientsForForm() {
    const isGroupOrder = document.getElementById('isGroupOrder').checked;
    const allClients = getAllClients();
    
    if (isGroupOrder) {
        const groupId = parseInt(document.getElementById('orderGrupoSelector').value, 10);
        if (groupId) {
            return allClients.filter(c => c._isGrupoClient && c._grupoId === groupId);
        } else {
            return [];
        }
    } else {
        // Modo normal (mostra só clientes que não são de grupos)
        return allClients.filter(c => !c._isGrupoClient);
    }
}

function updateClientsDatalist() {
    const availableClients = getAvailableClientsForForm();
    
    const datalist = document.getElementById('clientes-list');
    if (datalist) {
        datalist.innerHTML = '';
        availableClients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nome;
            datalist.appendChild(opt);
        });
    }
    
    const enderecosList = document.getElementById('enderecos-list');
    if (enderecosList) {
        enderecosList.innerHTML = '';
        availableClients.forEach(c => {
            if (c.endereco) {
                const opt = document.createElement('option');
                opt.value = c.endereco;
                enderecosList.appendChild(opt);
            }
        });
    }
}

// Logic for Group Checkbox
document.getElementById('isGroupOrder').addEventListener('change', (e) => {
    const groupContainer = document.getElementById('groupOrderContainer');
    if (e.target.checked) {
        groupContainer.classList.remove('hidden');
        populateOrderGrupoSelector();
    } else {
        groupContainer.classList.add('hidden');
        document.getElementById('orderGrupoSelector').value = '';
    }
    updateClientsDatalist();
    
    // Clear fields when toggling mode
    document.getElementById('senderName').value = '';
    document.getElementById('receiverName').value = '';
    document.getElementById('receiverPhone').value = '';
});

// Logic for Group Selector dropdown
document.getElementById('orderGrupoSelector').addEventListener('change', (e) => {
    const groupId = parseInt(e.target.value, 10);
    appData = db.readDB();
    const grupo = appData.grupos.find(g => g.id === groupId);
    
    if (grupo && grupo.endereco) {
        document.getElementById('receiverName').value = grupo.endereco;
    } else {
        document.getElementById('receiverName').value = '';
    }
    
    document.getElementById('senderName').value = '';
    document.getElementById('receiverPhone').value = '';
    updateClientsDatalist();
});

function populateOrderGrupoSelector() {
    appData = db.readDB();
    const selector = document.getElementById('orderGrupoSelector');
    selector.innerHTML = '<option value="">-- Selecione o Grupo --</option>';
    if (appData.grupos) {
        appData.grupos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.innerText = g.nome;
            selector.appendChild(opt);
        });
    }
}

// Preenchimento automático ao digitar/selecionar cliente
document.getElementById('senderName').addEventListener('input', (e) => {
    const name = e.target.value.trim();
    if (!name) return;
    const availableClients = getAvailableClientsForForm();
    const client = availableClients.find(c => c.nome.toLowerCase() === name.toLowerCase());
    if (client) {
        document.getElementById('receiverName').value = client.endereco || '';
        document.getElementById('receiverPhone').value = client.telefone || '';
        document.getElementById('receiverPhone').dispatchEvent(new Event('input')); // Máscara
    }
});

// Preenchimento automático ao digitar/selecionar endereço
document.getElementById('receiverName').addEventListener('input', (e) => {
    const address = e.target.value.trim();
    if (!address) return;
    // Se for pedido de grupo, não vamos preencher nome baseando no endereço,
    // pois o endereço é igual pra todo mundo!
    if (document.getElementById('isGroupOrder').checked) return;
    
    const availableClients = getAvailableClientsForForm();
    const client = availableClients.find(c => c.endereco && c.endereco.toLowerCase() === address.toLowerCase());
    if (client) {
        document.getElementById('senderName').value = client.nome || '';
        document.getElementById('receiverPhone').value = client.telefone || '';
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
    renderGruposSelector();
});

document.getElementById('btnCloseDBManager').addEventListener('click', () => {
    dbModal.classList.add('hidden');
});

document.getElementById('btnBottomCloseDB').addEventListener('click', () => {
    dbModal.classList.add('hidden');
});

// Tabs do modal
const tabClientes = document.getElementById('tabClientes');
const tabGrupos = document.getElementById('tabGrupos');
const tabItens = document.getElementById('tabItens');
const tabPrint = document.getElementById('tabPrint');
const contentClientes = document.getElementById('contentClientes');
const contentGrupos = document.getElementById('contentGrupos');
const contentItens = document.getElementById('contentItens');
const contentPrint = document.getElementById('contentPrint');

tabClientes.addEventListener('click', () => {
    tabClientes.classList.add('active-tab');
    tabGrupos.classList.remove('active-tab');
    tabItens.classList.remove('active-tab');
    tabPrint.classList.remove('active-tab');
    contentClientes.classList.remove('hidden');
    contentGrupos.classList.add('hidden');
    contentItens.classList.add('hidden');
    contentPrint.classList.add('hidden');
});

tabGrupos.addEventListener('click', () => {
    tabGrupos.classList.add('active-tab');
    tabClientes.classList.remove('active-tab');
    tabItens.classList.remove('active-tab');
    tabPrint.classList.remove('active-tab');
    contentGrupos.classList.remove('hidden');
    contentClientes.classList.add('hidden');
    contentItens.classList.add('hidden');
    contentPrint.classList.add('hidden');
    renderGruposSelector();
});

tabItens.addEventListener('click', () => {
    tabItens.classList.add('active-tab');
    tabClientes.classList.remove('active-tab');
    tabGrupos.classList.remove('active-tab');
    tabPrint.classList.remove('active-tab');
    contentItens.classList.remove('hidden');
    contentClientes.classList.add('hidden');
    contentGrupos.classList.add('hidden');
    contentPrint.classList.add('hidden');
});

// Lógica da Tab de Configurações de Impressão
const formPrintSettings = document.getElementById('formPrintSettings');
const printPageSize = document.getElementById('printPageSize');
const customSizeContainer = document.getElementById('customSizeContainer');
const printCustomWidth = document.getElementById('printCustomWidth');
const printCustomHeight = document.getElementById('printCustomHeight');
const printMaxOrders = document.getElementById('printMaxOrders');

tabPrint.addEventListener('click', () => {
    tabPrint.classList.add('active-tab');
    tabClientes.classList.remove('active-tab');
    tabGrupos.classList.remove('active-tab');
    tabItens.classList.remove('active-tab');
    contentPrint.classList.remove('hidden');
    contentClientes.classList.add('hidden');
    contentGrupos.classList.add('hidden');
    contentItens.classList.add('hidden');
    
    appData = db.readDB();
    const ps = appData.printSettings || { pageSize: "A4", customWidth: 80, customHeight: 200, maxOrdersPerSheet: 6 };
    printPageSize.value = ps.pageSize;
    printCustomWidth.value = ps.customWidth;
    printCustomHeight.value = ps.customHeight;
    printMaxOrders.value = ps.maxOrdersPerSheet;
    
    if (ps.pageSize === "Custom") {
        customSizeContainer.classList.remove('hidden');
    } else {
        customSizeContainer.classList.add('hidden');
    }

    const maxOrdersContainer = document.getElementById('maxOrdersContainer');
    if (ps.pageSize === "Thermal") {
        maxOrdersContainer.classList.add('hidden');
    } else {
        maxOrdersContainer.classList.remove('hidden');
    }
});

printPageSize.addEventListener('change', () => {
    const maxOrdersContainer = document.getElementById('maxOrdersContainer');
    
    if (printPageSize.value === "Thermal") {
        maxOrdersContainer.classList.add('hidden');
    } else {
        maxOrdersContainer.classList.remove('hidden');
    }

    if (printPageSize.value === "Custom") {
        customSizeContainer.classList.remove('hidden');
    } else {
        customSizeContainer.classList.add('hidden');
        if (printPageSize.value === "A4") printMaxOrders.value = 6;
        if (printPageSize.value === "A5") printMaxOrders.value = 4;
    }
});

formPrintSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    appData = db.readDB();
    appData.printSettings = {
        pageSize: printPageSize.value,
        customWidth: parseInt(printCustomWidth.value, 10),
        customHeight: parseInt(printCustomHeight.value, 10),
        maxOrdersPerSheet: parseInt(printMaxOrders.value, 10)
    };
    db.writeDB(appData);
    window.location.reload(); // Recarrega para aplicar os estilos de folha corretamente
});

// ==========================================
// LÓGICA DE GRUPOS
// ==========================================
let editingDbGrupoClientId = null;

function renderGruposSelector() {
    appData = db.readDB();
    if (!appData.grupos) appData.grupos = [];
    
    const selector = document.getElementById('grupoSelector');
    selector.innerHTML = '<option value="">-- Selecione --</option>';
    
    appData.grupos.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.innerText = g.nome;
        selector.appendChild(opt);
    });
    
    document.getElementById('grupoClientsArea').classList.add('hidden');
    document.getElementById('btnDeleteGrupo').style.display = 'none';
}

document.getElementById('btnCreateGrupo').addEventListener('click', async () => {
    const nome = document.getElementById('novoGrupoName').value.trim();
    const endereco = document.getElementById('novoGrupoEndereco').value.trim();
    if (!nome) return;
    
    const selector = document.getElementById('grupoSelector');
    const groupId = parseInt(selector.value, 10);
    
    appData = db.readDB();
    if (!appData.grupos) appData.grupos = [];
    
    if (groupId) {
        // Modo Edição
        const grupo = appData.grupos.find(g => g.id === groupId);
        if (grupo) {
            // Se mudou o nome e já existe outro com esse nome
            if (grupo.nome.toLowerCase() !== nome.toLowerCase() && appData.grupos.some(g => g.nome.toLowerCase() === nome.toLowerCase())) {
                await showCustomAlert("Já existe outro grupo com este nome!");
                return;
            }
            grupo.nome = nome;
            grupo.endereco = endereco;
            
            appData.grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            db.writeDB(appData);
            updateClientsDatalist();
            renderGruposSelector();
            
            // Re-seleciona
            const newSelector = document.getElementById('grupoSelector');
            newSelector.value = groupId;
            newSelector.dispatchEvent(new Event('change'));
        }
    } else {
        // Modo Criação
        if (appData.grupos.some(g => g.nome.toLowerCase() === nome.toLowerCase())) {
            await showCustomAlert("Já existe um grupo com este nome!");
            return;
        }
        
        const newGroup = {
            id: Date.now(),
            nome: nome,
            endereco: endereco,
            clientes: []
        };
        appData.grupos.push(newGroup);
        appData.grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        
        db.writeDB(appData);
        document.getElementById('novoGrupoName').value = '';
        document.getElementById('novoGrupoEndereco').value = '';
        updateClientsDatalist();
        renderGruposSelector();
        
        // Auto seleciona o novo grupo
        const newSelector = document.getElementById('grupoSelector');
        newSelector.value = newGroup.id;
        newSelector.dispatchEvent(new Event('change'));
    }
});

document.getElementById('btnDeleteGrupo').addEventListener('click', async () => {
    const selector = document.getElementById('grupoSelector');
    const groupId = parseInt(selector.value, 10);
    if (!groupId) return;
    
    const keep = await showCustomConfirm("Deseja realmente excluir este grupo e todos os clientes dentro dele?", "Sim", "Não");
    if (keep) {
        appData = db.readDB();
        appData.grupos = appData.grupos.filter(g => g.id !== groupId);
        db.writeDB(appData);
        updateClientsDatalist();
        renderGruposSelector();
    }
});

document.getElementById('grupoSelector').addEventListener('change', (e) => {
    const groupId = parseInt(e.target.value, 10);
    const clientsArea = document.getElementById('grupoClientsArea');
    const btnDelete = document.getElementById('btnDeleteGrupo');
    const btnCreate = document.getElementById('btnCreateGrupo');
    const inputNome = document.getElementById('novoGrupoName');
    const inputEndereco = document.getElementById('novoGrupoEndereco');
    
    if (!groupId) {
        clientsArea.classList.add('hidden');
        btnDelete.style.display = 'none';
        btnCreate.innerHTML = '➕ Criar';
        inputNome.value = '';
        inputEndereco.value = '';
        return;
    }
    
    appData = db.readDB();
    const grupo = appData.grupos.find(g => g.id === groupId);
    if (grupo) {
        inputNome.value = grupo.nome;
        inputEndereco.value = grupo.endereco || '';
        btnCreate.innerHTML = '🔄 Atualizar';
    }
    
    clientsArea.classList.remove('hidden');
    btnDelete.style.display = 'inline-block';
    renderGrupoClientsTable(groupId);
});

function renderGrupoClientsTable(groupId) {
    appData = db.readDB();
    const grupo = appData.grupos.find(g => g.id === groupId);
    const tbody = document.getElementById('dbGrupoClientsTableBody');
    tbody.innerHTML = '';
    
    if (!grupo || !grupo.clientes) return;
    
    grupo.clientes.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 10px;">${c.nome}</td>
            <td style="padding: 10px;">${c.telefone || '-'}</td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">
                <button type="button" class="btn-edit" onclick="editGrupoClient(${groupId}, ${c.id})" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;">✏️ Editar</button>
                <button type="button" class="btn-remove" onclick="deleteGrupoClient(${groupId}, ${c.id})" style="padding: 4px 8px; font-size: 11px;">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.editGrupoClient = (groupId, clientId) => {
    const grupo = appData.grupos.find(g => g.id === groupId);
    if (!grupo) return;
    const client = grupo.clientes.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('dbGrupoClientName').value = client.nome;
    document.getElementById('dbGrupoClientPhone').value = client.telefone || '';

    editingDbGrupoClientId = clientId;
    const submitBtn = document.getElementById('formAddGrupoClient').querySelector('button[type="submit"]');
    submitBtn.innerHTML = '🔄 Atualizar';
};

window.deleteGrupoClient = async (groupId, clientId) => {
    const keep = await showCustomConfirm("Deseja realmente excluir este cliente do grupo?", "Sim", "Não");
    if (keep) {
        appData = db.readDB();
        const grupo = appData.grupos.find(g => g.id === groupId);
        if (grupo) {
            grupo.clientes = grupo.clientes.filter(c => c.id !== clientId);
            db.writeDB(appData);
            updateClientsDatalist();
            renderGrupoClientsTable(groupId);
        }
    }
};

document.getElementById('formAddGrupoClient').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selector = document.getElementById('grupoSelector');
    const groupId = parseInt(selector.value, 10);
    if (!groupId) return;
    
    appData = db.readDB();
    const grupo = appData.grupos.find(g => g.id === groupId);
    if (!grupo) return;
    if (!grupo.clientes) grupo.clientes = [];
    
    const nome = document.getElementById('dbGrupoClientName').value.trim();
    const telefone = document.getElementById('dbGrupoClientPhone').value.trim();
    
    if (editingDbGrupoClientId !== null) {
        const client = grupo.clientes.find(c => c.id === editingDbGrupoClientId);
        if (client) {
            client.nome = nome;
            client.telefone = telefone;
        }
        editingDbGrupoClientId = null;
    } else {
        if (grupo.clientes.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
            await showCustomAlert("Já existe uma pessoa com este nome neste grupo!");
            return;
        }
        grupo.clientes.push({
            id: Date.now(),
            nome,
            telefone
        });
    }
    
    grupo.clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    db.writeDB(appData);
    e.target.reset();
    updateClientsDatalist();
    renderGrupoClientsTable(groupId);
});

document.getElementById('formAddGrupoClient').addEventListener('reset', (e) => {
    editingDbGrupoClientId = null;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '💾 Adicionar';
});

// Aplicar máscara de telefone no modal do Grupo
document.getElementById('dbGrupoClientPhone').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    e.target.value = value.substring(0, 15);
});

// Renderizar Clientes no Modal
function renderClientsTable() {
    appData = db.readDB(); // Atualiza o banco
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
};

window.deleteClient = async (id) => {
    const keep = await showCustomConfirm("Deseja realmente excluir este cliente?", "Sim", "Não");
    if (keep) {
        appData = db.readDB(); // Atualiza o banco
        appData.clientes = appData.clientes.filter(c => c.id !== id);
        db.writeDB(appData);
        updateClientsDatalist();
        renderClientsTable();
    }
};

// Formulário de adicionar/atualizar cliente no modal
document.getElementById('formAddClient').addEventListener('submit', async (e) => {
    e.preventDefault();
    appData = db.readDB(); // Atualiza o banco
    
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
            await showCustomAlert("Já existe um cliente com este nome!");
            return;
        }
        appData.clientes.push({
            id: Date.now(),
            nome,
            endereco,
            telefone
        });
    }
    
    // Mantém a lista de clientes em ordem alfabética
    appData.clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    
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
    appData = db.readDB(); // Atualiza o banco
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

    // Desativa a mudança de lista para evitar inconsistência na atualização
    document.getElementById('dbItemListSelector').disabled = true;
};

window.deleteItem = async (listName, index) => {
    const keep = await showCustomConfirm(`Deseja realmente excluir este item da lista de ${listName}?`, "Sim", "Não");
    if (keep) {
        appData = db.readDB(); // Atualiza o banco
        appData[listName].splice(index, 1);
        db.writeDB(appData);
        renderItemsTable();
        populateSelectOptions();
    }
};

document.getElementById('formAddItem').addEventListener('submit', async (e) => {
    e.preventDefault();
    appData = db.readDB(); // Atualiza o banco
    
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
            await showCustomAlert("Este item já existe nesta lista!");
            return;
        }
        appData[listName].push(itemName);
    }
    
    // Mantém a lista de itens em ordem alfabética
    appData[listName].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
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
    appData = db.readDB(); // Atualiza o banco
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
window.deleteHistoryItem = async (id) => {
    const keep = await showCustomConfirm("Deseja realmente excluir esta folha de impressão do histórico?", "Sim", "Não");
    if (keep) {
        appData = db.readDB(); // Atualiza o banco
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

// --- Lógica do Local do Banco de Dados ---
const btnMenuDBLocation = document.getElementById('btnMenuDBLocation');
const authModal = document.getElementById('auth-modal');
const authUser = document.getElementById('authUser');
const authPass = document.getElementById('authPass');
const authError = document.getElementById('auth-error');
const authLogin = document.getElementById('auth-login');
const authCancel = document.getElementById('auth-cancel');

const dbLocationModal = document.getElementById('db-location-modal');
const currentDbPathEl = document.getElementById('current-db-path');
const btnExportDb = document.getElementById('btnExportDb');
const btnImportDb = document.getElementById('btnImportDb');
const btnDbLocationClose = document.getElementById('btnDbLocationClose');

btnMenuDBLocation.addEventListener('click', () => {
    authUser.value = '';
    authPass.value = '';
    authError.classList.add('hidden');
    authModal.classList.remove('hidden');
    authUser.focus();
});

authCancel.addEventListener('click', () => {
    authModal.classList.add('hidden');
});

authLogin.addEventListener('click', () => {
    if (authUser.value === 'oliveira' && authPass.value === 'oliveira') {
        authModal.classList.add('hidden');
        showDbLocationModal();
    } else {
        authError.classList.remove('hidden');
    }
});

function showDbLocationModal() {
    currentDbPathEl.innerText = db.getActiveDbPath();
    dbLocationModal.classList.remove('hidden');
}

btnDbLocationClose.addEventListener('click', () => {
    dbLocationModal.classList.add('hidden');
});

btnExportDb.addEventListener('click', () => {
    const newPath = ipcRenderer.sendSync('export-db-location', 'db.json');
    if (newPath) {
        db.changeDbPath(newPath, true); // true = copy current
        dbLocationModal.classList.add('hidden');
        window.location.reload(); // Reload to refresh data
    }
});

btnImportDb.addEventListener('click', () => {
    const newPath = ipcRenderer.sendSync('select-db-location');
    if (newPath) {
        db.changeDbPath(newPath, false); // false = just point to it
        dbLocationModal.classList.add('hidden');
        window.location.reload(); // Reload to refresh data
    }
});

// Remover Splash Screen após o carregamento
window.addEventListener('load', () => {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        setTimeout(() => {
            splashScreen.style.opacity = '0';
            splashScreen.style.visibility = 'hidden';
            setTimeout(() => {
                splashScreen.remove();
                
                // Forçar a exibição correta dos selects e datalists após o splash
                populateSelectOptions();
                updateClientsDatalist();
            }, 600); // tempo da transição CSS
        }, 2500); // tempo mínimo exibindo a logo (2.5 segundos)
    }
});