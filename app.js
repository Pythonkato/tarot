import { tarotCards, positions } from "./tarot.js";

const state = {
  seed: null,
  revEnabled: false,
  historyEnabled: true,
  drawn: [],
  flippedCount: 0,
  isBusy: false,
  name: ""
};

const elements = {
  shuffleStatus: document.querySelector("[data-shuffle-status]"),
  spread: document.querySelector("[data-spread]") ,
  story: document.querySelector("[data-story]") ,
  storyText: document.querySelector("[data-story-text]"),
  urlOutput: document.querySelector("[data-url-output]"),
  copyUrlButton: document.querySelector("[data-copy-url]"),
  shuffleButton: document.querySelector("[data-shuffle]") ,
  revToggle: document.querySelector("[data-rev-toggle]") ,
  historyToggle: document.querySelector("[data-history-toggle]") ,
  historyList: document.querySelector("[data-history-list]") ,
  nameInput: document.querySelector("[data-name]")
};

const HISTORY_KEY = "past-life-tarot-history";

const xmur3 = (str) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const getSeededRandom = (seedValue) => {
  const seedNumber = typeof seedValue === "number" ? seedValue : xmur3(String(seedValue))();
  return mulberry32(seedNumber);
};

const shuffleArray = (array, rand) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const generateSeed = () => Math.floor(Math.random() * 1_000_000_000);

const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: params.get("seed"),
    rev: params.get("rev"),
    name: params.get("name")
  };
};

const buildResultUrl = (seed, revEnabled, name) => {
  const params = new URLSearchParams();
  params.set("seed", seed);
  if (revEnabled) {
    params.set("rev", "1");
  }
  if (name) {
    params.set("name", name);
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

const saveHistory = (entry) => {
  if (!state.historyEnabled) {
    return;
  }
  const history = loadHistory();
  const updated = [entry, ...history.filter((item) => item.seed !== entry.seed)];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 10)));
};

const loadHistory = () => {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const renderHistory = () => {
  const history = loadHistory();
  elements.historyList.innerHTML = "";
  if (!history.length) {
    elements.historyList.innerHTML = "<p class=\"muted\">まだ履歴がありません。</p>";
    return;
  }
  history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const label = document.createElement("div");
    label.className = "history-label";
    const date = new Date(item.timestamp).toLocaleString("ja-JP");
    label.innerHTML = `<strong>${item.name || "あなた"}</strong>・${date}<br><span class=\"muted\">seed ${item.seed}</span>`;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "ghost-button";
    openButton.textContent = "この結果を開く";
    openButton.addEventListener("click", () => {
      window.location.href = item.url;
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "ghost-button";
    copyButton.textContent = "URLコピー";
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.url);
      copyButton.textContent = "コピー済み";
      setTimeout(() => {
        copyButton.textContent = "URLコピー";
      }, 1500);
    });

    actions.append(openButton, copyButton);
    row.append(label, actions);
    elements.historyList.append(row);
  });
};

const buildStory = (drawn) => {
  const [role, environment, gift, pattern, key] = drawn;
  const name = state.name ? `${state.name}さん` : "あなた";
  return `${name}の前世は、「${role.card.name}」のように${role.text.scene} ${environment.text.scene} そこでは${gift.text.scene}ことが大きな光となり、今世には${gift.text.influence}として残っています。\n\nしかし${pattern.text.scene}という影が重なり、今世でも${pattern.text.influence}が現れやすいようです。だからこそ、今世の鍵は「${key.card.name}」が示すように${key.text.scene}。${key.text.influence}と信じて、${key.text.actions[0]}から始めてみてください。\n\n過去はあなたを縛るためではなく、あなたの味方としてそっと寄り添うもの。今は小さな選択の積み重ねで、未来の景色が変わっていきます。`;
};

const createCardElement = (item, position) => {
  const card = document.createElement("div");
  card.className = "tarot-card";
  card.setAttribute("data-position", position.id);

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">
        <div class="card-back-image" aria-hidden="true"></div>
        <span class="card-back-label">${position.label}</span>
      </div>
      <div class="card-face card-front">
        <div class="card-front-media">
          <img src="assets/cards/${item.card.id}.webp" alt="${item.card.name}" loading="lazy" />
          <span class="card-front-placeholder">${item.card.name}</span>
        </div>
        <div class="card-front-body">
          <div class="card-front-heading">
            <p class="position-label">${position.label}</p>
            <h3>${item.card.name}<span>${item.card.name_en}</span></h3>
            <span class="badge ${item.isReversed ? "reversed" : "upright"}">${item.isReversed ? "逆位置" : "正位置"}</span>
          </div>
          <div class="keyword-row">
            ${(item.isReversed ? item.card.keywords_reversed : item.card.keywords_upright)
              .map((word) => `<span>${word}</span>`)
              .join("")}
          </div>
          <div class="card-section">
            <h4>前世の情景</h4>
            <p>${item.text.scene}</p>
          </div>
          <div class="card-section">
            <h4>今に残る影響</h4>
            <p>${item.text.influence}</p>
          </div>
          <div class="card-section">
            <h4>今世のアクション</h4>
            <ul>${item.text.actions.map((action) => `<li>${action}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
    </div>
  `;

  const image = card.querySelector(".card-front-media img");
  const media = card.querySelector(".card-front-media");
  image.addEventListener("error", () => {
    media.classList.add("missing");
    image.remove();
  });

  return card;
};

const revealStoryIfReady = () => {
  if (state.flippedCount < positions.length) {
    return;
  }
  elements.storyText.textContent = buildStory(state.drawn);
  elements.story.classList.add("visible");
};

const handleCardClick = (cardElement) => {
  if (state.isBusy || cardElement.classList.contains("flipped")) {
    return;
  }
  cardElement.classList.add("flipped");
  state.flippedCount += 1;
  cardElement.setAttribute("aria-pressed", "true");
  if (state.flippedCount === positions.length) {
    revealStoryIfReady();
  }
};

const renderSpread = () => {
  elements.spread.innerHTML = "";
  state.flippedCount = 0;
  elements.story.classList.remove("visible");

  state.drawn.forEach((item, index) => {
    const position = positions[index];
    const cardElement = createCardElement(item, position);
    cardElement.addEventListener("click", () => handleCardClick(cardElement));
    cardElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardClick(cardElement);
      }
    });
    cardElement.setAttribute("role", "button");
    cardElement.setAttribute("tabindex", "0");
    cardElement.setAttribute("aria-pressed", "false");
    elements.spread.append(cardElement);
  });
};

const drawCards = (seed) => {
  const rand = getSeededRandom(seed);
  const shuffled = shuffleArray(tarotCards, rand).slice(0, positions.length);
  state.drawn = shuffled.map((card, index) => {
    const isReversed = state.revEnabled ? rand() < 0.33 : false;
    const position = positions[index];
    const text = card.positions[position.id];
    return { card, isReversed, text };
  });
};

const runShuffle = (seed) => {
  state.isBusy = true;
  elements.shuffleStatus.classList.add("active");
  setTimeout(() => {
    drawCards(seed);
    renderSpread();
    elements.shuffleStatus.classList.remove("active");
    state.isBusy = false;
  }, 1000);
};

const updateUrlSection = () => {
  const url = buildResultUrl(state.seed, state.revEnabled, state.name);
  elements.urlOutput.value = url;
};

const saveCurrentHistory = () => {
  const url = buildResultUrl(state.seed, state.revEnabled, state.name);
  saveHistory({
    seed: state.seed,
    rev: state.revEnabled,
    name: state.name,
    timestamp: Date.now(),
    url
  });
  renderHistory();
};

const initializeFromParams = () => {
  const { seed, rev, name } = getUrlParams();
  if (name) {
    state.name = decodeURIComponent(name);
    elements.nameInput.value = state.name;
  }
  if (rev === "1") {
    state.revEnabled = true;
    elements.revToggle.checked = true;
  }
  if (seed) {
    state.seed = Number(seed);
  }
};

const startReading = (seedOverride) => {
  state.seed = seedOverride ?? generateSeed();
  updateUrlSection();
  runShuffle(state.seed);
  saveCurrentHistory();
};

const bindEvents = () => {
  elements.shuffleButton.addEventListener("click", () => {
    startReading();
  });

  elements.revToggle.addEventListener("change", (event) => {
    state.revEnabled = event.target.checked;
    startReading(state.seed ?? generateSeed());
  });

  elements.historyToggle.addEventListener("change", (event) => {
    state.historyEnabled = event.target.checked;
    if (!state.historyEnabled) {
      localStorage.removeItem(HISTORY_KEY);
    }
    renderHistory();
  });

  elements.copyUrlButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(elements.urlOutput.value);
    elements.copyUrlButton.textContent = "コピー済み";
    setTimeout(() => {
      elements.copyUrlButton.textContent = "結果URLをコピー";
    }, 1500);
  });

  elements.nameInput.addEventListener("input", (event) => {
    state.name = event.target.value.trim();
    updateUrlSection();
  });
};

initializeFromParams();
bindEvents();
renderHistory();

if (state.seed) {
  startReading(state.seed);
} else {
  startReading();
}
