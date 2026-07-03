const STORAGE_KEY = "organizador-gastos-v2";
const LEGACY_STORAGE_KEY = "organizador-gastos-v1";

const state = loadState();
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const monthFilter = document.querySelector("#monthFilter");
const dailyForm = document.querySelector("#dailyForm");
const newCardForm = document.querySelector("#newCardForm");
const cardForm = document.querySelector("#cardForm");
const cardSelect = cardForm.elements.cardId;
const dailyList = document.querySelector("#dailyList");
const cardList = document.querySelector("#cardList");
const cardPicker = document.querySelector("#cardPicker");
const selectedCardSummary = document.querySelector("#selectedCardSummary");
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
  newCardForm.addEventListener("submit", addCard);
  cardForm.addEventListener("submit", addCardPurchase);
  cardSelect.addEventListener("change", () => selectCard(cardSelect.value));
  document.querySelector("#clearDaily").addEventListener("click", clearDailyMonth);

  render();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  const emptyState = { dailyExpenses: [], cards: [], cardPurchases: [], selectedCardId: null };
  if (!raw) return emptyState;

  try {
    return migrateState(JSON.parse(raw));
  } catch {
    return emptyState;
  }
}

function migrateState(parsed) {
  const migrated = {
    dailyExpenses: parsed.dailyExpenses ?? [],
    cards: parsed.cards ?? [],
    cardPurchases: parsed.cardPurchases ?? [],
    selectedCardId: parsed.selectedCardId ?? null,
  };

  migrated.cardPurchases.forEach((purchase) => {
    if (purchase.cardId) return;

    const legacyName = purchase.cardName?.trim();
    if (!legacyName) return;

    let card = migrated.cards.find((item) => item.name.toLowerCase() === legacyName.toLowerCase());
    if (!card) {
      card = { id: crypto.randomUUID(), name: legacyName };
      migrated.cards.push(card);
    }
    purchase.cardId = card.id;
  });

  migrated.cardPurchases.forEach((purchase) => {
    delete purchase.cardName;
  });

  if (!migrated.cards.some((card) => card.id === migrated.selectedCardId)) {
    migrated.selectedCardId = migrated.cards[0]?.id ?? null;
  }

  return migrated;
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

function addCard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = new FormData(form).get("name").trim();
  if (!name) return;

  const existing = state.cards.find((card) => card.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    selectCard(existing.id);
    form.reset();
    return;
  }

  const card = { id: crypto.randomUUID(), name };
  state.cards.push(card);
  state.selectedCardId = card.id;
  form.reset();
  saveState();
  render();
}

function addCardPurchase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const cardId = data.get("cardId");
  const installments = Number(data.get("installments"));
  const paidInstallments = Math.min(Number(data.get("paidInstallments")), installments);

  if (!state.cards.some((card) => card.id === cardId)) return;

  state.cardPurchases.push({
    id: crypto.randomUUID(),
    cardId,
    purchaseDate: data.get("purchaseDate"),
    purchase: data.get("purchase").trim(),
    amount: Number(data.get("amount")),
    installments,
    paidInstallments,
    firstDueMonth: data.get("firstDueMonth"),
  });

  state.selectedCardId = cardId;
  form.elements.purchase.value = "";
  form.elements.amount.value = "";
  form.elements.installments.value = "";
  form.elements.paidInstallments.value = "0";
  saveState();
  render();
}

function selectCard(cardId) {
  if (!state.cards.some((card) => card.id === cardId)) return;
  state.selectedCardId = cardId;
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
  renderCardControls(selectedMonth);
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

function renderCardControls(selectedMonth) {
  if (!state.cards.some((card) => card.id === state.selectedCardId)) {
    state.selectedCardId = state.cards[0]?.id ?? null;
  }

  renderCardPicker(selectedMonth);
  renderCardSelect();
  renderSelectedCardSummary(selectedMonth);
  setCardFormEnabled(state.cards.length > 0);
}

function renderCardPicker(selectedMonth) {
  cardPicker.innerHTML = "";
  if (!state.cards.length) {
    appendEmpty(cardPicker);
    return;
  }

  state.cards.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-pill";
    button.classList.toggle("active", card.id === state.selectedCardId);
    button.innerHTML = `<strong>${escapeHtml(card.name)}</strong><span>${formatMoney(cardTotalForMonth(selectedMonth, card.id))} este mes</span>`;
    button.addEventListener("click", () => selectCard(card.id));
    cardPicker.append(button);
  });
}

function renderCardSelect() {
  cardSelect.innerHTML = "";

  if (!state.cards.length) {
    cardSelect.append(new Option("Agrega una tarjeta primero", ""));
    return;
  }

  state.cards.forEach((card) => {
    cardSelect.append(new Option(card.name, card.id));
  });
  cardSelect.value = state.selectedCardId;
}

function renderSelectedCardSummary(selectedMonth) {
  selectedCardSummary.innerHTML = "";
  const card = getSelectedCard();
  if (!card) return;

  const activePurchases = purchasesForCard(card.id).filter((purchase) => remainingInstallments(purchase) > 0);
  const detail = document.createElement("article");
  detail.className = "card-detail-card";
  detail.innerHTML = `
    <div class="card-detail-title">
      <strong>${escapeHtml(card.name)}</strong>
      <span class="soft-label">${activePurchases.length} compras activas</span>
    </div>
    <div class="card-metrics">
      <div class="card-metric">
        <span>A pagar este mes</span>
        <strong>${formatMoney(cardTotalForMonth(selectedMonth, card.id))}</strong>
      </div>
      <div class="card-metric">
        <span>Deuda pendiente</span>
        <strong>${formatMoney(cardPendingDebt(card.id))}</strong>
      </div>
      <div class="card-metric">
        <span>Proximo mes</span>
        <strong>${formatMoney(cardTotalForMonth(addMonths(selectedMonth, 1), card.id))}</strong>
      </div>
    </div>
  `;
  selectedCardSummary.append(detail);
}

function setCardFormEnabled(enabled) {
  cardForm.classList.toggle("disabled", !enabled);
  cardForm.querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !enabled;
  });
}

function renderCardList(selectedMonth) {
  cardList.innerHTML = "";
  const card = getSelectedCard();
  const activePurchases = card ? purchasesForCard(card.id).filter((purchase) => remainingInstallments(purchase) > 0) : [];
  document.querySelector("#cardsCount").textContent = card
    ? `${activePurchases.length} compras activas`
    : "Agrega tus tarjetas";

  if (!card) return appendEmpty(cardList);

  const duePurchases = activePurchases.filter((purchase) => installmentNumberForMonth(purchase, selectedMonth) !== null);
  if (!duePurchases.length) return appendEmpty(cardList);

  [...duePurchases]
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
    .forEach((purchase) => {
      const installment = installmentNumberForMonth(purchase, selectedMonth);
      const installmentAmount = purchase.amount / purchase.installments;

      cardList.append(
        createItem({
          title: purchase.purchase,
          meta: `${card.name} - Cuota ${installment}/${purchase.installments} - ${remainingInstallments(purchase)} pendientes`,
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

function getSelectedCard() {
  return state.cards.find((card) => card.id === state.selectedCardId) ?? null;
}

function purchasesForCard(cardId) {
  return state.cardPurchases.filter((purchase) => purchase.cardId === cardId);
}

function cardTotalForMonth(month, cardId = null) {
  return sum(
    state.cardPurchases
      .filter((purchase) => (cardId ? purchase.cardId === cardId : true))
      .filter((purchase) => installmentNumberForMonth(purchase, month) !== null)
      .map((purchase) => purchase.amount / purchase.installments),
  );
}

function cardPendingDebt(cardId) {
  return sum(
    purchasesForCard(cardId).map((purchase) => {
      return (purchase.amount / purchase.installments) * remainingInstallments(purchase);
    }),
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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}
