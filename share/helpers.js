const callbackStore = new Map();
let counter = 1;

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


module.exports = {
    encodeCallbackData,
    decodeCallbackData,
    escapeMarkdown,
}
