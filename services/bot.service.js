const TelegramBot = require('node-telegram-bot-api');
const Calendar = require('telegram-inline-calendar');

const HostsService = require('./hosts.service');
const GeneralService = require('./general.service');

const dataBaseService = require('./dataBase.service');
const paths = require('../share/paths');
const {
    decodeCallbackData,
    encodeCallbackData,
    getRandomVacationEmoji,
    escapeMarkdown,
} = require('../share/helpers');

const hostsService = new HostsService();
const generalService = new GeneralService();

const regex = /^\/([a-zA-Z0-9_]+)(?:@[\w\d_]+)?(?:\s+(.+))?$/;

const commands = [
    {
        command: "start",
        description: "Запуск бота"
    },
    {
        command: "add",
        description: "добавиться к боту в список, для ведения дейли"
    },
    {
        command: "delete",
        description: "удалиться из списка ведущих дейли"
    },
    {
        command: "vacation",
        description: "Пойти в отпуск"
    },
    {
        command: "on_vacation",
        description: "Узнать, кто в отпуске"
    },
    {
        command: "admin",
        description: "Меню администратора"
    }
];

const adminKeyboard = [
    ['Оповестить о дейли', 'Выбрать ведущего', 'Удалить отпуск'],
    ['Переименовать бота', 'Обнулить hosted_daily', 'Удалить пользователя']
];
const dailyAlertKeyboard = [
    ['Всех', 'Ведущего'],
    ['⬅ Назад']
];

class BotService {
    startDate = '';
    endDate = '';
    calendar;
    msg;
    startFlag = false;
    endFlag = false;

    initialize() {
        this.bot = new TelegramBot(process.env.API_KEY_BOT, {
            polling: true,
        });

        this.bot.on('polling_error', (err) => {
            console.error('Polling error:', err.code, err.message);
        });

        this.calendar = new Calendar(this.bot, {
            date_format: 'DD-MM-YYYY',
            language: 'ru'
        });

        this.bot.setMyCommands(commands).then();
        generalService.setBot(this.bot);
    }

    commandProcessing() {
        this.bot.on('message', async (msg) => {
            console.log(msg)
        });
        this.bot.on('text', async msg => {
            const chatType = msg.chat.type;
            const text = msg.text ?? '';

            const match = text.match(regex);
            const isCommand = match?.[1]
                || adminKeyboard.flat().some(item => item.includes(text))
                || dailyAlertKeyboard[0].includes(text)
                || dailyAlertKeyboard[1].includes(text);
            const isMember = this._checkMember(msg);

            if (!isMember) {
                return this.bot.sendMessage(msg.chat.id, '⛔ Ты не состоишь в группе, где разрешено выполнять команды');
            }

            if (isCommand) {
                const command = match?.[1] ?? text;
                const isChatGroup = chatType === 'group' || chatType === 'supergroup';

                switch (command) {
                    case 'add': {
                        if (!isChatGroup) {
                            await this._add(msg);
                        } else {
                            await this.bot.sendMessage(msg.chat.id, 'Эта команда работает только в личном чате со мной.');
                        }
                        break;
                    }
                    case 'delete': {
                        if (!isChatGroup) {
                            await this._delete(msg);
                        } else {
                            await this.bot.sendMessage(msg.chat.id, 'Эта команда работает только в личном чате со мной.');
                        }
                        break;
                    }
                    case 'start': {
                        if (!isChatGroup) {
                            await this._start(msg);
                        } else {
                            await this.bot.sendMessage(msg.chat.id, 'Эта команда работает только в личном чате со мной.');
                        }
                        break;
                    }
                    case 'vacation': {
                        if (!isChatGroup) {
                            await this._vacation(msg);
                        } else {
                            await this.bot.sendMessage(msg.chat.id, 'Эта команда работает только в личном чате со мной.');
                        }
                        break;
                    }
                    case 'on_vacation': {
                        if (isChatGroup) {
                            const data = await generalService.onVacationUsersData();

                            if (!data.length) {
                                await this.bot.sendMessage(msg.chat.id, '✨ Никто не отдыхает, все в строю! 💪');
                                return;
                            }

                            const vacations = data
                                .map(item => {
                                    const name = escapeMarkdown(item.name);
                                    const username = escapeMarkdown(item.userName);
                                    const from = escapeMarkdown(item.startDate);
                                    const to = escapeMarkdown(item.endDate);
                                    const emoji = getRandomVacationEmoji();
                                    return `${emoji} *${name}* ${username}\n📅 ${from} → ${to}\n\n`;
                                })
                                .join('');

                            await this.bot.sendMessage(msg.chat.id, `🌴 Сейчас в отпуске: \n\n${vacations}`, {
                                parse_mode: 'MarkdownV2'
                            });
                            break;
                        } else {
                            await this.bot.sendMessage(msg.chat.id, 'Эта команда работает только в групповом чате.');
                        }
                        break;
                    }
                    case 'admin': {
                        await this._adminMenuMarkup(msg);
                        break;
                    }
                    case 'Оповестить о дейли': {
                        await this._sendButtonMarkup(msg, 'Выберите вариант:', dailyAlertKeyboard);
                        break;
                    }
                    case 'Всех': {
                        await generalService.daily();
                        break;
                    }
                    case 'Ведущего': {
                        await generalService.youAreHost();
                        break;
                    }
                    case '⬅ Назад': {
                        await this._adminMenuMarkup(msg);
                        break;
                    }
                    case 'Выбрать ведущего': {
                        await generalService.chooseHost();
                        break;
                    }
                    case 'Удалить отпуск': {
                        await this._deleteVacationMarkup(msg);
                        break;
                    }
                    case 'Переименовать бота': {
                        await generalService.chooseNewBotName();
                        break;
                    }
                    case 'Обнулить hosted_daily': {
                        await generalService.resetFieldHostedDaily();
                        break;
                    }
                    case 'Удалить пользователя': {
                        await this._deleteHostMarkup(msg);
                        break;
                    }
                    default:
                        break;
                }
            }
        });

        this.bot.on('callback_query', async (query) => {
            this._calendarMessageProcessing(query).then();

            switch (query.data) {
                case 'start_date': {
                    await this._startCalendar(query, 'startFlag');
                    break;
                }
                case 'end_date': {
                    await this._startCalendar(query, 'endFlag');
                    break;
                }
            }

            switch (true) {
                case /^delete_vacation:/.test(query.data): {
                    await this._deleteVacation(query);
                    break;
                }
                case /^delete_host:/.test(query.data): {
                    await this._deleteHost(query);
                    break;
                }
            }
        })
    }

    async _deleteHost(query) {
        try {
            const [_, data] = query.data.split(':');
            const encodeData = decodeCallbackData(data);

            if (encodeData) {
                await generalService.deleteHostPermanently(encodeData.user_id, query.message.chat.id, encodeData.name);
            }
        } catch (e) {
            console.log(`Ошиба удаления пользователя из ведущих ${e}`);
        }
    }

    async _checkMember(msg) {
        try {
            const member = await this.bot.getChatMember(process.env.CHAT_ID, msg.from.id);
            return member.status === 'left' || member.status === 'kicked';
        } catch (e) {
            console.log(`Ошиба проверки пользователя в группе ${e}`);
        }
    }

    async _sendButtonMarkup(msg, text, keyboard) {
        await this.bot.sendMessage(msg.chat.id, text, {
            reply_markup: {
                keyboard,
                resize_keyboard: true
            }
        })
    }

    async _adminMenuMarkup(msg) {
        try {
            if (String(msg.chat.id) === process.env.ADMIN_ID) {
                await this._sendButtonMarkup(msg, 'Админ меню бота', adminKeyboard);
            } else {
                await this.bot.sendMessage(msg.chat.id, 'Тебе сюда нельзя!');
                await this.bot.sendSticker(msg.chat.id, paths.stickers.iDontCallYou);
            }
        } catch (e) {
            console.log(`Ошиба команды /admin ${e}`);
        }
    }

    async _deleteVacation(query) {
        const [_, data] = query.data.split(':');
        const encodeData = decodeCallbackData(data);
        const name = encodeData?.name;

        try {
            await dataBaseService.deleteVacation(encodeData.user_id, encodeData.end_date);
            await this.bot.sendMessage(query.message.chat.id, `Успешно удалён отпуск ${name} из базы`);
        } catch (e) {
            await this.bot.sendMessage(query.message.chat.id, `Ошибка удаление отпуска ${name} из базы`);
            console.log(`Ошибка при удалении отпуска сотрудника ${name} ${e}`);
        }
    }

    async _startCalendar(query, flag) {
        const data = await this._checkVacation(query.message);
        if (data && this.msg) {
            this[flag] = true;
            this.calendar.startNavCalendar(this.msg);
        }
    }

    async _addVacation(query) {
        try {
            const res = await dataBaseService.setVacationData(query.from.id, query.from.username, this.startDate, this.endDate);

            if (res) {
                this._dispose();
                await this.bot.sendMessage(query.message.chat.id, 'Отпуск добавлен');
            }
        } catch (e) {
            console.log('Ошибка добавления отпуска в базу' + e);
            await this.bot.sendMessage(query.message.chat.id, 'Что-то пошло не так, сохранить отпуск не удалось, обратись а админу.');
        }
    }

    async _checkVacation(query) {
        try {
            const data = await generalService.getVacations();
            const currentUser = data?.filter((item) => item.user_id === query.chat.id);

            if (currentUser.length) {
                await this.bot.sendMessage(query.chat.id, 'У тебя уже есть отпуск, добавить второй до окончания первого - нельзя.');
                await this.bot.sendSticker(query.chat.id, paths.stickers.host);
                return false;
            }
            return true;
        } catch (e) {
            console.log('Ошибка получения данных из базы ' + e);
        }
    }

    _dispose() {
        this.startFlag = false;
        this.endFlag = false;
        this.startDate = '';
        this.endDate = '';
    }

    async _delete(msg) {
        try {
            const from = msg.from;
            const firstName = `${from.first_name} ` ?? '';
            const lastName = `${from.last_name} ` ?? '';
            const name = `${firstName}${lastName}(@${msg.from.username})`
            await generalService.deleteHostPermanently(msg.from.id, msg.chat.id, name);
        } catch (e) {
            console.log(`Ошибка удаления пользователя из списка ведущих ${e}`);
        }
    }

    async _add(msg) {
        const username = msg.from.username;
        try {
            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name ?? '';
            const lastName = msg.from.last_name ?? '';

            const host = await hostsService.findHost(userId);

            if (host) {
                await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} уже существует`);
                return;
            }

            await hostsService.setHost(userId, username, chatId, firstName, lastName);

            if (msg.chat.id === Number(process.env.CHAT_ID)) {
                await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} добавлен в список ведущих дейли`);
            } else {
                await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} добавлен в список ведущих дейли`);
                await this.bot.sendMessage(process.env.CHAT_ID, `Пользователь с ником @${username} добавлен в список ведущих дейли`);
            }
        } catch (e) {
            console.log(`Ошибка добавления пользователя в списоке ведущих ${e}`);
            await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} не добавлен в базу.`);
        }
    }

    async _start(msg) {
        try {
            await this.bot.sendMessage(msg.chat.id, 'Привет. Я бот, который позволяет сократить некоторую рутину. Посмотри меню, там написано, что я пока умею.');
        } catch (e) {
            console.log(`Ошиба команды /start ${e}`);
        }
    }

    async _vacation(msg) {
        try {
            const data = await this._checkVacation(msg);

            if (data) {
                this.msg = msg;
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Дата начала',  callback_data: 'start_date' },
                                { text: 'Дата конца', callback_data: 'end_date' }
                            ]
                        ]
                    }
                };
                await this.bot.sendMessage(msg.chat.id, 'Выбор даты', options);
            }
        } catch (e) {
            console.log(`Ошибка команды /vacation ${e}`);
        }
    }

    async _deleteHostMarkup(msg) {
        try {
            const hosts = await dataBaseService.getHosts();

            const preparedHosts = [];

            for (const item of hosts) {
                const firstName = item.first_name ? item.first_name : '';
                const lastName = item.last_name ? item.last_name : '';
                const name = `${firstName} ${lastName} (@${item.user_name})`;

                preparedHosts.push({ name, data: { user_id: item.user_id }, });
            }

            const users = preparedHosts.map(item => ({
                text: item.name,
                callback_data: `delete_host:${encodeCallbackData({ name: item.name, ...item.data })}`
            }));

            const options = {
                reply_markup: {
                    inline_keyboard: users.map(u => [u]),
                }
            };

            await this.bot.sendMessage(msg.chat.id, 'Выбери, кого хочешь удалить из ведущих', options);
        } catch (e) {
            console.log('Ошибка формирования маркапа для удаления пользователя из ведущих ' + e);
        }
    }

    async _deleteVacationMarkup(msg) {
        const vacations = await generalService.getVacations();

        const preparedVacations = [];

        for (const item of vacations) {
            const user = await hostsService.findHost(item.user_id);
            const firstName = user.first_name ? user.first_name : '';
            const lastName = user.last_name ? user.last_name : '';
            const name = `${firstName} ${lastName} (@${item.user_name})`;

            preparedVacations.push({ name, data: { ...user, end_date: item.end_date }, });
        }

        if (vacations.length) {
            const users = preparedVacations.map(item => ({
                text: item.name,
                callback_data: `delete_vacation:${encodeCallbackData({ name: item.name, ...item.data })}`
            }));

            const options = {
                reply_markup: {
                    inline_keyboard: users.map(u => [u]),
                }
            };

            await this.bot.sendMessage(msg.chat.id, 'Выбери, у кого хочешь удалить отпуск', options);
        } else {
            await this.bot.sendMessage(msg.chat.id, 'Никто не в отпуске, удалять нечего');
        }
    }

    async _calendarMessageProcessing(query) {
        const isCalendarMessage = query.message.message_id == this.calendar.chats.get(query.message.chat.id);
        if (isCalendarMessage) {
            const res = this.calendar.clickButtonCalendar(query);
            if (res !== -1) {
                const moment = this.startFlag && !this.endFlag ? 'начала' : 'конца';
                if (this.startFlag && !this.endFlag) {
                    this.startDate = res;
                } else if (this.endFlag) {
                    this.endDate = res;
                }

                try {
                    await this.bot.sendMessage(query.message.chat.id, `Вы выбрали дату ${moment} отпуска: ${res}`);

                    if (this.startFlag && this.endFlag) {
                        await this._addVacation(query);
                    }
                } catch (e) {
                    console.log('Ошибка выбора даты отпуска ' + e);
                    await this.bot.sendMessage(query.message.chat.id, 'Что-то пошло не так, сохранить отпуск не удалось, обратись а админу.');
                }
            }
        }
    }
}

const botService = new BotService();
botService.initialize();
botService.commandProcessing();

module.exports = botService;
