/**
 * Business Rule Task Properties Provider
 * Uses Kogito/jBPM compatible BPMN format for DMN decision linking
 *
 * Format:
 * - businessRuleTask with implementation="http://www.jboss.org/drools/dmn"
 * - ioSpecification with dataInputs: model, namespace, decision
 * - dataInputAssociation with assignments for values
 */

import { TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';
import { html } from 'htm/preact';
import { useState } from '@bpmn-io/properties-panel/preact/hooks';

import { DMN_IMPLEMENTATION_URI, DMN_DATA_INPUTS } from './moddle-descriptor';

// ============================================================================
// BPMN-JS Type Definitions (no official types available)
// ============================================================================

interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  id?: string;
  name?: string;
  get?: (key: string) => unknown;
  set?: (key: string, value: unknown) => void;
}

interface FormalExpression extends ModdleElement {
  body?: string;
}

interface Assignment extends ModdleElement {
  from?: FormalExpression;
  to?: FormalExpression;
}

interface DataInput extends ModdleElement {
  itemSubjectRef?: ModdleElement;
}

interface DataInputAssociation extends ModdleElement {
  targetRef?: DataInput;
  assignment?: Assignment[];
}

interface IoSpecification extends ModdleElement {
  dataInputs?: DataInput[];
  inputSets?: ModdleElement[];
  outputSets?: ModdleElement[];
}

interface ExtensionElements extends ModdleElement {
  values?: ModdleElement[];
}

interface DecisionTaskConfig extends ModdleElement {
  dmnFileName?: string;
  dmnFile?: string;
  decisionRef?: string;
}

interface BusinessObject extends ModdleElement {
  implementation?: string;
  extensionElements?: ExtensionElements;
  ioSpecification?: IoSpecification;
  dataInputAssociations?: DataInputAssociation[];
}

interface BpmnElement {
  businessObject?: BusinessObject;
  id?: string;
}

interface Definitions extends ModdleElement {
  rootElements?: ModdleElement[];
}

interface BpmnFactory {
  create(type: string, properties?: Record<string, unknown>): ModdleElement;
}

interface CommandStack {
  execute(command: string, context: Record<string, unknown>): void;
}

interface EventBus {
  on(event: string, callback: (event: SelectionChangedEvent) => void): void;
}

interface PropertiesPanel {
  registerProvider(priority: number, provider: unknown): void;
}

interface SelectionChangedEvent {
  newSelection?: BpmnElement[];
}

interface PropertyEntry {
  id: string;
  component: (props: { element: BpmnElement; id: string }) => unknown;
  isEdited: () => boolean;
}

interface PropertiesGroup {
  id: string;
  label: string;
  entries: PropertyEntry[];
}

interface DmnInputDefinition {
  name: string;
  typeRef: string;
}

interface VscodeApi {
  postMessage(message: { type: string; fileName?: string; modelName?: string; inputs?: DmnInputDefinition[] }): void;
}

declare global {
  interface Window {
    vscodeApi?: VscodeApi;
  }
}

// ============================================================================
// DMN File Types
// ============================================================================

export interface DmnFileInfo {
  path: string;
  name: string; // Relative file path for display
  modelName?: string; // DMN model name from <definitions name="..."> (required for Kogito/jBPM model input)
  namespace?: string;
  decisions: Array<{
    id: string;
    name: string;
  }>;
  inputData?: Array<{
    id: string;
    name: string;
    typeRef?: string;
  }>;
  outputData?: Array<{
    decisionId: string;
    decisionName: string;
    variableName: string;
    typeRef?: string;
  }>;
}

// Store for available DMN files (populated via messages from extension)
let availableDmnFiles: DmnFileInfo[] = [];

// Function to update available DMN files (called from webview message handler)
export function setAvailableDmnFiles(files: DmnFileInfo[]): void {
  availableDmnFiles = files;
}

// Function to get available DMN files
export function getAvailableDmnFiles(): DmnFileInfo[] {
  return availableDmnFiles;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper to check if element is a Business Rule Task
function isBusinessRuleTask(element: BpmnElement): boolean {
  return element?.businessObject?.$type === 'bpmn:BusinessRuleTask';
}

// Helper to get data input value from ioSpecification
function getDataInputValue(element: BpmnElement, inputName: string): string {
  const bo = element?.businessObject;
  if (!bo) return '';

  // First check for legacy dmn:DecisionTaskConfig format
  const legacyConfig = getLegacyDecisionConfig(element);
  if (legacyConfig) {
    if (inputName === DMN_DATA_INPUTS.MODEL) return legacyConfig.dmnFileName || legacyConfig.dmnFile || '';
    if (inputName === DMN_DATA_INPUTS.DECISION) return legacyConfig.decisionRef || '';
    if (inputName === DMN_DATA_INPUTS.NAMESPACE) return '';
  }

  // Look in dataInputAssociations
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      // Get value from assignment
      const assignment = assoc.assignment?.[0];
      if (assignment?.from?.body !== undefined) {
        return assignment.from.body;
      }
    }
  }

  return '';
}

// Helper to get legacy DecisionTaskConfig (for backward compatibility)
function getLegacyDecisionConfig(element: BpmnElement): DecisionTaskConfig | null {
  const bo = element?.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements || (bo.get?.('extensionElements') as ExtensionElements | undefined);
  if (!extensionElements) return null;

  const values = extensionElements.values || (extensionElements.get?.('values') as ModdleElement[] | undefined) || [];
  return (values.find((ext: ModdleElement) => ext.$type === 'dmn:DecisionTaskConfig') as DecisionTaskConfig) || null;
}

// Helper to ensure drools:metaData extension element exists
function ensureMetaData(element: BpmnElement, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  const bo = element.businessObject;
  if (!bo) return;

  // Get or create extension elements
  let extensionElements = bo.extensionElements;
  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] }) as ExtensionElements;
    extensionElements.$parent = bo;
  }

  // Check if metaData already exists
  const values = extensionElements.values || [];
  const hasMetaData = values.some((v: ModdleElement) => v.$type === 'drools:metaData' && v.name === 'elementname');

  if (!hasMetaData) {
    // Create drools:metaValue element with body property (this creates <drools:metaValue>text</drools:metaValue>)
    const metaValue = bpmnFactory.create('drools:metaValue', {
      body: bo.name || bo.id
    });

    // Create drools:metaData element (lowercase 'm' matches the descriptor)
    const metaData = bpmnFactory.create('drools:metaData', {
      name: 'elementname',
      metaValue: metaValue
    });
    metaValue.$parent = metaData;
    metaData.$parent = extensionElements;
    values.push(metaData);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        extensionElements
      }
    });
  }
}

// Helper to get the definitions element (root of the BPMN document)
function getDefinitions(element: BpmnElement): Definitions {
  let current: ModdleElement | undefined = element.businessObject;
  while (current?.$parent) {
    current = current.$parent;
  }
  return current as Definitions;
}

// Helper to ensure itemDefinition exists at definitions level
function ensureItemDefinition(definitions: Definitions, itemId: string, structureRef: string, bpmnFactory: BpmnFactory): ModdleElement {
  // Check if itemDefinition already exists
  const rootElements = definitions.rootElements || [];
  let itemDef = rootElements.find((el: ModdleElement) => el.$type === 'bpmn:ItemDefinition' && el.id === itemId);

  if (!itemDef) {
    // Create new itemDefinition
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemId,
      structureRef: structureRef
    });
    itemDef.$parent = definitions;

    // Add to rootElements (insert before process elements)
    if (!definitions.rootElements) {
      definitions.rootElements = [];
    }
    // Find insertion point - before first process
    const processIndex = definitions.rootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      definitions.rootElements.splice(processIndex, 0, itemDef);
    } else {
      definitions.rootElements.push(itemDef);
    }
  }

  return itemDef;
}

// Helper to ensure ioSpecification and data inputs exist (Kogito/BAMOE compatible format)
function ensureIoSpecification(element: BpmnElement, bpmnFactory: BpmnFactory, commandStack: CommandStack): IoSpecification | undefined {
  const bo = element.businessObject;
  if (!bo) return undefined;
  const taskId = bo.id;

  // Check if ioSpecification already exists with the correct inputs
  let ioSpec = bo.ioSpecification;
  if (ioSpec) {
    // Check if it has the required DMN inputs (namespace, model, decision)
    const dataInputs = ioSpec.dataInputs || [];
    const hasNamespace = dataInputs.some((di: DataInput) => di.name === 'namespace');
    const hasModel = dataInputs.some((di: DataInput) => di.name === 'model');
    if (hasNamespace && hasModel) {
      return ioSpec;
    }
  }

  // Ensure metaData extension element exists
  ensureMetaData(element, bpmnFactory, commandStack);

  // Get definitions to add itemDefinitions
  const definitions = getDefinitions(element);

  // Create data inputs with drools:dtype and itemSubjectRef attributes (Kogito format)
  const dataInputs: DataInput[] = [];
  const dataInputRefs: DataInput[] = [];

  // Order: namespace, model, decision (matching Kogito examples)
  for (const inputName of [DMN_DATA_INPUTS.NAMESPACE, DMN_DATA_INPUTS.MODEL, DMN_DATA_INPUTS.DECISION]) {
    const inputId = `${taskId}_${inputName}InputX`;
    const itemDefId = `_${inputId}Item`;

    // Ensure itemDefinition exists at definitions level
    const itemDef = ensureItemDefinition(definitions, itemDefId, 'java.lang.String', bpmnFactory);

    // Create dataInput with itemSubjectRef reference
    const dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: inputId,
      name: inputName,
      itemSubjectRef: itemDef
    }) as DataInput;
    // Set drools:dtype attribute for Kogito compatibility
    dataInput.set?.('drools:dtype', 'java.lang.String');
    dataInputs.push(dataInput);
    dataInputRefs.push(dataInput);
  }

  // Create input set (no ID - Kogito format)
  const inputSet = bpmnFactory.create('bpmn:InputSet', {
    dataInputRefs: dataInputRefs
  });

  // Create empty output set (no ID, no dataOutputs - Kogito format for DMN tasks)
  const outputSet = bpmnFactory.create('bpmn:OutputSet', {});

  // Create ioSpecification (no ID - Kogito format)
  ioSpec = bpmnFactory.create('bpmn:InputOutputSpecification', {
    dataInputs: dataInputs,
    inputSets: [inputSet],
    outputSets: [outputSet]
  }) as IoSpecification;

  // Set parent references
  dataInputs.forEach(di => { di.$parent = ioSpec; });
  inputSet.$parent = ioSpec;
  outputSet.$parent = ioSpec;
  ioSpec.$parent = bo;

  // Create data input associations (no ID - Kogito format)
  const dataInputAssociations: DataInputAssociation[] = [];
  for (const dataInput of dataInputs) {
    const fromExpression = bpmnFactory.create('bpmn:FormalExpression', { body: '' });
    const toExpression = bpmnFactory.create('bpmn:FormalExpression', { body: dataInput.id });
    const assignment = bpmnFactory.create('bpmn:Assignment', {
      from: fromExpression,
      to: toExpression
    });
    const association = bpmnFactory.create('bpmn:DataInputAssociation', {
      targetRef: dataInput,
      assignment: [assignment]
    }) as DataInputAssociation;
    assignment.$parent = association;
    association.$parent = bo;
    dataInputAssociations.push(association);
  }

  // Update element with new ioSpecification and associations (no dataOutputAssociations for DMN tasks)
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: bo,
    properties: {
      implementation: DMN_IMPLEMENTATION_URI,
      ioSpecification: ioSpec,
      dataInputAssociations: dataInputAssociations
    }
  });

  return ioSpec;
}

// Helper to update a data input value
function setDataInputValue(element: BpmnElement, inputName: string, value: string, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  const bo = element.businessObject;
  if (!bo) return;

  // Ensure ioSpecification exists
  ensureIoSpecification(element, bpmnFactory, commandStack);

  // Find the association for this input (handles both InputX and Input suffixes)
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from) {
        // Update the from expression
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: assignment.from,
          properties: { body: value }
        });
        return;
      }
    }
  }

  // If not found, create a new association (for existing elements without the DMN inputs)
  const ioSpec = bo.ioSpecification;
  if (ioSpec) {
    const dataInputs = ioSpec.dataInputs || [];
    const dataInput = dataInputs.find((di: DataInput) => di.name === inputName);
    if (dataInput) {
      const fromExpression = bpmnFactory.create('bpmn:FormalExpression', { body: value });
      const toExpression = bpmnFactory.create('bpmn:FormalExpression', { body: dataInput.id });
      const assignment = bpmnFactory.create('bpmn:Assignment', {
        from: fromExpression,
        to: toExpression
      });
      // No ID on association - Kogito format
      const association = bpmnFactory.create('bpmn:DataInputAssociation', {
        targetRef: dataInput,
        assignment: [assignment]
      }) as DataInputAssociation;
      assignment.$parent = association;
      association.$parent = bo;

      const newAssociations = [...(bo.dataInputAssociations || []), association];
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: bo,
        properties: { dataInputAssociations: newAssociations }
      });
    }
  }
}

// Helper to get available process variables
function getAvailableProcessVariables(element: BpmnElement): Array<{ id: string; name: string }> {
  const bo = element.businessObject;
  if (!bo) return [];
  const variables: Array<{ id: string; name: string }> = [];

  // Navigate up to find the process
  let process: ModdleElement | undefined = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return variables;

  // Get variables from bpmn:property elements (standard BPMN)
  const properties = (process as any).properties || [];
  for (const prop of properties) {
    if (prop.id || prop.name) {
      variables.push({
        id: prop.id || prop.name,
        name: prop.name || prop.id
      });
    }
  }

  // Also get from bamoe:ProcessVariables extension (if exists)
  const extensionElements = (process as any).extensionElements;
  if (extensionElements?.values) {
    const processVariables = extensionElements.values.find(
      (ext: ModdleElement) => ext.$type === 'bamoe:ProcessVariables'
    );
    if (processVariables?.variables) {
      for (const v of processVariables.variables) {
        // Avoid duplicates
        if (v.name && !variables.find(existing => existing.name === v.name)) {
          variables.push({ id: v.name, name: v.name });
        }
      }
    }
  }

  return variables;
}

// Helper to get DMN input mapping value (process variable mapped to DMN input)
function getDmnInputMapping(element: BpmnElement, inputName: string): string {
  const bo = element.businessObject;
  if (!bo) return '';

  // Look in dataInputAssociations for a mapping to this DMN input
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === inputName) {
      // Check if this is a variable reference (sourceRef) vs a literal assignment
      // sourceRef can be an array of element references or strings
      const sourceRefArray = (assoc as any).sourceRef;
      if (sourceRefArray && Array.isArray(sourceRefArray) && sourceRefArray.length > 0) {
        const sourceRef = sourceRefArray[0];
        // Filter out invalid values
        if (sourceRef === undefined || sourceRef === null || sourceRef === 'undefined') {
          return '';
        }
        if (typeof sourceRef === 'string') {
          // Filter out the literal string "undefined"
          if (sourceRef === 'undefined' || sourceRef === 'null') {
            return '';
          }
          return sourceRef;
        } else if (sourceRef?.name) {
          // It's a Property element reference - return the name
          return sourceRef.name;
        } else if (sourceRef?.id) {
          return sourceRef.id;
        }
      }
      // Check assignment for variable expression
      const assignment = assoc.assignment?.[0];
      if (assignment?.from?.body) {
        return assignment.from.body;
      }
    }
  }

  return '';
}

// Helper to find a process property by name
function findProcessProperty(element: BpmnElement, propertyName: string): ModdleElement | undefined {
  const bo = element.businessObject;
  if (!bo) return undefined;

  // Navigate up to find the process
  let process: ModdleElement | undefined = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return undefined;

  // Look for property with matching name or id
  const properties = (process as any).properties || [];
  return properties.find((prop: ModdleElement) =>
    prop.name === propertyName || prop.id === propertyName
  );
}

// Helper to ensure a process property exists, creating it if necessary
function ensureProcessProperty(element: BpmnElement, propertyName: string, bpmnFactory: BpmnFactory): ModdleElement | undefined {
  // First try to find existing property
  let property = findProcessProperty(element, propertyName);
  if (property) return property;

  const bo = element.businessObject;
  if (!bo) return undefined;

  // Navigate up to find the process
  let process: ModdleElement | undefined = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return undefined;

  // Navigate up to find definitions
  const definitions = process.$parent as Definitions;
  if (!definitions || definitions.$type !== 'bpmn:Definitions') return undefined;

  // Create itemDefinition for the variable
  const itemDefId = `_${propertyName}Item`;
  let itemDef = definitions.rootElements?.find(
    (el: ModdleElement) => el.$type === 'bpmn:ItemDefinition' && el.id === itemDefId
  );

  if (!itemDef) {
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: 'java.lang.Object'
    });
    itemDef.$parent = definitions;
    if (!definitions.rootElements) {
      definitions.rootElements = [];
    }
    // Insert before first process element
    const processIndex = definitions.rootElements.findIndex((el: ModdleElement) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      definitions.rootElements.splice(processIndex, 0, itemDef);
    } else {
      definitions.rootElements.push(itemDef);
    }
  }

  // Create the property element
  property = bpmnFactory.create('bpmn:Property', {
    id: propertyName,
    name: propertyName,
    itemSubjectRef: itemDef
  });
  property.$parent = process;

  if (!(process as any).properties) {
    (process as any).properties = [];
  }
  (process as any).properties.push(property);

  return property;
}

// Helper to set DMN input mapping (map process variable to DMN input)
function setDmnInputMapping(element: BpmnElement, inputName: string, variableName: string, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  // Strict validation to prevent writing "undefined" or invalid values
  if (!variableName || typeof variableName !== 'string' || variableName === 'undefined' || variableName === 'null' || variableName.trim() === '') {
    console.warn('[DMN Input Mapping] Ignoring invalid variable name:', variableName);
    return;
  }

  const bo = element.businessObject;
  if (!bo) return;
  const taskId = bo.id;

  // Find or create the Property element for this variable
  const propertyElement = ensureProcessProperty(element, variableName, bpmnFactory);
  if (!propertyElement) {
    console.warn('[DMN Input Mapping] Could not find or create property element for variable:', variableName);
    return;
  }

  // Ensure ioSpecification exists
  let ioSpec = bo.ioSpecification;
  if (!ioSpec) {
    ensureIoSpecification(element, bpmnFactory, commandStack);
    ioSpec = bo.ioSpecification;
  }
  if (!ioSpec) return;

  // Check if dataInput for this DMN input already exists
  const dataInputs = ioSpec.dataInputs || [];
  let dataInput = dataInputs.find((di: DataInput) => di.name === inputName);

  // Get definitions for itemDefinition
  const definitions = getDefinitions(element);

  let needsIoSpecUpdate = false;

  if (!dataInput) {
    // Create new dataInput for this DMN input
    const inputId = `${taskId}_${inputName}InputX`;
    const itemDefId = `_${inputId}Item`;

    // Ensure itemDefinition exists
    const itemDef = ensureItemDefinition(definitions, itemDefId, 'java.lang.Object', bpmnFactory);

    dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: inputId,
      name: inputName,
      itemSubjectRef: itemDef
    }) as DataInput;
    dataInput.set?.('drools:dtype', 'java.lang.Object');
    dataInput.$parent = ioSpec;

    // Add to ioSpecification
    if (!ioSpec.dataInputs) {
      ioSpec.dataInputs = [];
    }
    ioSpec.dataInputs.push(dataInput);

    // Add to inputSet
    const inputSet = ioSpec.inputSets?.[0];
    if (inputSet) {
      if (!(inputSet as any).dataInputRefs) {
        (inputSet as any).dataInputRefs = [];
      }
      (inputSet as any).dataInputRefs.push(dataInput);
    }
    needsIoSpecUpdate = true;
  }

  // Find existing dataInputAssociation for this input
  const associations = bo.dataInputAssociations || [];
  const existingAssoc = associations.find((a: DataInputAssociation) => a.targetRef?.name === inputName);

  if (existingAssoc) {
    // Update existing association using commandStack
    // Use the actual Property element reference, not just a string
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: existingAssoc,
      properties: {
        sourceRef: [propertyElement],
        assignment: undefined // Remove assignment when using sourceRef
      }
    });
  } else {
    // Create new association
    const newAssoc = bpmnFactory.create('bpmn:DataInputAssociation', {
      targetRef: dataInput
    }) as DataInputAssociation;

    // Set sourceRef to reference the actual Property element
    (newAssoc as any).sourceRef = [propertyElement];
    newAssoc.$parent = bo;

    // Add to associations list
    const newAssociations = [...associations, newAssoc];

    // Update with new association list
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        dataInputAssociations: newAssociations
      }
    });
  }

  // Update ioSpecification if we added new dataInput
  if (needsIoSpecUpdate) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        ioSpecification: ioSpec
      }
    });
  }
}

// ============================================================================
// DMN Output Mapping Helpers
// ============================================================================

interface DataOutput extends ModdleElement {
  itemSubjectRef?: ModdleElement;
}

interface DataOutputAssociation extends ModdleElement {
  sourceRef?: DataOutput;
  targetRef?: ModdleElement;
}

// Helper to get DMN output mapping (process variable that receives DMN output)
function getDmnOutputMapping(element: BpmnElement, outputName: string): string {
  const bo = element.businessObject;
  if (!bo) return '';

  // Look in dataOutputAssociations for a mapping from this DMN output
  const associations = (bo as any).dataOutputAssociations || [];
  for (const assoc of associations) {
    // sourceRef can be an array (bpmn-js moddle) or a single object
    const sourceRef = assoc.sourceRef;
    const sourceElement = Array.isArray(sourceRef) ? sourceRef[0] : sourceRef;
    if (sourceElement?.name === outputName) {
      // Get the target (process variable)
      const targetRef = assoc.targetRef;
      if (targetRef) {
        if (typeof targetRef === 'string') {
          return targetRef;
        } else if (targetRef.name) {
          return targetRef.name;
        } else if (targetRef.id) {
          return targetRef.id;
        }
      }
    }
  }

  return '';
}

// Helper to set DMN output mapping (map DMN output to process variable)
function setDmnOutputMapping(element: BpmnElement, outputName: string, variableName: string, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  // Strict validation
  if (!variableName || typeof variableName !== 'string' || variableName === 'undefined' || variableName === 'null' || variableName.trim() === '') {
    console.warn('[DMN Output Mapping] Ignoring invalid variable name:', variableName);
    return;
  }

  const bo = element.businessObject;
  if (!bo) return;
  const taskId = bo.id;

  // Find or create the Property element for this variable
  const propertyElement = ensureProcessProperty(element, variableName, bpmnFactory);
  if (!propertyElement) {
    console.warn('[DMN Output Mapping] Could not find or create property element for variable:', variableName);
    return;
  }

  // Ensure ioSpecification exists
  let ioSpec = bo.ioSpecification;
  if (!ioSpec) {
    ensureIoSpecification(element, bpmnFactory, commandStack);
    ioSpec = bo.ioSpecification;
  }
  if (!ioSpec) return;

  // Get definitions for itemDefinition
  const definitions = getDefinitions(element);

  // Check if dataOutput for this DMN output already exists
  const dataOutputs = (ioSpec as any).dataOutputs || [];
  let dataOutput = dataOutputs.find((d: DataOutput) => d.name === outputName);

  let needsIoSpecUpdate = false;

  if (!dataOutput) {
    // Create new dataOutput for this DMN output
    const outputId = `${taskId}_${outputName}OutputX`;
    const itemDefId = `_${outputId}Item`;

    // Ensure itemDefinition exists
    const itemDef = ensureItemDefinition(definitions, itemDefId, 'java.lang.Object', bpmnFactory);

    dataOutput = bpmnFactory.create('bpmn:DataOutput', {
      id: outputId,
      name: outputName,
      itemSubjectRef: itemDef
    }) as DataOutput;
    dataOutput.set?.('drools:dtype', 'java.lang.Object');
    dataOutput.$parent = ioSpec;

    // Add to ioSpecification dataOutputs
    if (!(ioSpec as any).dataOutputs) {
      (ioSpec as any).dataOutputs = [];
    }
    (ioSpec as any).dataOutputs.push(dataOutput);

    // Add to outputSet
    const outputSet = (ioSpec as any).outputSets?.[0];
    if (outputSet) {
      if (!(outputSet as any).dataOutputRefs) {
        (outputSet as any).dataOutputRefs = [];
      }
      (outputSet as any).dataOutputRefs.push(dataOutput);
    }
    needsIoSpecUpdate = true;
  }

  // Find existing dataOutputAssociation for this output
  const associations = (bo as any).dataOutputAssociations || [];
  const existingAssoc = associations.find((a: DataOutputAssociation) => {
    // sourceRef can be an array (bpmn-js moddle) or a single object
    const sourceRef = (a as any).sourceRef;
    const sourceElement = Array.isArray(sourceRef) ? sourceRef[0] : sourceRef;
    return sourceElement?.name === outputName;
  });

  if (existingAssoc) {
    // Update existing association using commandStack
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: existingAssoc,
      properties: {
        targetRef: propertyElement
      }
    });
  } else {
    // Create new association
    // Note: sourceRef is an array in bpmn-js moddle, containing references to dataOutput elements
    const newAssoc = bpmnFactory.create('bpmn:DataOutputAssociation', {
      targetRef: propertyElement
    }) as DataOutputAssociation;
    // sourceRef must be set as an array containing the dataOutput reference
    (newAssoc as any).sourceRef = [dataOutput];
    newAssoc.$parent = bo;

    // Add to associations list
    const newAssociations = [...associations, newAssoc];

    // Update with new association list
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        dataOutputAssociations: newAssociations
      }
    });
  }

  // Update ioSpecification if we added new dataOutput
  if (needsIoSpecUpdate) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: {
        ioSpecification: ioSpec
      }
    });
  }
}

// Remove legacy DecisionTaskConfig and migrate to new format
function migrateLegacyConfig(element: BpmnElement, bpmnFactory: BpmnFactory, commandStack: CommandStack): void {
  const legacyConfig = getLegacyDecisionConfig(element);
  if (!legacyConfig) return;

  const bo = element.businessObject;
  if (!bo) return;

  // Extract values from legacy config
  const model = legacyConfig.dmnFileName || legacyConfig.dmnFile || '';
  const decision = legacyConfig.decisionRef || '';

  // Remove the legacy extension element
  const extensionElements = bo.extensionElements;
  if (extensionElements?.values) {
    const newValues = extensionElements.values.filter((ext: ModdleElement) => ext.$type !== 'dmn:DecisionTaskConfig');
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: { values: newValues }
    });
  }

  // Ensure new format is set up
  ensureIoSpecification(element, bpmnFactory, commandStack);

  // Set the migrated values
  if (model) setDataInputValue(element, DMN_DATA_INPUTS.MODEL, model, bpmnFactory, commandStack);
  if (decision) setDataInputValue(element, DMN_DATA_INPUTS.DECISION, decision, bpmnFactory, commandStack);
}

// ============================================================================
// Create DMN State Management
// ============================================================================

// State for create DMN mode (stored globally to persist across re-renders)
let createDmnState = {
  isCreating: false,
  modelName: '',
  inputs: [] as DmnInputDefinition[],
  pendingAutoSelect: null as string | null  // Model name to auto-select after creation
};

// Callback for when DMN creation result is received
let onCreateDmnResult: ((result: { success: boolean; file?: DmnFileInfo; error?: string }) => void) | null = null;

// Function to handle DMN creation result (called from webview message handler)
export function handleCreateDmnFileResult(result: { success: boolean; file?: DmnFileInfo; error?: string }): void {
  console.log('[Business Rule Task] Received createDmnFileResult:', result);
  if (onCreateDmnResult) {
    onCreateDmnResult(result);
  }
  // Reset state after handling
  createDmnState.isCreating = false;
  createDmnState.modelName = '';
  createDmnState.inputs = [];
}

// Request DMN file creation
function requestCreateDmnFile(fileName: string, modelName: string, inputs: DmnInputDefinition[]): void {
  const vscode = window.vscodeApi;
  if (vscode) {
    createDmnState.pendingAutoSelect = modelName;
    vscode.postMessage({
      type: 'createDmnFile',
      fileName,
      modelName,
      inputs
    });
  }
}

// ============================================================================
// Property Panel Components
// ============================================================================

// Helper to check if a DMN model name conflicts with a process variable
// Kogito interprets identifiers matching process variables as variable references
function checkModelNameConflict(element: BpmnElement, modelName: string): string | null {
  if (!modelName) return null;

  const variables = getAvailableProcessVariables(element);
  const conflictingVar = variables.find(v => v.name === modelName);

  if (conflictingVar) {
    return `Warning: DMN model name "${modelName}" conflicts with process variable "${conflictingVar.name}". ` +
      `Kogito will interpret this as a variable reference. Consider renaming the DMN model.`;
  }
  return null;
}

// DMN File Select component
function DmnFileSelect(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
  };

  const setValue = (value: string) => {
    // Migrate legacy config if present
    migrateLegacyConfig(element, bpmnFactory, commandStack);

    // Ensure ioSpecification exists
    ensureIoSpecification(element, bpmnFactory, commandStack);

    // Find the selected file by modelName (dropdown value is now modelName)
    const selectedFile = availableDmnFiles.find(f => (f.modelName || f.name) === value);

    // Check for name collision with process variables
    const warning = checkModelNameConflict(element, value);
    if (warning) {
      console.warn('[Business Rule Task]', warning);
    }

    // Set the model value - this is now the modelName for Kogito/jBPM compatibility
    // Kogito expects the DMN model name (from <definitions name="...">) not the filename
    setDataInputValue(element, DMN_DATA_INPUTS.MODEL, value, bpmnFactory, commandStack);

    // Set the namespace
    if (selectedFile?.namespace) {
      setDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE, selectedFile.namespace, bpmnFactory, commandStack);
    }

    // Clear decision when file changes
    setDataInputValue(element, DMN_DATA_INPUTS.DECISION, '', bpmnFactory, commandStack);
  };

  const getOptions = () => {
    const options = [
      { value: '', label: translate('-- Select DMN File --') }
    ];

    for (const file of availableDmnFiles) {
      // Use modelName as value for Kogito compatibility, show filename for user clarity
      const modelName = file.modelName || file.name;
      options.push({
        value: modelName,
        label: `${file.name}${file.modelName ? ` (${file.modelName})` : ''}`
      });
    }

    return options;
  };

  return SelectEntry({
    id,
    element,
    label: translate('DMN File'),
    getValue,
    setValue,
    getOptions,
    debounce
  } as any);
}

// Decision Select component
function DecisionSelect(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.DECISION);
  };

  const setValue = (value: string) => {
    // Migrate legacy config if present
    migrateLegacyConfig(element, bpmnFactory, commandStack);

    setDataInputValue(element, DMN_DATA_INPUTS.DECISION, value, bpmnFactory, commandStack);
  };

  const getOptions = () => {
    const currentModel = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);

    const options = [
      { value: '', label: translate('-- Select Decision --') }
    ];

    if (currentModel) {
      // Match by modelName (primary), then fall back to filename matching for backward compatibility
      const selectedFile = availableDmnFiles.find(f =>
        (f.modelName || f.name) === currentModel ||
        f.name === currentModel ||
        f.path === currentModel ||
        f.name.endsWith(currentModel) ||
        currentModel.endsWith(f.name)
      );
      if (selectedFile?.decisions) {
        for (const decision of selectedFile.decisions) {
          options.push({
            value: decision.id,
            label: decision.name || decision.id
          });
        }
      }
    }

    return options;
  };

  return SelectEntry({
    id,
    element,
    label: translate('Decision'),
    getValue,
    setValue,
    getOptions,
    debounce
  } as any);
}

// DMN Namespace component (read-only, auto-populated)
function DmnNamespace(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const translate = useService('translate') as (text: string) => string;
  const debounce = useService('debounceInput') as <T>(fn: T) => T;

  const getValue = () => {
    return getDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE);
  };

  const setValue = () => {
    // Read-only - namespace is auto-populated when selecting DMN file
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('DMN Namespace'),
    getValue,
    setValue,
    disabled: true,
    debounce
  } as any);
}

// Available type options for DMN inputs
const DMN_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' }
];

// Create DMN Form Component
function CreateDmnForm(props: { element: BpmnElement; id: string; onCreated: (modelName: string) => void }) {
  const { element, id, onCreated } = props;
  const translate = useService('translate') as (text: string) => string;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;

  const [modelName, setModelName] = useState('');
  const [inputs, setInputs] = useState<DmnInputDefinition[]>([{ name: '', typeRef: 'string' }]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddInput = () => {
    setInputs([...inputs, { name: '', typeRef: 'string' }]);
  };

  const handleRemoveInput = (index: number) => {
    if (inputs.length > 1) {
      setInputs(inputs.filter((_, i) => i !== index));
    }
  };

  const handleInputChange = (index: number, field: 'name' | 'typeRef', value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setInputs(newInputs);
  };

  const handleSubmit = () => {
    // Validate
    if (!modelName.trim()) {
      setError(translate('Model name is required'));
      return;
    }

    const validInputs = inputs.filter(i => i.name.trim());
    if (validInputs.length === 0) {
      setError(translate('At least one input with a name is required'));
      return;
    }

    // Check for duplicate input names
    const names = validInputs.map(i => i.name.trim());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setError(translate('Input names must be unique'));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    // Set up callback to handle result
    onCreateDmnResult = (result) => {
      setIsSubmitting(false);
      if (result.success && result.file) {
        // Reset form
        setModelName('');
        setInputs([{ name: '', typeRef: 'string' }]);

        // Notify parent to select the new DMN
        if (result.file.modelName) {
          onCreated(result.file.modelName);
        }
      } else if (result.error) {
        setError(result.error);
      }
    };

    // Generate file name from model name (convert to kebab-case)
    const fileName = modelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Request creation
    requestCreateDmnFile(fileName, modelName.trim(), validInputs.map(i => ({
      name: i.name.trim(),
      typeRef: i.typeRef
    })));
  };

  const inputRowStyle = {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    marginBottom: '6px'
  };

  const sectionStyle = {
    marginBottom: '12px'
  };

  const actionsStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid var(--vscode-widget-border, #454545)'
  };

  return html`
    <div class="create-dmn-form">
      <div class="create-dmn-form-header">
        <span class="create-dmn-form-title">${translate('New DMN File')}</span>
        <button
          type="button"
          class="cancel-dmn-button"
          onClick=${() => onCreated('')}
          title=${translate('Close')}
        >
          ×
        </button>
      </div>

      <div style=${sectionStyle}>
        <label class="create-dmn-form-label">${translate('Model Name')}</label>
        <input
          type="text"
          class="create-dmn-form-input"
          value=${modelName}
          placeholder=${translate('e.g., CustomerEligibility')}
          onInput=${(e: Event) => setModelName((e.target as HTMLInputElement).value)}
          disabled=${isSubmitting}
        />
      </div>

      <div style=${sectionStyle}>
        <label class="create-dmn-form-label">${translate('Inputs')}</label>
        ${inputs.map((input, index) => html`
          <div style=${inputRowStyle} key=${index}>
            <input
              type="text"
              class="create-dmn-form-input"
              style=${{ flex: 1 }}
              value=${input.name}
              placeholder=${translate('Input name')}
              onInput=${(e: Event) => handleInputChange(index, 'name', (e.target as HTMLInputElement).value)}
              disabled=${isSubmitting}
            />
            <select
              class="create-dmn-form-select"
              value=${input.typeRef}
              onChange=${(e: Event) => handleInputChange(index, 'typeRef', (e.target as HTMLSelectElement).value)}
              disabled=${isSubmitting}
            >
              ${DMN_TYPE_OPTIONS.map(opt => html`
                <option value=${opt.value}>${opt.label}</option>
              `)}
            </select>
            ${inputs.length > 1 && html`
              <button
                type="button"
                class="remove-input-button"
                onClick=${() => handleRemoveInput(index)}
                disabled=${isSubmitting}
                title=${translate('Remove')}
              >
                ×
              </button>
            `}
          </div>
        `)}
        <button
          type="button"
          class="add-input-button"
          onClick=${handleAddInput}
          disabled=${isSubmitting}
        >
          + ${translate('Add input')}
        </button>
      </div>

      ${error && html`<div class="create-dmn-form-error">${error}</div>`}

      <div style=${actionsStyle}>
        <button
          type="button"
          class="submit-dmn-button"
          onClick=${handleSubmit}
          disabled=${isSubmitting}
        >
          ${isSubmitting ? translate('Creating...') : translate('Create')}
        </button>
      </div>
    </div>
  `;
}

// Create DMN Toggle component - shows a link to expand/collapse the create form
function CreateDmnToggle(props: { element: BpmnElement; id: string }) {
  const { element, id } = props;
  const translate = useService('translate') as (text: string) => string;
  const commandStack = useService('commandStack') as CommandStack;
  const bpmnFactory = useService('bpmnFactory') as BpmnFactory;

  const [showForm, setShowForm] = useState(false);

  const handleCreated = (modelName: string) => {
    // Hide the form
    setShowForm(false);

    // Auto-select the new DMN in the dropdown
    // This will be handled by setting the model value
    if (modelName) {
      // Migrate legacy config if present
      migrateLegacyConfig(element, bpmnFactory, commandStack);

      // Ensure ioSpecification exists
      ensureIoSpecification(element, bpmnFactory, commandStack);

      // Find the newly created file to get its namespace
      const newFile = availableDmnFiles.find(f => f.modelName === modelName);

      // Set the model value
      setDataInputValue(element, DMN_DATA_INPUTS.MODEL, modelName, bpmnFactory, commandStack);

      // Set the namespace if available
      if (newFile?.namespace) {
        setDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE, newFile.namespace, bpmnFactory, commandStack);
      }

      // Clear decision (user will select after opening the DMN)
      setDataInputValue(element, DMN_DATA_INPUTS.DECISION, '', bpmnFactory, commandStack);
    }
  };

  const containerStyle = {
    padding: '0 10px 8px 10px'
  };

  return html`
    <div style=${containerStyle}>
      ${!showForm && html`
        <button
          type="button"
          class="create-dmn-button"
          onClick=${() => setShowForm(true)}
        >
          + ${translate('Create New DMN')}
        </button>
      `}
      ${showForm && html`
        <${CreateDmnForm}
          element=${element}
          id="${id}_form"
          onCreated=${handleCreated}
        />
      `}
    </div>
  `;
}

// Modeling interface for triggering changes
interface Modeling {
  updateProperties: (element: BpmnElement, properties: Record<string, unknown>) => void;
}

// Cache for dynamically created components to ensure stable identity
const dmnInputComponents = new Map<string, any>();
const dmnOutputComponents = new Map<string, any>();

// DMN Input Mapping component - maps a single DMN input to a process variable
function getDmnInputMappingComponent(inputName: string) {
  if (dmnInputComponents.has(inputName)) {
    return dmnInputComponents.get(inputName);
  }

  const component = function DmnInputMapping(props: { element: BpmnElement; id: string }) {
    const { element, id } = props;
    const commandStack = useService('commandStack') as CommandStack;
    const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
    const modeling = useService('modeling') as Modeling;
    const translate = useService('translate') as (text: string) => string;

    const debounce = useService('debounceInput') as <T>(fn: T) => T;

    const getValue = () => {
      return getDmnInputMapping(element, inputName);
    };

    const setValue = (value: string) => {
      if (value && typeof value === 'string' && value !== 'undefined' && value !== 'null' && value.trim() !== '') {
        setDmnInputMapping(element, inputName, value, bpmnFactory, commandStack);
        const bo = element.businessObject;
        if (bo) {
          modeling.updateProperties(element, { name: bo.name || bo.id });
        }
      }
    };

    const getOptions = () => {
      const options = [{ value: '', label: translate('-- Select Variable --') }];
      const variables = getAvailableProcessVariables(element);
      for (const v of variables) {
        if (v.name && v.name !== 'undefined') {
          options.push({ value: v.name, label: v.name });
        }
      }
      return options;
    };

    return SelectEntry({
      id,
      element,
      label: `${inputName}`,
      getValue,
      setValue,
      getOptions,
      debounce
    } as any);
  };

  dmnInputComponents.set(inputName, component);
  return component;
}

// Create entries for Business Rule Task
function BusinessRuleTaskEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isBusinessRuleTask(element)) {
    return [];
  }

  const entries: PropertyEntry[] = [
    {
      id: 'dmnFile',
      component: DmnFileSelect,
      isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.MODEL)
    },
    {
      id: 'createDmn',
      component: CreateDmnToggle,
      isEdited: () => false
    }
  ];

  entries.push({
    id: 'dmnDecision',
    component: DecisionSelect,
    isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.DECISION)
  });

  entries.push({
    id: 'dmnNamespace',
    component: DmnNamespace,
    isEdited: () => !!getDataInputValue(element, DMN_DATA_INPUTS.NAMESPACE)
  });

  return entries;
}

// Create entries for DMN Input Mappings
function DmnInputMappingEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isBusinessRuleTask(element)) {
    return [];
  }

  // Get the selected DMN model
  const currentModel = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
  if (!currentModel) {
    return [];
  }

  // Find the selected DMN file
  const selectedFile = availableDmnFiles.find(f =>
    (f.modelName || f.name) === currentModel ||
    f.name === currentModel
  );

  if (!selectedFile?.inputData || selectedFile.inputData.length === 0) {
    return [];
  }

  // Create an entry for each DMN input
  return selectedFile.inputData.map(input => ({
    id: `dmnInput_${input.name}`,
    component: getDmnInputMappingComponent(input.name),
    isEdited: () => !!getDmnInputMapping(element, input.name)
  }));
}

// DMN Output Mapping component - maps a single DMN output to a process variable
function getDmnOutputMappingComponent(outputName: string, dmnVariableName: string) {
  const cacheKey = `${outputName}_${dmnVariableName}`;
  if (dmnOutputComponents.has(cacheKey)) {
    return dmnOutputComponents.get(cacheKey);
  }

  const component = function DmnOutputMapping(props: { element: BpmnElement; id: string }) {
    const { element, id } = props;
    const commandStack = useService('commandStack') as CommandStack;
    const bpmnFactory = useService('bpmnFactory') as BpmnFactory;
    const modeling = useService('modeling') as Modeling;
    const translate = useService('translate') as (text: string) => string;

    const debounce = useService('debounceInput') as <T>(fn: T) => T;

    const getValue = () => {
      return getDmnOutputMapping(element, dmnVariableName);
    };

    const setValue = (value: string) => {
      if (value && typeof value === 'string' && value !== 'undefined' && value !== 'null' && value.trim() !== '') {
        setDmnOutputMapping(element, dmnVariableName, value, bpmnFactory, commandStack);
        const bo = element.businessObject;
        if (bo) {
          modeling.updateProperties(element, { name: bo.name || bo.id });
        }
      }
    };

    const getOptions = () => {
      const options = [{ value: '', label: translate('-- Select Variable --') }];
      const variables = getAvailableProcessVariables(element);
      for (const v of variables) {
        if (v.name && v.name !== 'undefined') {
          options.push({ value: v.name, label: v.name });
        }
      }
      return options;
    };

    return SelectEntry({
      id,
      element,
      label: `${outputName}`,
      getValue,
      setValue,
      getOptions,
      debounce
    } as any);
  };

  dmnOutputComponents.set(cacheKey, component);
  return component;
}

// Create entries for DMN Output Mappings
function DmnOutputMappingEntries(props: { element: BpmnElement }): PropertyEntry[] {
  const { element } = props;

  if (!isBusinessRuleTask(element)) {
    return [];
  }

  // Get the selected DMN model and decision
  const currentModel = getDataInputValue(element, DMN_DATA_INPUTS.MODEL);
  const currentDecision = getDataInputValue(element, DMN_DATA_INPUTS.DECISION);
  if (!currentModel || !currentDecision) {
    return [];
  }

  // Find the selected DMN file
  const selectedFile = availableDmnFiles.find(f =>
    (f.modelName || f.name) === currentModel ||
    f.name === currentModel
  );

  if (!selectedFile?.outputData || selectedFile.outputData.length === 0) {
    return [];
  }

  // Find output for the selected decision
  const decisionOutput = selectedFile.outputData.find(o => o.decisionId === currentDecision);

  if (!decisionOutput) {
    return [];
  }

  // Create an entry for the decision output
  return [{
    id: `dmnOutput_${decisionOutput.variableName}`,
    component: getDmnOutputMappingComponent(decisionOutput.decisionName, decisionOutput.variableName),
    isEdited: () => !!getDmnOutputMapping(element, decisionOutput.variableName)
  }];
}

// Request DMN files from extension
function requestDmnFiles(): void {
  const vscode = window.vscodeApi;
  if (vscode) {
    vscode.postMessage({ type: 'requestDmnFiles' });
  }
}

// ============================================================================
// Properties Provider Class
// ============================================================================

export default class BusinessRuleTaskPropertiesProvider {
  static $inject = ['propertiesPanel', 'eventBus'];

  constructor(propertiesPanel: PropertiesPanel, eventBus: EventBus) {
    // Request DMN files on initialization
    requestDmnFiles();

    // Re-request when selection changes to a business rule task
    eventBus.on('selection.changed', (event: SelectionChangedEvent) => {
      const selected = event.newSelection?.[0];
      if (selected && isBusinessRuleTask(selected)) {
        // Debounce or only request if we don't have files yet
        if (availableDmnFiles.length === 0) {
          requestDmnFiles();
        }
      }
    });

    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: BpmnElement) {
    return (groups: PropertiesGroup[]) => {
      if (!isBusinessRuleTask(element)) {
        return groups;
      }

      // Add DMN Decision Configuration group
      groups.push({
        id: 'dmn-decision-configuration',
        label: 'DMN Decision Configuration',
        entries: BusinessRuleTaskEntries({ element })
      });

      // Add DMN Input Mappings group (only if DMN file is selected and has inputs)
      const inputMappingEntries = DmnInputMappingEntries({ element });
      if (inputMappingEntries.length > 0) {
        groups.push({
          id: 'dmn-input-mappings',
          label: 'DMN Input Mappings',
          entries: inputMappingEntries
        });
      }

      // Add DMN Output Mappings group (only if DMN file and decision are selected)
      const outputMappingEntries = DmnOutputMappingEntries({ element });
      if (outputMappingEntries.length > 0) {
        groups.push({
          id: 'dmn-output-mappings',
          label: 'DMN Output Mappings',
          entries: outputMappingEntries
        });
      }

      return groups;
    };
  }
}
