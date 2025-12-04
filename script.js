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
    },
    locator: {
        patchSize: "medium",
        halfSample: true
    },
    numOfWorkers: navigator.hardwareConcurrency || 4,
    locate: true,
};

let scannerEmFuncionamento = false;
let codigoEncontrado = null; // Armazena o último código para evitar leituras repetidas imediatas

// Elementos do DOM
const interactive = document.getElementById('interactive');
// Corrigido o ID do botão de acordo com seu HTML (dentro do <footer>)
const btnScanner = document.getElementById('btn-iniciar-scanner'); 
const nomeProdutoEl = document.getElementById('nome-produto');
const modal = document.getElementById('product-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalProductName = document.getElementById('modal-product-name');
const inputQuantidade = document.getElementById('input-quantidade');
const inputValor = document.getElementById('input-valor');
const btnAdicionar = document.getElementById('btn-adicionar');


// --- 1. FUNÇÕES DE CONTROLE DO SCANNER ---

/**
 * Para o QuaggaJS e reseta o estado do scanner.
 */
function pararScanner() {
    if (!scannerEmFuncionamento) return;

    Quagga.stop();
    scannerEmFuncionamento = false;
    codigoEncontrado = null; // Reseta para permitir nova leitura após a pausa

    // Atualiza o estado do botão
    btnScanner.textContent = 'SCAN (Reiniciar)';
    btnScanner.disabled = false;
    
    // Limpa o conteúdo da div interactive, removendo o vídeo/canvas
    interactive.innerHTML = '';
    console.log("Scanner QuaggaJS parado.");
}

/**
 * Inicializa e inicia o QuaggaJS, abrindo a câmera.
 */
function iniciarScanner() {
    if (scannerEmFuncionamento) return;
    
    // Resetar a div interactive antes de iniciar para evitar acúmulo de elementos
    interactive.innerHTML = ''; 

    // Atualiza o estado da UI
    btnScanner.textContent = 'Procurando...';
    btnScanner.disabled = true;
    nomeProdutoEl.textContent = 'Aguardando leitura...';

    Quagga.init(config, function (err) {
        if (err) {
            console.error("Erro ao inicializar o Quagga:", err);
            alert("Erro ao iniciar a câmera! Verifique as permissões.");
            pararScanner(); 
            return;
        }
        Quagga.start();
        scannerEmFuncionamento = true;
        console.log("Scanner QuaggaJS iniciado.");
        btnScanner.textContent = 'PARAR'; // Pode mudar o texto para indicar que está ativo
    });
}

// Quando um código é detectado
Quagga.onDetected(function (data) {
    const codigo = data.codeResult.code;

    // Garante que é um EAN-13 (13 dígitos) e que não é uma leitura repetida instantânea
    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;

        // ********* 🛑 Ação Principal: Parar a câmera após a leitura *********
        pararScanner();

        // Chamada da função para buscar o produto na API
        buscarProduto(codigo);
    }
});

// Opcional: Desenho da caixa de detecção
Quagga.onProcessed((result) => {
    const drawingCtx = Quagga.canvas.ctx.overlay;
    
    if (result && result.box) {
        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
    }
});


// --- 2. FUNÇÕES E EVENT LISTENERS DO MODAL ---

/**
 * Abre o modal e preenche com os dados do produto.
 */
function abrirModal(nome, ean) {
    modalProductName.textContent = nome;

    // Limpar/Resetar os inputs a cada abertura
    inputQuantidade.value = 1; // Padrão 1
    inputValor.value = '';

    modal.style.display = 'block';

    // Foco na quantidade para facilitar a digitação
    inputQuantidade.focus();

    // Armazena o EAN para uso posterior
    modal.dataset.ean = ean;
}

/**
 * Fecha o modal.
 */
function fecharModal() {
    modal.style.display = 'none';
    // Opcional: Reiniciar o scanner após fechar o modal
    // iniciarScanner(); 
}


document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o scanner automaticamente ao carregar a página
    iniciarScanner(); 

    // O botão agora serve para PARAR/REINICIAR o scanner
    btnScanner.addEventListener('click', () => {
        if (scannerEmFuncionamento) {
            pararScanner();
        } else {
            iniciarScanner();
        }
    });

    // Fechar o modal ao clicar no 'x'
    closeModalBtn.addEventListener('click', fecharModal);

    // Fechar o modal ao clicar fora dele
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            fecharModal();
        }
    });

    // Ação do botão Adicionar
    btnAdicionar.addEventListener('click', () => {
        const ean = modal.dataset.ean;
        const nome = modalProductName.textContent;
        const quantidade = inputQuantidade.value;
        const valor = inputValor.value;
        let qtd = parseFloat(quantidade);
        let preco = parseFloat(valor);
        let total = qtd * preco;
        const totalFormatado = total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        console.log(`Adicionado: EAN=${ean}, Produto=${nome}, Qtd=${qtd}, Valor=${preco}`);
        alert(`Produto adicionado!\n${nome} (Qtd: ${qtd}, Total: ${totalFormatado})`);

        fecharModal();
    });
});


// --- 3. FUNÇÃO DE BUSCA NA API DE PRODUTOS ---

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
            // Se o código não for encontrado, reinicia o scanner para o usuário tentar novamente
            nomeProdutoEl.textContent = `Erro: ${response.status}. Produto não encontrado (${ean}).`;
            iniciarScanner(); // Reinicia
            return;
        }

        const data = await response.json();
        const nomeProduto = data.description || 'Produto sem descrição (EAN: ' + ean + ')';

        nomeProdutoEl.textContent = nomeProduto; // Atualiza o texto
        
        // Abrir o modal com o nome do produto
        abrirModal(nomeProduto, ean);

    } catch (error) {
        console.error("Erro na busca da API:", error);
        nomeProdutoEl.textContent = 'Falha ao conectar com o serviço de produtos.';
        iniciarScanner(); // Reinicia em caso de falha de rede/API
    }
}