const days = ['В воскресенье', 'В понедельник', 'Во вторник', 'В среду','В четверг', 'В пятницу', 'В субботу'];

class DayOffService {
    _url = '';
    constructor(url) {
        this._url = url;
    }

    getStringWeekDay(day) {
        return days[day];
    }

    dayOfWeek(date) {
        return date.getDay();
    }

    async checkDateDayOff(date) {
        try {
            const revertDate = this._revertDate(date);
            return await this._checkDate(this._assembleUrl(revertDate));
        } catch (e) {
            console.log('DayOffService: Ошибка метода prepareDate' + e);
        }
    }

    async checkMonday(today) {
        try {
            let i = 0;
            const day = today.getDay();
            const isFriday = day === 5;
            const countDays = isFriday ? 3 : 1;
            let currentDay = today.getDate();
            let newDay = currentDay + countDays;
            today.setDate(newDay);

            let isDayOff = await this.checkDateDayOff(today);

            while (isDayOff) {
                i++;
                currentDay = today.getDate();
                newDay = currentDay + 1;
                today.setDate(newDay);
                isDayOff = await this.checkDateDayOff(today);
            }

            const dayOfWeek = this.dayOfWeek(today);
            const date = i >= 3 ? ` <ins>${today.toLocaleDateString('ru', { year: 'numeric', day: '2-digit', month: '2-digit' })}</ins>` : '';
            return `${this.getStringWeekDay(dayOfWeek)}${date}`;
        } catch (e) {
            console.log('DayOffService: Ошибка метода checkMonday' + e);
        }
    }

    async how() {
        try {
            const today = new Date();
            let currentDay = today.getDate();
            const newDay = currentDay + 1;
            today.setDate(newDay);

            const isDayOff = await this.checkDateDayOff(today);
            if (!isDayOff) {
                return 'Завтра';
            } else {
                return await this.checkMonday(today);
            }
        } catch (e) {
            console.log('DayOffService: Ошибка метода how' + e)
        }
    }

    async _checkDate(date) {
        try {
            const res = await fetch(date);
            const data = await res.json();
            return Boolean(data);
        } catch (e) {
            console.log('DayOffService: Ошибка метода _checkDate' + e);
        }
    }

    _revertDate(date) {
        const d = date.toLocaleDateString('ru', { year: 'numeric', day: '2-digit', month: '2-digit' });
        const dateParams = d.split('.');
        let dayOffDate = '';

        while (dateParams.length) {
            const el = dateParams.pop();
            dayOffDate += el;
        }

        return dayOffDate;
    }

    _assembleUrl(date) {
        return `${this._url}${date}`;
    }
}

module.exports = DayOffService;
