const { DateTime } = require('luxon');
const fs = require("fs");
const path = require('path');

const basePath = path.join(__dirname, '..');
const stickersPath = `${basePath}/stickers`;
const hostSticker = `${stickersPath}/host.webp`;
const dailyStickersPath = `${stickersPath}/daily`;
const easterEggSticker = `${stickersPath}/easter_egg/easter_egg.webp`;
const easterEggVoice = `${basePath}/voices/peasantwhat3.mp3`;
const dailyStickers = fs.readdirSync(dailyStickersPath);

const randomDailySticker = dailyStickers[Math.floor(Math.random() * dailyStickers.length)];
const randomDailyStickerPath = `${dailyStickersPath}/${randomDailySticker}`;

const bot = require('./bot.service');
const CronService = require('./cron.service');
const DayOffService = require('./dayOff.service');
const HostsService = require('./hosts.service');
const dataBaseService = require('./dataBase.service');

const cronService = new CronService();
const dayOffService = new DayOffService('https://isdayoff.ru/');
const hostsService = new HostsService();

class JobsService {
    dailyJob() {
        return cronService.createJob({
            cronTime: process.env.DAILY_TIME,
            onTick: this._dailyTick,
            start: true,
            timeZone: 'Europe/Moscow',
        });
    }

    hostJob() {
        return cronService.createJob({
            cronTime: process.env.CHOOSE_HOST_TIME,
            onTick: this._hostTick,
            start: true,
            timeZone: 'Europe/Moscow',
        });
    }

     closeTasks() {
         return cronService.createJob({
             cronTime: process.env.CLOSE_TASKS_TIME,
             onTick: this._closeTasksTick,
             start: true,
             timeZone: 'Europe/Moscow',
         });
     }

     deleteOldVacations() {
         return cronService.createJob({
             cronTime: process.env.DELETE_OLD_VACATIONS,
             onTick: this._deleteOldVacationsTick,
             start: true,
             timeZone: 'Europe/Moscow',
         });
     }

     async _deleteOldVacationsTick() {
         const data = await dataBaseService.getVacations();

         const serverDate = new Date();
         const serverDateMoscow = DateTime.fromJSDate(serverDate).setZone('Europe/Moscow').toISODate();

         for (const item of data) {
             const date = item.end_date.split('-').reverse().join('-');
             const utcDate = new Date(date).toISOString().split('T')[0];
             const isMore = serverDateMoscow >= utcDate;

             if (isMore) {
                 try {
                     await dataBaseService.deleteVacation(item.user_id, item.end_date);
                     console.log('Успешно удалён отпуск у ' + item.user_id);
                 } catch (e) {
                     await this.bot.sendMessage(process.env.CHAT_ID, `Ошибка удаление отпуска @${item.user_name} из базы`);
                     console.log(`Ошибка при удалении отпуска сотрудника ${item.user_name} ${e}`);
                 }
             }
         }
     }

    async _dailyTick() {
        try {
            await bot.sendMessage(process.env.CHAT_ID, `Доброе утро! Дейли - ${process.env.DAILY_URL}`);
            await bot.sendSticker(process.env.CHAT_ID, randomDailyStickerPath);
        } catch (e) {
            console.log('Ошибка отправки сообщения о том, что нужно идти на дейлм', e);
        }
    }

    async _hostTick() {
        const isDayOff = await dayOffService.isDayOff();
        if (!isDayOff) {
            const how = dayOffService.dayOfWeek === 5 ? 'В понедельник' : 'Завтра';

            try {
                const randomHost = await hostsService.randomHost();
                if (randomHost) {
                    await bot.sendMessage(process.env.CHAT_ID, `${how} дейли ведёт @${randomHost.user_name}`);
                    if (randomHost.user_name === process.env.EASTER_EGG_NICKNAME) {
                        await bot.sendSticker(process.env.CHAT_ID, easterEggSticker);
                        await bot.sendVoice(process.env.CHAT_ID, easterEggVoice);
                    } else {
                        await bot.sendSticker(process.env.CHAT_ID, hostSticker);
                    }
                }
            } catch (e) {
                console.log('Ошибка отправки сообщения, выбранного ведущего дейли', e);
            }
        }
    }

    async _closeTasksTick() {
        try {
            await bot.sendMessage(process.env.CHAT_ID, 'Не забудьте закрыть задачи 📝(примерно на 1-2 дня) 😉!');
        } catch (e) {
            console.log('Ошибка отправки сообщения о том, что нужно закрыть задачи', e);
        }
    }
}

module.exports = JobsService;
