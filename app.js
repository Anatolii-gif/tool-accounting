"use strict";

const RECORDS_KEY = "toolAccountingV2.records";
const TOOLS_KEY = "toolAccountingV2.tools";
const MAX_PHOTO_BYTES = 2_500_000;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const currentToolId = (params.get("tool") || "").trim();
let selectedIssuePhoto = "";
let selectedAdminPhoto = "";
let selectedQuickPhoto = "";

function loadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const loadRecords = () => loadArray(RECORDS_KEY);
const loadTools = () => loadArray(TOOLS_KEY);
const saveRecords = (records) => localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
const saveTools = (tools) => localStorage.setItem(TOOLS_KEY, JSON.stringify(tools));

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function setMessage(id, text = "", ok = true) {
  const element = $(id);
  element.textContent = text;
  element.className = `message ${text ? (ok ? "ok" : "err") : ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toolFor(id, tools = loadTools()) {
  return tools.find((tool) => tool.id === id) || null;
}

function toolLabel(id, tools = loadTools()) {
  return toolFor(id, tools)?.name || id;
}

function activeRecordFor(toolId, records = loadRecords()) {
  return [...records].reverse().find(
    (record) => record.toolId === toolId && record.status === "not_returned"
  );
}

function readPhoto(file, onSuccess, messageId) {
  if (!file) return;
  if (file.size > MAX_PHOTO_BYTES) {
    setMessage(messageId, "Фото слишком большое. Выбери файл до 2,5 МБ.", false);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onSuccess(String(reader.result || ""));
  reader.onerror = () => setMessage(messageId, "Не удалось прочитать фото.", false);
  reader.readAsDataURL(file);
}

function recordCard(record, tools) {
  const wrapper = document.createElement("article");
  wrapper.className = "record";
  const registryTool = toolFor(record.toolId, tools);
  const imageSource = record.photo || registryTool?.photo || "";
  const image = imageSource
    ? `<img src="${imageSource}" alt="Фото ${escapeHtml(toolLabel(record.toolId, tools))}">`
    : `<div class="photo-placeholder" aria-hidden="true">🛠</div>`;

  wrapper.innerHTML = `
    ${image}
    <div>
      <strong>${escapeHtml(toolLabel(record.toolId, tools))}</strong>
      <small class="tool-number">${escapeHtml(record.toolId)}</small>
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

function renderList(id, records, tools) {
  const list = $(id);
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Пусто";
    list.appendChild(empty);
    return;
  }
  records.forEach((record) => list.appendChild(recordCard(record, tools)));
}

function renderToolsList(tools = loadTools()) {
  const list = $("toolsList");
  list.replaceChildren();
  if (!tools.length) {
    list.innerHTML = '<div class="empty">Инструменты ещё не добавлены</div>';
    return;
  }

  [...tools].sort((a, b) => a.id.localeCompare(b.id)).forEach((tool) => {
    const row = document.createElement("article");
    row.className = "tool-admin-row";
    row.innerHTML = `
      ${tool.photo ? `<img src="${tool.photo}" alt="">` : '<div class="photo-placeholder">🛠</div>'}
      <div><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.id)}</small></div>
      <div class="row-actions">
        <button class="mini edit-tool" type="button" data-id="${escapeHtml(tool.id)}">Изменить</button>
        <button class="mini danger delete-tool" type="button" data-id="${escapeHtml(tool.id)}">Удалить</button>
      </div>`;
    list.appendChild(row);
  });
}

function renderToolMode(records = loadRecords(), tools = loadTools()) {
  const hasToolId = Boolean(currentToolId);
  const registeredTool = hasToolId ? toolFor(currentToolId, tools) : null;

  $("noToolCard").hidden = hasToolId;
  $("unknownToolCard").hidden = !hasToolId || Boolean(registeredTool);
  $("toolHeader").hidden = !registeredTool;
  $("issueCard").hidden = true;
  $("returnCard").hidden = true;

  if (!hasToolId) return;
  if (!registeredTool) {
    $("unknownToolId").textContent = currentToolId;
    return;
  }

  $("currentToolName").textContent = registeredTool.name;
  $("currentToolId").textContent = `Метка ${currentToolId}`;
  if (registeredTool.photo) {
    $("currentToolPhoto").src = registeredTool.photo;
    $("currentToolPhoto").hidden = false;
  } else {
    $("currentToolPhoto").hidden = true;
  }

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

function renderAll() {
  const records = loadRecords();
  const tools = loadTools();
  const active = records.filter((record) => record.status === "not_returned");
  $("activeCount").textContent = String(active.length);
  renderList("activeList", [...active].reverse(), tools);
  renderList("historyList", [...records].reverse(), tools);
  renderToolsList(tools);
  renderToolMode(records, tools);
}

function resetToolForm() {
  $("toolForm").reset();
  $("editingOriginalId").value = "";
  $("adminPhotoPreview").hidden = true;
  selectedAdminPhoto = "";
  $("cancelToolEditBtn").hidden = true;
  $("saveToolBtn").textContent = "Сохранить инструмент";
  setMessage("adminMessage");
}

$("adminToggleBtn").addEventListener("click", () => {
  $("adminCard").hidden = false;
  $("adminCard").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("adminCloseBtn").addEventListener("click", () => { $("adminCard").hidden = true; });
$("cancelToolEditBtn").addEventListener("click", resetToolForm);

$("adminToolPhoto").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  readPhoto(file, (data) => {
    selectedAdminPhoto = data;
    $("adminPhotoPreview").src = data;
    $("adminPhotoPreview").hidden = false;
  }, "adminMessage");
});

$("quickToolPhoto").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  readPhoto(file, (data) => {
    selectedQuickPhoto = data;
    $("quickPhotoPreview").src = data;
    $("quickPhotoPreview").hidden = false;
  }, "quickToolMessage");
});

$("photo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  selectedIssuePhoto = "";
  $("preview").hidden = true;
  if (!file) return;
  readPhoto(file, (data) => {
    selectedIssuePhoto = data;
    $("preview").src = data;
    $("preview").hidden = false;
  }, "issueMessage");
});

$("toolForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("adminToolId").value.trim();
  const name = $("adminToolName").value.trim();
  const originalId = $("editingOriginalId").value;
  if (!id || !name) return setMessage("adminMessage", "Укажи номер метки и название.", false);

  const tools = loadTools();
  if (tools.some((tool) => tool.id === id && tool.id !== originalId)) {
    return setMessage("adminMessage", "Инструмент с таким номером уже существует.", false);
  }

  const existing = originalId ? toolFor(originalId, tools) : null;
  const updated = { id, name, photo: selectedAdminPhoto || existing?.photo || "" };
  const nextTools = originalId
    ? tools.map((tool) => tool.id === originalId ? updated : tool)
    : [...tools, updated];

  if (originalId && originalId !== id) {
    const records = loadRecords().map((record) => record.toolId === originalId ? { ...record, toolId: id } : record);
    saveRecords(records);
  }
  saveTools(nextTools);
  setMessage("adminMessage", "Инструмент сохранён.", true);
  resetToolForm();
  renderAll();
});

$("toolsList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const id = button.dataset.id;
  const tools = loadTools();
  const tool = toolFor(id, tools);
  if (!tool) return;

  if (button.classList.contains("edit-tool")) {
    $("editingOriginalId").value = tool.id;
    $("adminToolId").value = tool.id;
    $("adminToolName").value = tool.name;
    selectedAdminPhoto = tool.photo || "";
    if (tool.photo) {
      $("adminPhotoPreview").src = tool.photo;
      $("adminPhotoPreview").hidden = false;
    } else {
      $("adminPhotoPreview").hidden = true;
    }
    $("cancelToolEditBtn").hidden = false;
    $("saveToolBtn").textContent = "Сохранить изменения";
    $("toolForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (button.classList.contains("delete-tool")) {
    if (activeRecordFor(id)) return alert("Сначала верни этот инструмент, затем его можно удалить.");
    if (!confirm(`Удалить «${tool.name}» из справочника? История выдач останется.`)) return;
    saveTools(tools.filter((item) => item.id !== id));
    renderAll();
  }
});

$("quickSaveToolBtn").addEventListener("click", () => {
  const name = $("quickToolName").value.trim();
  if (!currentToolId || !name) return setMessage("quickToolMessage", "Введи название инструмента.", false);
  const tools = loadTools();
  if (!toolFor(currentToolId, tools)) {
    tools.push({ id: currentToolId, name, photo: selectedQuickPhoto });
    saveTools(tools);
  }
  $("quickToolName").value = "";
  $("quickToolPhoto").value = "";
  $("quickPhotoPreview").hidden = true;
  selectedQuickPhoto = "";
  renderAll();
});

$("issueBtn").addEventListener("click", () => {
  if (!currentToolId || !toolFor(currentToolId)) return;
  const employee = $("employee").value.trim();
  if (!employee) {
    setMessage("issueMessage", "Укажи, кто берёт инструмент.", false);
    $("employee").focus();
    return;
  }
  const records = loadRecords();
  if (activeRecordFor(currentToolId, records)) {
    setMessage("issueMessage", "Этот инструмент уже выдан.", false);
    return renderAll();
  }
  records.push({
    id: `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`,
    toolId: currentToolId,
    employee,
    photo: selectedIssuePhoto,
    issuedAt: new Date().toISOString(),
    returnedAt: null,
    status: "not_returned"
  });
  saveRecords(records);
  $("employee").value = "";
  $("photo").value = "";
  $("preview").hidden = true;
  selectedIssuePhoto = "";
  renderAll();
});

$("returnBtn").addEventListener("click", () => {
  if (!currentToolId) return;
  const records = loadRecords();
  const active = activeRecordFor(currentToolId, records);
  if (!active) return renderAll();
  active.status = "returned";
  active.returnedAt = new Date().toISOString();
  saveRecords(records);
  renderAll();
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("Удалить всю историю выдач и возвратов на этом телефоне? Справочник инструментов останется.")) return;
  localStorage.removeItem(RECORDS_KEY);
  renderAll();
});

$("exportBtn").addEventListener("click", () => {
  const tools = loadTools();
  const rows = [
    ["Номер", "Инструмент", "Кто взял", "Выдан", "Возвращён", "Статус"],
    ...loadRecords().map((record) => [
      record.toolId,
      toolLabel(record.toolId, tools),
      record.employee,
      formatDate(record.issuedAt),
      formatDate(record.returnedAt),
      record.status === "not_returned" ? "Не возвращён" : "Возвращён"
    ])
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
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
