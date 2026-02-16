# BAMOE - BPMN & DMN Editor for VS Code

Visual editors for BPMN 2.0 workflows and DMN 1.3 decision models, powered by [bpmn-js](https://github.com/bpmn-io/bpmn-js) and [dmn-js](https://github.com/bpmn-io/dmn-js).

## Features

- **BPMN Editor** - Full modeler with properties panel, minimap, token simulation, and linting
- **DMN Editor** - Viewer/modeler with properties panel for decision tables and DRDs
- Custom service task extensions: REST, Kafka, business rule, and script tasks
- Built-in features: templates, search, comments, diff, deploy, and compliance panels

## Installation

### From GitHub Release (recommended)

1. Go to the [Releases](https://github.com/jrs40492/bpmn_extension/releases) page
2. Download the latest `bamoe-x.x.x.vsix` file
3. Install using one of these methods:
   - **CLI:** `code --install-extension bamoe-0.1.0.vsix`
   - **VS Code UI:** Extensions sidebar > `...` menu > "Install from VSIX..."

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/jrs40492/bpmn_extension.git
   cd bpmn_extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build and package:
   ```bash
   npm run package
   ```
4. Install the generated `.vsix`:
   ```bash
   code --install-extension bamoe-0.1.0.vsix
   ```

## Usage

Once installed, open any `.bpmn` or `.dmn` file and the visual editor will open automatically.

You can also create new diagrams via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):
- **BPMN: Create New BPMN Diagram**
- **DMN: Create New DMN Decision**

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start watch mode:
   ```bash
   npm run watch
   ```
3. Press **F5** in VS Code to launch the Extension Development Host
4. Open a `.bpmn` or `.dmn` file to test the editors

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the extension (bundles extension + webviews via Rollup) |
| `npm run watch` | Watch mode for development |
| `npm run lint` | Lint TypeScript code |
| `npm run test` | Run VS Code extension tests |
| `npm run package` | Package the extension as `.vsix` |

## License

MIT
