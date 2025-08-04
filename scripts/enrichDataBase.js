require('dotenv').config();
const bot = require('../services/bot.service');
const dataBaseService = require("../services/dataBase.service");

(async () => {
    const hostIds = await dataBaseService.getHostIds();
    const ids = hostIds.map(item => item.user_id);

    for (const userId of ids) {
        try {
            const chat = await bot.getChat(userId);
            const { first_name, last_name, username } = chat;
            console.log(`✅ ${userId}: ${first_name} ${last_name || ''} (@${username || '-'})`);
            const firstName = first_name ?? '';
            const lastName = last_name ?? '';
            await dataBaseService.enrichHost(userId, firstName, lastName);
        } catch (err) {
            console.warn(`⚠️ ${userId}: ${err.message}`);
        }
    }
})();

