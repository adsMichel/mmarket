// Configurações do QuaggaJS
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
// **ATENÇÃO: Elemento nome-produto deve ser adicionado ao HTML**
const nomeProdutoEl = document.getElementById('nome-produto'); 
const modal = document.getElementById('product-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalProductName = document.getElementById('modal-product-name');
const inputQuantidade = document.getElementById('input-quantidade');
const inputValor = document.getElementById('input-valor');
const btnAdicionar = document.getElementById('btn-adicionar');
const totalValueDisplay = document.querySelector('#fixed-header p'); // Elemento para o Total
let totalGeral = 150.00; // Valor inicial do HTML (R$ 150,00)


// --- 1. FUNÇÕES DE CONTROLE DO SCANNER ---

function pararScanner() {
    if (!scannerEmFuncionamento) return;

    Quagga.stop();
    scannerEmFuncionamento = false;
    codigoEncontrado = null; // Reseta para permitir nova leitura

    // Atualiza o estado do botão
    // Se o ícone está no SVG, talvez você queira reabilitar a classe 'active' 
    // ou mudar o texto do span se ele for o 'Ler'
    const spanLer = btnScanner.querySelector('span');
    if (spanLer) spanLer.textContent = 'Ler';

    btnScanner.disabled = false;

    // Limpa a área de visualização, mas mantém o estilo
    const interactiveDiv = document.getElementById('interactive');
    // Remove o canvas e video gerados pelo Quagga
    const elementsToRemove = interactiveDiv.querySelectorAll('canvas, video');
    elementsToRemove.forEach(el => el.remove());

    console.log("Scanner QuaggaJS parado.");
}


function iniciarScanner() {
    if (scannerEmFuncionamento) return;

    // Remove a classe 'active' de todos os itens e adiciona ao scanner
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active', 'text-blue-700'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.add('text-gray-500'));
    btnScanner.classList.add('active', 'text-blue-700');
    btnScanner.classList.remove('text-gray-500');

    // Atualiza o estado do botão
    const spanLer = btnScanner.querySelector('span');
    if (spanLer) spanLer.textContent = 'Procurando...';

    // btnScanner.disabled = true; // Mantemos desabilitado até parar ou falhar
    if (nomeProdutoEl) nomeProdutoEl.textContent = 'Aguardando leitura...';


    // Garante que o elemento alvo existe no DOM
    const targetEl = document.querySelector('#interactive');
    if (!targetEl) {
        console.error("Elemento alvo #interactive não encontrado.");
        if (nomeProdutoEl) nomeProdutoEl.textContent = 'Erro de inicialização: Elemento scanner ausente.';
        return;
    }
    
    // Quagga.init chama a câmera e adiciona os elementos ao target
    Quagga.init(config, function (err) {
        if (err) {
            console.error(err);
            alert("Erro ao iniciar a câmera! Verifique as permissões. " + err.message);
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

    // Verifica se é um EAN-13 válido (o formato mais comum) e se não foi lido duas vezes seguidas
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
    inputQuantidade.value = 1; // Sugerir 1 como padrão
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


// --- FUNÇÃO PARA ATUALIZAR O TOTAL GERAL ---
function atualizarTotalGeral(novoTotal) {
    totalGeral = novoTotal;
    const totalFormatado = totalGeral.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    if (totalValueDisplay) {
        totalValueDisplay.textContent = totalFormatado;
    }
}


// --- 2. EVENT LISTENER PARA O BOTÃO ---

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o total a partir do HTML
    const valorInicialStr = totalValueDisplay.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim();
    totalGeral = parseFloat(valorInicialStr) || 0;
    
    // Evento de clique para iniciar o scanner
    btnScanner.addEventListener('click', iniciarScanner);
    
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
        
        let qtd = parseFloat(inputQuantidade.value);
        let preco = parseFloat(inputValor.value);

        // Validação básica
        if (isNaN(qtd) || qtd <= 0) {
            alert('Por favor, insira uma quantidade válida.');
            return;
        }
        if (isNaN(preco) || preco <= 0) {
            alert('Por favor, insira um valor unitário válido.');
            return;
        }
        
        const totalProduto = qtd * preco;
        const totalFormatado = totalProduto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        // 💡 ATUALIZA O TOTAL GERAL
        const novoTotal = totalGeral + totalProduto;
        atualizarTotalGeral(novoTotal);

        console.log(`Adicionado: EAN=${ean}, Produto=${nome}, Qtd=${qtd}, Valor Unitário=${preco}, Total=${totalFormatado}`);
        alert(`🛒 Produto adicionado à lista!\n${nome} (Qtd: ${qtd}, Total: ${totalFormatado})`);

        fecharModal();
    });

    // Adiciona o evento de clique para os outros botões da navegação para simular a mudança de estado
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', function() {
            // Se for o botão do scanner, a função iniciarScanner já cuida disso
            if (this.id === 'btn-iniciar-scanner') {
                return; 
            }

            // Para os outros botões (Início, Perfil), para o scanner se estiver rodando
            if (scannerEmFuncionamento) {
                pararScanner();
            }

            // Remove a classe 'active' de todos os itens e adiciona ao clicado
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active', 'text-blue-700');
                item.classList.add('text-gray-500');
            });
            this.classList.add('active', 'text-blue-700');
            this.classList.remove('text-gray-500');

            // Exemplo: mostrar o nome do botão clicado
            const btnName = this.querySelector('span').textContent;
            if (nomeProdutoEl) nomeProdutoEl.textContent = `Navegando para: ${btnName}`;
        });
    });
});


// --- 3. FUNÇÃO DE BUSCA NA API DE PRODUTOS ---

// Use sua chave de API real aqui
const API_KEY = "P7uKcTcma8P8GLzyw0ICeA"; 
const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br/gtins/";

async function buscarProduto(ean) {
    if (nomeProdutoEl) nomeProdutoEl.textContent = 'Buscando dados do produto...';

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
            const errorText = `Erro: ${response.status}. Produto ${ean} não encontrado ou falha na API.`;
            if (nomeProdutoEl) nomeProdutoEl.textContent = errorText;
            alert(errorText); // Alerta o usuário
            return;
        }

        const data = await response.json();
        const nomeProduto = data.description || 'Produto sem descrição (EAN: ' + ean + ')';
        // Tenta buscar um preço (exemplo, a API Cosmos retorna dados complexos, use 'gpc_price' se disponível)
        // const precoSugerido = data.gpc_price ? data.gpc_price.toFixed(2) : ''; 
        const precoSugerido = data.gpc_price || '';


        if (nomeProdutoEl) nomeProdutoEl.textContent = `Produto encontrado: ${nomeProduto}`; 

        // ********* 🚀 Abrir o modal com o nome do produto *********
        abrirModal(nomeProduto, ean);

        // Se houver um preço sugerido, preenche o input de valor
        if (precoSugerido) {
            inputValor.value = parseFloat(precoSugerido).toFixed(2);
        }

    } catch (error) {
        console.error("Erro na busca da API:", error);
        if (nomeProdutoEl) nomeProdutoEl.textContent = 'Falha ao conectar com o serviço de produtos.';
    }
}