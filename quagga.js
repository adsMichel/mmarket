// Configuração do QuaggaJS
const config = {
  inputStream: {
    name: "Live",
    type: "LiveStream",
    target: document.querySelector("#interactive"),
    constraints: {
      facingMode: "environment",
      aspectRatio: { min: 1, max: 2 },
    },
  },
  decoder: {
    readers: [
      "ean_reader",
      "ean_8_reader",
      "code_128_reader",
      "code_39_reader",
    ],
    multiple: false,
  },
  locate: true,
  locator: {
    patchSize: "medium",
    halfSample: true,
  },
  frequency: 10,
};

// Elementos de navegação e telas
const homeScreen = document.getElementById("home-screen");
const scannerArea = document.getElementById("scanner-area");
const nomeProdutoEl = document.getElementById("nome-produto");
const btnLer = document.getElementById("btn-ler");
const btnHome = document.getElementById("btn-home");

let scannerEmFuncionamento = false;
let codigoEncontrado = null;

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

// --- FUNÇÕES DO SCANNER ---

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

    btnLer.querySelector("span").textContent = "Ler";

    if (!codigoDetectado) {
      abrirModalManual();
    }

    if (callback) callback();
  });

  scannerEmFuncionamento = false;
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
    console.log("Scanner QuaggaJS iniciado.");
  });
}

// Quando um código é detectado
Quagga.onDetected(function (data) {
  const codigo = data.codeResult.code;

  if (codigo && codigo.length === 13 && codigo !== codigoEncontrado) {
    codigoEncontrado = codigo;
    pararScanner();
    mostrarTela("home");
    buscarProduto(codigo);
  }
});

// --- EVENT LISTENERS ---

document.addEventListener("DOMContentLoaded", () => {
  btnLer.addEventListener("click", () => {
    if (scannerEmFuncionamento) {
      pararScanner();
    } else {
      iniciarScanner();
    }
  });

  btnHome.addEventListener("click", () => {
    mostrarTela("home");
  });

  closeModalBtn.addEventListener("click", fecharModal);

  window.addEventListener("click", (event) => {
    if (event.target == modal) {
      fecharModal();
    }
  });

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
  });
});
