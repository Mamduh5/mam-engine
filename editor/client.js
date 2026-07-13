"use strict";

const state = { definitions: [], selectedPath: null, enabledKinds: new Set(), query: "" };
const elements = {
  workspaceName: document.querySelector("#workspace-name"),
  connection: document.querySelector("#connection-status"),
  validCount: document.querySelector("#valid-count"),
  invalidCount: document.querySelector("#invalid-count"),
  search: document.querySelector("#definition-search"),
  filters: document.querySelector("#kind-filters"),
  list: document.querySelector("#definition-list"),
  inspector: document.querySelector("#inspector")
};

elements.search.addEventListener("input", () => { state.query = elements.search.value.trim().toLowerCase(); renderDefinitionList(); });

void loadWorkspace();

async function loadWorkspace() {
  try {
    const [workspace, result] = await Promise.all([getJson("/api/workspace"), getJson("/api/definitions")]);
    state.definitions = result.definitions;
    state.enabledKinds = new Set(workspace.supportedDefinitionKinds);
    elements.workspaceName.textContent = workspace.displayName;
    elements.validCount.textContent = String(workspace.validCount);
    elements.invalidCount.textContent = String(workspace.invalidCount);
    elements.connection.textContent = "Connected";
    elements.connection.dataset.state = "connected";
    renderFilters(workspace.supportedDefinitionKinds);
    renderDefinitionList();
  } catch (error) {
    elements.connection.textContent = "Unavailable";
    elements.connection.dataset.state = "failed";
    elements.list.replaceChildren(message("Server unavailable"));
    showFailure("Server unavailable", errorMessage(error));
  }
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

async function selectDefinition(relativePath) {
  state.selectedPath = relativePath;
  renderDefinitionList();
  elements.inspector.setAttribute("aria-busy", "true");
  elements.inspector.replaceChildren(emptyState("Inspector", "Loading definition", relativePath));
  try { renderInspection(await getJson(`/api/definitions/inspect?file=${encodeURIComponent(relativePath)}`)); }
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
  const badge = document.createElement("span");
  badge.className = `status-badge${summary.valid ? " valid" : ""}`;
  badge.textContent = summary.valid ? "Valid" : `Invalid · ${summary.errorCount}`;
  heading.append(identity, badge);
  wrapper.append(heading);
  wrapper.append(sectionWithFields("Authored fields", inspection.authoredFields));
  wrapper.append(sectionWithList("Referenced definitions", inspection.resolvedReferences.map((reference) => `${reference.field}: ${reference.relativePath}`), "No resolved references."));
  const findings = inspection.validationFindings.map((finding) => `${finding.code}${finding.path ? ` · ${finding.path}` : ""}: ${finding.message}`);
  wrapper.append(sectionWithList("Validation findings", findings, summary.valid ? "No validation findings." : "Invalid definition."));
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
function showFailure(title, detail) { elements.inspector.replaceChildren(emptyState("Editor", title, detail)); }
function emptyState(eyebrowText, titleText, detailText) { const section = document.createElement("section"); section.className = "empty-state"; const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow"; eyebrow.textContent = eyebrowText; const title = document.createElement("h1"); title.textContent = titleText; const detail = document.createElement("p"); detail.textContent = detailText; section.append(eyebrow, title, detail); return section; }
function message(text) { const paragraph = document.createElement("p"); paragraph.className = "muted"; paragraph.textContent = text; return paragraph; }
function searchableText(definition) { return [definition.relativePath, definition.kind, definition.id, definition.displayName].filter(Boolean).join(" ").toLowerCase(); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
async function getJson(url) { const response = await fetch(url, { headers: { Accept: "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || `Request failed with ${response.status}`); return body; }
