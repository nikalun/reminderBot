const callbackStore = new Map();
let counter = 1;

// Список отпускных эмодзи
emojis = ["🏖️", "🍹", "🌊", "🕶️", "🌺", "☀️", "🌴", "🍍", "🏝️", "🌸"];

/**
 * Кодирование объекта в callback_data
 */
function encodeCallbackData(obj) {
    const json = JSON.stringify(obj);

    // Если json помещается в лимит Telegram (64 байта) — возвращаем напрямую
    if (Buffer.byteLength(json, "utf8") <= 64) {
        return json;
    }

    // Если длинный — сохраняем в store и возвращаем короткий ключ
    const key = "cb_" + counter++;
    callbackStore.set(key, obj);
    return key;
}

function decodeCallbackData(data) {
    if (data.startsWith("cb_")) {
        return callbackStore.get(data);
    }

    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

/**
 * Экранирование символов для MarkdownV2
 * @param text
 * @returns {*}
 */
function escapeMarkdown(text) {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Сегодня находится между 2 дат
 * @param startDate
 * @param endDate
 * @returns {boolean}
 */
function isTodayBetween(startDate, endDate) {
    const today = new Date();
    // убираем время у сегодняшней даты
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const start = parseDateDMY(startDate);
    const end = parseDateDMY(endDate);

    return current >= start && current <= end;
}

function parseDateDMY(dateStr) {
    // Разбиваем строку "DD-MM-YYYY"
    const [day, month, year] = dateStr?.split("-")?.map(Number);
    // month - 1, потому что в JS месяцы с 0
    return new Date(year, month - 1, day);
}

/**
 * Получаем рандомную иконку отпуска
 * @returns {*}
 */
function getRandomVacationEmoji() {
    return emojis[Math.floor(Math.random() * emojis.length)];
}


module.exports = {
    encodeCallbackData,
    decodeCallbackData,
    escapeMarkdown,
    isTodayBetween,
    getRandomVacationEmoji,
    parseDateDMY,
}
