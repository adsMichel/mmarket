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
const nomeProdutoEl = document.getElementById('nome-produto');
const modal = document.getElementById('product-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalProductName = document.getElementById('modal-product-name');
const inputQuantidade = document.getElementById('input-quantidade');
const inputValor = document.getElementById('input-valor');
const btnAdicionar = document.getElementById('btn-adicionar');

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
    nomeProdutoEl.textContent = 'Aguardando leitura...';


    Quagga.init(config, function (err) {
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
Quagga.onDetected(function (data) {
    const codigo = data.codeResult.code;

    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;

        // ********* 🛑 Ação Principal: Parar a câmera após a leitura *********
        pararScanner();

        // Chamada da função para buscar o produto na API
        buscarProduto(codigo);
    }
});

// Funções de controle do Modal
function abrirModal(nome, ean) {
    modalProductName.textContent = nome;

    // Opcional: Limpar/Resetar os inputs a cada abertura
    inputQuantidade.value = '';
    inputValor.value = '';

    modal.style.display = 'block';

    // Foco na quantidade para facilitar a digitação
    inputQuantidade.focus();

    // Armazena o EAN para uso posterior (ex: função Adicionar)
    modal.dataset.ean = ean;
}

function fecharModal() {
    modal.style.display = 'none';
}

// Quando um código é detectado (mantido)
Quagga.onDetected(function (data) {
    const codigo = data.codeResult.code;

    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;

        // Parar a câmera após a leitura
        pararScanner();

        // Chamada da função para buscar o produto na API
        buscarProduto(codigo);
    }
});


// --- 2. EVENT LISTENER PARA O BOTÃO ---

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    btnScanner.addEventListener('click', iniciarScanner);

    // Fechar o modal ao clicar no 'x'
    closeModalBtn.addEventListener('click', fecharModal);

    // Fechar o modal ao clicar fora dele
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            fecharModal();
        }
    });

    // Ação do botão Adicionar (apenas um exemplo de console.log)
    btnAdicionar.addEventListener('click', () => {
        const ean = modal.dataset.ean;
        const nome = modalProductName.textContent;
        const quantidade = inputQuantidade.value;
        const valor = inputValor.value;

        console.log(`Adicionado: EAN=${ean}, Produto=${nome}, Qtd=${quantidade}, Valor=${valor}`);

        alert(`Produto adicionado!\n${nome} (Qtd: ${quantidade}, R$ ${valor*quantidade})`);
        fecharModal();
    });
});




// --- 3. FUNÇÃO DE BUSCA NA API DE PRODUTOS (Mantida do exemplo anterior) ---

// --- FUNÇÃO DE BUSCA NA API DE PRODUTOS (MODIFICADA) ---
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

        nomeProdutoEl.textContent = nomeProduto; // Atualiza o texto abaixo do scanner

        // ********* 🚀 NOVO: Abrir o modal com o nome do produto *********
        abrirModal(nomeProduto, ean);

    } catch (error) {
        console.error("Erro na busca da API:", error);
        nomeProdutoEl.textContent = 'Falha ao conectar com o serviço de produtos.';
    }
}
