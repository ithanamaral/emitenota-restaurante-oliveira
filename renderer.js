const { ipcRenderer } = require('electron');

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
    const carnes = carnesValues.length > 0 ? '<br>' + carnesValues.map(val => `&bull; ${val}`).join('<br>') : '';
    
    const acompSelects = document.querySelectorAll('.acomp-select');
    const acompValues = Array.from(acompSelects)
        .map(select => select.value)
        .filter(val => val !== "");
    const acompanhamentos = acompValues.length > 0 ? '<br>' + acompValues.map(val => `&bull; ${val}`).join('<br>') : ''
    
    const bebidaSelects = document.querySelectorAll('.bebida-select');
    const bebidaValues = Array.from(bebidaSelects)
        .map(select => select.value)
        .filter(val => val !== "");
    const bebidas = bebidaValues.length > 0 ? '<br>' + bebidaValues.map(val => `&bull; ${val}`).join('<br>') : '';

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
    
    // O valor precisa tratar vírgulas como decimais e extrair o número
    // Remove pontos de milhar e converte a vírgula decimal em ponto para o parseFloat
    const rawPrice = document.getElementById('pricevalue').value.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(rawPrice) || 0;

    const date = new Date().toLocaleString('pt-BR');
    const transactionId = Math.floor(Math.random() * 1000000000);

    // Função auxiliar para preencher todas as ocorrências (vias)
    const fillField = (className, value) => {
        document.querySelectorAll('.' + className).forEach(el => el.innerHTML = value);
    };

    // Preenche as informações do recibo
    fillField('r-sender', sender);
    fillField('r-receiver', receiver);
    fillField('r-phone', phone);
    fillField('r-carnes', carnes);
    fillField('r-acompanhamentos', acompanhamentos);
    fillField('r-amount', amount.toFixed(2).replace('.', ','));
    fillField('r-date', date);
    fillField('r-id', transactionId);
    fillField('r-pagamento', pagamento);
    fillField('r-tamanho', tamanho);
    fillField('r-bebidas', bebidas);
    fillField('r-quantity', quantity);
    fillField('r-entrega', entrega);
    fillField('r-talher', talher);




    // Esconde o formulário e mostra a pré-visualização
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');
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

// Lógica para adicionar selects dinamicamente
function handleDynamicSelects(containerId, selectClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.addEventListener('change', (e) => {
        if (e.target.classList.contains(selectClass)) {
            const selects = container.querySelectorAll('.' + selectClass);
            const lastSelect = selects[selects.length - 1];
            
            // Se o último select tiver um valor selecionado (diferente do placeholder), cria um novo
            if (lastSelect.value !== "") {
                const newSelect = lastSelect.cloneNode(true);
                newSelect.value = ""; // Reseta o valor para o placeholder
                newSelect.style.marginTop = "10px"; // Adiciona espaçamento
                container.appendChild(newSelect);
            }
        }
    });
}

handleDynamicSelects('carnes-container', 'carne-select');
handleDynamicSelects('acompanhamentos-container', 'acomp-select');
handleDynamicSelects('bebidas-container', 'bebida-select');