const fs = require('fs');

const paths = require('../share/paths');
const HostsService = require('./hosts.service');
const DayOffService = require('./dayOff.service');

const dayOffService = new DayOffService('https://isdayoff.ru/');
const hostsService = new HostsService();

const closeTasksText = `
Не забудьте закрыть задачи 📝 (примерно на 1–2 дня) 😉!

Отвлекись и сходи закрой задачи, но не забудь основные правила:

<blockquote>
• Закрывать задачи нужно до 16:00;
• В пятницу вечером задачи брать нельзя — задачу нельзя закрыть и сразу брать в работу новые;
• Новые берем в работу только с утра.
</blockquote>

Ты закрываешь задачи - ИТ лид счастлив. Ты этого не делаешь - ИТ лид делает тебе попаболь!
`;

class GeneralService {
    bot = undefined;

    setBot(bot) {
        this.bot = bot;
    }

    async daily() {
        try {
            const teamList = await hostsService.hostsWithoutVacations();
            const teamString = teamList.map(item => `@${item.user_name}`).join(', ');
            await this.bot.sendMessage(process.env.CHAT_ID, `Доброе утро! Дейли - ${process.env.DAILY_URL}\n${teamString}`);
            await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.dailyRandomSticker);
        } catch (e) {
            console.log('Ошибка отправки сообщения о том, что нужно идти на дейли', e);
        }
    }

    async youAreHost() {
        try {
            const currentHost = await hostsService.prevHost();
            await this.bot.sendMessage(process.env.CHAT_ID, `⚡️Сегодня дейли ведёт @${currentHost[0].user_name}`);

            if (!fs.existsSync(paths.stickers.hello)) {
                console.error('❌ Гифка не найдена по пути:', paths.stickers.hello);
                return;
            }

            const gifStream = fs.createReadStream(paths.stickers.hello);

            gifStream.on('open', async () => {
                try {
                    await this.bot.sendAnimation(currentHost[0].user_id, gifStream, {
                        caption: 'Бу! Ты сегодня ведущий.',
                    });
                    console.log('✅ Пользователь успешно уведомлён');
                } catch (err) {
                    console.error('❌ Ошибка уведомления пользователя:', err);
                }
            });

            gifStream.on('error', (err) => {
                console.error('❌ Ошибка чтения файла гифки:', err);
            });
        } catch (e) {
            console.log(`Ошибка отправки сообщения пользователю, что он ведущий - ${e}`);
        }
    }

    async chooseHost() {
        const isDayOff = await dayOffService.isDayOff();
        if (!isDayOff) {
            const how = dayOffService.dayOfWeek === 5 ? 'В понедельник' : 'Завтра';

            try {
                const randomHost = await hostsService.randomHost();
                if (randomHost) {
                    await this.bot.sendMessage(process.env.CHAT_ID, `${how} дейли ведёт @${randomHost.user_name}`);
                    if (randomHost.user_name === process.env.EASTER_EGG_NICKNAME) {
                        await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.easterEgg);
                        await this.bot.sendVoice(process.env.CHAT_ID, paths.voices.easterEgg);
                    } else {
                        await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.host);
                    }
                }
            } catch (e) {
                console.log('Ошибка отправки сообщения, выбранного ведущего дейли', e);
            }
        }
    }

    async closeTasks() {
        try {
            await this.bot.sendMessage(process.env.CHAT_ID, closeTasksText, { parse_mode: 'HTML' });
        } catch (e) {
            console.log('Ошибка отправки сообщения о том, что нужно закрыть задачи', e);
        }
    }
}

module.exports = GeneralService;
