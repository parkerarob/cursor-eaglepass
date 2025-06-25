module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
}; 