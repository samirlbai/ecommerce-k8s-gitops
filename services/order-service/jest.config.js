export default {
    testEnvironment: 'node',
    transform: {},
    testTimeout: 30000,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1'
    }
  };