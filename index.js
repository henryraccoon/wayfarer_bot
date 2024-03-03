import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

dotenv.config();
const TELEGRAM_BOT_API_KEY = process.env.TELEGRAM_BOT_API_KEY;

const telegramBot = new TelegramBot(TELEGRAM_BOT_API_KEY, { polling: true });

const userState = {};

telegramBot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  telegramBot.sendMessage(
    msg.chat.id,
    `${msg.chat.first_name}, welcome to Wayfarer bot🖐️. Please let me know your destination. (can be airport IATA code or city name)`
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

        if (!countryInfo) {
          console.log("no country info");
        } else {
          userState[chatId].countryName = countryInfo.name.common;

          userState[chatId].currencies = [];
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
        }
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
        console.log(emergencyServices);
        if (emergencyServices) {
          userState[chatId].member112 = emergencyServices.member_112;
          userState[chatId].genEmerNum = emergencyServices.dispatch.all[0];
          userState[chatId].fireNum = emergencyServices.fire.all[0];
          userState[chatId].ambulanceNum = emergencyServices.ambulance.all[0];
          userState[chatId].policeNum = emergencyServices.police.all[0];
        }

        if (!userState[chatId].destination) {
          break;
          delete userState[chatId];
        } else {
          userState[chatId].step = 2;

          console.log(userState[chatId]);

          const emerSerMsg112 = `${userState[chatId].countryName} supports international recommendation of using number 112 as standartised emergency service number. In case of emergency call 112! Or if available you can use local numbers: General Emergency - ${userState[chatId].genEmerNum}, Police - ${userState[chatId].policeNum}, Ambulance - ${userState[chatId].ambulanceNum}, Fire Department - ${userState[chatId].fireNum} `;

          const emerSerMsg = `In case of emergency call these numbers: General Emergency - ${userState[chatId].genEmerNum}, Police - ${userState[chatId].policeNum}, Ambulance - ${userState[chatId].ambulanceNum}, Fire Department - ${userState[chatId].fireNum} `;

          telegramBot.sendMessage(
            chatId,
            `Great! You are taveling to ${userState[chatId].destination}, ${
              userState[chatId].countryName
            }! People in ${userState[chatId].countryName} speak ${
              userState[chatId].languages.length === 1
                ? userState[chatId].languages[0]
                : userState[chatId].languages.join(" and ")
            } and use ${
              userState[chatId].currencies.length === 1
                ? userState[chatId].currencies[0]
                : userState[chatId].currencies.join(" and ")
            }. According to travel-advisory.info: ${userState[chatId].advice} ${
              userState[chatId].member112 ? emerSerMsg112 : emerSerMsg
            } `
          );

          telegramBot.sendMessage(
            chatId,
            "If you would like more useful information please provide youre departure airport IATA code or city."
          );
          break;
        }

      case 2:
        userState[chatId].start = await cityByIata(messageText);
        if (!userState[chatId].start) {
          break;
          delete userState[chatId];
        } else {
          userState[chatId].step = 3;
          telegramBot.sendMessage(
            chatId,
            `Wonderfull! You want to tavel from ${userState[chatId].start} to ${userState[chatId].destination}! ... info ...`
          );
          telegramBot.sendMessage(
            chatId,
            "If you would also want some more information about weather conditions or upcoming holidays please provide date of your trip."
          );
          break;
        }

      case 3:
        userState[chatId].date = messageText;
        if (!userState[chatId].date) {
          break;
          delete userState[chatId];
        } else {
          telegramBot.sendMessage(
            chatId,
            `Amaizing! So you want to tavel from ${userState[chatId].start} to ${userState[chatId].destination} on ${userState[chatId].date}! ... info ...`
          );
          const sendThanks = function () {
            telegramBot.sendMessage(
              chatId,
              `Thank you for using Wayfarer bot. All your provided data will be deleted now. Bye.`
            );
          };
          setTimeout(sendThanks, 2000);
          console.log(userState[chatId]);
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

// airport api

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

// API city to country:
// https://api.api-ninjas.com/v1/city?name=

// API for country: (name, currency)
// https://api.api-ninjas.com/v1/country?name=

// API for emergency services:
// https://emergencynumberapi.com/api/country/{ iso code}

// api for safety index:
// https://www.travel-advisory.info/api?countrycode=AU

// api for country info: language, currency, flag, carside, timezone etc
// https://restcountries.com/v3.1/name/{name}

// api for holidays:
// https://date.nager.at/api/v2/PublicHolidays/2024/US

// api for weather:
// https://history.openweathermap.org/data/2.5/aggregated/year?lat=35&lon=139&appid={API key} need to register
