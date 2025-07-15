const TelegramBot = require('node-telegram-bot-api');
const Calendar = require('telegram-inline-calendar');

const HostsService = require('./hosts.service');
const dataBaseService = require('./dataBase.service');
const path = require("path");

const hostSticker = path.join(__dirname, '..', 'stickers', 'host.webp');
const iDontCallYou = path.join(__dirname, '..', 'stickers', 'i_dont_call_you.webp');

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
            polling: true
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
                    try {
                        const userId = msg.from.id;
                        const username = msg.from.username;
                        const chatId = msg.chat.id;

                        const host = await hostsService.findHost(userId);

                        if (host) {
                            await this.bot.sendMessage(msg.chat.id, `Пользователь с ником @${username} уже существует`);
                            break;
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
                    break;
                }
                case '/start': {
                    try {
                        await this.bot.sendMessage(msg.chat.id, 'Привет. Я бот, который позволяет сократить некоторую рутину. Посмотри меню, там написано, что я пока умею.');
                    } catch (e) {
                        console.log(`Ошиба команды /start ${e}`);
                    }
                    break;
                }
                case '/admin': {
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
                            await this.bot.sendSticker(msg.chat.id, iDontCallYou);
                        }
                    } catch (e) {
                        console.log(`Ошиба команды /admin ${e}`);
                    }
                    break;
                }
                case '/vacation': {
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
                    break;
                }
                case 'Оповестить о дейли': {
                    break;
                }
                case 'Выбрать ведущего': {
                    break;
                }
                case 'Удалить отпуск': {
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
                default:
                    break;
            }
        });

        this.bot.on('callback_query', async (query) => {
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


            switch (query.data) {
                case 'start_date': {
                    const data = await this._checkVacation(query.message);
                    if (data && this.msg) {
                        this.startFlag = true;
                        this.calendar.startNavCalendar(this.msg);
                    }
                    break;
                }
                case 'end_date': {
                    const data = await this._checkVacation(query.message);
                    if (data && this.msg) {
                        this.endFlag = true;
                        this.calendar.startNavCalendar(this.msg);
                    }
                    break;
                }
            }

            switch (true) {
                case /^delete_vacation:\d+:\d{2}-\d{2}-\d{4}$/.test(query.data): {
                    const [_, userId, endDate] = query.data.split(':');

                    try {
                        await dataBaseService.deleteVacation(userId, endDate);
                        await this.bot.sendMessage(query.message.chat.id, `Успешно удалён отпуск ${userId} из базы`);
                    } catch (e) {
                        await this.bot.sendMessage(query.message.chat.id, `Ошибка удаление отпуска ${userId} из базы`);
                        console.log(`Ошибка при удалении отпуска сотрудника ${userId} ${e}`);
                    }
                }
            }
        })
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
                await this.bot.sendSticker(query.chat.id, hostSticker);
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
}

const botService = new BotService();
botService.initialize();
botService.commandProcessing();

module.exports = botService.bot;
