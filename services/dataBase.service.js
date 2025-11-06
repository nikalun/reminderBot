const path = require("path");
const { promisify } = require('util');
const sqlite3 = require("sqlite3").verbose();

const filepath = path.join(__dirname, '..', 'db', process.env.DATA_BASE_NAME);

const SQLRequests = new Map([
    ['insertVacation', `INSERT INTO vacation (user_id, user_name, start_date, end_date) VALUES (?, ?, ?, ?)`],
    ['insertHost', `INSERT INTO hosts (user_id, user_name, chat_id, first_name, last_name) VALUES (?, ?, ?, ?, ?)`],

    ['deleteVacation', `DELETE FROM vacation WHERE user_id = ? AND end_date = ?`],
    ['deletePermanentlyHost', 'DELETE FROM hosts WHERE user_id = ?'],
    ['deletePermanentlyVacation', 'DELETE FROM vacation WHERE user_id = ?'],

    ['selectVacations', `SELECT * FROM vacation`],
    ['selectHosts', `SELECT * FROM hosts`],
    ['selectHost', `SELECT * FROM hosts WHERE user_id = ?`],
    ['selectHostIds', `SELECT user_id FROM hosts`],

    ['updatePrevHost', `UPDATE hosts SET prev_host = ? WHERE user_id = ?`],
    ['updateHostedDaily', `UPDATE hosts SET hosted_daily = ? WHERE user_id = ?`],
    ['enrichHost', `UPDATE hosts SET first_name = ?, last_name = ? WHERE user_id = ?`],
])

class DataBaseService {

    initialize() {
        this.db = new sqlite3.Database(filepath, (error) => {
            if (error) {
                return console.error(error.message);
            }
        });
        console.log('Успешное соединение с базой данных');
    }

    async setHost(userId, username, chatId, firstName, lastName) {
        const run = this._run(SQLRequests.get('insertHost'), [userId, username, chatId, firstName, lastName]);
        return await run;
    }

    async getHostIds() {
        const all = this._all();
        return await all(SQLRequests.get('selectHostIds'));
    }

    async updatePrevHost(userId, value) {
        const run = this._run(SQLRequests.get('updatePrevHost'), [value, userId]);
        return await run;
    }

    async updateHostedDaily(userId, value) {
        const run = this._run(SQLRequests.get('updateHostedDaily'), [value, userId]);
        return await run;
    }

    async enrichHost(userId, firstName, lastName) {
        const run = this._run(SQLRequests.get('enrichHost'), [firstName, lastName, userId]);
        return await run;
    }

    async selectHost(userId) {
        const get = this._get();
        return await get(SQLRequests.get('selectHost'), [userId]);
    }

    async deleteHostPermanently(userId) {
        return await this._transactionAsync(async () => {
           await this._run(SQLRequests.get('deletePermanentlyHost'), [userId]);
           await this._run(SQLRequests.get('deletePermanentlyVacation'), [userId]);
        });
    }

    async getHosts() {
        const all = this._all();
        return await all(SQLRequests.get('selectHosts'));
    }

    async setVacationData(userId, username, startDate, endDate) {
        const run = this._run(SQLRequests.get('insertVacation'), [userId, username, startDate, endDate]);
        return await run;
    }

    async deleteVacation(userId, endDate) {
        const run = this._run(SQLRequests.get('deleteVacation'), [userId, endDate]);
        return await run;
    }

    async getVacations() {
        const all = this._all();
        return await all(SQLRequests.get('selectVacations'));
    }

    _all() {
        return promisify(this.db.all).bind(this.db);
    }

    _get() {
        return promisify(this.db.get).bind(this.db);
    }

    _run(...args) {
        return new Promise((resolve, reject) => {
            this.db.run(...args, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async  _transactionAsync(callback) {
        try {
            await this._run('BEGIN TRANSACTION');
            const result = await callback();
            await this._run('COMMIT');
            return result;
        } catch (err) {
            await this._run('ROLLBACK');
            throw err;
        }
    }
}

const databaseService = new DataBaseService();
databaseService.initialize();

module.exports = databaseService;
