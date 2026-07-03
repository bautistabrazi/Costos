import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_CONFIG } from "./config.js";

const state = { dailyExpenses: [], cards: [], cardPurchases: [], selectedCardId: null };
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

let supabaseClient = null;
let currentUser = null;
let authMode = "login";
let authBusy = false;

const monthFilter = document.querySelector("#monthFilter");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const ownerName = document.querySelector("#ownerName");
const authPanel = document.querySelector("#authPanel");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authMessage = document.querySelector("#authMessage");
const authSwitch = document.querySelector("#authSwitch");
const authNameFields = document.querySelector("#authNameFields");
const authEmailLabel = document.querySelector("#authEmailLabel");
const authPasswordLabel = document.querySelector("#authPasswordLabel");
const loginModeButton = document.querySelector("#loginModeButton");
const signupModeButton = document.querySelector("#signupModeButton");
const authSubmitButton = document.querySelector("#authSubmitButton");
const recoverModeButton = document.querySelector("#recoverModeButton");
const sessionPanel = document.querySelector("#sessionPanel");
const signOutButton = document.querySelector("#signOutButton");
const appContent = document.querySelector("#appContent");
const dailyForm = document.querySelector("#dailyForm");
const newCardForm = document.querySelector("#newCardForm");
const cardForm = document.querySelector("#cardForm");
const cardSelect = cardForm.elements.cardId;
const fixedExpenseSelect = document.querySelector("#fixedExpenseSelect");
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

async function init() {
  const today = new Date();
  const currentMonth = toMonthValue(today);
  applyTheme(localStorage.getItem("organizador-theme") ?? "light");
  monthFilter.value = currentMonth;
  dailyForm.elements.date.value = toDateValue(today);
  cardForm.elements.purchaseDate.value = toDateValue(today);
  cardForm.elements.firstDueMonth.value = currentMonth;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  });

  themeToggle.addEventListener("click", toggleTheme);
  loginModeButton.addEventListener("click", () => setAuthMode("login"));
  signupModeButton.addEventListener("click", () => setAuthMode("signup"));
  recoverModeButton.addEventListener("click", () => setAuthMode("recover"));
  authForm.addEventListener("submit", submitAuthForm);
  signOutButton.addEventListener("click", signOut);
  monthFilter.addEventListener("change", render);
  dailyForm.addEventListener("submit", addDailyExpense);
  newCardForm.addEventListener("submit", addCard);
  cardForm.addEventListener("submit", addCardPurchase);
  cardSelect.addEventListener("change", () => selectCard(cardSelect.value));
  fixedExpenseSelect.addEventListener("change", syncFixedExpenseFields);
  document.querySelector("#clearDaily").addEventListener("click", clearDailyMonth);
  document.querySelectorAll("[data-money]").forEach((input) => {
    input.addEventListener("input", () => formatMoneyInput(input));
  });

  setupSupabase();
  syncFixedExpenseFields();
  render();
}

function setupSupabase() {
  if (!isSupabaseConfigured()) {
    setSignedOutUi("Falta configurar Supabase. Completa config.js con la URL y anon key del proyecto.");
    setAppEnabled(false);
    return;
  }

  supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user ?? null;
    if (event === "PASSWORD_RECOVERY") {
      setPasswordUpdateUi();
      setAppEnabled(false);
      render();
      return;
    }

    if (currentUser) {
      loadRemoteState();
    } else {
      resetState();
      setSignedOutUi("Ingresa con tu correo y contrasena para sincronizar tus gastos.");
      setAppEnabled(false);
      render();
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    currentUser = data.session?.user ?? null;
    if (currentUser) {
      loadRemoteState();
    } else {
      setSignedOutUi("Ingresa con tu correo y contrasena para sincronizar tus gastos.");
      setAppEnabled(false);
    }
  });
}

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG.url &&
      SUPABASE_CONFIG.anonKey &&
      !SUPABASE_CONFIG.url.includes("TU-PROYECTO") &&
      !SUPABASE_CONFIG.anonKey.includes("TU_SUPABASE"),
  );
}

async function submitAuthForm(event) {
  event.preventDefault();
  if (authBusy) return;
  if (!supabaseClient) {
    authMessage.textContent = "Supabase todavia no esta conectado. Revisa la configuracion del proyecto.";
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = formData.get("email").trim();
  const password = formData.get("password");
  const firstName = normalizeName(formData.get("firstName"));
  const lastName = normalizeName(formData.get("lastName"));
  if (authMode !== "update" && !isValidEmail(email)) {
    authMessage.textContent = "Ingresa un correo electronico valido.";
    return;
  }

  if (authMode === "signup" && (!firstName || !lastName)) {
    authMessage.textContent = "Ingresa tu nombre y apellido para crear la cuenta.";
    return;
  }

  if (authMode !== "recover" && !password) {
    authMessage.textContent = "Ingresa una contrasena para continuar.";
    return;
  }

  setAuthBusy(true);
  authMessage.textContent = getAuthBusyMessage();

  try {
    if (authMode === "recover") {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split("#")[0],
      });
      authMessage.textContent = error
        ? getAuthErrorMessage(error)
        : "Te enviamos un enlace para recuperar tu contrasena. Revisa tu correo.";
      return;
    }

    if (authMode === "update") {
      const { data, error } = await supabaseClient.auth.updateUser({ password });
      if (error) {
        authMessage.textContent = getAuthErrorMessage(error);
        return;
      }

      currentUser = data.user;
      authMessage.textContent = "Contrasena actualizada. Cargando tus datos...";
      await loadRemoteState();
      return;
    }

    if (authMode === "signup") {
      const signupResult = await createAccount({ email, password, firstName, lastName });
      if (signupResult.error) {
        authMessage.textContent = signupResult.error;
        return;
      }
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      authMessage.textContent = getAuthErrorMessage(error);
      return;
    }

    authMessage.textContent = "Ingreso correcto. Cargando tus datos...";
  } catch (error) {
    authMessage.textContent = `No se pudo conectar con Supabase: ${error.message}`;
  } finally {
    setAuthBusy(false);
  }
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

async function loadRemoteState() {
  if (!currentUser) return;

  setSignedInUi();
  setAppEnabled(false);

  const [cardsResult, dailyResult, purchasesResult] = await Promise.all([
    supabaseClient.from("cards").select("*").order("created_at", { ascending: true }),
    supabaseClient.from("daily_expenses").select("*").order("date", { ascending: false }),
    supabaseClient.from("card_purchases").select("*").order("purchase_date", { ascending: false }),
  ]);

  const error = cardsResult.error ?? dailyResult.error ?? purchasesResult.error;
  if (error) {
    authMessage.textContent = `No se pudieron cargar los datos: ${error.message}`;
    setAppEnabled(false);
    return;
  }

  state.cards = cardsResult.data.map(mapCardFromDb);
  state.dailyExpenses = dailyResult.data.map(mapDailyFromDb);
  state.cardPurchases = purchasesResult.data.map(mapPurchaseFromDb);
  if (!state.cards.some((card) => card.id === state.selectedCardId)) {
    state.selectedCardId = state.cards[0]?.id ?? null;
  }

  authPanel.hidden = true;
  setAppEnabled(true);
  render();
}

function setSignedInUi() {
  authPanel.hidden = false;
  authPanel.classList.add("signed-in");
  authTitle.textContent = "Cuenta sincronizada";
  authMessage.textContent = "";
  authForm.hidden = true;
  authSwitch.hidden = true;
  sessionPanel.hidden = false;
  ownerName.textContent = getUserDisplayName(currentUser);
  appContent.hidden = false;
  monthFilter.closest(".month-picker").hidden = false;
}

function setSignedOutUi(message) {
  authPanel.hidden = false;
  authPanel.classList.remove("signed-in");
  if (supabaseClient) {
    setAuthMode(authMode === "update" ? "login" : authMode);
  } else {
    authTitle.textContent = "Conecta Supabase";
  }
  authMessage.textContent = message;
  authForm.hidden = !supabaseClient;
  authSwitch.hidden = !supabaseClient;
  sessionPanel.hidden = true;
  ownerName.textContent = "Gastos";
  appContent.hidden = true;
  monthFilter.closest(".month-picker").hidden = true;
}

function setAuthMode(mode) {
  if (authBusy) return;
  authMode = mode;
  const isSignup = authMode === "signup";
  const isRecover = authMode === "recover";
  const isUpdate = authMode === "update";
  authTitle.textContent = getAuthTitle();
  updateAuthButtonText();
  loginModeButton.classList.toggle("active", authMode === "login");
  signupModeButton.classList.toggle("active", isSignup);
  loginModeButton.setAttribute("aria-selected", String(authMode === "login"));
  signupModeButton.setAttribute("aria-selected", String(isSignup));
  authSwitch.hidden = isUpdate;
  authNameFields.hidden = !isSignup;
  authEmailLabel.hidden = isUpdate;
  authPasswordLabel.hidden = isRecover;
  recoverModeButton.hidden = isUpdate;
  authForm.elements.password.autocomplete = isSignup || isUpdate ? "new-password" : "current-password";
  authMessage.textContent = getAuthModeMessage();
}

function setAuthBusy(isBusy) {
  authBusy = isBusy;
  authSubmitButton.disabled = isBusy;
  loginModeButton.disabled = isBusy;
  signupModeButton.disabled = isBusy;
  recoverModeButton.disabled = isBusy;
  updateAuthButtonText();
}

function updateAuthButtonText() {
  if (authBusy) {
    authSubmitButton.textContent = getAuthBusyButtonText();
    return;
  }

  authSubmitButton.textContent = getAuthSubmitText();
}

function setPasswordUpdateUi() {
  authPanel.hidden = false;
  authPanel.classList.remove("signed-in");
  authMode = "update";
  authTitle.textContent = "Nueva contrasena";
  authMessage.textContent = "Escribi una nueva contrasena para volver a entrar a tu cuenta.";
  authForm.hidden = false;
  authSwitch.hidden = true;
  authNameFields.hidden = true;
  authEmailLabel.hidden = true;
  authPasswordLabel.hidden = false;
  recoverModeButton.hidden = true;
  sessionPanel.hidden = true;
  appContent.hidden = true;
  monthFilter.closest(".month-picker").hidden = true;
  updateAuthButtonText();
}

function getAuthTitle() {
  if (authMode === "signup") return "Crear cuenta";
  if (authMode === "recover") return "Recuperar contrasena";
  if (authMode === "update") return "Nueva contrasena";
  return "Iniciar sesion";
}

function getAuthModeMessage() {
  if (authMode === "signup") return "Crea tu cuenta y entra automaticamente con ese mismo correo y contrasena.";
  if (authMode === "recover") return "Ingresa tu correo y te enviamos un enlace seguro para cambiar la contrasena.";
  if (authMode === "update") return "Escribi una nueva contrasena para volver a entrar a tu cuenta.";
  return "Ingresa con tu correo y contrasena para acceder a tus gastos.";
}

function getAuthSubmitText() {
  if (authMode === "signup") return "Crear cuenta";
  if (authMode === "recover") return "Enviar recuperacion";
  if (authMode === "update") return "Guardar contrasena";
  return "Ingresar";
}

function getAuthBusyMessage() {
  if (authMode === "signup") return "Creando tu cuenta...";
  if (authMode === "recover") return "Enviando correo de recuperacion...";
  if (authMode === "update") return "Guardando tu nueva contrasena...";
  return "Ingresando a tu cuenta...";
}

function getAuthBusyButtonText() {
  if (authMode === "signup") return "Creando cuenta...";
  if (authMode === "recover") return "Enviando...";
  if (authMode === "update") return "Guardando...";
  return "Ingresando...";
}

async function createAccount(payload) {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { error: result.error || "No se pudo crear la cuenta." };
  }

  return { error: null };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getUserDisplayName(user) {
  const metadata = user?.user_metadata ?? {};
  const fullName = normalizeName(metadata.full_name);
  const firstName = normalizeName(metadata.first_name);
  return firstName || fullName.split(" ")[0] || user?.email?.split("@")[0] || "Gastos";
}

function setAppEnabled(enabled) {
  [dailyForm, newCardForm].forEach((form) => {
    form.classList.toggle("disabled", !enabled);
    form.querySelectorAll("input, select, button").forEach((field) => {
      field.disabled = !enabled;
    });
  });
  document.querySelector("#clearDaily").disabled = !enabled;
  setCardFormEnabled(enabled && state.cards.length > 0);
}

function resetState() {
  state.dailyExpenses = [];
  state.cards = [];
  state.cardPurchases = [];
  state.selectedCardId = null;
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("organizador-theme", theme);

  const isDark = theme === "dark";
  themeIcon.textContent = isDark ? "💡" : "🌙";
  themeToggle.setAttribute("aria-label", isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  document.querySelector("meta[name='theme-color']").setAttribute("content", isDark ? "#111816" : "#315f72");
}

function formatMoneyInput(input) {
  const digits = input.value.replace(/\D/g, "");
  input.value = digits ? formatThousands(Number(digits)) : "";
}

function parseMoneyInput(value) {
  return Number(String(value).replace(/\D/g, "")) || 0;
}

function formatThousands(value) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}

function setActiveTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

async function addDailyExpense(event) {
  event.preventDefault();
  if (!currentUser) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    user_id: currentUser.id,
    date: data.get("date"),
    description: data.get("description").trim(),
    category: data.get("category"),
    payment_method: data.get("paymentMethod"),
    amount: parseMoneyInput(data.get("amount")),
  };
  const { data: inserted, error } = await supabaseClient.from("daily_expenses").insert(payload).select().single();
  if (error) return showError(error);

  state.dailyExpenses.push(mapDailyFromDb(inserted));
  form.elements.description.value = "";
  form.elements.amount.value = "";
  render();
}

async function addCard(event) {
  event.preventDefault();
  if (!currentUser) return;

  const form = event.currentTarget;
  const name = new FormData(form).get("name").trim();
  if (!name) return;

  const existing = state.cards.find((card) => card.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    selectCard(existing.id);
    form.reset();
    return;
  }

  const { data: inserted, error } = await supabaseClient
    .from("cards")
    .insert({ user_id: currentUser.id, name })
    .select()
    .single();
  if (error) return showError(error);

  const card = mapCardFromDb(inserted);
  state.cards.push(card);
  state.selectedCardId = card.id;
  form.reset();
  render();
}

async function addCardPurchase(event) {
  event.preventDefault();
  if (!currentUser) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const cardId = data.get("cardId");
  const isFixedExpense = data.get("isFixedExpense") === "yes";
  const installments = isFixedExpense ? 1 : Number(data.get("installments"));
  const paidInstallments = isFixedExpense ? 0 : Math.min(Number(data.get("paidInstallments")), installments);

  if (!state.cards.some((card) => card.id === cardId)) return;

  const payload = {
    user_id: currentUser.id,
    card_id: cardId,
    purchase_date: data.get("purchaseDate"),
    purchase: data.get("purchase").trim(),
    amount: parseMoneyInput(data.get("amount")),
    installments,
    paid_installments: paidInstallments,
    first_due_month: data.get("firstDueMonth"),
    is_fixed_expense: isFixedExpense,
    fixed_expense_active: true,
  };

  const { data: inserted, error } = await supabaseClient.from("card_purchases").insert(payload).select().single();
  if (error) return showError(error);

  state.cardPurchases.push(mapPurchaseFromDb(inserted));
  state.selectedCardId = cardId;
  form.elements.purchase.value = "";
  form.elements.amount.value = "";
  form.elements.isFixedExpense.value = "no";
  form.elements.installments.value = "";
  form.elements.paidInstallments.value = "0";
  syncFixedExpenseFields();
  render();
}

function selectCard(cardId) {
  if (!state.cards.some((card) => card.id === cardId)) return;
  state.selectedCardId = cardId;
  render();
}

async function clearDailyMonth() {
  if (!currentUser) return;

  const selectedMonth = monthFilter.value;
  const monthItems = state.dailyExpenses.filter((expense) => toMonthFromDate(expense.date) === selectedMonth);
  if (!monthItems.length) return;

  const confirmed = confirm(`Se van a borrar ${monthItems.length} gastos diarios de ${formatMonth(selectedMonth)}.`);
  if (!confirmed) return;

  const ids = monthItems.map((expense) => expense.id);
  const { error } = await supabaseClient.from("daily_expenses").delete().in("id", ids);
  if (error) return showError(error);

  state.dailyExpenses = state.dailyExpenses.filter((expense) => !ids.includes(expense.id));
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
  setCardFormEnabled(Boolean(currentUser) && state.cards.length > 0);
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

  const activePurchases = purchasesForCard(card.id).filter(isActiveCardPurchase);
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
  syncFixedExpenseFields();
}

function renderCardList(selectedMonth) {
  cardList.innerHTML = "";
  const card = getSelectedCard();
  const activePurchases = card ? purchasesForCard(card.id).filter(isActiveCardPurchase) : [];
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
      const amount = cardPurchaseAmountForMonth(purchase);
      const meta = purchase.isFixedExpense
        ? `${card.name} - Gasto fijo mensual`
        : `${card.name} - Cuota ${installment}/${purchase.installments} - ${remainingInstallments(purchase)} pendientes`;

      cardList.append(
        createItem({
          title: purchase.purchase,
          meta,
          amount,
          payLabel: purchase.isFixedExpense ? null : "Pagar",
          onPay: purchase.isFixedExpense ? null : () => markCardInstallmentPaid(purchase.id),
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

async function deleteDailyExpense(id) {
  const { error } = await supabaseClient.from("daily_expenses").delete().eq("id", id);
  if (error) return showError(error);

  state.dailyExpenses = state.dailyExpenses.filter((expense) => expense.id !== id);
  render();
}

async function deleteCardPurchase(id) {
  const { error } = await supabaseClient.from("card_purchases").delete().eq("id", id);
  if (error) return showError(error);

  state.cardPurchases = state.cardPurchases.filter((purchase) => purchase.id !== id);
  render();
}

async function markCardInstallmentPaid(id) {
  const purchase = state.cardPurchases.find((item) => item.id === id);
  if (!purchase) return;

  const paidInstallments = Math.min(purchase.paidInstallments + 1, purchase.installments);
  const { data: updated, error } = await supabaseClient
    .from("card_purchases")
    .update({ paid_installments: paidInstallments })
    .eq("id", id)
    .select()
    .single();
  if (error) return showError(error);

  Object.assign(purchase, mapPurchaseFromDb(updated));
  render();
}

function showError(error) {
  authMessage.textContent = `Error: ${error.message}`;
}

function getAuthErrorMessage(error) {
  const message = error.message ?? "";
  const normalized = message.toLowerCase();
  if (message.includes("only request this after")) {
    const seconds = message.match(/\d+/)?.[0] ?? "unos";
    return `Por seguridad, espera ${seconds} segundos antes de solicitar otro enlace de acceso.`;
  }

  if (normalized.includes("invalid login credentials")) {
    return "El correo o la contrasena no son correctos.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Ya existe una cuenta con ese correo. Usa Iniciar sesion.";
  }

  if (normalized.includes("password")) {
    return "La contrasena no coincide con la cuenta o Supabase no la acepto.";
  }

  if (normalized.includes("email")) {
    return "Revisa que el correo electronico este escrito correctamente.";
  }

  return `No se pudo completar la operacion: ${message}`;
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
      .map(cardPurchaseAmountForMonth),
  );
}

function cardPendingDebt(cardId) {
  return sum(
    purchasesForCard(cardId).filter((purchase) => !purchase.isFixedExpense).map((purchase) => {
      return (purchase.amount / purchase.installments) * remainingInstallments(purchase);
    }),
  );
}

function installmentNumberForMonth(purchase, month) {
  if (purchase.isFixedExpense) {
    return purchase.fixedExpenseActive && monthsBetween(purchase.firstDueMonth, month) >= 0 ? 1 : null;
  }

  const monthIndex = monthsBetween(purchase.firstDueMonth, month);
  if (monthIndex < 0 || monthIndex >= purchase.installments) return null;

  const installmentNumber = monthIndex + 1;
  if (installmentNumber <= purchase.paidInstallments) return null;
  return installmentNumber;
}

function remainingInstallments(purchase) {
  if (purchase.isFixedExpense) return purchase.fixedExpenseActive ? 1 : 0;
  return Math.max(purchase.installments - purchase.paidInstallments, 0);
}

function isActiveCardPurchase(purchase) {
  return purchase.isFixedExpense ? purchase.fixedExpenseActive : remainingInstallments(purchase) > 0;
}

function cardPurchaseAmountForMonth(purchase) {
  return purchase.isFixedExpense ? purchase.amount : purchase.amount / purchase.installments;
}

function mapCardFromDb(row) {
  return { id: row.id, name: row.name };
}

function mapDailyFromDb(row) {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category,
    paymentMethod: row.payment_method,
    amount: Number(row.amount),
  };
}

function mapPurchaseFromDb(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    purchaseDate: row.purchase_date,
    purchase: row.purchase,
    amount: Number(row.amount),
    installments: Number(row.installments),
    paidInstallments: Number(row.paid_installments),
    firstDueMonth: row.first_due_month,
    isFixedExpense: Boolean(row.is_fixed_expense),
    fixedExpenseActive: row.fixed_expense_active !== false,
  };
}

function syncFixedExpenseFields() {
  const isFixedExpense = fixedExpenseSelect.value === "yes";
  const formEnabled = !cardForm.classList.contains("disabled");
  cardForm.querySelectorAll("[data-installment-field]").forEach((field) => {
    field.hidden = isFixedExpense;
    field.querySelectorAll("input").forEach((input) => {
      input.disabled = !formEnabled || isFixedExpense;
      input.required = !isFixedExpense;
    });
  });
  if (isFixedExpense) {
    cardForm.elements.installments.value = "1";
    cardForm.elements.paidInstallments.value = "0";
  }
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
