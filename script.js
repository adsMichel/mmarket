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


function pararScanner() {
    if (!scannerEmFuncionamento) return;

    // 1. Chamar a função de parada do Quagga
    Quagga.stop();
    scannerEmFuncionamento = false;

    // 2. FORÇAR A PARADA DO STREAM DE VÍDEO (Solução para o problema)
    const video = interactive.querySelector('video');
    if (video && video.srcObject) {
        // Acessa o MediaStreamTrack e interrompe
        video.srcObject.getTracks().forEach(track => {
            track.stop();
        });
        video.srcObject = null; // Limpa a referência
    }

    // 3. Captura o valor de codigoEncontrado antes de resetá-lo
    const codigoDetectado = codigoEncontrado; 
    codigoEncontrado = null; 

    // 4. Limpa o conteúdo da div interactive, removendo o vídeo/canvas
    interactive.innerHTML = ''; 
    
    // 5. Atualiza o estado da UI e abre o modal, se necessário
    btnScanner.textContent = 'SCAN (Reiniciar)';
    btnScanner.disabled = false;
    console.log("Scanner QuaggaJS parado.");

    if (!codigoDetectado) {
        abrirModalManual();
    }
}

function iniciarScanner() {
    // ... (Seu código da função iniciarScanner permanece o mesmo) ...
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
        btnScanner.textContent = 'PARAR';
    });
}

// Quando um código é detectado
Quagga.onDetected(function (data) {
    const codigo = data.codeResult.code;

    // Garante que é um EAN-13 (13 dígitos) e que não é uma leitura repetida instantânea
    if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
        codigoEncontrado = codigo;
        
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


function abrirModal(nome, ean) {
    modalProductName.textContent = nome;

    // Limpar/Resetar os inputs a cada abertura
    inputQuantidade.value = 1; 
    inputValor.value = '';

    modal.style.display = 'block';

    inputQuantidade.focus();

    // Armazena o EAN (pode ser "MANUAL" se for entrada manual)
    modal.dataset.ean = ean;
    console.log(`Modal aberto para EAN: ${ean}`);
}

function abrirModalManual() {
    // Usamos 'MANUAL' ou um código dummy para o EAN neste caso.
    abrirModal("Inserir Produto Manualmente", "MANUAL"); 
    nomeProdutoEl.textContent = "Scanner Parado. Insira o produto.";
}

function fecharModal() {
    modal.style.display = 'none';
    // Opcional: manter o texto como "Scanner Parado..."
}


document.addEventListener('DOMContentLoaded', () => {
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