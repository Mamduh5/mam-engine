"use strict";

const state = { definitions: [], project: null, selectedPath: null, enabledKinds: new Set(), query: "", currentInspection: null, undo: null, notice: null };
const elements = {
  workspaceName: document.querySelector("#workspace-name"),
  connection: document.querySelector("#connection-status"),
  validCount: document.querySelector("#valid-count"),
  invalidCount: document.querySelector("#invalid-count"),
  search: document.querySelector("#definition-search"),
  filters: document.querySelector("#kind-filters"),
  projectActions: document.querySelector("#project-actions"),
  list: document.querySelector("#definition-list"),
  inspector: document.querySelector("#inspector")
};

elements.search.addEventListener("input", () => { state.query = elements.search.value.trim().toLowerCase(); renderDefinitionList(); });

void loadWorkspace();

async function loadWorkspace() {
  try {
    const workspace = await refreshWorkspaceData();
    state.enabledKinds = new Set(workspace.supportedDefinitionKinds);
    elements.connection.textContent = "Connected";
    elements.connection.dataset.state = "connected";
    renderFilters(workspace.supportedDefinitionKinds);
    renderProjectActions();
    renderDefinitionList();
  } catch (error) {
    elements.connection.textContent = "Unavailable";
    elements.connection.dataset.state = "failed";
    elements.list.replaceChildren(message("Server unavailable"));
    showFailure("Server unavailable", errorMessage(error));
  }
}

async function refreshWorkspaceData() {
  const [workspace, result, project] = await Promise.all([getJson("/api/workspace"), getJson("/api/definitions"), getJson("/api/project")]);
  state.definitions = result.definitions;
  state.project = project;
  elements.workspaceName.textContent = workspace.displayName;
  elements.validCount.textContent = String(workspace.validCount);
  elements.invalidCount.textContent = String(workspace.invalidCount);
  renderDefinitionList();
  renderProjectActions();
  return workspace;
}

function renderProjectActions() {
  elements.projectActions.replaceChildren();
  const hasMovement = state.definitions.some((definition) => definition.kind === "movement-profile");
  const create = actionButton("Create movement profile", "primary");
  create.hidden = hasMovement;
  create.disabled = !state.project?.initialized;
  create.addEventListener("click", async () => {
    create.disabled = true;
    try {
      const result = await postJson("/api/project/movement/create", { file: "movement/player.json" });
      await refreshWorkspaceData();
      if (result.data?.file) await selectDefinition(result.data.file);
    } catch (error) { showFailure("Movement creation failed", errorMessage(error)); }
  });
  const play = actionButton("Play movement sandbox");
  play.disabled = !state.project?.valid;
  play.addEventListener("click", async () => {
    play.disabled = true;
    play.textContent = "Sandbox running…";
    try {
      const result = await postJson("/api/project/play", {});
      state.notice = { file: state.selectedPath, message: `Sandbox exited · ${result.data?.metrics?.finalState ?? "complete"}` };
      if (state.selectedPath) await selectDefinition(state.selectedPath, true);
    } catch (error) { showFailure("Sandbox launch failed", errorMessage(error)); }
    finally { play.textContent = "Play movement sandbox"; play.disabled = !state.project?.valid; }
  });
  elements.projectActions.append(create, play);
}

function renderFilters(kinds) {
  elements.filters.querySelectorAll("label").forEach((node) => node.remove());
  for (const kind of kinds) {
    const label = document.createElement("label");
    label.className = "kind-filter";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.addEventListener("change", () => { input.checked ? state.enabledKinds.add(kind) : state.enabledKinds.delete(kind); renderDefinitionList(); });
    label.append(input, document.createTextNode(kind.replace("-profile", "")));
    elements.filters.append(label);
  }
}

function renderDefinitionList() {
  const visible = state.definitions.filter((definition) => state.enabledKinds.has(definition.kind) && searchableText(definition).includes(state.query));
  elements.list.replaceChildren();
  if (state.definitions.length === 0) { elements.list.append(message("No supported definitions found.")); return; }
  if (visible.length === 0) { elements.list.append(message("No definitions match the current filters.")); return; }
  const groups = new Map();
  for (const definition of visible) {
    if (!groups.has(definition.kind)) groups.set(definition.kind, []);
    groups.get(definition.kind).push(definition);
  }
  for (const [kind, definitions] of groups) {
    const section = document.createElement("section");
    section.className = "definition-group";
    const heading = document.createElement("h2");
    heading.textContent = kind;
    section.append(heading);
    for (const definition of definitions) section.append(definitionButton(definition));
    elements.list.append(section);
  }
}

function definitionButton(definition) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "definition-item";
  button.setAttribute("aria-current", String(state.selectedPath === definition.relativePath));
  const dot = document.createElement("span");
  dot.className = `validation-dot${definition.valid ? " valid" : ""}`;
  dot.setAttribute("aria-label", definition.valid ? "Valid" : "Invalid");
  const text = document.createElement("span");
  const title = document.createElement("span");
  title.className = "definition-title";
  title.textContent = definition.displayName || definition.id || definition.relativePath;
  const path = document.createElement("span");
  path.className = "definition-path";
  path.textContent = definition.relativePath;
  text.append(title, path);
  button.append(dot, text);
  button.addEventListener("click", () => { void selectDefinition(definition.relativePath); });
  return button;
}

async function selectDefinition(relativePath, preserveUndo = false) {
  if (state.selectedPath !== relativePath && !preserveUndo) { state.undo = null; state.notice = null; }
  state.selectedPath = relativePath;
  renderDefinitionList();
  elements.inspector.setAttribute("aria-busy", "true");
  elements.inspector.replaceChildren(emptyState("Inspector", "Loading definition", relativePath));
  try { state.currentInspection = await getJson(`/api/definitions/inspect?file=${encodeURIComponent(relativePath)}`); renderInspection(state.currentInspection); }
  catch (error) { showFailure("Inspection failed", errorMessage(error)); }
  finally { elements.inspector.removeAttribute("aria-busy"); elements.inspector.focus(); }
}

function renderInspection(inspection) {
  const summary = inspection.summary;
  const wrapper = document.createElement("article");
  const heading = document.createElement("header");
  heading.className = "inspector-heading";
  const identity = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = summary.kind;
  const title = document.createElement("h1");
  title.textContent = summary.displayName || summary.id || summary.relativePath;
  const meta = document.createElement("p");
  meta.className = "definition-meta";
  meta.textContent = summary.relativePath;
  identity.append(eyebrow, title, meta);
  const actions = document.createElement("div");
  actions.className = "inspector-actions";
  if (summary.valid && summary.kind === "movement-profile") {
    const edit = actionButton("Edit", "primary");
    edit.addEventListener("click", () => { void beginMovementEdit(); });
    actions.append(edit);
  }
  if (state.undo?.file === summary.relativePath) {
    const undo = actionButton("Undo last save");
    undo.addEventListener("click", () => { void undoLastSave(undo); });
    actions.append(undo);
  }
  const badge = document.createElement("span");
  badge.className = `status-badge${summary.valid ? " valid" : ""}`;
  badge.textContent = summary.valid ? "Valid" : `Invalid · ${summary.errorCount}`;
  const headingStatus = document.createElement("div");
  headingStatus.className = "heading-status";
  headingStatus.append(actions, badge);
  heading.append(identity, headingStatus);
  wrapper.append(heading);
  if (state.notice !== null && state.notice.file === summary.relativePath) wrapper.append(noticePanel(state.notice.message));
  wrapper.append(sectionWithFields("Authored fields", inspection.authoredFields));
  wrapper.append(sectionWithList("Referenced definitions", inspection.resolvedReferences.map((reference) => `${reference.field}: ${reference.relativePath}`), "No resolved references."));
  const findings = inspection.validationFindings.map((finding) => `${finding.code}${finding.path ? ` · ${finding.path}` : ""}: ${finding.message}`);
  wrapper.append(sectionWithList("Validation findings", findings, summary.valid ? "No validation findings." : "Invalid definition."));
  if (summary.valid && summary.kind === "movement-profile") wrapper.append(persistedSimulationSection(summary));
  const rawSection = document.createElement("section");
  rawSection.className = "inspector-section";
  const details = document.createElement("details");
  const detailsTitle = document.createElement("summary");
  detailsTitle.textContent = "Raw JSON";
  const raw = document.createElement("pre");
  raw.textContent = JSON.stringify(inspection.raw, null, 2);
  details.append(detailsTitle, raw);
  rawSection.append(details);
  wrapper.append(rawSection);
  elements.inspector.replaceChildren(wrapper);
}

async function beginMovementEdit() {
  if (state.selectedPath === null || state.currentInspection === null) return;
  elements.inspector.setAttribute("aria-busy", "true");
  try {
    const encoded = encodeURIComponent(state.selectedPath);
    const [editModel, simulationModel] = await Promise.all([getJson(`/api/definitions/edit?file=${encoded}`), getJson(`/api/definitions/simulation?file=${encoded}`)]);
    renderMovementEdit(editModel, simulationModel);
  }
  catch (error) { showFailure("Edit unavailable", errorMessage(error)); }
  finally { elements.inspector.removeAttribute("aria-busy"); }
}

function renderMovementEdit(model, simulationModel) {
  let selected = model.editableFields[0];
  let candidate = selected?.value;
  let previewPassed = false;
  const wrapper = document.createElement("article");
  const heading = document.createElement("header");
  heading.className = "inspector-heading";
  const identity = document.createElement("div");
  const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = "movement-profile · edit one property";
  const title = document.createElement("h1"); title.textContent = model.displayName;
  const meta = document.createElement("p"); meta.className = "definition-meta"; meta.textContent = model.relativePath;
  identity.append(eyebrow, title, meta);
  const dirty = document.createElement("span"); dirty.className = "status-badge"; dirty.textContent = "Unchanged";
  heading.append(identity, dirty);
  wrapper.append(heading);

  const form = document.createElement("form");
  form.className = "edit-form inspector-section";
  form.addEventListener("submit", (event) => event.preventDefault());
  const pathLabel = document.createElement("label"); pathLabel.htmlFor = "edit-property"; pathLabel.textContent = "Property";
  const pathSelect = document.createElement("select"); pathSelect.id = "edit-property";
  for (const field of model.editableFields) { const option = document.createElement("option"); option.value = field.path; option.textContent = `${field.label} · ${field.path}`; pathSelect.append(option); }
  const original = document.createElement("p"); original.className = "original-value";
  const inputLabel = document.createElement("label"); inputLabel.htmlFor = "edit-value"; inputLabel.textContent = "New value";
  const inputSlot = document.createElement("div");
  const findings = document.createElement("div"); findings.className = "edit-findings"; findings.setAttribute("aria-live", "polite");
  const controls = document.createElement("div"); controls.className = "edit-actions";
  const cancel = actionButton("Cancel");
  const preview = actionButton("Preview", "primary");
  const save = actionButton("Save", "primary"); save.disabled = true;
  controls.append(cancel, preview, save);
  form.append(pathLabel, pathSelect, original, inputLabel, inputSlot, findings, controls);
  wrapper.append(form);

  const simulationSection = sectionShell("Preview comparison");
  simulationSection.classList.add("simulation-panel");
  const scenarioLabel = document.createElement("label"); scenarioLabel.htmlFor = "preview-scenario"; scenarioLabel.textContent = "Scenario";
  const scenarioSelect = document.createElement("select"); scenarioSelect.id = "preview-scenario";
  for (const scenario of simulationModel.availableScenarios) { const option = document.createElement("option"); option.value = scenario.id; option.textContent = scenario.id; scenarioSelect.append(option); }
  const secondsLabel = document.createElement("label"); secondsLabel.htmlFor = "preview-seconds"; secondsLabel.textContent = "Seconds (optional)";
  const secondsInput = document.createElement("input"); secondsInput.id = "preview-seconds"; secondsInput.type = "number"; secondsInput.min = "0.01"; secondsInput.max = "60"; secondsInput.step = "any";
  const simulatePreview = actionButton("Simulate preview", "primary"); simulatePreview.disabled = true;
  const comparison = document.createElement("div"); comparison.className = "simulation-result"; comparison.setAttribute("aria-live", "polite");
  simulationSection.append(scenarioLabel, scenarioSelect, secondsLabel, secondsInput, simulatePreview, comparison);
  wrapper.append(simulationSection);
  elements.inspector.replaceChildren(wrapper);

  const selectedScenario = () => simulationModel.availableScenarios.find((scenario) => scenario.id === scenarioSelect.value);
  const clearComparison = () => comparison.replaceChildren();
  const updateSeconds = () => { const accepts = selectedScenario()?.acceptsCustomSeconds === true; secondsInput.disabled = !accepts; secondsLabel.hidden = !accepts; secondsInput.hidden = !accepts; if (!accepts) secondsInput.value = ""; clearComparison(); };
  scenarioSelect.addEventListener("change", updateSeconds);
  secondsInput.addEventListener("input", clearComparison);

  const renderInput = () => {
    candidate = selected.value;
    previewPassed = false;
    save.disabled = true;
    simulatePreview.disabled = true;
    findings.replaceChildren();
    clearComparison();
    original.textContent = `Original value: ${formatValue(selected.value)}`;
    const input = document.createElement("input"); input.id = "edit-value"; input.name = "value";
    if (selected.valueType === "number") { input.type = "number"; input.step = "any"; input.value = String(selected.value); }
    else if (selected.valueType === "boolean") { input.type = "checkbox"; input.checked = selected.value; }
    else { input.type = "text"; input.value = selected.value; }
    const update = () => {
      candidate = selected.valueType === "number" ? (input.value === "" ? null : Number(input.value)) : selected.valueType === "boolean" ? input.checked : input.value;
      previewPassed = false;
      save.disabled = true;
      simulatePreview.disabled = true;
      findings.replaceChildren();
      clearComparison();
      const changed = candidate !== selected.value;
      dirty.textContent = changed ? "Unsaved change" : "Unchanged";
      dirty.classList.toggle("dirty", changed);
      preview.disabled = !changed || (selected.valueType === "number" && !Number.isFinite(candidate));
    };
    input.addEventListener(selected.valueType === "boolean" ? "change" : "input", update);
    inputSlot.replaceChildren(input);
    update();
  };
  pathSelect.addEventListener("change", () => { selected = model.editableFields.find((field) => field.path === pathSelect.value); renderInput(); });
  cancel.addEventListener("click", () => { renderInspection(state.currentInspection); });
  preview.addEventListener("click", async () => {
    setBusy(controls, true);
    try {
      const result = await postJson("/api/definitions/edit/preview", { file: model.relativePath, expectedRevision: model.revision, path: selected.path, value: candidate });
      previewPassed = result.previewStatus === "passed";
      save.disabled = !previewPassed;
      simulatePreview.disabled = !previewPassed;
      showValidationFindings(findings, result.validationFindings, previewPassed ? "Preview passed. Save is enabled." : "Preview failed.");
    } catch (error) { previewPassed = false; save.disabled = true; simulatePreview.disabled = true; showRequestError(findings, error); }
    finally { setBusy(controls, false); save.disabled = !previewPassed; simulatePreview.disabled = !previewPassed; }
  });
  simulatePreview.addEventListener("click", async () => {
    if (!previewPassed) return;
    simulatePreview.disabled = true;
    comparison.replaceChildren(message("Running deterministic comparison…"));
    try {
      const seconds = optionalSeconds(secondsInput);
      const result = await postJson("/api/definitions/simulation/run", {
        file: model.relativePath,
        expectedRevision: model.revision,
        scenario: scenarioSelect.value,
        ...(seconds === undefined ? {} : { seconds }),
        candidate: { path: selected.path, value: candidate }
      });
      if (result.candidateSimulation === null) showValidationFindings(comparison, result.validationFindings, "Candidate simulation unavailable.");
      else comparison.replaceChildren(comparisonTable(result));
    } catch (error) { showRequestError(comparison, error); }
    finally { simulatePreview.disabled = !previewPassed; }
  });
  save.addEventListener("click", async () => {
    if (!previewPassed) return;
    setBusy(controls, true);
    try {
      const result = await postJson("/api/definitions/edit/save", { file: model.relativePath, expectedRevision: model.revision, path: selected.path, value: candidate });
      if (result.saveStatus !== "passed") { showValidationFindings(findings, result.validationFindings, "Save failed."); return; }
      state.undo = { file: model.relativePath, snapshotId: result.snapshotId, expectedRevision: result.currentRevision };
      state.notice = { file: model.relativePath, message: `Saved ${result.savedPropertyPath} = ${formatValue(result.savedValue)} · snapshot ${result.snapshotId}` };
      await refreshWorkspaceData();
      await selectDefinition(model.relativePath, true);
    } catch (error) { showRequestError(findings, error); }
    finally { setBusy(controls, false); }
  });
  updateSeconds();
  renderInput();
}

async function undoLastSave(button) {
  const undo = state.undo;
  if (undo === null) return;
  button.disabled = true;
  try {
    const result = await postJson("/api/definitions/edit/rollback", undo);
    if (result.rollbackStatus !== "rolled_back") throw new Error("Rollback failed");
    state.undo = null;
    state.notice = { file: undo.file, message: `Undo restored snapshot ${result.restoredSnapshotId}` };
    await refreshWorkspaceData();
    await selectDefinition(undo.file, true);
  } catch (error) { showFailure("Undo failed", errorMessage(error)); }
}

function persistedSimulationSection(summary) {
  const section = sectionShell("Simulation");
  section.classList.add("simulation-panel");
  const content = document.createElement("div");
  content.append(message("Loading simulation options…"));
  section.append(content);
  void getJson(`/api/definitions/simulation?file=${encodeURIComponent(summary.relativePath)}`)
    .then((model) => renderPersistedSimulationControls(content, model))
    .catch((error) => content.replaceChildren(message(errorMessage(error))));
  return section;
}

function renderPersistedSimulationControls(content, model) {
  const scenarioLabel = document.createElement("label"); scenarioLabel.htmlFor = "simulation-scenario"; scenarioLabel.textContent = "Scenario";
  const scenarioSelect = document.createElement("select"); scenarioSelect.id = "simulation-scenario";
  for (const scenario of model.availableScenarios) { const option = document.createElement("option"); option.value = scenario.id; option.textContent = scenario.id; scenarioSelect.append(option); }
  const secondsLabel = document.createElement("label"); secondsLabel.htmlFor = "simulation-seconds"; secondsLabel.textContent = "Seconds (optional)";
  const secondsInput = document.createElement("input"); secondsInput.id = "simulation-seconds"; secondsInput.type = "number"; secondsInput.min = "0.01"; secondsInput.max = "60"; secondsInput.step = "any";
  const run = actionButton("Run simulation", "primary");
  const resultSlot = document.createElement("div"); resultSlot.className = "simulation-result"; resultSlot.setAttribute("aria-live", "polite");
  const selectedScenario = () => model.availableScenarios.find((scenario) => scenario.id === scenarioSelect.value);
  const clearResult = () => resultSlot.replaceChildren();
  const updateSeconds = () => { const accepts = selectedScenario()?.acceptsCustomSeconds === true; secondsInput.disabled = !accepts; secondsInput.hidden = !accepts; secondsLabel.hidden = !accepts; if (!accepts) secondsInput.value = ""; clearResult(); };
  scenarioSelect.addEventListener("change", updateSeconds);
  secondsInput.addEventListener("input", clearResult);
  run.addEventListener("click", async () => {
    run.disabled = true;
    resultSlot.replaceChildren(message("Running deterministic simulation…"));
    try {
      const seconds = optionalSeconds(secondsInput);
      const result = await postJson("/api/definitions/simulation/run", {
        file: model.relativePath,
        expectedRevision: model.currentRevision,
        scenario: scenarioSelect.value,
        ...(seconds === undefined ? {} : { seconds })
      });
      resultSlot.replaceChildren(simulationResultTable(result));
    } catch (error) { showRequestError(resultSlot, error); }
    finally { run.disabled = false; }
  });
  content.replaceChildren(scenarioLabel, scenarioSelect, secondsLabel, secondsInput, run, resultSlot);
  updateSeconds();
}

function simulationResultTable(result) {
  const wrapper = document.createElement("div");
  wrapper.append(message(`Scenario: ${result.scenario} · revision ${result.sourceRevision.slice(0, 12)}`));
  wrapper.append(metricTable(["Metric", "Value"], Object.entries(result.persistedSimulation.metrics).map(([metric, value]) => [metric, formatValue(value)])));
  return wrapper;
}

function comparisonTable(result) {
  const wrapper = document.createElement("div");
  wrapper.append(message(`Saved versus preview · ${result.scenario}`));
  wrapper.append(metricTable(["Metric", "Saved", "Preview", "Delta", "Changed"], result.metricComparison.map((row) => [row.metric, formatValue(row.persisted), formatValue(row.candidate), formatValue(row.delta), row.changed ? "yes" : "no"])));
  return wrapper;
}

function metricTable(headings, rows) {
  const table = document.createElement("table"); table.className = "simulation-table";
  const head = document.createElement("thead"); const headerRow = document.createElement("tr");
  for (const heading of headings) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = heading; headerRow.append(cell); }
  head.append(headerRow);
  const body = document.createElement("tbody");
  for (const values of rows) { const row = document.createElement("tr"); values.forEach((value, index) => { const cell = document.createElement(index === 0 ? "th" : "td"); if (index === 0) cell.scope = "row"; cell.textContent = value; row.append(cell); }); body.append(row); }
  table.append(head, body);
  return table;
}

function optionalSeconds(input) { return input.disabled || input.value === "" ? undefined : Number(input.value); }

function sectionWithFields(title, fields) {
  const section = sectionShell(title);
  const table = document.createElement("table");
  table.className = "field-table";
  const body = document.createElement("tbody");
  for (const field of fields) {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = field.path;
    const value = document.createElement("td");
    value.textContent = typeof field.value === "string" ? field.value : JSON.stringify(field.value);
    row.append(label, value);
    body.append(row);
  }
  table.append(body);
  section.append(table);
  return section;
}

function sectionWithList(title, items, emptyText) {
  const section = sectionShell(title);
  if (items.length === 0) { section.append(message(emptyText)); return section; }
  const list = document.createElement("ul");
  list.className = title === "Validation findings" ? "finding-list" : "reference-list";
  for (const item of items) { const entry = document.createElement("li"); entry.textContent = item; list.append(entry); }
  section.append(list);
  return section;
}

function sectionShell(title) { const section = document.createElement("section"); section.className = "inspector-section"; const heading = document.createElement("h2"); heading.textContent = title; section.append(heading); return section; }
function actionButton(text, style = "") { const button = document.createElement("button"); button.type = "button"; button.className = `editor-button${style ? ` ${style}` : ""}`; button.textContent = text; return button; }
function noticePanel(text) { const panel = document.createElement("p"); panel.className = "editor-notice"; panel.setAttribute("role", "status"); panel.textContent = text; return panel; }
function formatValue(value) { return typeof value === "string" ? value : JSON.stringify(value); }
function setBusy(container, busy) { container.querySelectorAll("button").forEach((button) => { button.disabled = busy; }); }
function showValidationFindings(container, findings, successText) { container.replaceChildren(); if (findings.length === 0) { container.append(message(successText)); return; } const list = document.createElement("ul"); list.className = "finding-list"; for (const finding of findings) { const item = document.createElement("li"); item.textContent = `${finding.code}${finding.path ? ` · ${finding.path}` : ""}: ${finding.message}`; list.append(item); } container.append(list); }
function showRequestError(container, error) { const findings = error.payload?.error?.validationFindings || []; showValidationFindings(container, findings, errorMessage(error)); if (findings.length === 0) container.replaceChildren(message(errorMessage(error))); }
function showFailure(title, detail) { elements.inspector.replaceChildren(emptyState("Editor", title, detail)); }
function emptyState(eyebrowText, titleText, detailText) { const section = document.createElement("section"); section.className = "empty-state"; const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = eyebrowText; const title = document.createElement("h1"); title.textContent = titleText; const detail = document.createElement("p"); detail.textContent = detailText; section.append(eyebrow, title, detail); return section; }
function message(text) { const paragraph = document.createElement("p"); paragraph.className = "muted"; paragraph.textContent = text; return paragraph; }
function searchableText(definition) { return [definition.relativePath, definition.kind, definition.id, definition.displayName].filter(Boolean).join(" ").toLowerCase(); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
async function getJson(url) { const response = await fetch(url, { headers: { Accept: "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || `Request failed with ${response.status}`); return body; }
async function postJson(url, value) { const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(value) }); const body = await response.json(); if (!response.ok) { const error = new Error(body.error?.message || `Request failed with ${response.status}`); error.payload = body; throw error; } return body; }
