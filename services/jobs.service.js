const { DateTime } = require('luxon');
require('dotenv').config();

const botService = require('./bot.service');
const CronService = require('./cron.service');
const dataBaseService = require('./dataBase.service');
const GeneralService = require('./general.service');

const cronService = new CronService();
const generalService = new GeneralService();

class JobsService {
    constructor() {
        generalService.setBot(botService.bot);
    }

    dailyJob() {
        return cronService.createJob({
            cronTime: process.env.DAILY_TIME,
            onTick: () => generalService.daily(),
            start: true,
            timeZone: 'Europe/Moscow',
        });
    }

    youAreHost() {
        return cronService.createJob({
            cronTime: process.env.DUTY_REMINDER_TIME,
            onTick: () => generalService.youAreHost(),
            start: true,
            timeZone: 'Europe/Moscow',
        });
    }

    hostJob() {
        return cronService.createJob({
            cronTime: process.env.CHOOSE_HOST_TIME,
            onTick: () => generalService.chooseHost(),
            start: true,
            timeZone: 'Europe/Moscow',
        });
    }

     closeTasks() {
         return cronService.createJob({
             cronTime: process.env.CLOSE_TASKS_TIME,
             onTick: () => generalService.closeTasks(),
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

    chooseNewBotName() {
        return cronService.createJob({
            cronTime: process.env.CHOOSE_NEW_BOT_NAME_TIME,
            onTick: () => generalService.chooseNewBotName(),
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
                     await botService.bot.sendMessage(process.env.CHAT_ID, `Ошибка удаление отпуска @${item.user_name} из базы`);
                     console.log(`Ошибка при удалении отпуска сотрудника ${item.user_name} ${e}`);
                 }
             }
         }
     }
}

module.exports = JobsService;
