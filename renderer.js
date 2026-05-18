const { ipcRenderer } = require('electron');

document.getElementById('remessaForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // Captura os dados
    const sender = document.getElementById('senderName').value;
    const receiver = document.getElementById('receiverName').value;
    const country = document.getElementById('destinationCountry').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const rate = parseFloat(document.getElementById('exchangeRate').value);

    // Cálculos simples
    const finalValue = (amount / rate).toFixed(2);
    const date = new Date().toLocaleString('pt-BR');
    const transactionId = Math.floor(Math.random() * 1000000000);

    // Função auxiliar para preencher todas as ocorrências (vias)
    const fillField = (className, value) => {
        document.querySelectorAll('.' + className).forEach(el => el.innerText = value);
    };

    // Preenche as duas vias
    fillField('r-sender', sender);
    fillField('r-receiver', receiver);
    fillField('r-country', country);
    fillField('r-amount', amount.toFixed(2));
    fillField('r-rate', rate);
    fillField('r-final', "US$ " + finalValue);
    fillField('r-date', date);
    fillField('r-id', transactionId);

    // Esconde o formulário e mostra a pré-visualização
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('receipt-area').classList.remove('hidden');
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