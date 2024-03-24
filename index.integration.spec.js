const { handler } = require("./index");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

jest.mock("axios", () => ({
  get: jest
    .fn()
    .mockResolvedValueOnce({
      status: 200,
      data: [{ city: "London" }],
    })
    .mockResolvedValueOnce({
      status: 200,
      data: [{ city: "Kuala Lumpur" }],
    })
    .mockResolvedValueOnce({
      status: 200,
      // data: [{ country: "GB" }],
      data: {
        geonames: [
          {
            countryCode: "GB",
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      // data: [{ country: "MY" }],
      data: {
        geonames: [
          {
            countryCode: "MY",
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: [
        {
          cca2: "GB",
          currencies: {
            GBP: {
              name: "British pound",
            },
          },
          languages: {
            eng: "English",
          },
          name: {
            common: "United Kingdom",
          },
        },
        { cca2: "US" },
      ],
    })
    .mockResolvedValueOnce({
      status: 200,
      data: [
        {
          name: {
            common: "Malaysia",
          },
          cca2: "MY",
          currencies: {
            MYR: {
              name: "Malaysian ringgit",
            },
          },
          languages: {
            eng: "English",
            msa: "Malay",
          },
        },
        { cca2: "US" },
      ],
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        MY: {
          message:
            "Malaysia has a current risk level of 2.8 (out of 5). We advise: Use some caution when travelling Malaysia.",
        },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        country: {
          name: "Malaysia",
          ISOCode: "MY",
          ISONumeric: "458",
        },
        ambulance: {
          all: ["999"],
          gsm: ["112"],
          fixed: null,
        },
        fire: {
          all: ["994"],
          gsm: null,
          fixed: null,
        },
        police: {
          all: ["999"],
          gsm: ["112"],
          fixed: null,
        },
        dispatch: {
          all: [""],
          gsm: null,
          fixed: null,
        },
        member_112: false,
        localOnly: false,
        nodata: false,
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: "Europe/London",
    })
    .mockResolvedValueOnce({
      status: 200,
      data: { utc_offset: "+00:00" },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: "Asia/Kuala_Lumpur",
    })
    .mockResolvedValueOnce({
      status: 200,
      data: { utc_offset: "+08:00" },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: 5.9715,
    })
    .mockResolvedValueOnce({
      status: 200,
      data: [],
    }),
}));

describe("Telegram Bot Integration Tests", () => {
  beforeEach(() => {
    // Mocking the TelegramBot constructor
    jest
      .spyOn(TelegramBot.prototype, "sendMessage")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("Handle incoming trip messages - Success", async () => {
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: 123456789,
            first_name: "John",
          },
          text: "LGW-KUL-5", // Example message triggering multiple axios calls
        },
      }),
    };

    await handler(event);

    expect(TelegramBot.prototype.sendMessage).toHaveBeenCalled();

    expect(TelegramBot.prototype.sendMessage).toHaveBeenCalledTimes(7);
  });

  test("Handle incoming start message - Success", async () => {
    const event = {
      body: JSON.stringify({
        message: {
          chat: {
            id: 123456789,
            first_name: "John",
          },
          text: "/start",
        },
      }),
    };

    // Call handler function
    await handler(event);

    // Spy on the arguments passed to sendMessage
    expect(TelegramBot.prototype.sendMessage).toHaveBeenCalledWith(
      123456789, // Chat ID
      "John, welcome to Wayfarer bot🖐️. I will be happy to provide all basic but useful information about your upcoming trip. Please let me know your departure airport IATA, destination airport IATA code and month NUMBER of your upcoming trip. (e.g. LGW-KUL-5). Please use dashes/minuses in between."
    );
  });
});
