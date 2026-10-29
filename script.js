/* Historia Universal: interfaz y navegación temporal.
   El sitio es estático: los datos se leen de events.csv y no se editan desde la web. */
"use strict";

const $ = (selector) => document.querySelector(selector);

const elements = {
  status: $("#load-status"),
  search: $("#search"),
  category: $("#category-filter"),
  region: $("#region-filter"),
  rangeStart: $("#range-start"),
  rangeEnd: $("#range-end"),
  applyRange: $("#apply-range"),
  zoomIn: $("#zoom-in"),
  zoomOut: $("#zoom-out"),
  panLeft: $("#pan-left"),
  panRight: $("#pan-right"),
  reset: $("#reset-view"),
  viewport: $("#timeline-viewport"),
  track: $("#timeline-track"),
  ticks: $("#ticks"),
  markers: $("#markers"),
  visibleRange: $("#visible-range"),
  eventCount: $("#event-count"),
  details: $("#event-details")
};

const FULL_START = -10000;
const FULL_END = 2026;
const MIN_SPAN = 1;
let events = [];
let viewStart = FULL_START;
let viewEnd = FULL_END;
let selectedId = null;
let dragState = null;

// Para evitar un año cero histórico: -1 = 1 a. C.; 1 = 1 d. C.
// El eje interno sí es continuo, y estas funciones convierten entre ambos sistemas.
function historicalToAxis(year) {
  return year < 0 ? year + 1 : year;
}

function axisToHistorical(axisYear) {
  return axisYear <= 0 ? axisYear - 1 : axisYear;
}

function formatYear(year) {
  if (year < 0) return `${Math.abs(year).toLocaleString("es-MX")} a. C.`;
  return `${year.toLocaleString("es-MX")} d. C.`;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

// Parser CSV que admite comas, comillas y saltos de línea dentro de campos entrecomillados.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("Hay una comilla sin cerrar en events.csv.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];

  const headers = rows.shift().map(value => value.trim().replace(/^\uFEFF/, ""));
  return rows.map(values => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

function normalizeEvents(records) {
  return records.map((record, index) => {
    const start = Number(record.start);
    const end = record.end === "" ? start : Number(record.end);
    if (!record.title || !Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      return null;
    }

    return {
      id: record.id || String(index + 1),
      title: record.title,
      start,
      end,
      region: record.region || "Sin región",
      categories: (record.categories || "")
        .split("|").map(value => value.trim()).filter(Boolean),
      description: record.description || "Sin descripción.",
      source: record.source || "",
      certainty: record.certainty || ""
    };
  }).filter(Boolean);
}

function fillSelect(select, values, defaultLabel) {
  select.replaceChildren();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function populateFilters() {
  fillSelect(elements.category, events.flatMap(event => event.categories), "Todas las categorías");
  fillSelect(elements.region, events.map(event => event.region), "Todas las regiones");
}

function getFilteredEvents() {
  const query = elements.search.value.trim().toLocaleLowerCase("es");
  const category = elements.category.value;
  const region = elements.region.value;

  return events.filter(event => {
    const searchable = `${event.title} ${event.description} ${event.region} ${event.categories.join(" ")}`
      .toLocaleLowerCase("es");
    const matchesQuery = !query || searchable.includes(query);
    const matchesCategory = !category || event.categories.includes(category);
    const matchesRegion = !region || event.region === region;
    const start = historicalToAxis(event.start);
    const end = historicalToAxis(event.end);
    const rangeStart = historicalToAxis(viewStart);
    const rangeEnd = historicalToAxis(viewEnd);
    const matchesRange = start <= rangeEnd && end >= rangeStart;
    return matchesQuery && matchesCategory && matchesRegion && matchesRange;
  });
}

function chooseTickStep(span) {
  const target = span / 7;
  const choices = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];
  return choices.find(step => step >= target) || 50000;
}

function renderTicks() {
  elements.ticks.replaceChildren();
  const startAxis = historicalToAxis(viewStart);
  const endAxis = historicalToAxis(viewEnd);
  const span = endAxis - startAxis;
  const step = chooseTickStep(span);
  const firstTick = Math.ceil(startAxis / step) * step;

  for (let axisYear = firstTick; axisYear <= endAxis && elements.ticks.childElementCount < 30; axisYear += step) {
    const year = axisToHistorical(axisYear);
    const position = ((axisYear - startAxis) / span) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = `${position}%`;

    const label = document.createElement("span");
    label.className = "tick-label";
    label.textContent = axisYear === 0 ? "0" : formatYear(year);
    tick.appendChild(label);
    elements.ticks.appendChild(tick);
  }
}

function renderMarkers(filtered) {
  elements.markers.replaceChildren();

  const startAxis = historicalToAxis(viewStart);
  const endAxis = historicalToAxis(viewEnd);
  const span = endAxis - startAxis;
  const viewportWidth = Math.max(elements.viewport.clientWidth, 320);
  const sorted = filtered
    .map(event => {
      const middle = (historicalToAxis(event.start) + historicalToAxis(event.end)) / 2;
      return { event, middle, x: ((middle - startAxis) / span) * viewportWidth };
    })
    .filter(item => item.middle >= startAxis && item.middle <= endAxis)
    .sort((a, b) => a.x - b.x);

  // Reparte las etiquetas entre carriles alternos para reducir solapamientos.
  const laneEnds = [[], [], [], [], [], []];
  let maxLane = 0;

  sorted.forEach(({ event, x }) => {
    const estimatedWidth = Math.min(175, Math.max(76, event.title.length * 7 + 24));
    let chosenLane = laneEnds.findIndex(endX => x - estimatedWidth / 2 > endX + 8);
    if (chosenLane === -1) {
      chosenLane = laneEnds.length;
      laneEnds.push([]);
    }
    laneEnds[chosenLane] = x + estimatedWidth / 2;
    maxLane = Math.max(maxLane, chosenLane);

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "event-marker";
    if (event.id === selectedId) marker.classList.add("selected");
    const above = chosenLane % 2 === 0;
    if (!above) marker.classList.add("below");
    marker.style.left = `${(x / viewportWidth) * 100}%`;
    marker.style.top = above
      ? `${Math.max(8, 190 - (Math.floor(chosenLane / 2) + 1) * 48)}px`
      : `${214 + Math.floor(chosenLane / 2) * 48}px`;
    marker.textContent = event.title;
    marker.title = `${event.title} · ${formatYear(event.start)}`;
    marker.setAttribute("aria-label", `${event.title}, ${formatYear(event.start)}. Mostrar detalles.`);
    marker.addEventListener("click", () => showDetails(event));
    elements.markers.appendChild(marker);
  });

  const neededHeight = Math.max(390, 255 + (Math.floor(maxLane / 2) + 1) * 48);
  elements.track.style.height = `${neededHeight}px`;
  elements.viewport.style.minHeight = `${neededHeight}px`;
}

function render() {
  const filtered = getFilteredEvents();
  elements.visibleRange.textContent = `${formatYear(viewStart)} — ${formatYear(viewEnd)}`;
  elements.rangeStart.value = viewStart;
  elements.rangeEnd.value = viewEnd;
  renderTicks();
  renderMarkers(filtered);
  elements.eventCount.textContent = `${filtered.length} acontecimiento(s) en el intervalo y con los filtros actuales.`;
}

function showDetails(event) {
  selectedId = event.id;
  const container = elements.details;
  container.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = event.title;
  container.appendChild(heading);

  const date = document.createElement("p");
  date.textContent = event.start === event.end
    ? formatYear(event.start)
    : `${formatYear(event.start)} – ${formatYear(event.end)}`;
  container.appendChild(date);

  const metadata = document.createElement("div");
  metadata.className = "event-meta";
  [event.region, ...event.categories, event.certainty].filter(Boolean).forEach(value => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = value;
    metadata.appendChild(pill);
  });
  container.appendChild(metadata);

  const description = document.createElement("p");
  description.className = "event-description";
  description.textContent = event.description;
  container.appendChild(description);

  if (event.source) {
    const source = document.createElement("p");
    source.className = "event-source";
    source.append("Fuente: ");
    // Solo convierte en enlace URLs http(s); el resto se muestra como texto.
    if (/^https?:\/\/\S+$/i.test(event.source)) {
      const link = document.createElement("a");
      link.href = event.source;
      link.textContent = event.source;
      link.target = "_blank";
      link.rel = "noreferrer";
      source.appendChild(link);
    } else {
      source.append(event.source);
    }
    container.appendChild(source);
  }

  renderMarkers(getFilteredEvents());
}

function setRange(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    setStatus("El año inicial debe ser menor que el año final.", true);
    return;
  }
  viewStart = start;
  viewEnd = end;
  selectedId = null;
  setStatus("Intervalo actualizado.");
  render();
}

function zoom(factor) {
  const start = historicalToAxis(viewStart);
  const end = historicalToAxis(viewEnd);
  const center = (start + end) / 2;
  const newSpan = Math.max(MIN_SPAN, (end - start) * factor);
  const newStart = center - newSpan / 2;
  const newEnd = center + newSpan / 2;
  setRange(axisToHistorical(Math.floor(newStart)), axisToHistorical(Math.ceil(newEnd)));
}

function pan(fraction) {
  const start = historicalToAxis(viewStart);
  const end = historicalToAxis(viewEnd);
  const shift = (end - start) * fraction;
  setRange(axisToHistorical(Math.floor(start + shift)), axisToHistorical(Math.ceil(end + shift)));
}

function attachEvents() {
  elements.search.addEventListener("input", render);
  elements.category.addEventListener("change", render);
  elements.region.addEventListener("change", render);

  elements.applyRange.addEventListener("click", () => {
    setRange(Number(elements.rangeStart.value), Number(elements.rangeEnd.value));
  });
  elements.zoomIn.addEventListener("click", () => zoom(0.5));
  elements.zoomOut.addEventListener("click", () => zoom(2));
  elements.panLeft.addEventListener("click", () => pan(-0.35));
  elements.panRight.addEventListener("click", () => pan(0.35));
  elements.reset.addEventListener("click", () => setRange(FULL_START, FULL_END));

  // Arrastre con ratón o dedo para desplazarse por el tiempo.
  elements.viewport.addEventListener("pointerdown", event => {
    if (event.target.closest(".event-marker")) return;
    dragState = {
      x: event.clientX,
      start: historicalToAxis(viewStart),
      end: historicalToAxis(viewEnd),
      width: Math.max(elements.viewport.clientWidth, 1)
    };
    elements.viewport.classList.add("is-dragging");
    elements.viewport.setPointerCapture(event.pointerId);
  });

  elements.viewport.addEventListener("pointermove", event => {
    if (!dragState) return;
    const dx = event.clientX - dragState.x;
    const shift = -(dx / dragState.width) * (dragState.end - dragState.start);
    const start = dragState.start + shift;
    const end = dragState.end + shift;
    viewStart = axisToHistorical(Math.floor(start));
    viewEnd = axisToHistorical(Math.ceil(end));
    render();
  });

  const stopDrag = () => {
    dragState = null;
    elements.viewport.classList.remove("is-dragging");
  };
  elements.viewport.addEventListener("pointerup", stopDrag);
  elements.viewport.addEventListener("pointercancel", stopDrag);

  // Zoom con rueda al mantener pulsada la tecla Ctrl o Cmd.
  elements.viewport.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.8 : 1.25);
  }, { passive: false });

  window.addEventListener("resize", render);
}

async function init() {
  attachEvents();
  try {
    const response = await fetch("./events.csv");
    if (!response.ok) throw new Error(`No se pudo leer events.csv (HTTP ${response.status}).`);
    const csvText = await response.text();
    events = normalizeEvents(parseCSV(csvText));

    if (events.length === 0) {
      throw new Error("No hay acontecimientos válidos en events.csv. Revisa los encabezados y las fechas.");
    }

    populateFilters();
    render();
    setStatus(`${events.length} acontecimientos cargados.`);
  } catch (error) {
    console.error(error);
    setStatus(`${error.message} Abre la página mediante GitHub Pages o un servidor local, no con file://.`, true);
    elements.eventCount.textContent = "No se pudieron cargar los datos.";
  }
}

init();
