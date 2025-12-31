// --- CONFIGURAÇÕES E CHAVES ---
const API_KEY = "P7uKcTcma8P8GLzyw0ICeA";
const COSMOS_URL = "https://api.cosmos.bluesoft.com.br/gtins/";
const STORAGE_KEY = "listaDeProdutos";
const STORAGE_HISTORY_KEY = "historicoPrecos";

let scannerAtivo = false;

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
  console.log("iniciado");
  if (scannerAtivo) return;

  // Garante que o container esteja visível antes de iniciar
  const container = document.getElementById("scanner-container");
  container.classList.remove("hidden");

  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector("#interactive"), // Onde a câmera aparece
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          facingMode: "environment", // Força a câmera traseira no celular
        },
      },
      decoder: {
        readers: ["ean_reader", "ean_8_reader"],
      },
      locate: true,
    },
    function (err) {
      if (err) {
        console.error("Erro ao iniciar Quagga:", err);
        Swal.fire({
          icon: "error",
          title: "Erro na Câmera",
          text: "Não foi possível acessar a câmera. Verifique as permissões ou se está usando HTTPS.",
        });
        container.classList.add("hidden");
        return;
      }
      console.log("Scanner iniciado com sucesso");
      Quagga.start();
      scannerAtivo = true;
    }
  );
}

function pararScanner() {
  Quagga.stop();
  scannerContainer.classList.add("hidden");
  scannerAtivo = false;
}

Quagga.onDetected(async (data) => {
  const code = data.codeResult.code;
  if (code) {
    pararScanner();
    buscarEAdicionar(code);
  }
});

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
