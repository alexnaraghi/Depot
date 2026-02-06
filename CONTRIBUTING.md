# Contributing to Depot

Thank you for your interest in contributing to Depot! This document provides guidelines for setting up your development environment and contributing to the project.

Please note that this project adheres to a [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md). By participating, you are expected to uphold this code.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or later and npm
- **Rust** 1.75 or later with cargo
- **Windows 10 or later** (Depot targets Windows)
- **Perforce CLI** (p4.exe) for testing with a Perforce server

## Development Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/alexnaraghi/depot.git
cd depot
```

2. Install dependencies:

```bash
npm install
```

3. Run the development build:

```bash
npm run tauri dev
```

The application will launch with hot-reload enabled for both frontend and backend changes.

## Project Structure

- **`src/`** — React frontend (TypeScript)
  - Components, hooks, state management (Zustand, TanStack Query)
  - UI components using shadcn/ui and Tailwind CSS

- **`src-tauri/`** — Rust backend (Tauri commands)
  - Perforce CLI integration
  - Async command execution with tokio
  - File indexing and search

- **`.planning/`** — Development history and methodology
  - Documents the agentic development process (GSD methodology)
  - Phase plans, context, and decision logs

## Running Tests

### Unit Tests

```bash
npm test
```

### E2E Tests

End-to-end tests require a Perforce server setup. See `e2e/README.md` for configuration details.

```bash
npm run test:e2e
```

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

2. **Follow existing code style**:
   - Frontend: Prettier for TypeScript/React formatting
   - Backend: rustfmt for Rust formatting
   - Run formatters before committing

3. **Write clear commit messages**:
   - Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
   - Provide context in the commit body if needed

4. **Test your changes**:
   - Ensure the app builds and runs without errors
   - Test affected functionality manually
   - Add or update tests if applicable

5. **Open a Pull Request** against the `main` branch:
   - Provide a clear title and description
   - Explain what changes you made and why
   - Reference any related issues

6. **Respond to feedback**:
   - Address review comments
   - Push additional commits to your branch as needed

## Questions?

If you have questions or need help:

- Open a [GitHub Discussion](https://github.com/alexnaraghi/depot/discussions)
- File an [Issue](https://github.com/alexnaraghi/depot/issues) if you find a bug

We appreciate your contributions!
