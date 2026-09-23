const fs = require('fs');

const paths = require('../share/paths');
const { escapeMarkdown, isTodayBetween, getRandomVacationEmoji} = require('../share/helpers');
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

const closeTaskSecondText = 'Задачи все закрыли?)';

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

            await this.resetFieldHostedDaily();
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
            const isTodayDayOff = await dayOffService.checkDateDayOff(new Date());
            if (!isTodayDayOff) {
                const teamList = await hostsService.hostsWithoutVacations();
                const data = await this.onVacationUsersData();

                const onVacationString = data
                    .map((item) => {
                        const emoji = getRandomVacationEmoji();
                        return `${emoji} ${escapeMarkdown(item.name)}\n`;
                    })
                    .join('');

                const teamString = teamList.map(item => `@${escapeMarkdown(item.user_name)}`).join(', ');
                const vacations = onVacationString.length ? `🌴 *Сегодня в отпуске:*\n\n${onVacationString}` : '';

                const message = `☀️${escapeMarkdown("Доброе утро!")}\n
🔗 *[Дейли](${escapeMarkdown(process.env.DAILY_URL)})*\n
${teamString}\n
${vacations}`;

                await this.bot.sendMessage(process.env.CHAT_ID, message, {
                    parse_mode: 'MarkdownV2'
                });
                await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.dailyRandomSticker);
            }
        } catch (e) {
            console.log('GeneralService: Ошибка отправки сообщения о том, что нужно идти на дейли', e);
        }
    }

    async youAreHost() {
        try {
            const isTodayDayOff = await dayOffService.checkDateDayOff(new Date());

            if (!isTodayDayOff) {
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
            }
        } catch (e) {
            console.log(`GeneralService: Ошибка отправки сообщения пользователю, что он ведущий - ${e}`);
        }
    }

    async resetFieldHostedDaily() {
        await hostsService.resetFieldHostedDaily();
    }

    async chooseHost() {
        try {
            const isTodayDayOff = await dayOffService.checkDateDayOff(new Date());
            if (!isTodayDayOff) {
                const how = await dayOffService.how();
                const randomHost = await hostsService.randomHost();

                if (randomHost) {
                    await this.bot.sendMessage(process.env.CHAT_ID, `${how} дейли ведёт @${randomHost.user_name}`, {
                        parse_mode: 'HTML'
                    });
                    if (randomHost.user_name === process.env.EASTER_EGG_NICKNAME) {
                        await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.easterEgg);
                        await this.bot.sendVoice(process.env.CHAT_ID, paths.voices.easterEgg);
                    } else {
                        await this.bot.sendSticker(process.env.CHAT_ID, paths.stickers.host);
                    }
                }
            }

        } catch (e) {
            console.log('GeneralService: Ошибка отправки сообщения, выбранного ведущего дейли', e);
        }
    }

    async closeTasks() {
        try {
            const isTodayDayOff = await dayOffService.checkDateDayOff(new Date());
            if (!isTodayDayOff) {
                await this.bot.sendMessage(process.env.CHAT_ID, closeTasksText, { parse_mode: 'HTML' });
            }
        } catch (e) {
            console.log('GeneralService: Ошибка отправки сообщения о том, что нужно закрыть задачи', e);
        }
    }

    async closeTasksSecond() {
        try {
            const isTodayDayOff = await dayOffService.checkDateDayOff(new Date());
            if (!isTodayDayOff) {
                const teamList = await hostsService.hostsWithoutVacations();
                const teamString = teamList.map(item => `@${escapeMarkdown(item.user_name)}`).join(', ');

                await this.bot.sendSticker(process.env.CHAT_ID, 'CAACAgIAAxkBAAEuhphqoCjSW2Aep2s3Q4FRnZIqYOyJbgAC0goAAlhn8UpuzluC140K7D0E');
                await this.bot.sendMessage(process.env.CHAT_ID, `${closeTaskSecondText}\n${teamString}`, { parse_mode: 'MarkdownV2' });
            }
        } catch (e) {
            console.log('GeneralService: Ошибка отправки второго сообщения о том, что нужно закрыть задачи', e);
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

            if (isTodayBetween(item.start_date, item.end_date)) {
                const firstName = user.first_name ? user.first_name : '';
                const lastName = user.last_name ? ` ${user.last_name}` : '';
                const name = `${firstName}${lastName}`;

                data.push({ name, userName: item.user_name, startDate: item.start_date, endDate: item.end_date });
            }
        }

        return data;
    }

    async deleteHostPermanently(userId, chatId, name) {
        try {
            await dataBaseService.deleteHostPermanently(userId);
            const text = `Пользователь ${name} был удалён из списка ведущих. Благодарим за службу!`;
            const sticker = paths.stickers.pressF;
            if (chatId === Number(process.env.CHAT_ID)) {
                // Отправляем в общий чат
                await this.bot.sendMessage(process.env.CHAT_ID, text);
                await this.bot.sendSticker(process.env.CHAT_ID, sticker);
            } else {
                // Отправляем в общий чат
                await this.bot.sendMessage(process.env.CHAT_ID, text);
                await this.bot.sendSticker(process.env.CHAT_ID, sticker);

                // Отправляем в личку
                await this.bot.sendMessage(chatId, text);
                await this.bot.sendSticker(chatId, sticker);
            }
        } catch (e) {
            console.log('GeneralService: Ошибка удаления ведущего ' + e);
        }
    }
}

module.exports = GeneralService;
