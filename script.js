// Configurações do QuaggaJS (mantidas)
const config = {
    inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector('#interactive'),
        constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
        },
    },
    decoder: {
        readers: ["ean_reader"]
    }
};

let scannerEmFuncionamento = false;
let codigoEncontrado = null; 

// Elementos do DOM
const btnScanner = document.getElementById('btn-iniciar-scanner');
const codigoLidoEl = document.getElementById('codigo-lido');
const nomeProdutoEl = document.getElementById('nome-produto');


// --- 1. FUNÇÕES DE CONTROLE DO SCANNER ---

function pararScanner() {
    if (!scannerEmFuncionamento) return;
    
    Quagga.stop();
    scannerEmFuncionamento = false;
    codigoEncontrado = null; // Reseta para permitir nova leitura
    
    // Atualiza o estado do botão
    btnScanner.textContent = '📷 Ler Código';
    btnScanner.disabled = false;
    
    // Limpa a área de visualização, se necessário (o Quagga.stop() faz a maior parte)
    document.getElementById('interactive').innerHTML = ''; 
    console.log("Scanner QuaggaJS parado.");
}


function iniciarScanner() {
    if (scannerEmFuncionamento) return;

    // Atualiza o estado do botão
    btnScanner.textContent = 'Procurando...';
    btnScanner.disabled = true; // Desabilita o botão enquanto a câmera está aberta
    codigoLidoEl.textContent = 'Aguardando leitura...';
    nomeProdutoEl.textContent = 'Aguardando leitura...';


    Quagga.init(config, function(err) {
        if (err) {
            console.error(err);
            alert("Erro ao iniciar a câmera! Verifique as permissões.");
            pararScanner(); // Chama parar para resetar o botão
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
    
    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;
        codigoLidoEl.textContent = codigo;
        
        // ********* 🛑 Ação Principal: Parar a câmera após a leitura *********
        pararScanner();
        
        // Chamada da função para buscar o produto na API
        buscarProduto(codigo);
    }
});


// --- 2. EVENT LISTENER PARA O BOTÃO ---

// Associa a função iniciarScanner ao clique do botão
document.addEventListener('DOMContentLoaded', () => {
    btnScanner.addEventListener('click', iniciarScanner);
});


// --- 3. FUNÇÃO DE BUSCA NA API DE PRODUTOS (Mantida do exemplo anterior) ---

const API_KEY = "P7uKcTcma8P8GLzyw0ICeA"; 
const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br/gtins/";

async function buscarProduto(ean) {
    nomeProdutoEl.textContent = 'Buscando dados do produto...';

    const url = `${COSMOS_API_URL}${ean}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Cosmos-Token': API_KEY, 
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            nomeProdutoEl.textContent = `Erro: ${response.status}. Produto não encontrado ou falha na API.`;
            return;
        }

        const data = await response.json();
        const nomeProduto = data.description || 'Descrição não disponível';
        const marcaProduto = data.brand ? ` (${data.brand.name})` : '';

        nomeProdutoEl.textContent = nomeProduto + marcaProduto;
        
    } catch (error) {
        console.error("Erro na busca da API:", error);
        nomeProdutoEl.textContent = 'Falha ao conectar com o serviço de produtos.';
    }
}
