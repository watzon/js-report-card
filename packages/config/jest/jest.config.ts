// Copyright (c) 2024 Christopher Watson
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Config } from 'jest';

const baseConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ]
};

export default baseConfig;