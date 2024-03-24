const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TELEGRAM_BOT_API_KEY = process.env.TELEGRAM_BOT_API_KEY;
const telegramBot = new TelegramBot(TELEGRAM_BOT_API_KEY, { polling: false });

const cityByIata = async (iata) => {
  try {
    const optionsObj = {
      headers: {
        "X-Api-Key": process.env.API_NINJAS_KEY,
      },
    };
    const res = await axios.get(
      `https://api.api-ninjas.com/v1/airports?iata=${iata}`,
      optionsObj
    );

    if (res.status === 200) {
      return res.data[0].city;
    }
  } catch (err) {
    console.log(err.message);
  }
};

const countryByCity = async (cityName) => {
  try {
    optionsObj = {
      headers: {
        "X-Api-Key": process.env.API_NINJAS_KEY,
      },
    };
    const res = await axios.get(
      `https://api.api-ninjas.com/v1/city?name=${cityName}`,
      optionsObj
    );

    if (res.status === 200) {
      return res.data[0].country;
    }
  } catch (err) {
    console.log(err);
  }
};

const infoAboutCountry = async (country) => {
  try {
    const res = await axios.get(
      `https://restcountries.com/v3.1/name/${country}`
    );

    if (res.status === 200) {
      const filteredResults = res.data.filter((co) => co.cca2 === country);
      return filteredResults[0];
    }
  } catch (err) {
    console.log(err.message);
  }
};

const riskLevelCountry = async (country) => {
  try {
    const res = await axios.get(
      `https://www.travel-advisory.info/api?countrycode=${country}`
    );
    if (res.status === 200) {
      return res.data.data;
    }
  } catch (err) {
    console.log(err.code, "could not find risk info about a country");
  }
};

const emergencyServicesByCountry = async (country) => {
  try {
    const res = await axios.get(
      `https://emergencynumberapi.com/api/country/${country}`
    );
    if (res.status === 200) {
      return res.data.data;
    }
  } catch (err) {
    console.log(err.code, "could not find emergency info about a country");
  }
};

const getTimeZoneOffset = async (city) => {
  try {
    const res = await axios.get(
      `https://api.api-ninjas.com/v1/timezone?city=${city}`,
      {
        headers: {
          "X-Api-Key": process.env.API_NINJAS_KEY,
        },
      }
    );

    if (res.status === 200) {
      const tzName = res.data.timezone;

      const resp = await axios.get(
        `https://worldtimeapi.org/api/timezone/${tzName}`
      );

      if (resp.status === 200) {
        return resp.data.utc_offset;
      }
    }
  } catch (err) {
    console.log(err.code, "could not find timezone info about a city");
  }
};

const excRate = async function (query) {
  try {
    const res = await axios.get(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/${query}`
    );

    if (res.status === 200) {
      return res.data.conversion_rate;
    }
  } catch (err) {
    console.log(err.code, "could not find exchange rate info");
  }
};

const getHolidays = async function (month, countryCode) {
  try {
    const res = await axios.get(
      `https://date.nager.at/api/v2/PublicHolidays/2024/${countryCode}`
    );

    if (res.status === 200) {
      const holidaysArray = res.data;

      const holidaysInMonth = holidaysArray.filter(
        (hol) => parseInt(hol.date.split("-")[1]) === month
      );

      return holidaysInMonth;
    } else if (res.status === 204) {
      return [];
    }
  } catch (err) {
    console.log(err.code, "could not find holiday info");
  }
};

// HELPER FUNCTIONS

const getExchangeRateQuery = function (startCur, destCur) {
  if (startCur.length === 1 && destCur.length === 1) {
    const query = [...startCur, ...destCur].join("/");

    return query;
  } else if (startCur.length > 1 || destCur.length > 1) {
    const query = [startCur[0], destCur[0]].join("/");

    return query;
  }
};

function calculateTimeDifference(startTZ, destTZ) {
  const startOffset = parseUtcOffset(startTZ);
  const destOffset = parseUtcOffset(destTZ);

  const timeDifferenceHours = (destOffset - startOffset) / 60;

  return timeDifferenceHours;
}

function parseUtcOffset(utcOffset) {
  const [sign, hours, minutes] = utcOffset
    .match(/^([-+])(\d{2}):(\d{2})$/)
    .slice(1);
  const offsetMinutes =
    (parseInt(hours, 10) * 60 + parseInt(minutes, 10)) *
    (sign === "-" ? -1 : 1);
  return offsetMinutes;
}

exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  // Handle incoming Telegram messages

  if (body.message) {
    const chatId = body.message.chat.id;
    const messageText = body.message.text;

    if (messageText === "/start") {
      await telegramBot.sendMessage(
        chatId,
        `${body.message.chat.first_name}, welcome to Wayfarer bot🖐️. I will be happy to provide all basic but useful information about your upcoming trip. Please let me know your departure airport IATA, destination airport IATA code and month NUMBER of your upcoming trip. (e.g. LGW-KUL-5). Please use dashes/minuses in between.`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Success" }),
      };
    }

    if (!messageText || messageText.length < 9 || messageText.length > 50) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Fail" }),
      };
    }

    const words = messageText.split("-");
    const userData = {};
    userData.date = parseInt(words[2]);

    if (words[0].length > 3 || words[1].length > 3) {
      userData.departureCity = words[0];
      userData.destinationCity = words[1];
    } else if (words[0].length === 3 && words[1].length === 3) {
      userData.departureCity = await cityByIata(words[0]);
      userData.destinationCity = await cityByIata(words[1]);
    } else {
      telegramBot.sendMessage(
        chatId,
        `Oops, something went wrong with IATA that you've provided. If problem persists please try using CITY NAMES instead of IATA.`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Fail" }),
      };
    }

    if (!userData.date || userData.date < 0 || userData.date > 12) {
      telegramBot.sendMessage(
        chatId,
        `That's a strange month... 🧐 Are you sure you typed number from 1 to 12? I received this: ${words[2]}, which doesn't look right... Maybe try again? `
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Fail" }),
      };
    }

    userData.departureCountryCode = await countryByCity(userData.departureCity);
    userData.destinationCountryCode = await countryByCity(
      userData.destinationCity
    );

    if (!userData.departureCountryCode) {
      telegramBot.sendMessage(
        chatId,
        `Something went wrong, because I could find that you're traveling from ${userData.departureCity}, but I couldn't find information about a country... That happens when city names change, but aren't updated in all databases. Sorry. If you know any other name of the city or different spelling you can try using CITY NAMES instead of IATA.`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Fail" }),
      };
    }

    if (!userData.destinationCountryCode) {
      telegramBot.sendMessage(
        chatId,
        `Something went wrong, because I could find that you're traveling to ${userData.destinationCity}, but I couldn't find information about a country... That happens when city names change, but aren't updated in all databases. Sorry. If you know any other name of the city or different spelling you can try using CITY NAMES instead of IATA.`
      );
      return;
    }

    userData.departureCountryInfo = await infoAboutCountry(
      userData.departureCountryCode
    );
    userData.destinationCountryInfo = await infoAboutCountry(
      userData.destinationCountryCode
    );

    await telegramBot.sendMessage(
      chatId,
      `Wonderful! You are traveling from ${userData.departureCity}, ${userData.departureCountryInfo.name.common}  to ${userData.destinationCity}, ${userData.destinationCountryInfo.name.common}.`
    );

    userData.destinationCurrencies = [];
    userData.destCurCode = Object.keys(
      userData.destinationCountryInfo.currencies
    );

    Object.entries(userData.destinationCountryInfo.currencies).forEach(
      ([curCode, curObj]) => {
        userData.destinationCurrencies.push(curObj.name);
      }
    );

    userData.destinationLanguages = [];
    Object.entries(userData.destinationCountryInfo.languages).forEach(
      ([lngCode, lngName]) => {
        userData.destinationLanguages.push(lngName);
      }
    );

    await telegramBot.sendMessage(
      chatId,
      `People in ${userData.destinationCountryInfo.name.common} speak ${
        userData.destinationLanguages.length === 1
          ? userData.destinationLanguages[0]
          : userData.destinationLanguages.join(" and ")
      } and use ${
        userData.destinationCurrencies.length === 1
          ? userData.destinationCurrencies[0]
          : userData.destinationCurrencies.join(" and ")
      }.`
    );

    userData.destinationTravelRisks = await riskLevelCountry(
      userData.destinationCountryCode
    );
    if (userData.destinationTravelRisks) {
      const countryKeys = Object.keys(userData.destinationTravelRisks);
      const firstKey = countryKeys[0];
      userData.advice =
        userData.destinationTravelRisks[firstKey].advisory.message;
    }

    const emergencyServices = await emergencyServicesByCountry(
      userData.destinationCountryCode
    );

    if (emergencyServices) {
      userData.member112 = emergencyServices.member_112;
      userData.genEmerNum = emergencyServices.dispatch.all[0];
      userData.fireNum = emergencyServices.fire.all[0];
      userData.ambulanceNum = emergencyServices.ambulance.all[0];
      userData.policeNum = emergencyServices.police.all[0];
    }

    const emerSerMsg112 = `${userData.destinationCountryInfo.name.common} supports international recommendation of using number 112 as standartised emergency service number. In case of emergency call 112! Or if available you can use local numbers: General Emergency - ${userData.genEmerNum}, Police - ${userData.policeNum}, Ambulance - ${userData.ambulanceNum}, Fire Department - ${userData.fireNum} `;

    const emerSerMsg = `In case of emergency call these numbers: General Emergency - ${userData.genEmerNum}, Police - ${userData.policeNum}, Ambulance - ${userData.ambulanceNum}, Fire Department - ${userData.fireNum} `;

    await telegramBot.sendMessage(
      chatId,
      `According to travel-advisory.info: ${userData.advice}`
    );

    await telegramBot.sendMessage(
      chatId,
      `${userData.member112 ? emerSerMsg112 : emerSerMsg} `
    );

    userData.destTZ = await getTimeZoneOffset(userData.destinationCity);

    userData.departCurCode = Object.keys(
      userData.departureCountryInfo.currencies
    );

    userData.startTZ = await getTimeZoneOffset(userData.departureCity);

    const timeDifferenceHours = calculateTimeDifference(
      userData.startTZ,
      userData.destTZ
    );

    const exQuery = getExchangeRateQuery(
      userData.departCurCode,
      userData.destCurCode
    );

    const rate = await excRate(exQuery);

    const noExchangeMsg = `Both your destination and departure countries use the same currency`;

    const exchangeRateMsg = `The exchange rate ${userData.departCurCode} to ${userData.destCurCode} is ${rate}`;

    const timeDifferMsg = `Time difference between ${userData.departureCity} and ${userData.destinationCity} will be ${timeDifferenceHours} hours`;

    await telegramBot.sendMessage(
      chatId,
      `${timeDifferMsg}. ${
        userData.departCurCode[0] === userData.destCurCode[0]
          ? noExchangeMsg
          : exchangeRateMsg
      }.`
    );

    const holidaysArray = await getHolidays(
      userData.date,
      userData.destinationCountryCode
    );

    if (holidaysArray.length > 0) {
      const holidaysMessage = `In the month of your trip, people in ${
        userData.destinationCountryInfo.name.common
      } celebrate these holidays: ${holidaysArray
        .map((hol) => `${hol.name} (local: ${hol.localName}) on ${hol.date}`)
        .join(
          ", "
        )}. Please plan your trip accordingly and expect changes in business hours on these days.`;

      await telegramBot.sendMessage(chatId, holidaysMessage);
    } else if (holidaysArray.length === 0) {
      await telegramBot.sendMessage(
        chatId,
        `Seems like there aren't any public holidays in this month in ${userData.destinationCountryInfo.name.common}. (keep in mind my database might not have all the holidays in all the countries at the moment. Sorry. We are working on it.)`
      );
    }

    await telegramBot.sendMessage(
      chatId,
      `Thank you for using Wayfarer bot. All your provided data will be deleted now. Bye. 🤝 Have a nice trip!`
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Success" }),
  };
};

module.exports = {
  handler: exports.handler,
  countryByCity,
  cityByIata,
  riskLevelCountry,
  getExchangeRateQuery,
};
