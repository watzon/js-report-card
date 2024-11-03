# JS Report Card

[![CI](https://github.com/watzon/js-report-card/actions/workflows/ci.yml/badge.svg)](https://github.com/watzon/js-report-card/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/username/js-report-card/branch/main/graph/badge.svg)](https://codecov.io/gh/username/js-report-card)
[![Turbo](https://img.shields.io/badge/powered%20by-Turbo-EF4444.svg)](https://turbo.build)

An automated code quality and maintainability analyzer for JavaScript and TypeScript projects, inspired by [Go Report Card](https://goreportcard.com/).

## Features

- 📊 Comprehensive code analysis
- 🔍 Multiple analyzer types (ESLint, TypeScript, Complexity, Dead Code)
- ⚡ High-performance analysis with caching
- 🔄 Support for various project sources (Git, NPM, ZIP, Local)
- 📝 Detailed reports with actionable feedback
- 🎯 Letter grade scoring system

## Project Status

Currently in active development. See our [roadmap](ROADMAP.md) for detailed progress and upcoming features.

### Completed Features
- ✅ Monorepo infrastructure
- ✅ Core analysis engine
- ✅ Project download system
- ✅ Plugin-based analyzer architecture
- ✅ Caching system

### Coming Soon
- 🚧 Essential code analyzers
- 🚧 CLI tool
- 🚧 Web API
- 🚧 Web interface
- 🚧 CI/CD integration

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 10.8.2
- Turborepo CLI: `npm install -g turbo`

### Installation

```bash
# Clone the repository
git clone https://github.com/username/js-report-card.git

# Install dependencies
cd js-report-card
npm install

# Install Turborepo CLI globally if you haven't already
npm install -g turbo
```

### Development

```bash
# Run all tests
turbo test

# Run tests with coverage
turbo test:coverage

# Start development mode
turbo dev

# Build all packages
turbo build

# Run linting
turbo lint

# Run specific tasks for specific packages
turbo run test --filter=@repo/core
turbo run build --filter=@repo/cli
```

### Using Turbo's Cache

Turbo provides powerful caching capabilities. To take advantage of this:

```bash
# Enable remote caching (requires Vercel account)
turbo login

# Run tasks with caching
turbo build --cache-dir=".turbo"

# Clear the cache if needed
turbo clean
```

## Project Structure

```
js-report-card/
├── apps/
│   ├── web/          # Web interface
│   └── docs/         # Documentation site
├── packages/
│   ├── core/         # Core analysis engine
│   ├── cli/          # Command line interface
│   ├── api/          # REST API service
│   └── config/       # Shared configurations
```

## Architecture

JS Report Card uses a plugin-based architecture for its analyzers, allowing for easy extension and customization. The core system supports multiple project sources and implements efficient caching for improved performance.

### Analyzer Types

- **Style & Format**: ESLint-based checks
- **Type Safety**: TypeScript compiler checks
- **Complexity**: Cyclomatic complexity analysis
- **Dead Code**: Unused code detection
- **Test Coverage**: Coverage reporting and analysis

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Standards

- Strict TypeScript usage
- Minimum 90% test coverage
- Comprehensive documentation
- Performance-focused implementation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Go Report Card](https://goreportcard.com/)
- Built with [Turborepo](https://turbo.build/)
- Powered by [TypeScript](https://www.typescriptlang.org/)

## Project Goals

Our mission is to help JavaScript and TypeScript projects maintain high code quality through automated analysis and actionable feedback. Key metrics we're targeting:

- 90%+ test coverage
- Sub-5 minute analysis time for medium projects
- Less than 1% false positives
- Clear, actionable feedback for all issues
- Successful analysis of top 100 npm packages

For more details about our goals and roadmap, see [ROADMAP.md](ROADMAP.md).