const TelegramBot = require('node-telegram-bot-api');
const Calendar = require('telegram-inline-calendar');

const HostsService = require('./hosts.service');
const dataBaseService = require('./dataBase.service');
const paths = require('../share/paths');

const hostsService = new HostsService();

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
        command: "vacation",
        description: "Пойти в отпуск"
    },
    {
        command: "admin",
        description: "Меню администратора"
    }
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
    }

    commandProcessing() {
        this.bot.on('text', async msg => {
            switch (msg.text) {
                case '/add': {
                    await this._add(msg);
                    break;
                }
                case '/start': {
                    await this._start(msg);
                    break;
                }
                case '/vacation': {
                    await this._vacation(msg);
                    break;
                }
                case 'Оповестить о дейли': {
                    break;
                }
                case 'Выбрать ведущего': {
                    break;
                }
                case '/admin': {
                    await this._adminMenuMarkup(msg);
                    break;
                }
                case 'Удалить отпуск': {
                     await this._deleteVacationMarkup(msg);
                     break;
                }
                default:
                    break;
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
                case /^delete_vacation:\d+:\d{2}-\d{2}-\d{4}$/.test(query.data): {
                    await this._deleteVacation(query);
                }
            }
        })
    }

    async _adminMenuMarkup(msg) {
        try {
            if (String(msg.chat.id) === process.env.ADMIN_ID) {
                await this.bot.sendMessage(msg.chat.id, `Админ меню бота`, {
                    reply_markup: {
                        keyboard: [
                            ['Оповестить о дейли', 'Выбрать ведущего', 'Удалить отпуск'],
                        ]
                    }
                })
            } else {
                await this.bot.sendMessage(msg.chat.id, 'Тебе сюда нельзя!');
                await this.bot.sendSticker(msg.chat.id, paths.stickers.iDontCallYou);
            }
        } catch (e) {
            console.log(`Ошиба команды /admin ${e}`);
        }
    }

    async _deleteVacation(query) {
        const [_, userId, endDate] = query.data.split(':');

        try {
            await dataBaseService.deleteVacation(userId, endDate);
            await this.bot.sendMessage(query.message.chat.id, `Успешно удалён отпуск ${userId} из базы`);
        } catch (e) {
            await this.bot.sendMessage(query.message.chat.id, `Ошибка удаление отпуска ${userId} из базы`);
            console.log(`Ошибка при удалении отпуска сотрудника ${userId} ${e}`);
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
            const data = await this._getVacations();
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

    async _getVacations() {
        try {
            const data = await dataBaseService.getVacations();
            return data;
        } catch (e) {
            console.log('Ошибка получения данных отпускников из базы ' + e);
        }
    }

    _dispose() {
        this.startFlag = false;
        this.endFlag = false;
        this.startDate = '';
        this.endDate = '';
    }

    async _add(msg) {
        const username = msg.from.username;
        try {
            const userId = msg.from.id;
            const chatId = msg.chat.id;

            const host = await hostsService.findHost(userId);

            if (host) {
                await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} уже существует`);
                return;
            }

            await hostsService.setHost(userId, username, chatId);

            if (msg.chat.id === process.env.CHAT_ID) {
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

    async _deleteVacationMarkup(msg) {
        const vacations = await this._getVacations();

        if (vacations.length) {
            const users = vacations.map(item => ({ text: `@${item.user_name}`, callback_data: `delete_vacation:${item.user_id}:${item.end_date}` }));

            const options = {
                reply_markup: {
                    inline_keyboard: [users]
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

module.exports = botService.bot;
