// Configurações do QuaggaJS
const config = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector('#interactive'), // O elemento HTML onde o vídeo aparecerá
        constraints: {
            width: 640,
            height: 480,
            facingMode: "environment" // Usa a câmera traseira do celular
        },
    },
    decoder: {
        readers: ["ean_reader"] // Lê códigos EAN (EAN-13 é o mais comum no Brasil)
    }
};

let scannerEmFuncionamento = false;
let codigoEncontrado = null; // Para evitar leituras repetidas

// Função de inicialização
function iniciarScanner() {
    if (scannerEmFuncionamento) return;

    Quagga.init(config, function(err) {
        if (err) {
            console.error(err);
            alert("Erro ao iniciar a câmera! Verifique as permissões.");
            return;
        }
        Quagga.start();
        scannerEmFuncionamento = true;
        console.log("Scanner QuaggaJS iniciado.");
    });
}

// Quando um código é detectado
Quagga.onDetected(function(data) {
    const codigo = data.codeResult.code;
    
    // Verifica se é um código EAN-13 (13 dígitos) e se já não foi processado
    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;
        document.getElementById('codigo-lido').textContent = codigo;
        
        // **OPCIONAL:** Parar o scanner após a primeira leitura
        Quagga.stop();
        scannerEmFuncionamento = false;
        
        // Chamada da função para buscar o produto na API
        buscarProduto(codigo);
    }
});

// Inicia o scanner automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', iniciarScanner);

// --- FUNÇÃO DE BUSCA NA API DE PRODUTOS ---

// Substitua "SUA_API_KEY" pela sua chave de autenticação real da Cosmos ou outra API.
const API_KEY = "P7uKcTcma8P8GLzyw0ICeA"; 
const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br/gtins/";

async function buscarProduto(ean) {
    document.getElementById('nome-produto').textContent = 'Buscando dados do produto...';

    // A API Cosmos usa o código EAN (GTIN) para busca
    const url = `${COSMOS_API_URL}${ean}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // A Cosmos normalmente usa um token ou chave específica aqui.
                // Isso é um exemplo, verifique a documentação da API.
                'X-Cosmos-Token': API_KEY, 
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            document.getElementById('nome-produto').textContent = `Erro: ${response.status}. Produto não encontrado ou falha na API.`;
            // Tenta reiniciar o scanner após o erro
            iniciarScanner(); 
            return;
        }

        const data = await response.json();
        
        // Exemplo de como a Cosmos retorna o nome/descrição
        const nomeProduto = data.description || 'Descrição não disponível';
        const marcaProduto = data.brand ? ` (${data.brand.name})` : '';

        document.getElementById('nome-produto').textContent = nomeProduto + marcaProduto;
        
    } catch (error) {
        console.error("Erro na busca da API:", error);
        document.getElementById('nome-produto').textContent = 'Falha ao conectar com o serviço de produtos.';
    } finally {
        // Tenta reiniciar o scanner para uma nova leitura após a busca
        iniciarScanner(); 
    }
}
