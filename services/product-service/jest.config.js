export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    setupFilesAfterEnv: ['./tests/jest.setup.js'],
    testTimeout: 30000,
    forceExit: true,
    detectOpenHandles: true,
    verbose: true,
    maxWorkers: 1
};