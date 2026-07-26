"use strict";

const STORAGE_KEY = "toolAccountingV2.records";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const currentToolId = (params.get("tool") || "").trim();
let selectedPhoto = "";

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function setMessage(id, text = "", ok = true) {
  const element = $(id);
  element.textContent = text;
  element.className = `message ${text ? (ok ? "ok" : "err") : ""}`;
}

function activeRecordFor(toolId, records = loadRecords()) {
  return [...records].reverse().find(
    (record) => record.toolId === toolId && record.status === "not_returned"
  );
}

function recordCard(record) {
  const wrapper = document.createElement("article");
  wrapper.className = "record";

  const image = record.photo
    ? `<img src="${record.photo}" alt="Фото инструмента ${escapeHtml(record.toolId)}">`
    : `<div class="photo-placeholder" aria-hidden="true">🛠</div>`;

  wrapper.innerHTML = `
    ${image}
    <div>
      <strong>${escapeHtml(record.toolId)}</strong>
      <div class="meta">
        Взял: ${escapeHtml(record.employee)}<br>
        Выдан: ${formatDate(record.issuedAt)}
        ${record.returnedAt ? `<br>Возвращён: ${formatDate(record.returnedAt)}` : ""}
      </div>
    </div>
    <span class="badge ${record.status === "not_returned" ? "out" : "in"}">
      ${record.status === "not_returned" ? "Не возвращён" : "Возвращён"}
    </span>`;

  return wrapper;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(id, records) {
  const list = $(id);
  list.replaceChildren();

  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Пусто";
    list.appendChild(empty);
    return;
  }

  records.forEach((record) => list.appendChild(recordCard(record)));
}

function renderAll() {
  const records = loadRecords();
  const active = records.filter((record) => record.status === "not_returned");

  $("activeCount").textContent = String(active.length);
  renderList("activeList", [...active].reverse());
  renderList("historyList", [...records].reverse());
  renderToolMode(records);
}

function renderToolMode(records = loadRecords()) {
  const hasTool = Boolean(currentToolId);
  $("noToolCard").hidden = hasTool;
  $("toolHeader").hidden = !hasTool;
  $("issueCard").hidden = true;
  $("returnCard").hidden = true;

  if (!hasTool) return;

  $("currentToolId").textContent = currentToolId;
  const active = activeRecordFor(currentToolId, records);

  if (active) {
    $("currentStatus").textContent = "Выдан";
    $("currentStatus").className = "status-pill out";
    $("returnCard").hidden = false;
    $("returnEmployee").textContent = active.employee;
    $("returnIssuedAt").textContent = formatDate(active.issuedAt);
    setMessage("issueMessage");
  } else {
    $("currentStatus").textContent = "Свободен";
    $("currentStatus").className = "status-pill free";
    $("issueCard").hidden = false;
    setMessage("returnMessage");
  }
}

$("photo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  selectedPhoto = "";
  $("preview").hidden = true;

  if (!file) return;
  if (file.size > 2_500_000) {
    setMessage("issueMessage", "Фото слишком большое. Выбери файл до 2,5 МБ.", false);
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedPhoto = String(reader.result || "");
    $("preview").src = selectedPhoto;
    $("preview").hidden = false;
  };
  reader.onerror = () => setMessage("issueMessage", "Не удалось прочитать фото.", false);
  reader.readAsDataURL(file);
});

$("issueBtn").addEventListener("click", () => {
  if (!currentToolId) return;

  const employee = $("employee").value.trim();
  if (!employee) {
    setMessage("issueMessage", "Укажи, кто берёт инструмент.", false);
    $("employee").focus();
    return;
  }

  const records = loadRecords();
  if (activeRecordFor(currentToolId, records)) {
    setMessage("issueMessage", "Этот инструмент уже выдан.", false);
    renderAll();
    return;
  }

  records.push({
    id: `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`,
    toolId: currentToolId,
    employee,
    photo: selectedPhoto,
    issuedAt: new Date().toISOString(),
    returnedAt: null,
    status: "not_returned"
  });

  saveRecords(records);
  $("employee").value = "";
  $("photo").value = "";
  $("preview").hidden = true;
  selectedPhoto = "";
  setMessage("issueMessage", "Инструмент выдан.", true);
  renderAll();
});

$("returnBtn").addEventListener("click", () => {
  if (!currentToolId) return;

  const records = loadRecords();
  const active = activeRecordFor(currentToolId, records);
  if (!active) {
    setMessage("returnMessage", "Активная выдача не найдена.", false);
    renderAll();
    return;
  }

  active.status = "returned";
  active.returnedAt = new Date().toISOString();
  saveRecords(records);
  setMessage("returnMessage", "Возврат записан.", true);
  renderAll();
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("Удалить всю историю выдач и возвратов на этом телефоне?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
});

$("exportBtn").addEventListener("click", () => {
  const rows = [
    ["Инструмент", "Кто взял", "Выдан", "Возвращён", "Статус"],
    ...loadRecords().map((record) => [
      record.toolId,
      record.employee,
      formatDate(record.issuedAt),
      formatDate(record.returnedAt),
      record.status === "not_returned" ? "Не возвращён" : "Возвращён"
    ])
  ];

  const csv = "\uFEFF" + rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tool-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

renderAll();
