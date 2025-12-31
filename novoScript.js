// --- CONFIGURAÇÕES E CHAVES ---
const API_KEY = "P7uKcTcma8P8GLzyw0ICeA";
const COSMOS_URL = "https://api.cosmos.bluesoft.com.br/gtins/";
const STORAGE_KEY = "listaDeProdutos";
const STORAGE_HISTORY_KEY = "historicoPrecos";

let scannerAtivo = false;

// --- NOVAS VARIÁVEIS DE CONTROLE DE LEITURA ---
let leiturasConsecutivas = 0;
let ultimoCodigoLido = null;
const LEITURAS_NECESSARIAS = 3; // Número de vezes para validar

// --- ELEMENTOS DO DOM ---
const containerListas = document.getElementById("container-listas");
const valorTotalFooter = document.getElementById("valor-total-footer");
const btnLerBarcode = document.getElementById("btn-ler-barcode");
const scannerContainer = document.getElementById("scanner-container");
const btnCancelarScan = document.getElementById("btn-cancelar-scan");

// --- FUNÇÕES DE DADOS ---

function carregarLista() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function salvarLista(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  renderizarLista();
}

function carregarHistorico() {
  return JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY)) || {};
}

function salvarHistorico(ean, preco) {
  const hist = carregarHistorico();
  hist[ean] = preco;
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(hist));
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --- INTERFACE ---

function renderizarLista() {
  const lista = carregarLista();
  containerListas.innerHTML = "";
  let totalGeral = 0;

  lista.forEach((prod, index) => {
    totalGeral += prod.subtotal;
    const li = document.createElement("li");
    li.className =
      "flex justify-between items-center bg-white p-4 border-b border-gray-100 shadow-sm";
    li.innerHTML = `
            <div>
                <p class="font-medium text-gray-800">${prod.nome}</p>
                <p class="text-xs text-gray-400">${formatarMoeda(
                  prod.valorUnitario
                )} un.</p>
            </div>
            <div class="flex items-center gap-4">
                <span class="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold">${
                  prod.quantidade
                }</span>
                <button onclick="removerItem(${index})" class="text-red-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
        `;
    containerListas.appendChild(li);
  });
  valorTotalFooter.textContent = formatarMoeda(totalGeral);
}

window.removerItem = (index) => {
  const lista = carregarLista();
  lista.splice(index, 1);
  salvarLista(lista);
};

// --- LÓGICA DO SCANNER ---

function iniciarScanner() {
  if (scannerAtivo) return;

  const container = document.getElementById("scanner-container");
  const interactive = document.querySelector("#interactive");

  interactive.innerHTML = "";
  container.classList.remove("hidden");

  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: interactive,
        constraints: {
          // Resolução menor (640x480) processa MUITO mais rápido que HD
          width: 640,
          height: 480,
          facingMode: "environment",
        },
        // Área de busca reduzida: o scanner foca apenas no centro
        area: { top: "30%", right: "20%", left: "20%", bottom: "30%" },
      },
      // Localizador otimizado
      locator: {
        patchSize: "small", // "small" é mais rápido para códigos de barras comuns
        halfSample: true, // Reduz a imagem pela metade para processar menos pixels
      },
      decoder: {
        readers: ["ean_reader"], // Apenas EAN-13 (mais rápido). Adicione "ean_8_reader" se necessário.
        multiple: false,
      },
      locate: true,
      frequency: 20, // Máxima frequência de varredura (20 vezes por segundo)
    },
    function (err) {
      if (err) {
        container.classList.add("hidden");
        return;
      }
      Quagga.start();
      scannerAtivo = true;
    }
  );
}

Quagga.onDetected((data) => {
  // Usamos o 'code' apenas se a precisão (fallback) for aceitável
  const code = data.codeResult.code;

  if (code === ultimoCodigoLido) {
    leiturasConsecutivas++;
  } else {
    ultimoCodigoLido = code;
    leiturasConsecutivas = 1;
  }

  // Com frequency: 20, 3 leituras acontecem em frações de segundo
  if (leiturasConsecutivas >= 3) {
    leiturasConsecutivas = 0;
    ultimoCodigoLido = null;

    if (navigator.vibrate) navigator.vibrate(50); // Feedback rápido
    pararScanner();
    buscarEAdicionar(code);
  }
});

function pararScanner() {
  Quagga.stop();
  scannerAtivo = false;
  document.getElementById("scanner-container").classList.add("hidden");
  // Limpa o vídeo para não travar a câmera
  document.querySelector("#interactive").innerHTML = "";
}

// --- BUSCA API E MODAL DE ADIÇÃO ---

async function buscarEAdicionar(ean) {
  Swal.fire({
    title: "Buscando...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const response = await fetch(`${COSMOS_URL}${ean}`, {
      headers: {
        "X-Cosmos-Token": API_KEY,
        "Content-Type": "application/json",
      },
    });

    let nome = "Produto não encontrado";
    if (response.ok) {
      const data = await response.json();
      nome = data.description;
    }

    const historico = carregarHistorico();
    const ultimoPreco = historico[ean] || "";

    Swal.fire({
      title: "Confirmar Produto",
      // Customizamos o estilo do SweetAlert para ser mais compacto
      customClass: {
        popup: "rounded-3xl",
        title: "text-lg font-bold pt-4",
        htmlContainer: "mt-2",
      },
      html: `
        <p class="text-xs text-gray-400 uppercase font-bold mb-3 tracking-wide">${nome}</p>
        
        <div class="flex gap-2 px-2">
            <div class="flex-1">
                <label class="block text-[10px] text-left ml-1 font-bold text-gray-400 uppercase">Qtd</label>
                <input id="swal-qtd" type="number" 
                    class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none text-center" 
                    placeholder="0" value="1">
            </div>
            <div class="flex-[2]">
                <label class="block text-[10px] text-left ml-1 font-bold text-gray-400 uppercase">Preço Unitário</label>
                <input id="swal-preco" type="number" step="0.01" 
                    class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none" 
                    placeholder="R$ 0,00" value="${ultimoPreco}">
            </div>
        </div>
    `,
      confirmButtonText: "Adicionar",
      confirmButtonColor: "#0284c7",
      focusConfirm: false,
      preConfirm: () => {
        const qtd = document.getElementById("swal-qtd").value;
        const preco = document.getElementById("swal-preco").value;

        if (!qtd || !preco) {
          Swal.showValidationMessage("Preencha os dois campos");
          return false;
        }

        return { qtd, preco };
      },
    }).then((result) => {
      if (result.isConfirmed) {
        const { qtd, preco } = result.value;
        const lista = carregarLista();
        const vUnit = parseFloat(preco);

        lista.push({
          nome,
          quantidade: parseFloat(qtd),
          valorUnitario: vUnit,
          subtotal: parseFloat(qtd) * vUnit,
          ean,
        });

        salvarHistorico(ean, vUnit);
        salvarLista(lista);
      }
    });
  } catch (error) {
    Swal.fire("Erro", "Falha na conexão com a API", "error");
  }
}

// --- INICIALIZAÇÃO ---

btnLerBarcode.addEventListener("click", iniciarScanner);
btnCancelarScan.addEventListener("click", pararScanner);
document.addEventListener("DOMContentLoaded", renderizarLista);
