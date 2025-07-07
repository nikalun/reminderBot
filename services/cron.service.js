const { CronJob } = require('cron');
class CronService {
    createJob({ cronTime, onTick, start, timeZone }) {
        return CronJob.from({
            cronTime,
            onTick,
            start,
            timeZone,
        })
    }
}

module.exports = CronService;
