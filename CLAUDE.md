# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BAMOE (BPMN & DMN Editor) is a VS Code extension that provides visual editors for BPMN 2.0 workflows and DMN 1.3 decision models. It uses bpmn-js and dmn-js libraries for diagram rendering and editing.

## Commands

```bash
# Install dependencies
npm install

# Build the extension (bundles extension + webviews via Rollup)
npm run build

# Watch mode for development
npm run watch

# Lint TypeScript code
npm run lint

# Run VS Code extension tests
npm run test

# Package the extension as .vsix
npm run package
```

## Development Workflow

1. Run `npm run watch` in one terminal
2. Press F5 in VS Code to launch the Extension Development Host
3. Open a `.bpmn` or `.dmn` file to test the editors

Debug configurations are in `.vscode/launch.json`:
- "Run Extension" - launch extension with build
- "Extension Tests" - run test suite

## Architecture

The codebase has three main parts, each with its own build target:

### Extension (Node.js, CommonJS)
- Entry: `src/extension/extension.ts`
- Output: `dist/extension/extension.js`
- Registers custom editors (`BpmnEditorProvider`, `DmnEditorProvider`) and commands
- Uses VS Code's `CustomTextEditorProvider` for file sync and undo/redo support
- Communicates with webviews via typed message protocol in `src/shared/message-types.ts`

### BPMN Webview (Browser, IIFE)
- Entry: `src/webview/index.ts`
- Output: `dist/webview/webview.js`
- Creates bpmn-js modeler with extensions: properties panel, minimap, token simulation, linting
- Custom extensions in `src/webview/extensions/`: REST task, Kafka task, business rule task, script task, etc.
- Feature panels in `src/webview/features/`: templates, search, comments, diff, deploy, compliance

### DMN Webview (Browser, IIFE)
- Entry: `src/dmn-webview/index.ts`
- Output: `dist/webview/dmn-webview.js`
- Creates dmn-js viewer/modeler with properties panel

### Message Protocol
Extension and webviews communicate via postMessage. Types are defined in `src/shared/message-types.ts`:
- Extension -> Webview: `init`, `update`, `dmnFiles`
- Webview -> Extension: `ready`, `change`, `validation`, `requestDmnFiles`

## Key Configuration Files

- `rollup.config.mjs` - Builds all three bundles (extension + 2 webviews)
- `tsconfig.json` - Extension TypeScript config (excludes webview)
- `tsconfig.webview.json` - Webview TypeScript config
- `.bpmnlintrc` - BPMN validation rules (extends bpmnlint:recommended)
- `.eslintrc.json` - Linting config (single quotes, semicolons required)

## Code Style

- Single quotes for strings
- Semicolons required
- Unused function args prefixed with underscore (e.g., `_token`)
- No explicit `any` types (warns)
