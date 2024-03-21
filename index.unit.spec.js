const axios = require("axios");
const {
  cityByIata,
  riskLevelCountry,
  countryByCity,
  getExchangeRateQuery,
} = require("./index.js");

jest.mock("axios");

describe("cityByIata", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("cityByIata returns city", async () => {
    const resp = {
      status: 200,
      data: [{ city: "London" }],
    };
    axios.get.mockResolvedValue(resp);

    const city = await cityByIata("LGW");
    expect(city).toEqual("London");
  });

  test("handles invalid IATA code gracefully", async () => {
    // Mock Axios response for an invalid IATA code
    axios.get.mockRejectedValue(new Error("Missing API Key."));

    jest.spyOn(console, "log").mockImplementation();

    await expect(cityByIata("XYZ")).rejects.toThrow("Missing API Key.");
  });
});

describe("countryByCity", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("countryByCity returns country", async () => {
    const resp = {
      status: 200,
      data: [{ country: "GB" }],
    };
    axios.get.mockResolvedValue(resp);

    const country = await countryByCity("London");
    expect(country).toEqual("GB");
  });

  test("handles invalid data gracefully", async () => {
    // Mock Axios response for an invalid IATA code
    axios.get.mockRejectedValue(new Error("Couldn't find country"));

    await expect(countryByCity("Hambelton")).rejects.toThrow(
      "Couldn't find country"
    );
  });
});

describe("riskLevelCountry", () => {
  test("riskLevelCountry returns risk level", async () => {
    const resp = {
      status: 200,
      data: {
        data: "risk-level",
      },
    };
    axios.get.mockResolvedValue(resp);

    const city = await riskLevelCountry("GB");
    expect(city).toEqual("risk-level");
  });
});

describe("getExchangeRateQuery", () => {
  test("getExchangeRateQuery returns valid query", () => {
    const query = "USD/EUR";
    const res = getExchangeRateQuery(["USD"], ["EUR"]);
    expect(res).toEqual(query);
  });
});
