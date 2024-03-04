import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

dotenv.config();
const TELEGRAM_BOT_API_KEY = process.env.TELEGRAM_BOT_API_KEY;

const telegramBot = new TelegramBot(TELEGRAM_BOT_API_KEY, { polling: true });

const userState = {};

// API CALLS

const cityByIata = async (iata) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://api.api-ninjas.com/v1/airports?iata=${iata}`,
      headers: {
        "X-Api-Key": process.env.API_NINJAS_KEY,
      },
    });

    if (res.status === 200) {
      return res.data[0].city;
    }
  } catch (err) {
    console.log(err.code);
  }
};

const countryByCity = async (cityName) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://api.api-ninjas.com/v1/city?name=${cityName}`,
      headers: {
        "X-Api-Key": process.env.API_NINJAS_KEY,
      },
    });
    if (res.status === 200) {
      return res.data[0].country;
    }
  } catch (err) {
    console.log(err.code, "could not find a country by city");
  }
};

const infoAboutCountry = async (country) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://restcountries.com/v3.1/name/${country}`,
    });
    if (res.status === 200) {
      const filteredResults = res.data.filter((co) => co.cca2 === country);
      return filteredResults[0];
    }
  } catch (err) {
    console.log(err.code, "could not find info about a country");
  }
};

const riskLevelCountry = async (country) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://www.travel-advisory.info/api?countrycode=${country}`,
    });
    if (res.status === 200) {
      return res.data.data;
    }
  } catch (err) {
    console.log(err.code, "could not find risk info about a country");
  }
};

const emergencyServicesByCountry = async (country) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://emergencynumberapi.com/api/country/${country}`,
    });
    if (res.status === 200) {
      return res.data.data;
    }
  } catch (err) {
    console.log(err.code, "could not find emergency info about a country");
  }
};

const getTimeZoneOffset = async (city) => {
  try {
    const res = await axios({
      method: "GET",
      url: `https://api.api-ninjas.com/v1/timezone?city=${city}`,
      headers: {
        "X-Api-Key": process.env.API_NINJAS_KEY,
      },
    });

    if (res.status === 200) {
      const tzName = res.data.timezone;

      const resp = await axios({
        method: "GET",
        url: `https://worldtimeapi.org/api/timezone/${tzName}`,
      });

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
    const res = await axios({
      method: "GET",
      url: `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/${query}`,
    });

    if (res.status === 200) {
      return res.data.conversion_rate;
    }
  } catch (err) {
    console.log(err.code, "could not find exchange rate info");
  }
};

const getHolidays = async function (month, countryCode) {
  try {
    const res = await axios({
      method: "GET",
      url: `https://date.nager.at/api/v2/PublicHolidays/2024/${countryCode}`,
    });

    if (res.status === 200) {
      const holidaysArray = res.data;

      const holidaysInMonth = holidaysArray.filter(
        (hol) => parseInt(hol.date.split("-")[1]) === parseInt(month)
      );
      console.log(holidaysInMonth);
      return holidaysInMonth;
    } else if (res.status === 204) {
      console.log("nothing found about holidays");
      return [];
    }
  } catch (err) {
    console.log(err.code, "could not find holiday info");
  }
};

// api for holidays:
// https://date.nager.at/api/v2/PublicHolidays/2024/US

// api for weather:
// https://history.openweathermap.org/data/2.5/aggregated/year?lat=35&lon=139&appid={API key} need to register

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

// TELEGRAM MESSAGE HANDLERS

telegramBot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  telegramBot.sendMessage(
    msg.chat.id,
    `${msg.chat.first_name}, welcome to Wayfarer bot🖐️. I will be happy to provide all basic but useful information about your upcoming trip. Please let me know your destination airport IATA code. (three letters that you can see on your ticket 🫡)`
  );
  userState[chatId] = { step: 1, start: "" };
});

telegramBot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === "/start") return;

  if (userState[chatId]) {
    const { step } = userState[chatId];

    switch (step) {
      case 1:
        userState[chatId].destination = await cityByIata(messageText);
        userState[chatId].countryCode = await countryByCity(
          userState[chatId].destination
        );

        const countryInfo = await infoAboutCountry(
          userState[chatId].countryCode
        );

        if (!userState[chatId].destination) {
          console.log("something went wrong in step 1");
          telegramBot.sendMessage(
            chatId,
            ` Something went wrong, because I couldn't find a city airport with that IATA. Maybe try again from the /start? If problem persists, maybe this airport is just isn't in my database. Sorry. I know I'm not perfect... But I will try to get better. 😔  `
          );
          break;
          delete userState[chatId];
        } else if (!countryInfo) {
          telegramBot.sendMessage(
            chatId,
            ` Something went wrong, because I could find that you're going to ${userState[chatId].destination}, but I couldn't find information about a country... That happens when city names change, but aren't updated in all databases. Sorry. I know I'm not perfect... But I will try to get better. 😔 `
          );
          break;
          delete userState[chatId];
        } else {
          userState[chatId].countryName = countryInfo.name.common;
          userState[chatId].step = 2;

          telegramBot.sendMessage(
            chatId,
            `Great! You are traveling to ${userState[chatId].destination}, ${userState[chatId].countryName}.`
          );

          userState[chatId].currencies = [];
          userState[chatId].destCurCode = Object.keys(countryInfo.currencies);

          Object.entries(countryInfo.currencies).forEach(
            ([curCode, curObj]) => {
              userState[chatId].currencies.push(curObj.name);
            }
          );

          userState[chatId].languages = [];
          Object.entries(countryInfo.languages).forEach(
            ([lngCode, lngName]) => {
              userState[chatId].languages.push(lngName);
            }
          );

          const travelRisks = await riskLevelCountry(
            userState[chatId].countryCode
          );
          if (travelRisks) {
            const countryKeys = Object.keys(travelRisks);
            const firstKey = countryKeys[0];
            userState[chatId].advice = travelRisks[firstKey].advisory.message;
          }

          const emergencyServices = await emergencyServicesByCountry(
            userState[chatId].countryCode
          );

          if (emergencyServices) {
            userState[chatId].member112 = emergencyServices.member_112;
            userState[chatId].genEmerNum = emergencyServices.dispatch.all[0];
            userState[chatId].fireNum = emergencyServices.fire.all[0];
            userState[chatId].ambulanceNum = emergencyServices.ambulance.all[0];
            userState[chatId].policeNum = emergencyServices.police.all[0];
          }

          const emerSerMsg112 = `${userState[chatId].countryName} supports international recommendation of using number 112 as standartised emergency service number. In case of emergency call 112! Or if available you can use local numbers: General Emergency - ${userState[chatId].genEmerNum}, Police - ${userState[chatId].policeNum}, Ambulance - ${userState[chatId].ambulanceNum}, Fire Department - ${userState[chatId].fireNum} `;

          const emerSerMsg = `In case of emergency call these numbers: General Emergency - ${userState[chatId].genEmerNum}, Police - ${userState[chatId].policeNum}, Ambulance - ${userState[chatId].ambulanceNum}, Fire Department - ${userState[chatId].fireNum} `;

          telegramBot.sendMessage(
            chatId,
            `People in ${userState[chatId].countryName} speak ${
              userState[chatId].languages.length === 1
                ? userState[chatId].languages[0]
                : userState[chatId].languages.join(" and ")
            } and use ${
              userState[chatId].currencies.length === 1
                ? userState[chatId].currencies[0]
                : userState[chatId].currencies.join(" and ")
            }.`
          );

          telegramBot.sendMessage(
            chatId,
            `According to travel-advisory.info: ${userState[chatId].advice}`
          );

          telegramBot.sendMessage(
            chatId,
            `${userState[chatId].member112 ? emerSerMsg112 : emerSerMsg} `
          );

          const offeringMoreInformation = function () {
            telegramBot.sendMessage(
              chatId,
              "If you would like more useful information please provide your departure airport IATA."
            );
          };

          setTimeout(offeringMoreInformation, 2000);

          userState[chatId].destTZ = await getTimeZoneOffset(
            userState[chatId].destination
          );

          break;
        }

      case 2:
        userState[chatId].start = await cityByIata(messageText);
        if (!userState[chatId].start) {
          telegramBot.sendMessage(
            chatId,
            ` Something went wrong, because I couldn't find a city airport with that IATA. Maybe try again from the /start? If problem persists, maybe this airport is just isn't in my database. Sorry. I know I'm not perfect... But I will try to get better. 😔  `
          );

          break;
          delete userState[chatId];
        } else {
          userState[chatId].step = 3;

          userState[chatId].startCountryCode = await countryByCity(
            userState[chatId].start
          );

          const startCountryInfo = await infoAboutCountry(
            userState[chatId].startCountryCode
          );

          if (!startCountryInfo) {
            telegramBot.sendMessage(
              chatId,
              ` Something went wrong, because I could find that your departure city is ${userState[chatId].start}, but I couldn't find information about a country... That happens when city names change, but aren't updated in all databases. And in this case, unfortunately, I won't be able to provide more information. Sorry. I know I'm not perfect... But I will try to get better. 😔 `
            );
            break;
            delete userState[chatId];
          }

          userState[chatId].startCurCode = Object.keys(
            startCountryInfo.currencies
          );

          userState[chatId].startTZ = await getTimeZoneOffset(
            userState[chatId].start
          );
          const timeDifferenceHours = calculateTimeDifference(
            userState[chatId].startTZ,
            userState[chatId].destTZ
          );

          const exQuery = getExchangeRateQuery(
            userState[chatId].startCurCode,
            userState[chatId].destCurCode
          );

          const rate = await excRate(exQuery);

          const noExchangeMsg = `Both your destination and departure countries use the same currency`;

          const exchangeRateMsg = `The exchange rate ${userState[chatId].startCurCode} to ${userState[chatId].destCurCode} is ${rate}`;

          const timeDifferMsg = `Time difference will be ${timeDifferenceHours} hours`;

          telegramBot.sendMessage(
            chatId,
            `Wonderful! You are traveling from ${userState[chatId].start} to ${
              userState[chatId].destination
            }. ${timeDifferMsg}. ${
              userState[chatId].startCurCode[0] ===
              userState[chatId].destCurCode[0]
                ? noExchangeMsg
                : exchangeRateMsg
            }.`
          );
          const inquireDate = function () {
            telegramBot.sendMessage(
              chatId,
              `If you would also want some more information about upcoming holidays in your destination country or weather conditions please provide the month number of your trip.`
            );
          };
          setTimeout(inquireDate, 2000);
          // delete userState[chatId];
          break;
        }

      case 3:
        userState[chatId].date = messageText;
        if (!userState[chatId].date) {
          break;
          delete userState[chatId];
        } else {
          const holidaysArray = await getHolidays(
            userState[chatId].date,
            userState[chatId].countryCode
          );
          console.log(holidaysArray);
          if (holidaysArray.length > 0) {
            const holidaysMessage = `Amazing! In the month of your trip, people in ${
              userState[chatId].countryName
            } celebrate these holidays: ${holidaysArray
              .map(
                (hol) => `${hol.name} (local: ${hol.localName}) on ${hol.date}`
              )
              .join(
                ", "
              )}. Please plan your trip accordingly and expect changes in business hours on these days.`;

            telegramBot.sendMessage(chatId, holidaysMessage);
          } else if (holidaysArray.length === 0) {
            telegramBot.sendMessage(
              chatId,
              `Seems like there aren't any public holidays in this month in ${userState[chatId].countryName}. (keep in mind my database might not have all the holidays in all the countries at the moment. Sorry. We are working on it.)`
            );
          }

          const sendThanks = function () {
            telegramBot.sendMessage(
              chatId,
              `Thank you for using Wayfarer bot. All your provided data will be deleted now. Bye. 🤝 Have a nice trip!`
            );
          };
          setTimeout(sendThanks, 2000);
          delete userState[chatId];
          break;
        }
      default:
        telegramBot.sendMessage(chatId, "Oops! Something went wrong.");
        delete userState[chatId];
    }
  } else {
    telegramBot.sendMessage(chatId, "Please start the converstion with /start");
    delete userState[chatId];
  }
});
