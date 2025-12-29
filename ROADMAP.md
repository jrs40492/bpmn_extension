# BAMOE Roadmap - Future Enhancements

## Phase 1: Core UX Improvements ✅

- [x] **Properties Panel** - Add a side panel for editing element properties (name, ID, documentation, etc.)
- [x] **Zoom Controls** - Add UI buttons for zoom in/out/fit-to-viewport
- [x] **Minimap** - Add minimap module for navigating large diagrams
- [x] **Keyboard Shortcuts** - Document and expose common shortcuts (Cmd+Shift+/ to view)

## Phase 2: Export & Import

- [ ] **Export to PNG** - Allow exporting diagrams as PNG images
- [ ] **Export to SVG** - Allow exporting diagrams as scalable SVG
- [ ] **Import from other formats** - Support importing from other BPM tools

## Phase 3: Advanced Features ✅

- [x] **BPMN Templates** - Pre-built templates for common process patterns
- [x] **Element Search** - Search for elements by name or ID within the diagram
- [x] **Collaboration Comments** - Add commenting/annotation support
- [x] **Process Simulation** - Token-based simulation to visualize process flow
- [x] **Version Diff** - Visual diff between diagram versions

## Phase 4: Enterprise Features ✅

- [x] **Workflow Engine Integration** - Deploy to Camunda 7/8, Flowable, or custom engines
- [x] **BPMN Compliance Levels** - Support 4 compliance levels (Descriptive, Analytic, Common Executable, Full)
- [x] **Custom Element Extensions** - Built-in extensions (REST, Retry, Notification, Logging) + user-defined
- [x] **Multi-file Projects** - Support for BPMN projects with multiple diagrams and cross-diagram links

## Phase 5: Publishing

- [ ] **VS Code Marketplace** - Package and publish the extension
- [ ] **Documentation Site** - Create user documentation
- [ ] **CI/CD Pipeline** - Automated testing and releases

## Technical Debt

- [ ] Add comprehensive unit tests
- [ ] Add integration tests with @vscode/test-electron
- [ ] Improve error handling and user feedback
- [ ] Performance optimization for large diagrams
