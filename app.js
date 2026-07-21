const STORAGE_KEY = "randomOperatorSheet";
const OPTIONS_STORAGE_KEY = "randomOperatorSheetOptions";
const OPERATOR_IMAGE_DIR = "image/";
const RARITIES = [6, 5, 4, 3, 2, 1];

const countInput = document.querySelector("#operator-count");
const seedInput = document.querySelector("#seed-input");
const seedDisplay = document.querySelector("#seed-display");
const copySeedButton = document.querySelector("#copy-seed-button");
const generateButton = document.querySelector("#generate-button");
const resetButton = document.querySelector("#reset-button");
const optionsButton = document.querySelector("#options-button");
const optionsDialog = document.querySelector("#options-dialog");
const clearOptionsButton = document.querySelector("#clear-options-button");
const optionsNotice = document.querySelector("#options-notice");
const classToggles = document.querySelector("#class-toggles");
const operatorList = document.querySelector("#operator-list");
const progress = document.querySelector("#progress");
const notice = document.querySelector("#notice");
const operatorTemplate = document.querySelector("#operator-template");

let sheet = null;
let selectionOptions = {
  rarities: Object.fromEntries(RARITIES.map((rarity) => [rarity, true])),
  classes: Object.fromEntries(OPERATOR_CLASSES.map((className) => [className, true])),
  minimums: Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]))
};

function createDefaultSelectionOptions() {
  return {
    rarities: Object.fromEntries(RARITIES.map((rarity) => [rarity, true])),
    classes: Object.fromEntries(OPERATOR_CLASSES.map((className) => [className, true])),
    minimums: Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]))
  };
}

function buildClassToggles() {
  classToggles.replaceChildren();
  OPERATOR_CLASSES.forEach((className) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.classToggle = className;
    input.checked = true;
    label.append(input, document.createTextNode(className));
    classToggles.append(label);
  });
}

function isOperatorSelectable(operator) {
  return (
    selectionOptions.rarities[operator.rarity] && selectionOptions.classes[operator.class]
  );
}

function getOperatorImageSrc(operator) {
  const fileName = operator.image || `${operator.id}.png`;
  return `${OPERATOR_IMAGE_DIR}${fileName}`;
}

function saveSheet() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
}

function showNotice(message = "") {
  notice.textContent = message;
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function createSelection(count) {
  const enabledRarities = RARITIES.filter((rarity) => selectionOptions.rarities[rarity]);
  const enabledClasses = OPERATOR_CLASSES.filter(
    (className) => selectionOptions.classes[className]
  );
  const minimumTotal = enabledRarities.reduce(
    (total, rarity) => total + selectionOptions.minimums[rarity],
    0
  );

  if (enabledRarities.length === 0) {
    throw new Error("選出対象のレアリティを1つ以上選択してください。");
  }
  if (enabledClasses.length === 0) {
    throw new Error("選出対象の職分を1つ以上選択してください。");
  }
  if (minimumTotal > count) {
    throw new Error("レアリティごとの最低人数の合計が抽選人数を超えています。");
  }

  const pool = OPERATOR_DATA.filter(isOperatorSelectable);
  const selected = [];
  for (const rarity of enabledRarities) {
    const candidates = shuffle(pool.filter((operator) => operator.rarity === rarity));
    const minimum = selectionOptions.minimums[rarity];
    if (minimum > candidates.length) {
      throw new Error(`☆${rarity}の最低人数が条件に合うオペレーター数を超えています。`);
    }
    selected.push(...candidates.slice(0, minimum));
  }

  const selectedIds = new Set(selected.map((operator) => operator.id));
  const remainingCandidates = shuffle(
    pool.filter((operator) => !selectedIds.has(operator.id))
  );
  const needed = count - selected.length;

  if (needed > remainingCandidates.length) {
    throw new Error("条件に合うオペレーター数が抽選人数に足りません。");
  }

  return shuffle([...selected, ...remainingCandidates.slice(0, needed)]).map((operator) => ({
    id: operator.id,
    used: false
  }));
}

function encodeSheetSeed(sourceSheet) {
  const payload = {
    v: 1,
    o: sourceSheet.operators.map((entry) => [
      OPERATOR_DATA.findIndex((operator) => operator.id === entry.id),
      Number(entry.used)
    ])
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const binary = String.fromCharCode(...bytes);
  return `v1.${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

function refreshSheetSeed() {
  if (!sheet) return;
  sheet.seed = encodeSheetSeed(sheet);
  seedDisplay.value = sheet.seed;
}

function decodeSheetSeed(value) {
  if (!value.startsWith("v1.")) return null;

  try {
    const encoded = value.slice(3).replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    if (
      payload.v !== 1 ||
      !Array.isArray(payload.o) ||
      payload.o.length === 0 ||
      payload.o.some(
        ([index, used]) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= OPERATOR_DATA.length ||
          (used !== 0 && used !== 1)
      ) ||
      new Set(payload.o.map(([index]) => index)).size !== payload.o.length
    ) {
      return null;
    }

    return {
      count: payload.o.length,
      seed: value,
      createdAt: new Date().toISOString(),
      operators: payload.o.map(([index, used]) => ({
        id: OPERATOR_DATA[index].id,
        used: Boolean(used)
      }))
    };
  } catch {
    return null;
  }
}

function getOperator(id) {
  return OPERATOR_DATA.find((operator) => operator.id === id);
}

function applyOptionsToDialog() {
  RARITIES.forEach((rarity) => {
    const toggle = document.querySelector(`[data-rarity-toggle="${rarity}"]`);
    const minimum = document.querySelector(`[data-rarity-minimum="${rarity}"]`);
    toggle.checked = selectionOptions.rarities[rarity];
    minimum.value = selectionOptions.minimums[rarity];
    minimum.disabled = !toggle.checked;
  });

  OPERATOR_CLASSES.forEach((className) => {
    const toggle = document.querySelector(`[data-class-toggle="${className}"]`);
    if (toggle) toggle.checked = selectionOptions.classes[className];
  });
}

function readOptionsFromDialog() {
  const rarities = {};
  const classes = {};
  const minimums = {};

  RARITIES.forEach((rarity) => {
    const toggle = document.querySelector(`[data-rarity-toggle="${rarity}"]`);
    const minimum = document.querySelector(`[data-rarity-minimum="${rarity}"]`);
    rarities[rarity] = toggle.checked;
    minimums[rarity] = toggle.checked
      ? Math.max(0, Number.parseInt(minimum.value, 10) || 0)
      : 0;
  });

  OPERATOR_CLASSES.forEach((className) => {
    const toggle = document.querySelector(`[data-class-toggle="${className}"]`);
    classes[className] = Boolean(toggle?.checked);
  });

  return { rarities, classes, minimums };
}

function saveSelectionOptions() {
  selectionOptions = readOptionsFromDialog();
  localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(selectionOptions));
  updateOptionsButton();
}

function updateOptionsButton() {
  const hasRestrictedRarity = RARITIES.some(
    (rarity) => !selectionOptions.rarities[rarity] || selectionOptions.minimums[rarity] > 0
  );
  const hasRestrictedClass = OPERATOR_CLASSES.some(
    (className) => !selectionOptions.classes[className]
  );
  optionsButton.classList.toggle("is-active", hasRestrictedRarity || hasRestrictedClass);
}

function loadSelectionOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY));
    if (!saved || !saved.rarities || !saved.minimums) return;

    RARITIES.forEach((rarity) => {
      if (typeof saved.rarities[rarity] === "boolean") {
        selectionOptions.rarities[rarity] = saved.rarities[rarity];
      }
      if (Number.isInteger(saved.minimums[rarity]) && saved.minimums[rarity] >= 0) {
        selectionOptions.minimums[rarity] = saved.minimums[rarity];
      }
    });

    if (saved.classes) {
      OPERATOR_CLASSES.forEach((className) => {
        if (typeof saved.classes[className] === "boolean") {
          selectionOptions.classes[className] = saved.classes[className];
        }
      });
    }

    updateOptionsButton();
  } catch {
    localStorage.removeItem(OPTIONS_STORAGE_KEY);
  }
}

function render() {
  operatorList.replaceChildren();

  if (!sheet || sheet.operators.length === 0) {
    operatorList.innerHTML = '<p class="empty-state">抽選人数を入力して「生成する」を押してください。</p>';
    progress.textContent = "まだ生成されていません";
    seedDisplay.value = "";
    return;
  }

  const usedCount = sheet.operators.filter((operator) => operator.used).length;
  progress.textContent = `${sheet.operators.length}人中 ${usedCount}人使用済み`;
  seedDisplay.value = sheet.seed;

  sheet.operators.forEach((entry) => {
    const operator = getOperator(entry.id);
    if (!operator) return;

    const card = operatorTemplate.content.firstElementChild.cloneNode(true);
    const rarityLabel = "★".repeat(operator.rarity);

    card.dataset.id = operator.id;
    card.classList.add(`rarity-${operator.rarity}`);
    card.classList.toggle("is-used", entry.used);
    card.setAttribute("aria-pressed", String(entry.used));
    card.setAttribute(
      "aria-label",
      `${operator.name}、${operator.class}、${rarityLabel}。${entry.used ? "使用済み。クリックして未使用に戻す" : "未使用。クリックして使用済みにする"}`
    );
    card.querySelector(".operator-name").textContent = operator.name;
    card.querySelector(".operator-class").textContent = operator.class;
    card.querySelector(".operator-rarity").textContent = rarityLabel;
    card.querySelector(".operator-rarity").setAttribute("aria-label", `レアリティ${operator.rarity}`);

    const image = card.querySelector(".operator-image");
    image.alt = "";
    image.hidden = false;
    card.classList.add("has-image");
    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        image.removeAttribute("src");
        card.classList.remove("has-image");
      },
      { once: true }
    );
    image.src = getOperatorImageSrc(operator);

    operatorList.append(card);
  });
}

function generate() {
  const seed = seedInput.value.trim();

  if (seed) {
    const restoredSheet = decodeSheetSeed(seed);
    if (!restoredSheet) {
      showNotice("シード値を読み込めません。コピーしたシード値をそのまま貼り付けてください。");
      seedInput.focus();
      return;
    }

    sheet = restoredSheet;
    countInput.value = sheet.count;
    seedInput.value = "";
    saveSheet();
    showNotice("シード値からシートを復元しました。");
    render();
    return;
  }

  const count = Number.parseInt(countInput.value, 10);

  if (!Number.isInteger(count) || count < 1) {
    showNotice("抽選人数は1人以上で入力してください。");
    countInput.focus();
    return;
  }

  const selectableCount = OPERATOR_DATA.filter(isOperatorSelectable).length;
  if (selectableCount === 0) {
    showNotice("条件に合うオペレーターがいません。オプションを確認してください。");
    return;
  }

  const actualCount = Math.min(count, selectableCount);
  let operators;
  try {
    operators = createSelection(actualCount);
  } catch (error) {
    showNotice(error.message);
    return;
  }

  sheet = {
    count: actualCount,
    seed: "",
    createdAt: new Date().toISOString(),
    operators
  };
  countInput.value = actualCount;
  seedInput.value = "";
  refreshSheetSeed();
  saveSheet();
  showNotice(
    count > selectableCount
      ? `条件に合う${selectableCount}人をすべて選出しました。`
      : `${actualCount}人を新しく選出しました。`
  );
  render();
}

function resetUsage() {
  if (!sheet) {
    showNotice("リセットする抽選結果がありません。");
    return;
  }

  sheet.operators.forEach((operator) => {
    operator.used = false;
  });
  seedInput.value = "";
  refreshSheetSeed();
  saveSheet();
  showNotice("使用状況をリセットしました。");
  render();
}

function loadSheet() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      saved &&
      Number.isInteger(saved.count) &&
      Array.isArray(saved.operators) &&
      saved.operators.every(
        (operator) =>
          typeof operator.id === "string" &&
          typeof operator.used === "boolean" &&
          getOperator(operator.id)
      )
    ) {
      sheet = saved;
      refreshSheetSeed();
      countInput.value = saved.count;
      showNotice("前回の抽選結果を復元しました。");
    } else if (saved) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function copySeed() {
  if (!sheet) {
    showNotice("コピーするシード値がありません。");
    return;
  }

  try {
    await navigator.clipboard.writeText(sheet.seed);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = sheet.seed;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showNotice("シード値をクリップボードにコピーしました。");
}

generateButton.addEventListener("click", generate);
resetButton.addEventListener("click", resetUsage);
copySeedButton.addEventListener("click", copySeed);
optionsButton.addEventListener("click", () => {
  optionsNotice.textContent = "";
  applyOptionsToDialog();
  optionsDialog.showModal();
});

optionsDialog.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveSelectionOptions();
  optionsDialog.close();
  showNotice("抽選条件を保存しました。");
});

clearOptionsButton.addEventListener("click", () => {
  selectionOptions = createDefaultSelectionOptions();
  applyOptionsToDialog();
  optionsNotice.textContent = "初期値に戻しました。保存すると反映されます。";
});

document.querySelectorAll("[data-rarity-toggle]").forEach((toggle) => {
  toggle.addEventListener("change", () => {
    const minimum = document.querySelector(`[data-rarity-minimum="${toggle.dataset.rarityToggle}"]`);
    minimum.disabled = !toggle.checked;
    if (!toggle.checked) minimum.value = 0;
  });
});

countInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") generate();
});

seedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") generate();
});

operatorList.addEventListener("click", (event) => {
  const card = event.target.closest(".operator-card");
  if (!card || !sheet) return;

  const entry = sheet.operators.find((operator) => operator.id === card.dataset.id);
  if (!entry) return;

  entry.used = !entry.used;
  seedInput.value = "";
  refreshSheetSeed();
  saveSheet();
  showNotice(entry.used ? "使用済みにしました。" : "未使用に戻しました。");
  render();
});

const announcementButton = document.querySelector("#announcement-button");
const announcementPanel = document.querySelector("#announcement-panel");

function renderAnnouncements() {
  const items = Array.isArray(ANNOUNCEMENTS) ? ANNOUNCEMENTS.filter(Boolean) : [];
  announcementPanel.replaceChildren();

  if (items.length === 0) {
    announcementButton.hidden = true;
    setAnnouncementOpen(false);
    return;
  }

  announcementButton.hidden = false;
  items.forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    announcementPanel.append(paragraph);
  });
}

function setAnnouncementOpen(open) {
  announcementButton.setAttribute("aria-expanded", String(open));
  announcementPanel.hidden = !open;
}

announcementButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setAnnouncementOpen(announcementPanel.hidden);
});

document.addEventListener("click", (event) => {
  if (announcementPanel.hidden) return;
  if (event.target.closest(".announcement")) return;
  setAnnouncementOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !announcementPanel.hidden) {
    setAnnouncementOpen(false);
    announcementButton.focus();
  }
});

buildClassToggles();
loadSelectionOptions();
applyOptionsToDialog();
loadSheet();
renderAnnouncements();
render();
