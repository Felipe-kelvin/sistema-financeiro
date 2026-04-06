import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.body.style.display = "none";

const totalEntradasEl = document.getElementById("total-entradas");
const totalSaidasEl = document.getElementById("total-saidas");
const totalSaldoEl = document.getElementById("total-saldo");
const ctxEntradasSaidas = document.getElementById("chart-entradas-saidas");
const ctxSaldoMensal = document.getElementById("chart-saldo-mensal");
const errorMessageEl = document.getElementById("graficos-error");
const logoutBtn = document.getElementById("logout-btn");

let userUID = null;
let chartEntradasSaidas = null;
let chartSaldoMensal = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  userUID = user.uid;
  document.body.style.display = "flex";

  if (typeof Chart === "undefined") {
    mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
    return;
  }

  escutarTransacoes();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../index.html";
  } catch (erro) {
    alert("Erro ao sair: " + erro.message);
  }
});

function escutarTransacoes() {
  onSnapshot(collection(db, "transacoes", userUID, "lista"), (snapshot) => {
    if (typeof Chart === "undefined") {
      mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
      return;
    }

    const dadosPorMes = {};
    let totalEntradas = 0;
    let totalSaidas = 0;

    snapshot.forEach((docSnap) => {
      const t = docSnap.data();
      const mes = t.mes || formatarMesData(t.criadoEm);
      const valor = Number(t.valor) || 0;

      if (!dadosPorMes[mes]) {
        dadosPorMes[mes] = {
          entradas: 0,
          saidas: 0,
          saldo: 0
        };
      }

      if (t.tipo === "entrada") {
        dadosPorMes[mes].entradas += valor;
        totalEntradas += valor;
      } else {
        dadosPorMes[mes].saidas += valor;
        totalSaidas += valor;
      }

      dadosPorMes[mes].saldo = dadosPorMes[mes].entradas - dadosPorMes[mes].saidas;
    });

    atualizarResumo(totalEntradas, totalSaidas);
    atualizarGraficos(dadosPorMes);
  });
}

function atualizarResumo(entradas, saidas) {
  const saldo = entradas - saidas;

  totalEntradasEl.textContent = formatarMoeda(entradas);
  totalSaidasEl.textContent = formatarMoeda(saidas);
  totalSaldoEl.textContent = formatarMoeda(saldo);
}

function atualizarGraficos(dadosPorMes) {
  if (typeof Chart === "undefined") {
    mostrarErroChart("O Chart.js não foi carregado. Verifique sua conexão ou tente recarregar a página.");
    return;
  }
  const mesesOrdenados = Object.keys(dadosPorMes).sort();

  const labels = mesesOrdenados.map(formatarMesLabel);
  const valoresEntradas = mesesOrdenados.map((mes) => dadosPorMes[mes].entradas);
  const valoresSaidas = mesesOrdenados.map((mes) => dadosPorMes[mes].saidas);
  const valoresSaldo = mesesOrdenados.map((mes) => dadosPorMes[mes].saldo);

  if (chartEntradasSaidas) {
    chartEntradasSaidas.destroy();
  }

  if (chartSaldoMensal) {
    chartSaldoMensal.destroy();
  }

  try {
    chartEntradasSaidas = new Chart(ctxEntradasSaidas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Entradas",
            data: valoresEntradas,
            backgroundColor: "#10b981",
            borderRadius: 6,
          },
          {
            label: "Saídas",
            data: valoresSaidas,
            backgroundColor: "#ef4444",
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            stacked: false,
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatarMoeda(value)
            }
          }
        },
        plugins: {
          legend: {
            position: "top"
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatarMoeda(context.parsed.y)}`
            }
          }
        }
      }
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de entradas e saídas. " + erro.message);
    return;
  }

  try {
    chartSaldoMensal = new Chart(ctxSaldoMensal, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Saldo",
            data: valoresSaldo,
            backgroundColor: valoresSaldo.map((saldo) => saldo >= 0 ? "#2563eb" : "#d97706"),
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => formatarMoeda(value)
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `Saldo: ${formatarMoeda(context.parsed.y)}`
            }
          }
        }
      }
    });
  } catch (erro) {
    mostrarErroChart("Não foi possível inicializar o gráfico de saldo. " + erro.message);
    return;
  }
}

function mostrarErroChart(mensagem) {
  if (errorMessageEl) {
    errorMessageEl.style.display = "block";
    errorMessageEl.innerHTML = `<strong>Erro ao carregar os gráficos.</strong><p>${mensagem}</p>`;
  }

  if (ctxEntradasSaidas) {
    ctxEntradasSaidas.style.display = "none";
  }

  if (ctxSaldoMensal) {
    ctxSaldoMensal.style.display = "none";
  }
}

function formatarMesLabel(mes) {
  const [ano, mesNumero] = mes.split("-");
  const nomesMeses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const mesIndex = Number(mesNumero) - 1;
  return `${nomesMeses[mesIndex]}/${ano}`;
}

function formatarMesData(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return "0000-00";
  }

  const data = timestamp.toDate();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}
