/** @type {import("jest").Config} */
module.exports = {
  clearMocks: true,
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  modulePaths: ["<rootDir>/src"],
  moduleNameMapper: {
    "^obsidian$": "<rootDir>/src/tests/obsidian.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
};
