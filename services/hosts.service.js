const dataBaseService = require('./dataBase.service');

class HostsService {
    async setHost(userId, userName, chatId) {
        return await dataBaseService.setHost(userId, userName, chatId);
    }

    async setPrevHost(userId, value) {
        return await dataBaseService.updatePrevHost(userId, value);
    }

    async setHostedDaily(userId, value) {
        return await dataBaseService.updateHostedDaily(userId, value);
    }

    async findHost(userId) {
        return await dataBaseService.selectHost(userId);
    }

    async hosts() {
        return await dataBaseService.getHosts();
    }

    async vacations() {
        return await dataBaseService.getVacations();
    }

    async randomHost() {
        try {
            const hostsWithoutPrevAndVacations = await this.hostsWithoutPrevAndVacations();
            const hosts = await this.hosts();
            const randomHost = hostsWithoutPrevAndVacations[Math.floor(Math.random() * hostsWithoutPrevAndVacations.length)];

            if (randomHost) {
                for (const item of hosts) {
                    if (item.prev_host) {
                        await this.setPrevHost(item.user_id, '');
                    }
                }
                // Сколько раз вёл дейли
                const count = ++randomHost.hosted_daily;

                await this.setPrevHost(randomHost.user_id, 'true');
                await this.setHostedDaily(randomHost.user_id, count);
            }

            return randomHost;
        } catch (e) {
            console.log(`Ошибка в методе randomHost ${e}`);
        }
    }

    async hostsWithoutPrevAndVacations() {
        try {
            return await this.hostsWithoutVacations(true);
        } catch (e) {
            console.log(`Ошибка в методе hostsWithoutPrev ${e}`);
        }
    }

    async hostsWithoutVacations(withoutPrevHost = false) {
        try {
            const hosts = await this.hosts();
            const vacations = await this.vacations();
            const vacationIds = new Set(vacations.map(item => item.user_id));

            return hosts.filter(item => {
                const withoutVacations = !vacationIds.has(item.user_id);
                if (withoutPrevHost) {
                    return item.prev_host !== 'true' && withoutVacations;
                }

                return withoutVacations;
            })
        } catch (e) {
            console.log(`Ошибка в методе hostsWithoutVacations ${e}`);
        }
    }

    async prevHost() {
        const hosts = await this.hosts();
        return hosts.filter(host => host.prev_host === 'true');
    }
}

module.exports = HostsService;
