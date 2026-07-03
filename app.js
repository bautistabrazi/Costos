const STORAGE_KEY = "organizador-gastos-v1";

const state = loadState();
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const monthFilter = document.querySelector("#monthFilter");
const dailyForm = document.querySelector("#dailyForm");
const cardForm = document.querySelector("#cardForm");
const dailyList = document.querySelector("#dailyList");
const cardList = document.querySelector("#cardList");
const projectionList = document.querySelector("#projectionList");
const emptyTemplate = document.querySelector("#emptyState");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

init();

function init() {
  const today = new Date();
  const currentMonth = toMonthValue(today);
  monthFilter.value = currentMonth;
  dailyForm.elements.date.value = toDateValue(today);
  cardForm.elements.purchaseDate.value = toDateValue(today);
  cardForm.elements.firstDueMonth.value = currentMonth;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  });

  monthFilter.addEventListener("change", render);
  dailyForm.addEventListener("submit", addDailyExpense);
  cardForm.addEventListener("submit", addCardPurchase);
  document.querySelector("#clearDaily").addEventListener("click", clearDailyMonth);

  render();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { dailyExpenses: [], cardPurchases: [] };

  try {
    const parsed = JSON.parse(raw);
    return {
      dailyExpenses: parsed.dailyExpenses ?? [],
      cardPurchases: parsed.cardPurchases ?? [],
    };
  } catch {
    return { dailyExpenses: [], cardPurchases: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setActiveTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function addDailyExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  state.dailyExpenses.push({
    id: crypto.randomUUID(),
    date: data.get("date"),
    description: data.get("description").trim(),
    category: data.get("category"),
    paymentMethod: data.get("paymentMethod"),
    amount: Number(data.get("amount")),
  });

  form.elements.description.value = "";
  form.elements.amount.value = "";
  saveState();
  render();
}

function addCardPurchase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const installments = Number(data.get("installments"));
  const paidInstallments = Math.min(Number(data.get("paidInstallments")), installments);

  state.cardPurchases.push({
    id: crypto.randomUUID(),
    cardName: data.get("cardName").trim(),
    purchaseDate: data.get("purchaseDate"),
    purchase: data.get("purchase").trim(),
    amount: Number(data.get("amount")),
    installments,
    paidInstallments,
    firstDueMonth: data.get("firstDueMonth"),
  });

  form.elements.purchase.value = "";
  form.elements.amount.value = "";
  form.elements.installments.value = "";
  form.elements.paidInstallments.value = "0";
  saveState();
  render();
}

function clearDailyMonth() {
  const selectedMonth = monthFilter.value;
  const count = state.dailyExpenses.filter((expense) => toMonthFromDate(expense.date) === selectedMonth).length;
  if (!count) return;

  const confirmed = confirm(`Se van a borrar ${count} gastos diarios de ${formatMonth(selectedMonth)}.`);
  if (!confirmed) return;

  state.dailyExpenses = state.dailyExpenses.filter((expense) => toMonthFromDate(expense.date) !== selectedMonth);
  saveState();
  render();
}

function render() {
  const selectedMonth = monthFilter.value;
  const nextMonth = addMonths(selectedMonth, 1);
  const dailyThisMonth = state.dailyExpenses.filter((expense) => toMonthFromDate(expense.date) === selectedMonth);
  const dailyTotal = sum(dailyThisMonth.map((expense) => expense.amount));
  const cardsThisMonth = cardTotalForMonth(selectedMonth);
  const nextMonthCards = cardTotalForMonth(nextMonth);

  document.querySelector("#dailyTotal").textContent = formatMoney(dailyTotal);
  document.querySelector("#cardsThisMonth").textContent = formatMoney(cardsThisMonth);
  document.querySelector("#monthTotal").textContent = formatMoney(dailyTotal + cardsThisMonth);
  document.querySelector("#nextMonthTotal").textContent = formatMoney(nextMonthCards);

  renderDailyList(dailyThisMonth);
  renderCardList(selectedMonth);
  renderProjection(selectedMonth);
}

function renderDailyList(items) {
  dailyList.innerHTML = "";
  if (!items.length) return appendEmpty(dailyList);

  [...items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((expense) => {
      dailyList.append(
        createItem({
          title: expense.description,
          meta: `${formatDate(expense.date)} - ${expense.category} - ${expense.paymentMethod}`,
          amount: expense.amount,
          onDelete: () => deleteDailyExpense(expense.id),
        }),
      );
    });
}

function renderCardList(selectedMonth) {
  cardList.innerHTML = "";
  const activePurchases = state.cardPurchases.filter((purchase) => remainingInstallments(purchase) > 0);
  document.querySelector("#cardsCount").textContent = `${activePurchases.length} compras activas`;

  const duePurchases = activePurchases.filter((purchase) => installmentNumberForMonth(purchase, selectedMonth) !== null);
  if (!duePurchases.length) return appendEmpty(cardList);

  [...duePurchases]
    .sort((a, b) => a.cardName.localeCompare(b.cardName))
    .forEach((purchase) => {
      const installment = installmentNumberForMonth(purchase, selectedMonth);
      const installmentAmount = purchase.amount / purchase.installments;

      cardList.append(
        createItem({
          title: `${purchase.cardName} - ${purchase.purchase}`,
          meta: `Cuota ${installment}/${purchase.installments} - ${remainingInstallments(purchase)} pendientes`,
          amount: installmentAmount,
          payLabel: "Pagar",
          onPay: () => markCardInstallmentPaid(purchase.id),
          onDelete: () => deleteCardPurchase(purchase.id),
        }),
      );
    });
}

function renderProjection(selectedMonth) {
  projectionList.innerHTML = "";
  const months = Array.from({ length: 12 }, (_, index) => addMonths(selectedMonth, index));
  const totals = months.map((month) => {
    const daily = sum(
      state.dailyExpenses
        .filter((expense) => toMonthFromDate(expense.date) === month)
        .map((expense) => expense.amount),
    );
    return { month, total: daily + cardTotalForMonth(month) };
  });
  const max = Math.max(...totals.map((item) => item.total), 1);

  totals.forEach((item) => {
    const row = document.createElement("div");
    row.className = "projection-row";
    row.innerHTML = `
      <strong>${formatMonthShort(item.month)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width: ${(item.total / max) * 100}%"></div></div>
      <span class="amount">${formatMoney(item.total)}</span>
    `;
    projectionList.append(row);
  });
}

function createItem({ title, meta, amount, payLabel, onPay, onDelete }) {
  const item = document.createElement("article");
  item.className = "item";

  const main = document.createElement("div");
  main.className = "item-main";

  const titleElement = document.createElement("span");
  titleElement.className = "item-title";
  titleElement.textContent = title;

  const metaElement = document.createElement("span");
  metaElement.className = "item-meta";
  metaElement.textContent = meta;

  const side = document.createElement("div");
  side.className = "item-side";

  const amountElement = document.createElement("span");
  amountElement.className = "amount";
  amountElement.textContent = formatMoney(amount);

  if (onPay) {
    const payButton = document.createElement("button");
    payButton.className = "pay-action";
    payButton.type = "button";
    payButton.textContent = payLabel;
    payButton.addEventListener("click", onPay);
    side.append(payButton);
  }

  const button = document.createElement("button");
  button.className = "icon-action";
  button.type = "button";
  button.title = "Eliminar";
  button.textContent = "x";
  button.addEventListener("click", onDelete);

  main.append(titleElement, metaElement);
  side.prepend(amountElement);
  side.append(button);
  item.append(main, side);
  return item;
}

function appendEmpty(container) {
  container.append(emptyTemplate.content.cloneNode(true));
}

function deleteDailyExpense(id) {
  state.dailyExpenses = state.dailyExpenses.filter((expense) => expense.id !== id);
  saveState();
  render();
}

function deleteCardPurchase(id) {
  state.cardPurchases = state.cardPurchases.filter((purchase) => purchase.id !== id);
  saveState();
  render();
}

function markCardInstallmentPaid(id) {
  const purchase = state.cardPurchases.find((item) => item.id === id);
  if (!purchase) return;

  purchase.paidInstallments = Math.min(purchase.paidInstallments + 1, purchase.installments);
  saveState();
  render();
}

function cardTotalForMonth(month) {
  return sum(
    state.cardPurchases
      .filter((purchase) => installmentNumberForMonth(purchase, month) !== null)
      .map((purchase) => purchase.amount / purchase.installments),
  );
}

function installmentNumberForMonth(purchase, month) {
  const monthIndex = monthsBetween(purchase.firstDueMonth, month);
  if (monthIndex < 0 || monthIndex >= purchase.installments) return null;

  const installmentNumber = monthIndex + 1;
  if (installmentNumber <= purchase.paidInstallments) return null;
  return installmentNumber;
}

function remainingInstallments(purchase) {
  return Math.max(purchase.installments - purchase.paidInstallments, 0);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function formatMoney(value) {
  return money.format(value);
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonth(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function formatMonthShort(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });
}

function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthFromDate(dateValue) {
  return dateValue.slice(0, 7);
}

function addMonths(month, amount) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + amount, 1);
  return toMonthValue(date);
}

function monthsBetween(startMonth, endMonth) {
  const [startYear, start] = startMonth.split("-").map(Number);
  const [endYear, end] = endMonth.split("-").map(Number);
  return (endYear - startYear) * 12 + (end - start);
}
