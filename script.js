// Elementos de navegação e telas
const homeScreen = document.getElementById("home-screen");
const scannerArea = document.getElementById("scanner-area");
const btnLer = document.getElementById("btn-ler"); // Novo ID para o botão "Ler"
const btnHome = document.getElementById("btn-home"); // ID para o botão "Início"
const nomeProdutoEl = document.getElementById("nome-produto");

// ... (Resto das suas variáveis do DOM e a constante config) ...

// Elementos do DOM
const interactive = document.getElementById("interactive");
// MANTEMOS btnScanner para o estado do scanner, mas a ação principal é do btnLer

const modal = document.getElementById("product-modal");
const closeModalBtn = document.querySelector(".close-button");
const modalProductName = document.getElementById("modal-product-name");
const inputQuantidade = document.getElementById("input-quantidade");
const inputValor = document.getElementById("input-valor");
const btnAdicionar = document.getElementById("btn-adicionar");

let scannerEmFuncionamento = false;
let codigoEncontrado = null; 

// --- FUNÇÕES DE NAVEGAÇÃO ---

function mostrarTela(tela) {
  homeScreen.classList.add("hidden");
  scannerArea.classList.add("hidden");

  if (tela === "home") {
    homeScreen.classList.remove("hidden");
    pararScanner(); // Garante que o scanner pare ao voltar para a home
  } else if (tela === "scanner") {
    scannerArea.classList.remove("hidden");
  }
}

// --- FUNÇÕES DO SCANNER (AJUSTADAS) ---

function pararScanner(callback) {
  if (!scannerEmFuncionamento) return;

  Quagga.stop(function () {
    console.log("Scanner QuaggaJS parado (callback executado).");

    const video = interactive.querySelector("video");
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
      video.srcObject = null;
    }

    const codigoDetectado = codigoEncontrado;
    codigoEncontrado = null;
    interactive.innerHTML = "";
    nomeProdutoEl.textContent = "Aguardando código...";
    
    // Atualiza o texto do botão "Ler" para refletir o estado
    btnLer.querySelector('span').textContent = 'Ler';

    if (!codigoDetectado) {
        // Se parou sem ler, mostre a área de input manual
        abrirModalManual(); 
    }

    if (callback) callback();
  });

  scannerEmFuncionamento = false;
}

function iniciarScanner() {
  if (scannerEmFuncionamento) return;

  mostrarTela("scanner"); // Garante que a tela do scanner esteja visível
  interactive.innerHTML = "";

  btnLer.querySelector('span').textContent = 'Parar'; // Mudar o texto do botão Ler
  nomeProdutoEl.textContent = "Aguardando leitura...";

  Quagga.init(config, function (err) {
    if (err) {
      console.error("Erro ao inicializar o Quagga:", err);
      alert("Erro ao iniciar a câmera! Verifique as permissões.");
      mostrarTela("home");
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
    pararScanner(); // Parar o scanner imediatamente
    buscarProduto(codigo);
  }
});

// Opcional: Desenho da caixa de detecção (mantido)
Quagga.onProcessed((result) => {
  const drawingCtx = Quagga.canvas.ctx.overlay;

  if (result && result.box) {
    Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
      color: "lime",
      lineWidth: 2,
    });
  }
});

// --- FUNÇÕES DO MODAL (MANTIDAS/AJUSTADAS) ---

function abrirModal(nome, ean) {
  // ... (código para abrir modal mantido) ...
  modalProductName.textContent = nome;
  inputQuantidade.value = 1;
  inputValor.value = "";
  modal.classList.remove('hidden'); // Usa classe Tailwind para mostrar
  inputQuantidade.focus();
  modal.dataset.ean = ean;
  console.log(`Modal aberto para EAN: ${ean}`);
}

function abrirModalManual() {
  abrirModal("Inserir Produto Manualmente", "MANUAL");
  nomeProdutoEl.textContent = "Scanner Parado. Insira o produto.";
}

function fecharModal() {
  modal.classList.add('hidden'); // Usa classe Tailwind para esconder
  // Ao fechar o modal, se não estiver no scanner, volta para a home
  if (!scannerEmFuncionamento && scannerArea.classList.contains('hidden')) {
      mostrarTela('home');
  }
}

// --- EVENT LISTENERS ---

document.addEventListener("DOMContentLoaded", () => {
  // 1. Ação do Botão "Ler" (btn-ler)
  btnLer.addEventListener("click", () => {
    if (scannerEmFuncionamento) {
      pararScanner(); // Se estiver rodando, para e abre modal manual
    } else {
      iniciarScanner(); // Se estiver parado, inicia
    }
  });

  // 2. Ação do Botão "Início" (btn-home)
  btnHome.addEventListener("click", () => {
    mostrarTela("home");
  });

  // 3. Fechar o modal ao clicar no 'x'
  closeModalBtn.addEventListener("click", fecharModal);

  // 4. Fechar o modal ao clicar fora dele
  window.addEventListener("click", (event) => {
    // Usamos a classe 'modal' para identificar o background do modal
    if (event.target == modal) { 
      fecharModal();
    }
  });

  // 5. Ação do botão Adicionar (mantido)
  btnAdicionar.addEventListener("click", () => {
    const ean = modal.dataset.ean;
    const nome = modalProductName.textContent;
    const quantidade = inputQuantidade.value;
    const valor = inputValor.value;
    let qtd = parseFloat(quantidade);
    let preco = parseFloat(valor);
    let total = qtd * preco;
    const totalFormatado = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    console.log(
      `Adicionado: EAN=${ean}, Produto=${nome}, Qtd=${qtd}, Valor=${preco}`
    );
    alert(
      `Produto adicionado!\n${nome} (Qtd: ${qtd}, Total: ${totalFormatado})`
    );

    fecharModal();
    // Opcional: Reiniciar o scanner após adicionar o item
    // iniciarScanner();
  });
});

// --- FUNÇÃO DE BUSCA NA API DE PRODUTOS (MANTIDA) ---

const API_KEY = "P7uKcTcma8P8GLzyw0ICeA";
const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br/gtins/";

async function buscarProduto(ean) {
  // ... (código da função buscarProduto mantido) ...
  nomeProdutoEl.textContent = "Buscando dados do produto...";

  const url = `${COSMOS_API_URL}${ean}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Cosmos-Token": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      nomeProdutoEl.textContent = `Erro: ${response.status}. Produto não encontrado (${ean}).`;
      // Não reiniciamos o scanner, apenas voltamos para a home após fechar o modal.
      abrirModalManual(); 
      return;
    }

    const data = await response.json();
    const nomeProduto =
      data.description || "Produto sem descrição (EAN: " + ean + ")";

    nomeProdutoEl.textContent = nomeProduto;
    abrirModal(nomeProduto, ean);
  } catch (error) {
    console.error("Erro na busca da API:", error);
    nomeProdutoEl.textContent = "Falha ao conectar com o serviço de produtos.";
    abrirModalManual(); 
  }
}