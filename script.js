// Configuração do QuaggaJS (alterada)
const config = {
  inputStream: {
    name: "Live",
    type: "LiveStream",
    target: document.querySelector("#interactive"),
    constraints: {
      width: 640,
      height: 480,
      facingMode: "environment",
    },
    // ÁREA DE LEITURA: Define onde o scanner deve focar
    // top/right/left/bottom variam de 0% a 100%
    area: {
      top: "25%", // Ignora os 25% superiores
      right: "15%", // Ignora os 15% da direita
      left: "15%", // Ignora os 15% da esquerda
      bottom: "25%", // Ignora os 25% inferiores
    },
  },
  // FREQUÊNCIA: Quantas vezes ele tenta ler por segundo.
  // Diminuir para 3 ou 5 torna a leitura menos "desesperada".
  frequency: 5,
  decoder: {
    readers: ["ean_reader", "ean_8_reader"],
    multiple: false,
  },
  locate: true,
  locator: {
    patchSize: "medium",
    halfSample: true,
  },
};

// Elementos de navegação e telas (mantidos)
const homeScreen = document.getElementById("home-screen");
const scannerArea = document.getElementById("scanner-area");
const btnLer = document.getElementById("btn-ler");
const btnHome = document.getElementById("btn-home");
const nomeProdutoEl = document.getElementById("nome-produto");
const manualInputContainer = document.getElementById("manual-input-container");
const btnManual = document.getElementById("btn-manual");

// Elementos do DOM do Modal de Inserção (mantidos)
const interactive = document.getElementById("interactive");
const productModal = document.getElementById("product-modal");
const closeModalBtn = productModal.querySelector(".close-button");
const modalProductName = document.getElementById("modal-product-name");
const inputQuantidade = document.getElementById("input-quantidade");
const inputValor = document.getElementById("input-valor");
const btnAdicionar = document.getElementById("btn-adicionar");

// Elementos do DOM do Modal da Lista (mantidos)
const listModal = document.getElementById("list-modal");
const closeListModalBtn = listModal.querySelector(".close-list-button");
const listaProdutosEl = document.getElementById("lista-produtos");
const valorTotalHeaderEl = document.getElementById("valor-total-header");
const valorTotalModalEl = document.getElementById("valor-total-modal");
const listaVaziaMsg = document.getElementById("lista-vazia-mensagem");
const btnLimparLista = document.getElementById("btn-limpar-lista");

let scannerEmFuncionamento = false;
let codigoEncontrado = null;
let timerEsperaLeitura;

// Chave do localStorage para a lista de compras (mantida)
const STORAGE_KEY = "listaDeProdutos";
// CHAVE NOVA: Histórico do último preço visto (Chave para o mapeamento EAN -> Preço)
const STORAGE_HISTORY_KEY = "historicoPrecos";

// --- FUNÇÕES DE ARMAZENAMENTO E CÁLCULO ---

/** Carrega a lista de produtos do localStorage. */
function carregarLista() {
  const listaJSON = localStorage.getItem(STORAGE_KEY);
  return listaJSON ? JSON.parse(listaJSON) : [];
}

/** Salva a lista de produtos no localStorage. */
function salvarLista(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  atualizarTotalELista();
}

/** NOVO: Carrega o mapa de histórico de preços do localStorage. */
function carregarHistorico() {
  const historicoJSON = localStorage.getItem(STORAGE_HISTORY_KEY);
  return historicoJSON ? JSON.parse(historicoJSON) : {};
}

/** NOVO: Salva o último preço unitário de um produto no histórico. */
function salvarHistoricoProduto(ean, valorUnitario) {
  if (ean === "MANUAL") return; // Não salva códigos manuais
  const historico = carregarHistorico();
  historico[ean] = valorUnitario;
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(historico));
}

/** Calcula o total de todos os produtos na lista. (mantida)*/
function calcularTotal(lista) {
  return lista.reduce((soma, produto) => soma + produto.subtotal, 0);
}

/** Formata um valor numérico para o padrão de moeda BRL (R$). (mantida)*/
function formatarMoeda(valor) {
  // Garante que o valor seja um número antes de formatar
  if (typeof valor !== "number" || isNaN(valor)) {
    return "R$ 0,00";
  }
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function renderizarLista() {
  const lista = carregarLista();
  listaProdutosEl.innerHTML = "";

  if (lista.length === 0) {
    listaProdutosEl.appendChild(listaVaziaMsg);
    btnLimparLista.disabled = true;
  } else {
    btnLimparLista.disabled = false;
    lista.forEach((produto, index) => {
      const listItem = document.createElement("li");
      listItem.className =
        "bg-gray-50 p-3 rounded-xl shadow-sm flex justify-between items-center border border-gray-200";
      listItem.innerHTML = `
              <div>
                  <p class="text-sm font-semibold text-gray-900">${
                    produto.nome
                  }</p>
                  <p class="text-xs text-gray-500">Unid. ${
                    produto.quantidade
                  } - ${formatarMoeda(produto.valorUnitario)}</p>
              </div>
              <div class="text-right flex items-center gap-3">
                  <p class="font-bold text-base text-green-600">${formatarMoeda(
                    produto.subtotal
                  )}</p>
                  
                  <button data-index="${index}" class="btn-remover text-red-500 hover:text-red-700 hover:scale-110 transition-all p-1">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                  </button>
              </div>
          `;
      listaProdutosEl.appendChild(listItem);
    });

    // Adiciona listeners aos botões de remoção
    document.querySelectorAll(".btn-remover").forEach((button) => {
      button.addEventListener("click", removerProduto);
    });
  }

  const total = calcularTotal(lista);
  valorTotalHeaderEl.textContent = formatarMoeda(total);
  valorTotalModalEl.textContent = formatarMoeda(total);
}

/** Atualiza os totais nas telas (Header e Modal). (mantida)*/
function atualizarTotalELista() {
  renderizarLista();
}

/** Remove um produto da lista pelo seu índice. (mantida)*/
function removerProduto(event) {
  const index = parseInt(event.currentTarget.dataset.index);
  let lista = carregarLista();

  if (index > -1 && index < lista.length) {
    lista.splice(index, 1);
    salvarLista(lista);
  }
}

/** Limpa toda a lista de produtos. (mantida)*/
function limparLista() {
  if (confirm("Tem certeza que deseja limpar toda a lista de compras?")) {
    salvarLista([]);
    alert("Lista limpa!");
  }
}

// --- FUNÇÕES DE NAVEGAÇÃO E MODAIS (A função abrirProductModal foi modificada) ---

function mostrarTela(tela) {
  homeScreen.classList.add("hidden");
  scannerArea.classList.add("hidden");

  if (tela === "home") {
    homeScreen.classList.remove("hidden");
    pararScanner();
  } else if (tela === "scanner") {
    scannerArea.classList.remove("hidden");
  }
}

/** * Função MODIFICADA:
 * 1. Verifica histórico.
 * 2. Aplica cor roxa e mensagem se o EAN estiver no histórico.
 */
function abrirProductModal(nome, ean) {
  // Limpa classes e conteúdo anterior
  modalProductName.textContent = nome;
  modalProductName.className = "text-green-900 font-medium text-center"; // Padrão

  // Remove qualquer span de comparação que possa ter sobrado
  const oldComparison = document.getElementById("price-comparison-span");
  if (oldComparison) oldComparison.remove();

  // ------------------ Lógica de Histórico ------------------
  const historico = carregarHistorico();
  const precoAnterior = historico[ean];

  if (precoAnterior !== undefined) {
    // MODO: Produto Conhecido (Histórico Encontrado)
    modalProductName.textContent = nome;
    modalProductName.className = "text-green-900 font-medium text-center";

    // Cria o span de comparação de preço
    const comparisonSpan = document.createElement("span");
    comparisonSpan.id = "price-comparison-span";
    comparisonSpan.className =
      "block text-xs font-semibold mt-1 text-green-600";
    comparisonSpan.textContent = `Preço da última compra: ${formatarMoeda(
      precoAnterior
    )}`;

    // Insere o span abaixo do input de valor
    const valorDiv = document.getElementById("input-valor").parentNode;
    valorDiv.appendChild(comparisonSpan);

    // Sugere o preço anterior no input para facilitar a inserção
    inputValor.value = "";
  } else {
    // MODO: Produto Novo
    // Limpa o campo de valor
    inputValor.value = "";
  }
  // ---------------------------------------------------------

  inputQuantidade.value = ""; // Volta ao padrão

  productModal.classList.remove("hidden");
  inputQuantidade.focus();
  productModal.dataset.ean = ean;
}

function fecharProductModal() {
  productModal.classList.add("hidden");
  // Removido o pararScanner daqui, pois ele já foi parado ao detectar o código
  mostrarTela("home");
}

function abrirListModal() {
  renderizarLista();
  listModal.classList.remove("hidden");
}

function fecharListModal() {
  listModal.classList.add("hidden");
}

// --- FUNÇÕES DO SCANNER (mantidas) ---

function pararScanner(callback) {
  if (!scannerEmFuncionamento) {
    if (callback) callback();
    return;
  }

  clearTimeout(timerEsperaLeitura);
  manualInputContainer.classList.add("hidden");
  scannerEmFuncionamento = false; // Define como falso imediatamente para evitar chamadas duplas

  Quagga.stop();

  // Garante o encerramento da câmera acessando os tracks diretamente
  const video = interactive.querySelector("video");
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
  }

  // Limpa o conteúdo visual do scanner
  interactive.innerHTML = "";

  if (callback && typeof callback === "function") {
    callback();
  }
}

function iniciarScanner() {
  if (scannerEmFuncionamento) return;

  mostrarTela("scanner");
  interactive.innerHTML = "";

  Quagga.init(config, function (err) {
    if (err) {
      console.error("Erro ao inicializar o Quagga:", err);
      alert("Erro ao iniciar a câmera! Verifique as permissões.");
      mostrarTela("home");
      return;
    }
    Quagga.start();
    scannerEmFuncionamento = true;
    iniciarTimerManual();
  });
}

function iniciarTimerManual() {
  // Define o tempo de espera em milissegundos (5 segundos)
  const TEMPO_ESPERA_MS = 5000;

  // Limpa qualquer timer anterior para garantir que só haja um ativo
  clearTimeout(timerEsperaLeitura);

  timerEsperaLeitura = setTimeout(() => {
    // Se o scanner ainda estiver funcionando após 5 segundos, mostra o botão
    if (scannerEmFuncionamento) {
      manualInputContainer.classList.remove("hidden");
    }
  }, TEMPO_ESPERA_MS);
}

// Quando um código é detectado (mantida)
Quagga.onDetected(function (data) {
  const codigo = data.codeResult.code;

  if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
    codigoEncontrado = codigo;
    clearTimeout(timerEsperaLeitura);
    manualInputContainer.classList.add("hidden");
    pararScanner();
    mostrarTela("home");
    buscarProduto(codigo);
  }
});

function abrirModalManual() {
  abrirProductModal("Novo Produto", "MANUAL");
  // nomeProdutoEl.textContent = "Scanner Parado. Insira o produto.";
}

// --- FUNÇÃO DE BUSCA NA API DE PRODUTOS (mantida) ---

const API_KEY = "P7uKcTcma8P8GLzyw0ICeA"; // (Sua chave)
const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br/gtins/";

async function buscarProduto(ean) {
  nomeProdutoEl.textContent = "Buscando dados do produto...";

  const url = `${COSMOS_API_URL}${ean}`;

  try {
    // ... (lógica de fetch)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Cosmos-Token": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      nomeProdutoEl.textContent = `Erro: ${response.status}. Produto não encontrado (${ean}).`;
      abrirModalManual();
      return;
    }

    const data = await response.json();
    const nomeProduto =
      data.description || "Produto sem descrição (EAN: " + ean + ")";

    nomeProdutoEl.textContent = nomeProduto;
    abrirProductModal(nomeProduto, ean); // Chama a função modificada
  } catch (error) {
    console.error("Erro na busca da API:", error);
    nomeProdutoEl.textContent = "Falha ao conectar com o serviço de produtos.";
    abrirModalManual();
  }
}

// --- EVENT LISTENERS (Modificado para SALVAR O HISTÓRICO) ---

document.addEventListener("DOMContentLoaded", () => {
  atualizarTotalELista();

  btnLer.addEventListener("click", () => {
    if (scannerEmFuncionamento) {
      pararScanner(() => {
        mostrarTela("home");
      });
    } else {
      iniciarScanner();
    }
  });

  btnHome.addEventListener("click", abrirListModal);
  closeModalBtn.addEventListener("click", fecharProductModal);
  productModal.addEventListener("click", (event) => {
    if (event.target === productModal) {
      fecharProductModal();
    }
  });

  closeListModalBtn.addEventListener("click", fecharListModal);
  listModal.addEventListener("click", (event) => {
    if (event.target === listModal) {
      fecharListModal();
    }
  });

  btnLimparLista.addEventListener("click", limparLista);

  // Adicionar Produto (Lógica modificada para salvar no histórico)
  btnAdicionar.addEventListener("click", () => {
    const ean = productModal.dataset.ean;
    const nome = modalProductName.textContent;
    const quantidade = inputQuantidade.value;
    const valor = inputValor.value;

    let qtd = parseFloat(quantidade);
    let preco = parseFloat(valor.replace(",", "."));

    if (isNaN(qtd) || qtd <= 0) {
      alert("Por favor, insira uma quantidade válida.");
      return;
    }
    if (isNaN(preco) || preco < 0) {
      alert("Por favor, insira um valor válido.");
      return;
    }

    let subtotal = qtd * preco;

    const novoProduto = {
      nome: nome,
      quantidade: qtd,
      valorUnitario: preco,
      subtotal: subtotal,
      ean: ean,
    };

    // 1. Salva na lista de compras
    const listaAtual = carregarLista();
    listaAtual.push(novoProduto);
    salvarLista(listaAtual);

    // 2. NOVO: Salva o valor unitário no histórico para comparação futura
    salvarHistoricoProduto(ean, preco);

    Swal.fire({
      title: "Produto Adicionado! 💜",
      showConfirmButton: false,
      timer: 2000,
      toast: true,
      position: "top-end",
    });

    fecharProductModal();
    mostrarTela("home");
  });

  btnManual.addEventListener("click", () => {
    pararScanner();
    abrirModalManual();
  });

  mostrarTela("home");
});
