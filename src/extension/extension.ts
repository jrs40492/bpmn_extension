import * as vscode from 'vscode';
import { BpmnEditorProvider } from './bpmn-editor-provider';

export function activate(context: vscode.ExtensionContext): void {
  // Register the custom editor provider
  context.subscriptions.push(BpmnEditorProvider.register(context));

  // Register command to create new BPMN file
  context.subscriptions.push(
    vscode.commands.registerCommand('bamoe.newBpmnFile', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const defaultUri = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder.uri, 'new-diagram.bpmn')
        : undefined;

      const uri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'BPMN Files': ['bpmn']
        },
        saveLabel: 'Create BPMN Diagram'
      });

      if (uri) {
        // Write the default BPMN template
        const defaultBpmn = getDefaultBpmnContent();
        await vscode.workspace.fs.writeFile(uri, Buffer.from(defaultBpmn, 'utf-8'));

        // Open the file with our custom editor
        await vscode.commands.executeCommand('vscode.openWith', uri, 'bamoe.bpmnEditor');
      }
    })
  );

  // Register command to show keyboard shortcuts
  context.subscriptions.push(
    vscode.commands.registerCommand('bamoe.showKeyboardShortcuts', () => {
      const shortcuts = `
# BPMN Editor Keyboard Shortcuts

## General
- **Ctrl/Cmd + Z** - Undo
- **Ctrl/Cmd + Shift + Z** or **Ctrl/Cmd + Y** - Redo
- **Ctrl/Cmd + A** - Select all elements
- **Delete** or **Backspace** - Delete selected elements
- **Escape** - Deselect / Cancel

## Navigation
- **Mouse wheel** - Zoom in/out
- **Ctrl/Cmd + Mouse wheel** - Zoom in/out (faster)
- **Click + Drag on canvas** - Pan
- **Ctrl/Cmd + 0** - Reset zoom to 100%
- **Ctrl/Cmd + 1** - Fit diagram to viewport

## Editing
- **Ctrl/Cmd + C** - Copy selected elements
- **Ctrl/Cmd + V** - Paste elements
- **Ctrl/Cmd + X** - Cut selected elements
- **E** - Activate direct editing (rename element)
- **H** - Hand tool (pan mode)
- **L** - Lasso tool (multi-select)
- **S** - Space tool (create/remove space)

## Elements
- **Click element** - Select element
- **Ctrl/Cmd + Click** - Add to selection
- **Double-click element** - Edit element name
- **Drag from palette** - Create new element
      `.trim();

      vscode.window.showInformationMessage('BPMN Editor Keyboard Shortcuts', {
        modal: true,
        detail: shortcuts
      });
    })
  );
}

export function deactivate(): void {
  // Cleanup if needed
}

/**
 * Returns the default BPMN 2.0 XML template for new diagrams
 */
function getDefaultBpmnContent(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_1</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="182" y="192" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="188" y="235" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="432" y="192" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="440" y="235" width="20" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="218" y="210" />
        <di:waypoint x="432" y="210" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
