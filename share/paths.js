const path = require("path");
const fs = require("fs");

const stickers =  path.join(__dirname, '..', 'stickers');
const voices =  path.join(__dirname, '..', 'voices');

const paths = {
    stickers: {
        host: `${stickers}/host.webp`,
        hello: `${stickers}/boo.gif`,
        iDontCallYou: `${stickers}/i_dont_call_you.webp`,
        daily: `${stickers}/daily`,
        easterEgg: `${stickers}/easter_egg/easter_egg.webp`,
        get dailyRandomSticker() {
            const dailyStickers = fs.readdirSync(this.daily);
            const randomDailySticker = dailyStickers[Math.floor(Math.random() * dailyStickers.length)];

            return `${this.daily}/${randomDailySticker}`;
        }
    },
    voices: {
        easterEgg: `${voices}/peasantwhat3.mp3`,
    }
}

module.exports = paths;
