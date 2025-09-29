const fs = require('fs');

const paths = require('../share/paths');
const HostsService = require('./hosts.service');
const DayOffService = require('./dayOff.service');
const dataBaseService = require('./dataBase.service');

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

// Список отпускных эмодзи
emojis = ["🏖️", "🍹", "🌊", "🕶️", "🌺", "☀️", "🌴", "🍍", "🏝️", "🌸"]

class GeneralService {
    bot = undefined;

    setBot(bot) {
        this.bot = bot;
    }

    async chooseNewBotName() {
        try {
            const data = await dataBaseService.getHosts();
            const maxObj = data.reduce((max, current) => {
                return current.hosted_daily > max.hosted_daily ? current : max;
            }, { hosted_daily: -Infinity });
            const name = maxObj.first_name ?? maxObj.last_name;
            const currentMonth = new Date().toLocaleDateString('ru', { month: 'long' });

            await this.bot.sendMessage(process.env.CHAT_ID, `‼️В прошлом месяце больше всех был(а) ведущим - ${name}.\n\n✨🔭 Астрологи объявили ${currentMonth} именем <b>${name}</b>.`, {
                parse_mode: 'HTML',
            })
            await this.bot.setMyName({ name: `Выбери ${maxObj.first_name} ведущим` });
            await this.bot.sendSticker(process.env.CHAT_ID, 'CAACAgIAAxkBAAIURmjS_tqTtz7JwCBcM9krif_OmHEzAAIzFAACh8YhSLgqPYszxtqjNgQ');
        } catch (e) {
            console.log('GeneralService: Ошибка выбора нового имени бота', e);
        }
    }

    async daily() {
        try {
            const teamList = await hostsService.hostsWithoutVacations();
            const data = await this.onVacationUsersData();

            const onVacationString = data.map((item) => {
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                return `${emoji} ${item.onlyName}\n`;
            }).join(',').replace(',', '');
            const teamString = teamList.map(item => `@${item.user_name}`).join(', ');
            const vacations = onVacationString.length ? `🌴 **Сегодня в отпуске:**\n\n${onVacationString}` : '';

            const message = `☀️ **Доброе утро!**\n
🔗 **[Дейли](${process.env.DAILY_URL})**\n
${teamString}\n
${vacations}`;

            await this.bot.sendMessage(process.env.CHAT_ID, message, {
                parse_mode: 'Markdown'
            });

            if (onVacationString) {
                await this.bot.sendMessage(process.env.CHAT_ID, `🌴🌴☀️Сегодня в отпуске ☀️🌴🌴:\n\n${onVacationString}`);
            }
            await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.dailyRandomSticker);
        } catch (e) {
            console.log('GeneralService: Ошибка отправки сообщения о том, что нужно идти на дейли', e);
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
            console.log(`GeneralService: Ошибка отправки сообщения пользователю, что он ведущий - ${e}`);
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
                console.log('GeneralService: Ошибка отправки сообщения, выбранного ведущего дейли', e);
            }
        }
    }

    async closeTasks() {
        try {
            await this.bot.sendMessage(process.env.CHAT_ID, closeTasksText, { parse_mode: 'HTML' });
        } catch (e) {
            console.log('GeneralService: Ошибка отправки сообщения о том, что нужно закрыть задачи', e);
        }
    }

    async getVacations() {
        try {
            const data = await dataBaseService.getVacations();
            return data;
        } catch (e) {
            console.log('GeneralService: Ошибка получения данных отпускников из базы ' + e);
        }
    }

    async onVacationUsersData() {
        const vacations = await this.getVacations();
        const data = [];

        for (const item of vacations) {
            const user = await hostsService.findHost(item.user_id);
            const firstName = user.first_name ? user.first_name : '';
            const lastName = user.last_name ? ` ${user.last_name}` : '';
            const name = `${firstName}${lastName} (@${item.user_name})`;
            const onlyName = `${firstName}${lastName}`;
            const date = `с ${item.start_date} по ${item.end_date}`;

            data.push({ name, onlyName, date });
        }

        return data;
    }
}

module.exports = GeneralService;
