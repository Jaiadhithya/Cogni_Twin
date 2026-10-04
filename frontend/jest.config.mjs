import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/.next-dev/', '<rootDir>/.next-build/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
});
