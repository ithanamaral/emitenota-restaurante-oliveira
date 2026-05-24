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
        const formatBullets = (arr) => arr.length > 0 ? '<br>' + arr.map(val => `&bull; ${val}`).join('<br>') : '';

        grid.innerHTML += `
            <div class="receipt-container">
                <div class="receipt-actions no-print">
                    <button class="btn-edit" onclick="editOrder(${order.id})">✏️ Editar</button>
                </div>
                <div class="receipt-header">
                    <img src="public/logo Restaurante oliveira.png" style="width: 50px;">
                    <h1>OLIVEIRA REAL</h1>
                    <p style="font-size: 9px">ID: ${order.id} | ${order.date}</p>
                </div>
                <div class="receipt-body">
                    <div class="receipt-margin">
                    <p><strong>Cliente:</strong> ${order.sender}</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Telefone:</strong> ${order.phone}</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Endereço:</strong> ${order.receiver}</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Pedido:</strong> ${order.tamanho} (${order.quantity}x)</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Carnes:</strong> ${formatBullets(order.carnes)}</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Acompanhamentos:</strong> ${formatBullets(order.acompanhamentos)}</p>
                    </div>
                    <div class="receipt-margin">
                    <p><strong>Bebidas:</strong> ${formatBullets(order.bebidas)}</p>
                    </div>
                    <p><strong>Observações:</strong> ${order.observacoes}</p>
                    <hr>
                    <p><strong>R$ ${order.amount}</strong> (${order.pagamento})</p>
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
                const keep = await showCustomConfirm(`O item "${newValue}" já foi selecionado. Deseja manter a duplicata?`);
                if (!keep) {
                    select.value = "";
                    return;
                }
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

// Função para testar o layout da folha com 6 notas fictícias
document.getElementById('btnTestLayout').addEventListener('click', () => {
    ordersQueue = []; // Limpa a fila atual para o teste
    for(let i = 1; i <= 6; i++) {
        ordersQueue.push({
            sender: `Cliente de Teste ${i}`,
            receiver: `Rua Exemplo de Teste, nº ${i}00 - Bairro Centro`,
            phone: `(31) 98888-000${i}`,
            carnes: ['Bife bovino acebolado', 'Carne Moída'],
            acompanhamentos: ['Arroz', 'Feijão', 'Batata frita', 'Couve'],
            bebidas: ['Coca cola lata'],
            pagamento: 'Pix',
            tamanho: 'Média',
            quantity: '1',
            entrega: 'Entrega',
            talher: 'Sim',
            observacoes: 'Esta é uma observação de teste para verificar como o texto se comporta no layout de 6 divisões.',
            amount: '35,00',
            date: new Date().toLocaleString('pt-BR'),
            id: 1000 + i
        });
    }
    updateQueueUI();
    document.getElementById('btnShowSheet').click();
});