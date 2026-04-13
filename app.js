const menuButton = document.getElementById("menu-button");
const drawer = document.getElementById("drawer");
const listEl = document.getElementById("location-list");
const contentEl = document.getElementById("content");
const searchInput = document.getElementById("search-input");

let locations = [];
let filteredLocations = [];
let activeId = null;

menuButton.addEventListener("click", () => {
  const isOpen = drawer.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

searchInput.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  filteredLocations = filterLocations(query);
  renderList();

  if (activeId && !filteredLocations.some((item) => item.id === activeId)) {
    activeId = filteredLocations[0]?.id ?? null;
  }

  if (activeId) {
    renderDetails(activeId);
  } else {
    contentEl.innerHTML = '<p class="empty-state">No locations match this search.</p>';
  }
});

init();

async function init() {
  try {
    const response = await fetch("tour_content.csv");
    const text = await response.text();
    const rows = parseCsv(text);

    locations = rows
      .map((row, idx) => ({
        id: `${row.menu_order || idx}-${row.menu_label}`,
        menuOrder: Number(row.menu_order) || idx + 1,
        menuLabel: row.menu_label?.trim() || "Untitled",
        displayTitle: row.display_title?.trim() || row.menu_label?.trim() || "Untitled",
        overview: row.overview?.trim() || "",
        talkingPoints: splitTalkingPoints(row.talking_points),
      }))
      .sort((a, b) => a.menuOrder - b.menuOrder);

    filteredLocations = [...locations];
    activeId = filteredLocations[0]?.id ?? null;

    renderList();

    if (activeId) {
      renderDetails(activeId);
    }
  } catch (error) {
    contentEl.innerHTML = '<p class="empty-state">Unable to load tour content.</p>';
    console.error(error);
  }
}

function filterLocations(query) {
  if (!query) return [...locations];

  return locations.filter((location) => {
    const searchable = [
      location.displayTitle,
      location.overview,
      location.talkingPoints.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

function renderList() {
  listEl.innerHTML = "";

  filteredLocations.forEach((location) => {
    const li = document.createElement("li");
    li.className = "location-item";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${location.menuOrder}. ${location.menuLabel}`;

    if (location.id === activeId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeId = location.id;
      renderList();
      renderDetails(location.id);

      if (window.innerWidth < 900) {
        drawer.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    li.appendChild(button);
    listEl.appendChild(li);
  });

  if (filteredLocations.length === 0) {
    listEl.innerHTML = '<li class="empty-state">No matching locations.</li>';
  }
}

function renderDetails(id) {
  const location = filteredLocations.find((item) => item.id === id) || locations.find((item) => item.id === id);

  if (!location) {
    contentEl.innerHTML = '<p class="empty-state">Choose a location to view details.</p>';
    return;
  }

  const talkingPointsHtml = location.talkingPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");

  contentEl.innerHTML = `
    <article>
      <h2>${escapeHtml(location.displayTitle)}</h2>
      <p>${escapeHtml(location.overview)}</p>
      <h3>Talking points</h3>
      <ul>${talkingPointsHtml}</ul>
    </article>
  `;
}

function splitTalkingPoints(rawValue = "") {
  return rawValue
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^•\s*/, ""))
    .filter(Boolean);
}

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCsv(csvText) {
  const normalized = csvText.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((cols) => {
    const out = {};
    headers.forEach((header, i) => {
      out[header.trim()] = cols[i] ?? "";
    });
    return out;
  });
}
