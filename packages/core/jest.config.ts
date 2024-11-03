// Copyright (c) 2024 Christopher Watson
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Config } from 'jest';
import baseConfig from '@repo/config/jest/jest.config';

const config: Config = {
  ...baseConfig,
  displayName: 'core',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};

export default config;