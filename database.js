const fs = require('fs');
const path = require('path');
const os = require('os');

// Caminho do arquivo db.json fora do diretório do projeto para não disparar live-reload do Electron
const dbDir = path.join(os.homedir(), '.emitenota-oliveira');
const dbPath = path.join(dbDir, 'db.json');
const localDbPath = path.join(__dirname, 'db.json');

// Garante que o diretório existe
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Migra os dados já existentes do arquivo local, se houver
if (!fs.existsSync(dbPath) && fs.existsSync(localDbPath)) {
    try {
        fs.copyFileSync(localDbPath, dbPath);
    } catch (err) {
        console.error("Erro ao migrar banco de dados local para a pasta pessoal:", err);
    }
}

// Valores iniciais e padrões para o banco de dados
const defaultData = {
    impressoes: [],
    clientes: [],
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
        "Fraldinha bovina assada",
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
    ]
};

// Carrega os dados ou inicializa com os padrões
function readDB() {
    try {
        if (!fs.existsSync(dbPath)) {
            writeDB(defaultData);
            return defaultData;
        }
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Erro ao ler banco de dados:", err);
        return defaultData;
    }
}

// Salva os dados no db.json
function writeDB(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Erro ao salvar no banco de dados:", err);
    }
}

module.exports = {
    readDB,
    writeDB
};
