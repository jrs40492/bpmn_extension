/**
 * Custom Palette Provider for REST Task
 * Creates a Kogito-compatible REST work item using STANDARD BPMN elements only.
 *
 * NO CUSTOM EXTENSIONS - uses only:
 * - bpmn:task with drools:taskName="Rest" attribute
 * - bpmn:ioSpecification with dataInput/dataOutput
 * - bpmn:dataInputAssociation with assignments
 * - bpmn:dataOutputAssociation for result mapping
 *
 * This is compatible with:
 * - Kogito/Drools runtime (uses built-in RESTWorkItemHandler)
 * - Any standard BPMN editor
 * - IBM BAMOE editor
 */

interface PaletteEntry {
  group: string;
  className: string;
  title: string;
  action: {
    dragstart: (event: Event) => void;
    click: (event: Event) => void;
  };
}

interface ElementFactory {
  createShape: (attrs: Record<string, unknown>) => unknown;
}

interface Create {
  start: (event: Event, shape: unknown) => void;
}

interface BpmnFactory {
  create: (type: string, attrs?: Record<string, unknown>) => unknown;
}

interface ModdleElement {
  $parent?: ModdleElement;
  $type?: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Kogito REST WorkItemHandler expected parameters
 *
 * Additional parameters supported by Kogito:
 * - AcceptHeader: Sets the Accept HTTP header for the request
 * - AcceptCharset: Sets the Accept-Charset header
 * - ResultClass: Java class to deserialize JSON response into (e.g., "java.util.Map")
 * - HandleResponseErrors: Whether to throw exception on HTTP errors (default: true)
 * - Headers: Custom headers as JSON object
 */
export const REST_PARAMS = {
  inputs: ['Url', 'Method', 'ContentType', 'AcceptHeader', 'Content', 'ConnectTimeout', 'ReadTimeout', 'ResultClass', 'HandleResponseErrors'],
  // Note: jBPM RESTWorkItemHandler uses 'Status' (not 'StatusCode') and it's a String type
  outputs: ['Result', 'Status', 'StatusMsg']
} as const;

/**
 * Default values for REST task
 * All parameters are created upfront so they can be updated later
 */
const DEFAULT_CONFIG: Record<string, string> = {
  Url: 'https://api.example.com/endpoint',
  Method: 'GET',
  ContentType: 'application/json',
  AcceptHeader: 'application/json',
  Content: '',
  ConnectTimeout: '30000',
  ReadTimeout: '30000',
  ResultClass: '',
  HandleResponseErrors: 'false'
};

export default class RestTaskPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'bpmnFactory'];

  private create: Create;
  private elementFactory: ElementFactory;
  private bpmnFactory: BpmnFactory;

  constructor(
    palette: { registerProvider: (provider: RestTaskPaletteProvider) => void },
    create: Create,
    elementFactory: ElementFactory,
    bpmnFactory: BpmnFactory
  ) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.bpmnFactory = bpmnFactory;

    palette.registerProvider(this);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const create = this.create;
    const elementFactory = this.elementFactory;
    const bpmnFactory = this.bpmnFactory;

    function createRestTask(event: Event): void {
      try {
        // Let bpmn-js create the shape normally - this ensures proper serialization
        const shape = elementFactory.createShape({
          type: 'bpmn:Task'
        }) as any;

        const businessObject = shape.businessObject;
        const taskId = businessObject.id;

        // Set name and drools:taskName AFTER creation
        businessObject.name = 'REST API Call';
        businessObject.set('drools:taskName', 'Rest');

        // Create ioSpecification with data inputs/outputs
        const dataInputs = new Map<string, ModdleElement>();
        const dataOutputs = new Map<string, ModdleElement>();
        const dataInputRefs: ModdleElement[] = [];
        const dataOutputRefs: ModdleElement[] = [];

        // Create data inputs for each REST parameter (no IDs for Kogito compatibility)
        for (const paramName of REST_PARAMS.inputs) {
          const dataInput = (bpmnFactory as any).create('bpmn:DataInput', {
            id: `${taskId}_${paramName}Input`,
            name: paramName
          });
          // Set drools:dtype for Kogito compatibility
          dataInput.set('drools:dtype', 'java.lang.String');
          dataInputs.set(paramName, dataInput);
          dataInputRefs.push(dataInput);
        }

        // Create data outputs with appropriate types
        for (const paramName of REST_PARAMS.outputs) {
          const dataOutput = (bpmnFactory as any).create('bpmn:DataOutput', {
            id: `${taskId}_${paramName}Output`,
            name: paramName
          });
          // Set drools:dtype for Kogito compatibility
          // Result type depends on ResultClass, Status and StatusMsg are Strings
          if (paramName === 'Result') {
            dataOutput.set('drools:dtype', 'java.util.Map');
          } else {
            // Status and StatusMsg are Strings in jBPM RESTWorkItemHandler
            dataOutput.set('drools:dtype', 'java.lang.String');
          }
          dataOutputs.set(paramName, dataOutput);
          dataOutputRefs.push(dataOutput);
        }

        // Create input/output sets (no IDs for Kogito compatibility)
        const inputSet = (bpmnFactory as any).create('bpmn:InputSet', {
          dataInputRefs: dataInputRefs
        });

        const outputSet = (bpmnFactory as any).create('bpmn:OutputSet', {
          dataOutputRefs: dataOutputRefs
        });

        // Create ioSpecification (no ID for Kogito compatibility)
        const ioSpecification = (bpmnFactory as any).create('bpmn:InputOutputSpecification', {
          dataInputs: Array.from(dataInputs.values()),
          dataOutputs: Array.from(dataOutputs.values()),
          inputSets: [inputSet],
          outputSets: [outputSet]
        });

        // Set parent references for ioSpec
        dataInputs.forEach(di => { di.$parent = ioSpecification; });
        dataOutputs.forEach(dout => { dout.$parent = ioSpecification; });
        inputSet.$parent = ioSpecification;
        outputSet.$parent = ioSpecification;

        // Create data input associations with default values (no IDs for Kogito compatibility)
        const dataInputAssociations: ModdleElement[] = [];
        for (const [paramName, dataInput] of dataInputs) {
          const value = DEFAULT_CONFIG[paramName as keyof typeof DEFAULT_CONFIG] || '';

          const fromExpression = (bpmnFactory as any).create('bpmn:FormalExpression', {
            body: value
          });
          const toExpression = (bpmnFactory as any).create('bpmn:FormalExpression', {
            body: dataInput.id
          });
          const assignment = (bpmnFactory as any).create('bpmn:Assignment', {
            from: fromExpression,
            to: toExpression
          });
          // No ID on association for Kogito compatibility
          const association = (bpmnFactory as any).create('bpmn:DataInputAssociation', {
            targetRef: dataInput,
            assignment: [assignment]
          });
          dataInputAssociations.push(association);
        }

        // Create data output association with targetRef (REQUIRED by Kogito)
        // The targetRef points to a process variable name where the result will be stored
        const resultOutput = dataOutputs.get('Result')!;
        const dataOutputAssociation = (bpmnFactory as any).create('bpmn:DataOutputAssociation', {
          sourceRef: [resultOutput],
          targetRef: 'restResult'  // Maps output to 'restResult' process variable
        });

        // Set all properties on business object
        businessObject.ioSpecification = ioSpecification;
        businessObject.dataInputAssociations = dataInputAssociations;
        businessObject.dataOutputAssociations = [dataOutputAssociation];

        // Set parent references
        ioSpecification.$parent = businessObject;
        dataInputAssociations.forEach((assoc: ModdleElement) => { assoc.$parent = businessObject; });
        dataOutputAssociation.$parent = businessObject;

        create.start(event, shape);
      } catch (error) {
        console.error('Error creating REST task:', error);
        // Fallback to simple task
        const simpleShape = elementFactory.createShape({
          type: 'bpmn:Task'
        });
        create.start(event, simpleShape);
      }
    }

    return {
      'create.rest-task': {
        group: 'activity',
        className: 'bpmn-icon-service-task rest-task-icon',
        title: 'Create REST API Task',
        action: {
          dragstart: createRestTask,
          click: createRestTask
        }
      }
    };
  }
}

/**
 * Helper functions for reading/writing REST task configuration
 * Used by properties panel and rest-panel
 */

/**
 * Check if an element is a REST task
 */
export function isRestTask(element: any): boolean {
  if (!element?.businessObject) return false;
  const bo = element.businessObject;
  if (bo.$type !== 'bpmn:Task') return false;

  // Check for drools:taskName="Rest"
  const taskName = bo.get?.('drools:taskName') || bo['drools:taskName'];
  return taskName === 'Rest';
}

/**
 * Check if a REST task already has a boundary error event attached
 */
export function hasBoundaryErrorEvent(element: any): boolean {
  if (!element?.attachers) return false;

  for (const attacher of element.attachers) {
    if (attacher.type === 'bpmn:BoundaryEvent') {
      const bo = attacher.businessObject;
      const eventDefs = bo?.eventDefinitions || [];
      for (const eventDef of eventDefs) {
        if (eventDef.$type === 'bpmn:ErrorEventDefinition') {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get the boundary error event attached to a REST task (if any)
 */
export function getBoundaryErrorEvent(element: any): any | null {
  if (!element?.attachers) return null;

  for (const attacher of element.attachers) {
    if (attacher.type === 'bpmn:BoundaryEvent') {
      const bo = attacher.businessObject;
      const eventDefs = bo?.eventDefinitions || [];
      for (const eventDef of eventDefs) {
        if (eventDef.$type === 'bpmn:ErrorEventDefinition') {
          return attacher;
        }
      }
    }
  }
  return null;
}

/**
 * Get REST configuration from standard BPMN data input associations
 */
export function getRestConfig(element: any): Record<string, string> | null {
  if (!isRestTask(element)) return null;

  const bo = element.businessObject;
  const config: Record<string, string> = {};

  // Read from dataInputAssociations
  const associations = bo.dataInputAssociations || [];
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (!targetRef) continue;

    const paramName = targetRef.name;
    if (!paramName) continue;

    // Get value from assignment
    const assignment = assoc.assignment?.[0];
    if (assignment?.from?.body !== undefined) {
      config[paramName] = assignment.from.body;
    }
  }

  // Read result variable from output association
  const outputAssoc = bo.dataOutputAssociations?.[0];
  if (outputAssoc) {
    config['ResultVariable'] = (outputAssoc as any).targetVariable || 'restResult';
  }

  return config;
}

/**
 * Update a REST configuration parameter
 * If the parameter doesn't exist, it will be created
 */
export function updateRestParam(element: any, paramName: string, value: string, modeling: any, bpmnFactory?: any): void {
  const bo = element.businessObject;
  const associations = bo.dataInputAssociations || [];

  // First, try to find and update existing parameter
  for (const assoc of associations) {
    const targetRef = assoc.targetRef;
    if (targetRef?.name === paramName) {
      const assignment = assoc.assignment?.[0];
      if (assignment?.from) {
        // Update the value
        const oldValue = assignment.from.body;
        assignment.from.body = value;

        // Trigger change by updating a property (name to itself forces commandStack entry)
        // This is necessary because direct modification of nested objects doesn't trigger change events
        modeling.updateProperties(element, { name: bo.name || '' });
        return;
      }
    }
  }

  // Parameter not found - need to create it
  if (!bpmnFactory) {
    console.warn('Could not create new parameter - bpmnFactory not available');
    return;
  }

  try {
    const taskId = bo.id || 'Task';
    const inputId = `${taskId}_${paramName}Input`;

    // Create dataInput
    const dataInput = bpmnFactory.create('bpmn:DataInput', {
      id: inputId,
      name: paramName
    });
    dataInput.set('drools:dtype', 'java.lang.String');

    // Get ioSpecification
    const ioSpec = bo.ioSpecification;
    if (!ioSpec) {
      console.warn('No ioSpecification found on task');
      return;
    }

    // Directly modify the existing ioSpecification arrays (don't create new objects)
    dataInput.$parent = ioSpec;
    if (!ioSpec.dataInputs) {
      ioSpec.dataInputs = [];
    }
    ioSpec.dataInputs.push(dataInput);

    // Add to inputSet
    const inputSet = ioSpec.inputSets?.[0];
    if (inputSet) {
      if (!inputSet.dataInputRefs) {
        inputSet.dataInputRefs = [];
      }
      inputSet.dataInputRefs.push(dataInput);
    }

    // Create assignment with from/to expressions
    const fromExpression = bpmnFactory.create('bpmn:FormalExpression', {
      body: value
    });
    fromExpression.$parent = null; // Will be set below

    const toExpression = bpmnFactory.create('bpmn:FormalExpression', {
      body: inputId
    });
    toExpression.$parent = null;

    const assignment = bpmnFactory.create('bpmn:Assignment', {
      from: fromExpression,
      to: toExpression
    });
    fromExpression.$parent = assignment;
    toExpression.$parent = assignment;

    // Create dataInputAssociation
    const dataInputAssoc = bpmnFactory.create('bpmn:DataInputAssociation', {
      targetRef: dataInput,
      assignment: [assignment]
    });
    assignment.$parent = dataInputAssoc;
    dataInputAssoc.$parent = bo;

    // Add to businessObject's dataInputAssociations
    if (!bo.dataInputAssociations) {
      bo.dataInputAssociations = [];
    }
    bo.dataInputAssociations.push(dataInputAssoc);

    // Trigger change by updating a property
    // This forces bpmn-js to recognize changes and add to commandStack
    modeling.updateProperties(element, { name: bo.name || '' });

    console.log(`Created new REST parameter: ${paramName} = ${value}`);

  } catch (error) {
    console.error('Error creating REST parameter:', error);
  }
}

/**
 * Update the Result output's drools:dtype to match the ResultClass
 * This ensures the output type matches what the REST handler will return
 */
export function updateResultOutputType(element: any, resultClass: string): void {
  const bo = element.businessObject;
  const ioSpec = bo.ioSpecification;
  if (!ioSpec) return;

  // Find the Result dataOutput
  const dataOutputs = ioSpec.dataOutputs || [];
  for (const dataOutput of dataOutputs) {
    if (dataOutput.name === 'Result') {
      // Map ResultClass to the appropriate dtype
      const dtype = resultClass || 'java.lang.String';
      dataOutput.set('drools:dtype', dtype);
      console.log(`Updated Result output dtype to: ${dtype}`);
      return;
    }
  }
}

/**
 * Get the target process variable name from an output association by output name
 */
export function getOutputVariableName(element: any, outputName: string): string | null {
  const bo = element.businessObject;
  const outputAssocs = bo.dataOutputAssociations || [];

  for (const assoc of outputAssocs) {
    const sourceRef = assoc.sourceRef?.[0];
    if (sourceRef?.name === outputName) {
      // targetRef could be a string (variable name) or a reference to a property element
      const targetRef = assoc.targetRef;
      if (typeof targetRef === 'string') {
        return targetRef;
      } else if (targetRef?.id) {
        return targetRef.id;
      } else if (targetRef?.name) {
        return targetRef.name;
      }
    }
  }
  return null;
}

/**
 * Get the target process variable name from the Result output association
 */
export function getResultVariableName(element: any): string | null {
  return getOutputVariableName(element, 'Result');
}

/**
 * Get the target process variable name from the Status output association
 * Note: jBPM RESTWorkItemHandler uses 'Status' (not 'StatusCode')
 */
export function getStatusCodeVariableName(element: any): string | null {
  return getOutputVariableName(element, 'Status');
}

/**
 * Get the target process variable name from the StatusMsg output association
 */
export function getStatusMsgVariableName(element: any): string | null {
  return getOutputVariableName(element, 'StatusMsg');
}

/**
 * Get all available process variables from the parent process
 */
export function getAvailableProcessVariables(element: any): Array<{ id: string; name: string }> {
  const bo = element.businessObject;
  const variables: Array<{ id: string; name: string }> = [];

  // Navigate up to find the process
  let process = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return variables;

  // Get variables from bpmn:property elements (standard BPMN)
  const properties = process.properties || [];
  for (const prop of properties) {
    if (prop.id || prop.name) {
      variables.push({
        id: prop.id || prop.name,
        name: prop.name || prop.id
      });
    }
  }

  // Also get from bamoe:ProcessVariables extension (if exists)
  const extensionElements = process.extensionElements;
  if (extensionElements?.values) {
    const processVariables = extensionElements.values.find(
      (ext: any) => ext.$type === 'bamoe:ProcessVariables'
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

/**
 * Find an existing Property element on the process, or create one if it doesn't exist
 */
function findOrCreateProperty(element: any, variableName: string, bpmnFactory: any, variableType?: string): any {
  const bo = element.businessObject;

  // Navigate up to find the process
  let process = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return null;

  // Look for existing property
  const properties = process.properties || [];
  for (const prop of properties) {
    if (prop.id === variableName || prop.name === variableName) {
      return prop;
    }
  }

  // Property doesn't exist - create it
  // First, navigate to definitions to create itemDefinition
  const definitions = process.$parent;
  if (!definitions || definitions.$type !== 'bpmn:Definitions') return null;

  const itemDefId = `_${variableName}Item`;

  // Check if itemDefinition exists
  let itemDef = null;
  const rootElements = definitions.rootElements || [];
  for (const elem of rootElements) {
    if (elem.$type === 'bpmn:ItemDefinition' && elem.id === itemDefId) {
      itemDef = elem;
      break;
    }
  }

  // Create itemDefinition if missing
  if (!itemDef) {
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: variableType || 'java.lang.Object'
    });
    itemDef.$parent = definitions;
    if (!definitions.rootElements) {
      definitions.rootElements = [];
    }
    // Insert before first process
    const processIndex = definitions.rootElements.findIndex((el: any) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      definitions.rootElements.splice(processIndex, 0, itemDef);
    } else {
      definitions.rootElements.push(itemDef);
    }
  }

  // Create the property
  const property = bpmnFactory.create('bpmn:Property', {
    id: variableName,
    name: variableName,
    itemSubjectRef: itemDef
  });
  property.$parent = process;

  if (!process.properties) {
    process.properties = [];
  }
  process.properties.push(property);

  console.log(`[REST Task] Created new property: ${variableName}`);
  return property;
}

/**
 * Update an output association to target a different process variable
 */
export function updateOutputVariable(element: any, outputName: string, variableName: string, modeling: any, bpmnFactory: any, variableType?: string): void {
  const bo = element.businessObject;
  // Create a COPY of the array - modifying the original reference won't trigger bpmn-js change detection
  let outputAssocs = [...(bo.dataOutputAssociations || [])];

  // Find existing association for this output
  let existingAssocIndex = -1;
  let dataOutput: any = null;

  for (let i = 0; i < outputAssocs.length; i++) {
    const sourceRef = outputAssocs[i].sourceRef?.[0];
    if (sourceRef?.name === outputName) {
      existingAssocIndex = i;
      dataOutput = sourceRef;
      break;
    }
  }

  // Get or create ioSpecification
  let ioSpec = bo.ioSpecification;
  if (!ioSpec) return;

  // If we didn't find the dataOutput from the association, look in ioSpec
  if (!dataOutput) {
    const dataOutputs = ioSpec.dataOutputs || [];
    dataOutput = dataOutputs.find((d: any) => d.name === outputName);
  }

  // If dataOutput doesn't exist, create it (for existing REST tasks without Status/StatusMsg)
  if (!dataOutput) {
    const taskId = bo.id || 'Task';
    const outputId = `${taskId}_${outputName}Output`;

    // Determine the data type based on output name
    // Note: jBPM RESTWorkItemHandler returns Status as String, not Integer
    let dtype = 'java.lang.String';
    if (outputName === 'Result') {
      dtype = 'java.util.Map';
    }

    dataOutput = bpmnFactory.create('bpmn:DataOutput', {
      id: outputId,
      name: outputName
    });
    dataOutput.set('drools:dtype', dtype);
    dataOutput.$parent = ioSpec;

    // Add to ioSpecification
    if (!ioSpec.dataOutputs) {
      ioSpec.dataOutputs = [];
    }
    ioSpec.dataOutputs.push(dataOutput);

    // Add to outputSet
    const outputSet = ioSpec.outputSets?.[0];
    if (outputSet) {
      if (!outputSet.dataOutputRefs) {
        outputSet.dataOutputRefs = [];
      }
      outputSet.dataOutputRefs.push(dataOutput);
    }

    console.log(`[REST Task] Created missing dataOutput: ${outputName}`);
  }

  // Remove existing association if found (we'll create a new one)
  if (existingAssocIndex >= 0) {
    outputAssocs.splice(existingAssocIndex, 1);
  }

  // Create new output association with proper references
  console.log(`[REST Task] Creating output association: ${outputName} -> ${variableName}`);
  console.log(`[REST Task] dataOutput:`, dataOutput?.id, dataOutput?.name);

  // Find or create the Property element for the target variable
  // bpmn-js requires targetRef to be an element reference, not just a string
  let targetProperty = findOrCreateProperty(element, variableName, bpmnFactory, variableType);
  console.log(`[REST Task] Target property:`, targetProperty?.id, targetProperty?.name);

  const newAssoc = bpmnFactory.create('bpmn:DataOutputAssociation', {
    sourceRef: [dataOutput],
    targetRef: targetProperty || variableName  // Fall back to string if property not found
  });
  newAssoc.$parent = bo;

  console.log(`[REST Task] New association targetRef:`, newAssoc.targetRef);

  // Add the new association
  outputAssocs.push(newAssoc);

  // Directly assign to business object - modeling.updateProperties doesn't work for complex arrays
  bo.dataOutputAssociations = outputAssocs;

  console.log(`[REST Task] Updated dataOutputAssociations, count: ${outputAssocs.length}`);
  console.log(`[REST Task] Verifying - first assoc targetRef:`, bo.dataOutputAssociations[0]?.targetRef);
  console.log(`[REST Task] Verifying - second assoc targetRef:`, bo.dataOutputAssociations[1]?.targetRef);

  // Trigger change notification by updating a simple property
  // This forces bpmn-js to recognize that the element has changed
  modeling.updateProperties(element, { name: bo.name || '' });

  // Ensure the process variable exists
  ensureProcessVariable(element, variableName, bpmnFactory, modeling, variableType);
}

/**
 * Update the REST task output association to target a different process variable
 */
export function updateResultVariable(element: any, variableName: string, modeling: any, bpmnFactory: any): void {
  updateOutputVariable(element, 'Result', variableName, modeling, bpmnFactory, 'java.util.Map');
}

/**
 * Update the Status output association to target a different process variable
 * Note: jBPM RESTWorkItemHandler uses 'Status' (not 'StatusCode') and it's a String
 */
export function updateStatusCodeVariable(element: any, variableName: string, modeling: any, bpmnFactory: any): void {
  updateOutputVariable(element, 'Status', variableName, modeling, bpmnFactory, 'java.lang.String');
}

/**
 * Update the StatusMsg output association to target a different process variable
 */
export function updateStatusMsgVariable(element: any, variableName: string, modeling: any, bpmnFactory: any): void {
  updateOutputVariable(element, 'StatusMsg', variableName, modeling, bpmnFactory, 'java.lang.String');
}

/**
 * Ensure a process variable exists with the given name
 */
function ensureProcessVariable(element: any, variableName: string, bpmnFactory: any, modeling: any, variableType?: string): void {
  const bo = element.businessObject;

  // Navigate up to find the process
  let process = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) return;

  // Navigate up to find definitions
  const definitions = process.$parent;
  if (!definitions || definitions.$type !== 'bpmn:Definitions') return;

  const itemDefId = `_${variableName}Item`;

  // Check if itemDefinition exists
  let itemDef = null;
  const rootElements = definitions.rootElements || [];
  for (const elem of rootElements) {
    if (elem.$type === 'bpmn:ItemDefinition' && elem.id === itemDefId) {
      itemDef = elem;
      break;
    }
  }

  // Create itemDefinition if missing
  if (!itemDef && bpmnFactory) {
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: variableType || 'java.util.Map'
    });
    itemDef.$parent = definitions;
    if (!definitions.rootElements) {
      definitions.rootElements = [];
    }
    // Insert before first process
    const processIndex = definitions.rootElements.findIndex((el: any) => el.$type === 'bpmn:Process');
    if (processIndex >= 0) {
      definitions.rootElements.splice(processIndex, 0, itemDef);
    } else {
      definitions.rootElements.push(itemDef);
    }
  }

  // Check if property exists
  let property = null;
  const properties = process.properties || [];
  for (const prop of properties) {
    if (prop.id === variableName || prop.name === variableName) {
      property = prop;
      break;
    }
  }

  // Create property if missing
  if (!property && bpmnFactory) {
    property = bpmnFactory.create('bpmn:Property', {
      id: variableName,
      name: variableName,
      itemSubjectRef: itemDef
    });
    property.$parent = process;
    if (!process.properties) {
      process.properties = [];
    }
    process.properties.push(property);

    // Also add to bamoe:ProcessVariables if extension exists
    const extensionElements = process.extensionElements;
    if (extensionElements?.values) {
      const processVariables = extensionElements.values.find(
        (ext: any) => ext.$type === 'bamoe:ProcessVariables'
      );
      if (processVariables) {
        const existingVar = processVariables.variables?.find((v: any) => v.name === variableName);
        if (!existingVar) {
          const newVar = bpmnFactory.create('bamoe:Variable', {
            name: variableName,
            type: 'object'
          });
          newVar.$parent = processVariables;
          if (!processVariables.variables) {
            processVariables.variables = [];
          }
          processVariables.variables.push(newVar);
        }
      }
    }
  }
}

/**
 * Update or create the process variable that receives the REST result
 * This updates the itemDefinition structureRef to match ResultClass
 */
export function updateResultVariableType(element: any, resultClass: string, bpmnFactory: any): void {
  const bo = element.businessObject;

  // Get the variable name from the output association
  const varName = getResultVariableName(element);
  if (!varName) {
    console.warn('No result variable found in output association');
    return;
  }

  // Navigate up to find the process
  let process = bo.$parent;
  while (process && process.$type !== 'bpmn:Process') {
    process = process.$parent;
  }
  if (!process) {
    console.warn('Could not find parent process');
    return;
  }

  // Navigate up to find definitions
  const definitions = process.$parent;
  if (!definitions || definitions.$type !== 'bpmn:Definitions') {
    console.warn('Could not find definitions');
    return;
  }

  const dtype = resultClass || 'java.lang.String';
  const itemDefId = `_${varName}Item`;

  // Find or create the itemDefinition
  let itemDef = null;
  const rootElements = definitions.rootElements || [];
  for (const elem of rootElements) {
    if (elem.$type === 'bpmn:ItemDefinition' && elem.id === itemDefId) {
      itemDef = elem;
      break;
    }
  }

  if (itemDef) {
    // Update existing itemDefinition
    itemDef.structureRef = dtype;
    console.log(`Updated itemDefinition ${itemDefId} structureRef to: ${dtype}`);
  } else if (bpmnFactory) {
    // Create new itemDefinition
    itemDef = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefId,
      structureRef: dtype
    });
    itemDef.$parent = definitions;
    if (!definitions.rootElements) {
      definitions.rootElements = [];
    }
    definitions.rootElements.push(itemDef);
    console.log(`Created itemDefinition ${itemDefId} with structureRef: ${dtype}`);

    // Also create the property on the process if it doesn't exist
    let property = null;
    const properties = process.properties || [];
    for (const prop of properties) {
      if (prop.id === varName || prop.name === varName) {
        property = prop;
        break;
      }
    }

    if (!property) {
      property = bpmnFactory.create('bpmn:Property', {
        id: varName,
        name: varName,
        itemSubjectRef: itemDef
      });
      property.$parent = process;
      if (!process.properties) {
        process.properties = [];
      }
      process.properties.push(property);
      console.log(`Created process property: ${varName}`);
    } else {
      // Update existing property to reference the itemDefinition
      property.itemSubjectRef = itemDef;
    }
  }
}
