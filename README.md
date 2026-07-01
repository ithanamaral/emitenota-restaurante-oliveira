# Sistema de Notas - Restaurante Oliveira Real

Um sistema desktop construído com Electron.js e focado em agilizar a emissão e impressão de notas/comprovantes de pedidos para o Restaurante Oliveira Real. O sistema gerencia clientes, grupos de pedidos (obras/empresas), itens do cardápio e gera PDFs prontos para impressão térmica ou em folhas A4/A5.

## 🚀 Funcionalidades Principais

*   **Emissão Rápida de Notas:** Formulário otimizado para lançar pedidos (tamanhos de marmitas, opções de carnes, acompanhamentos, bebidas, valor, frete e forma de pagamento).
*   **Auto-completar Inteligente:** O sistema salva o histórico de clientes. Ao digitar o nome, ele preenche o endereço e o telefone automaticamente.
*   **Gestão de Grupos/Obras:** Ferramenta dedicada para empresas e obras. Você cadastra o endereço no "Grupo" e cadastra os funcionários dentro dele. Na hora de emitir a nota, basta marcar a opção "Pedido de Grupo/Obra" para que o endereço seja travado e apenas os funcionários daquela obra sejam sugeridos.
*   **Cardápio Customizável:** Interface para cadastrar e excluir itens do cardápio (carnes, acompanhamentos e bebidas) que aparecem nas seleções das notas.
*   **Fila de Impressão:** Você pode adicionar vários pedidos em uma "Fila". O sistema organiza a impressão automaticamente para que várias notas saiam juntas na mesma folha de papel.
*   **Histórico de Impressões:** O sistema salva as folhas de pedidos geradas para que você possa consultar e reimprimir caso necessário.
*   **Configurações de Impressora:** Suporte nativo para impressoras Térmicas (bobina contínua) e folhas de tamanho A4, A5 ou tamanho customizado.
*   **Banco de Dados Portátil:** Todos os dados (clientes, grupos e cardápio) são salvos em um arquivo local `db.json`. Você pode escolher a pasta onde ele fica salvo, facilitando o uso de pastas sincronizadas em nuvem (como Google Drive/OneDrive) para backup.

## 🔄 Fluxo de Uso Básico

1.  **Configuração Inicial (Opcional):**
    *   No menu principal, acesse "Configurações / Banco de Dados".
    *   Cadastre seus **Itens do Cardápio** (carnes, acompanhamentos e bebidas).
    *   *Dica:* Não precisa cadastrar clientes ou grupos manualmente se não quiser, eles podem ser salvos no banco de dados automaticamente na primeira vez que você digita na tela de criação de notas.
2.  **Criar Nova Nota:**
    *   Vá em **Criar Notas**.
    *   Se for um cliente novo, basta preencher os dados. Se for antigo, ao digitar o nome, o sistema fará o preenchimento.
    *   Se for pedido para uma obra, marque a caixinha **Pedido de Grupo/Obra?** e selecione o local.
    *   Preencha os itens do pedido e clique em **"Adicionar à Fila de Impressão"**.
3.  **Imprimir:**
    *   Assim que todos os pedidos estiverem na fila, clique em **"🖨️ Visualizar Impressão"**.
    *   Confira se os dados estão corretos na prévia e clique no botão verde para gerar o PDF e enviar para a impressora.
4.  **Histórico:**
    *   Caso tenha perdido alguma folha, vá no menu **"Visualizar Impressões"** para resgatar os pedidos impressos nos dias anteriores.

## 💻 Tecnologias Utilizadas

*   **HTML / CSS / JavaScript (Vanilla):** Estrutura e interface limpa sem necessidade de pacotes web complexos.
*   **Electron.js:** Para encapsular o projeto web como um aplicativo Desktop de Windows, com acesso nativo à geração de PDF e leitura/escrita do sistema de arquivos (`fs`).
*   **Armazenamento em JSON:** Banco de dados simples, leve e sem necessidade de servidor de banco rodando no background.

## 🛠️ Como rodar o projeto

Certifique-se de ter o [Node.js](https://nodejs.org/) instalado na máquina.

```bash
# 1. Instale as dependências do Electron
npm install

# 2. Inicie o aplicativo em modo de desenvolvimento
npm start
```
