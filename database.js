const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Caminho do arquivo de configuração e diretório padrão
const configDir = path.join(os.homedir(), '.emitenota-oliveira');
const configPath = path.join(configDir, 'config.json');
const defaultDbPath = path.join(configDir, 'db.json');
const localDbPath = path.join(__dirname, 'db.json');

// Variável que guarda o caminho real do banco de dados a ser usado
let activeDbPath = defaultDbPath;

// Função para inicializar e resolver o caminho do banco
function initializeDbPath() {
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.dbPath) {
                activeDbPath = config.dbPath;
                return;
            }
        } catch (err) {
            console.error("Erro ao ler config.json:", err);
        }
    }

    // Se não tiver config.json, ou não tiver dbPath, perguntamos ao usuário via IPC Síncrono
    if (ipcRenderer) {
        const userPath = ipcRenderer.sendSync('ask-db-location');
        if (userPath) {
            activeDbPath = userPath;
            fs.writeFileSync(configPath, JSON.stringify({ dbPath: activeDbPath }, null, 2), 'utf8');
        } else {
            // Se cancelou ou escolheu Padrão, salva o padrão para não perguntar mais
            fs.writeFileSync(configPath, JSON.stringify({ dbPath: activeDbPath }, null, 2), 'utf8');
            
            // Migra os dados já existentes do arquivo local, se houver (somente se usar o padrão)
            if (!fs.existsSync(activeDbPath) && fs.existsSync(localDbPath)) {
                try {
                    fs.copyFileSync(localDbPath, activeDbPath);
                } catch (err) {
                    console.error("Erro ao migrar banco de dados local para a pasta pessoal:", err);
                }
            }
        }
    }
}

// Inicializa imediatamente
initializeDbPath();

// Valores iniciais e padrões para o banco de dados
const defaultData = {
    impressoes: [],
    clientes: [],
    grupos: [
        {
            id: 1,
            nome: "Minas copy",
            endereco: "Av. Canadá, 160 - Jardim Canada, Nova Lima - MG, 34007-654",
            clientes: []
        },
        {
            id: 2,
            nome: "CMF",
            endereco: "R. Star, 93 - Jardim Canada, Nova Lima - MG, 34007-666",
            clientes: []
        },
        {
            id: 3,
            nome: "Sidrasul",
            endereco: "Av. Vitória, 85 - Jardim Canada, Nova Lima - MG, 34000-000",
            clientes: []
        },
        {
            id: 4,
            nome: "GHB",
            endereco: "Retirada apenas",
            clientes: []
        },
        {
            id: 5,
            nome: "Obra Hércules/Cido",
            endereco: "Rua PITANGUEIRAS 405, Retiro das pedras",
            clientes: []
        },
        {
            id: 6,
            nome: "MARCOS SOUZA",
            endereco: "Avenida Toronto, 878 - Ljs 01 e 02 - Jardim Canada, Nova Lima - MG, 34007-658",
            clientes: []
        },
        {
            id: 7,
            nome: "AMAVET",
            endereco: "Av. Toronto, 878 - Jardim Canada, Nova Lima - MG, 34007-658",
            clientes: []
        },
        {
            id: 8,
            nome: "LINK",
            endereco: "Av. Vitória, 199 - Jardim Canada, Nova Lima - MG, 34000-000",
            clientes: []
        }
    ],
    carnes: [
        "Sem carnes",
        "Bife bovino acebolado",
        "Bife de pernil acebolado",
        "Burguer sabor picanha grelhado 90g",
        "Carne Moída",
        "Costela bovina cozida",
        "Costelinha suína",
        "Coxinha da asa",
        "Espaguete à bolonhesa",
        "Feijoada Real",
        "Filé de frango à milanesa",
        "Filé de frango grelhado",
        "Filé de peixe",
        "Carne bovina assada",
        "Iscas de fígado bovino",
        "Linguiça suína assada",
        "Lombo suíno",
        "Maçã de peito assada",
        "Omelete napolitano (2 ovos fritos + presunto e queijo)",
        "Ovos fritos (gema dura)",
        "Ovos fritos (gema mole)",
        "Paleta bovina cozida",
        "Parmegiana",
        "Sobrecoxa de frango",
        "Strogonoff de frango"
    ],
    acompanhamentos: [
        "Sem acompanhamentos",
        "Abóbora moranga",
        "Abobrinha italiana",
        "Angu temperado",
        "Arroz",
        "Batata doce assada",
        "Batata frita",
        "Batata inglesa assada",
        "Batata palha",
        "Batata salteada",
        "Beterraba",
        "Brócolis ao alho",
        "Cenoura com vagem",
        "Chuchu ao alho",
        "Couve",
        "Farofa de cenoura",
        "Farofa dourada",
        "Feijão",
        "Feijoada francesa",
        "Fruta do dia",
        "Jiló refogado",
        "Macarrão alho e óleo",
        "Mandioca frita",
        "Mandioca salteada na manteiga",
        "Maionese de batata",
        "Mix de legumes salteados",
        "Purê de abóbora moranga",
        "Purê de batata",
        "Quiabo",
        "Saladas do dia",
        "Salpicão",
        "Tropeiro",
        "Tutu de feijão"
    ],
    bebidas: [
        "Acerola (Suco Natural)",
        "Água Com Gás 500 ml",
        "Água Sem Gás 500 ml",
        "Coca Cola (2lt)",
        "Coca Cola Lata",
        "Coca Cola Original (600 ml)",
        "Coca Cola Zero (600 ml)",
        "Coca Cola Zero Lata",
        "Fanta Guaraná (2lt)",
        "Fanta Guaraná (Lata)",
        "Fanta Laranja (2lt)",
        "Fanta Laranja (600 ml)",
        "Fanta Laranja (Lata)",
        "Fanta Maracujá (Lata)",
        "Fanta Uva (Lata)",
        "Goiaba (Suco Lata)",
        "Goiaba (Suco Natural)",
        "Guarapan (2lt)",
        "Laranja (Suco Natural)",
        "Limão (Suco Natural)",
        "Manga (Suco Lata)",
        "Maracujá (Suco Lata)",
        "Maracujá (Suco Natural)",
        "Mate Couro Original (1lt)",
        "Mate Couro Zero (1lt)",
        "Pêssego (Suco Lata)",
        "Sprite (2lt)",
        "Sprite (600 ml)",
        "Sprite (Lata)",
        "Uva (Suco Lata)"
    ],
    printSettings: {
        pageSize: "A4",
        customWidth: 80, // mm
        customHeight: 200, // mm
        maxOrdersPerSheet: 6
    }
};

// Carrega os dados ou inicializa com os padrões
function readDB() {
    try {
        if (!fs.existsSync(activeDbPath)) {
            writeDB(defaultData);
            return defaultData;
        }
        const data = fs.readFileSync(activeDbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Erro ao ler banco de dados:", err);
        return defaultData;
    }
}

// Salva os dados no db.json
function writeDB(data) {
    try {
        fs.writeFileSync(activeDbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Erro ao salvar no banco de dados:", err);
    }
}

// Retorna o caminho atual
function getActiveDbPath() {
    return activeDbPath;
}

// Muda o banco de dados e salva na configuração
function changeDbPath(newPath, copyCurrent = false) {
    if (copyCurrent && fs.existsSync(activeDbPath)) {
        fs.copyFileSync(activeDbPath, newPath);
    }
    activeDbPath = newPath;
    fs.writeFileSync(configPath, JSON.stringify({ dbPath: activeDbPath }, null, 2), 'utf8');
}

module.exports = {
    readDB,
    writeDB,
    getActiveDbPath,
    changeDbPath
};
