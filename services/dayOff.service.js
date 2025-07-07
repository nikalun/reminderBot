class DayOffService {
    _url = '';
    constructor(url) {
        this._url = url;
    }

    async isDayOff() {
        try {
            const res = await fetch(this._assembleUrl);
            const data = await res.json();
            return Boolean(data);
        } catch (e) {
            console.log('Ошибка' + e);
        }
    }

    get dayOfWeek() {
        return new Date().getDay();
    }

    get _revertDate() {
        const date = new Date().toLocaleDateString('ru', { year: 'numeric', day: '2-digit', month: '2-digit' });
        const dateParams = date.split('.');
        let dayOffDate = '';

        while (dateParams.length) {
            const el = dateParams.pop();
            dayOffDate += el;
        }

        return dayOffDate;
    }

    get _assembleUrl() {
        return `${this._url}${this._revertDate}`;
    }
}

module.exports = DayOffService;
