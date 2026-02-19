/**
 * Process Variables Properties Provider
 * Adds input parameter/variable configuration to the Process element
 */

// @ts-expect-error - no type definitions available
import { ListGroup, TextFieldEntry, SelectEntry, CheckboxEntry } from '@bpmn-io/properties-panel';
// @ts-expect-error - no type definitions available
import { useService } from 'bpmn-js-properties-panel';

// Helper to check if element is a Process
function isProcess(element: any): boolean {
  return element?.businessObject?.$type === 'bpmn:Process';
}

// Helper to get business object
function getBusinessObject(element: any): any {
  return element?.businessObject;
}

// Get process variables container from element
function getProcessVariables(element: any): any {
  const bo = getBusinessObject(element);
  if (!bo) return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements) return null;

  const values = extensionElements.values || [];
  return values.find((ext: any) => ext.$type === 'bamoe:ProcessVariables');
}

// Get list of variables
function getVariables(element: any): any[] {
  const processVariables = getProcessVariables(element);
  return processVariables?.variables || [];
}

// Map our type values to Java types for IBM BAMOE compatibility
function getJavaType(type: string): string {
  switch (type) {
    case 'string':
      return 'java.lang.String';
    case 'integer':
      return 'java.lang.Integer';
    case 'number':
      return 'java.lang.Double';
    case 'boolean':
      return 'java.lang.Boolean';
    case 'object':
      return 'java.lang.Object';
    case 'array':
      return 'java.util.List';
    default:
      return 'java.lang.Object';
  }
}

// Map Java type (structureRef) back to our type system
function getTypeFromJava(structureRef: string | undefined): string {
  if (!structureRef) return 'string';
  switch (structureRef) {
    case 'String':
    case 'java.lang.String':
      return 'string';
    case 'Integer':
    case 'java.lang.Integer':
      return 'integer';
    case 'Double':
    case 'Float':
    case 'java.lang.Double':
    case 'java.lang.Float':
      return 'number';
    case 'Boolean':
    case 'java.lang.Boolean':
      return 'boolean';
    case 'java.util.List':
      return 'array';
    default:
      return 'object';
  }
}

// Sync bpmn:Property elements into bamoe:ProcessVariables so they display in the panel
function syncBpmnPropertiesToVariables(element: any, injector: any): void {
  const bo = getBusinessObject(element);
  if (!bo) return;

  const bpmnProperties = bo.properties || [];
  if (bpmnProperties.length === 0) return;

  const bpmnFactory = injector.get('bpmnFactory');
  const commandStack = injector.get('commandStack');

  // Ensure extensionElements exists
  let extensionElements = bo.extensionElements;
  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    extensionElements.$parent = bo;
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { extensionElements }
    });
  }

  // Ensure ProcessVariables container exists
  let processVariables = getProcessVariables(element);
  if (!processVariables) {
    processVariables = bpmnFactory.create('bamoe:ProcessVariables', { variables: [] });
    processVariables.$parent = extensionElements;
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: {
        values: [...(extensionElements.values || []), processVariables]
      }
    });
  }

  // Find bpmn:Property entries that don't have a corresponding bamoe:Variable
  const existingVariables = processVariables.variables || [];
  const existingNames = new Set(existingVariables.map((v: any) => v.name));
  const newVariables: any[] = [];

  for (const prop of bpmnProperties) {
    const name = prop.name || prop.id;
    if (!name || existingNames.has(name)) continue;

    const structureRef = prop.itemSubjectRef?.structureRef;
    const type = getTypeFromJava(structureRef);

    const variable = bpmnFactory.create('bamoe:Variable', {
      name,
      type,
      required: false
    });
    variable.$parent = processVariables;
    newVariables.push(variable);
  }

  if (newVariables.length > 0) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: processVariables,
      properties: {
        variables: [...existingVariables, ...newVariables]
      }
    });
  }
}

// Get definitions (root element) from a business object
function getDefinitions(bo: any): any {
  let definitions = bo.$parent;
  while (definitions && definitions.$type !== 'bpmn:Definitions') {
    definitions = definitions.$parent;
  }
  return definitions;
}

// Find an itemDefinition by id
function findItemDefinition(definitions: any, id: string): any {
  const rootElements = definitions?.rootElements || [];
  return rootElements.find((elem: any) => elem.$type === 'bpmn:ItemDefinition' && elem.id === id);
}

// Find a property by id in the process
function findProperty(bo: any, id: string): any {
  const properties = bo.properties || [];
  return properties.find((prop: any) => prop.id === id);
}

// Variable entry component - renders the fields for a single variable
function VariableEntry(props: { idPrefix: string; variable: any; element: any }) {
  const { idPrefix, variable, element } = props;

  const entries = [
    {
      id: `${idPrefix}-name`,
      component: VariableName,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-type`,
      component: VariableType,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-required`,
      component: VariableRequired,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-defaultValue`,
      component: VariableDefaultValue,
      variable,
      idPrefix,
      element
    },
    {
      id: `${idPrefix}-description`,
      component: VariableDescription,
      variable,
      idPrefix,
      element
    }
  ];

  return entries;
}

// Variable Name field
function VariableName(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');

  const getValue = () => variable.name || '';

  const setValue = (value: string) => {
    const oldName = variable.name;
    const newName = value;

    // Update the variable name
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { name: newName }
    });

    // Create or update BPMN property and itemDefinition for IBM BAMOE compatibility
    if (newName) {
      ensureBpmnPropertyAndItemDefinition(element, variable, oldName, newName, bpmnFactory, commandStack);
    }

    // Update all references if the name actually changed
    if (oldName && oldName !== newName) {
      updateVariableReferences(element, oldName, newName, commandStack);
    }
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Name'),
    getValue,
    setValue,
    debounce
  });
}

/**
 * Ensure that a bpmn:property and bpmn:itemDefinition exist for IBM BAMOE compatibility
 */
function ensureBpmnPropertyAndItemDefinition(
  element: any,
  variable: any,
  oldName: string | undefined,
  newName: string,
  bpmnFactory: any,
  commandStack: any
): void {
  const bo = getBusinessObject(element);
  if (!bo) return;

  const definitions = getDefinitions(bo);
  if (!definitions) return;

  const variableType = variable.type || 'string';
  const javaType = getJavaType(variableType);
  const itemDefinitionId = `_${newName}Item`;

  // Check if we're renaming (oldName exists and is different)
  const isRename = oldName && oldName !== newName;
  const oldItemDefinitionId = oldName ? `_${oldName}Item` : null;

  // Find existing itemDefinition (by old name if renaming)
  let itemDefinition = isRename
    ? findItemDefinition(definitions, oldItemDefinitionId!)
    : findItemDefinition(definitions, itemDefinitionId);

  // Create itemDefinition if it doesn't exist
  if (!itemDefinition) {
    itemDefinition = bpmnFactory.create('bpmn:ItemDefinition', {
      id: itemDefinitionId,
      structureRef: javaType
    });
    itemDefinition.$parent = definitions;

    // Add to rootElements
    const newRootElements = [...(definitions.rootElements || []), itemDefinition];
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: definitions,
      properties: { rootElements: newRootElements }
    });
  } else if (isRename) {
    // Update existing itemDefinition id when renaming
    itemDefinition.id = itemDefinitionId;
  }

  // Find existing property (by old name if renaming)
  let property = isRename
    ? findProperty(bo, oldName!)
    : findProperty(bo, newName);

  // Create property if it doesn't exist
  if (!property) {
    property = bpmnFactory.create('bpmn:Property', {
      id: newName,
      name: newName,
      itemSubjectRef: itemDefinition
    });
    property.$parent = bo;

    // Add to process properties
    const newProperties = [...(bo.properties || []), property];
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { properties: newProperties }
    });
  } else if (isRename) {
    // Update existing property when renaming
    property.id = newName;
    property.name = newName;
    property.itemSubjectRef = itemDefinition;
  }
}

/**
 * Update all references to a variable when it's renamed
 */
function updateVariableReferences(element: any, oldName: string, newName: string, commandStack: any): void {
  const bo = getBusinessObject(element);
  if (!bo) return;

  // Get definitions (root of document)
  let definitions = bo.$parent;
  while (definitions && definitions.$type !== 'bpmn:Definitions') {
    definitions = definitions.$parent;
  }
  if (!definitions) return;

  // 1. Update bpmn:Property element (id and name)
  const properties = bo.properties || [];
  for (const prop of properties) {
    if (prop.id === oldName || prop.name === oldName) {
      prop.id = newName;
      prop.name = newName;

      // Update itemSubjectRef if it references the old itemDefinition
      if (prop.itemSubjectRef?.id === `_${oldName}Item`) {
        // Find and update the itemDefinition
        const rootElements = definitions.rootElements || [];
        for (const elem of rootElements) {
          if (elem.$type === 'bpmn:ItemDefinition' && elem.id === `_${oldName}Item`) {
            elem.id = `_${newName}Item`;
            prop.itemSubjectRef = elem;
            break;
          }
        }
      }
    }
  }

  // 2. Update bpmn:ItemDefinition at definitions level
  const rootElements = definitions.rootElements || [];
  for (const elem of rootElements) {
    if (elem.$type === 'bpmn:ItemDefinition' && elem.id === `_${oldName}Item`) {
      elem.id = `_${newName}Item`;
    }
  }

  // 3. Update all flow elements in the process
  const flowElements = bo.flowElements || [];
  for (const flowElement of flowElements) {
    updateFlowElementReferences(flowElement, oldName, newName);
  }

  // Force a change notification by updating process name
  commandStack.execute('element.updateModdleProperties', {
    element,
    moddleElement: bo,
    properties: { name: bo.name || '' }
  });
}

/**
 * Update references within a flow element (task, gateway, etc.)
 */
function updateFlowElementReferences(flowElement: any, oldName: string, newName: string): void {
  // Update dataInputAssociations
  const inputAssocs = flowElement.dataInputAssociations || [];
  for (const assoc of inputAssocs) {
    // Check sourceRef (array of references)
    if (assoc.sourceRef) {
      for (let i = 0; i < assoc.sourceRef.length; i++) {
        const ref = assoc.sourceRef[i];
        if (typeof ref === 'string' && ref === oldName) {
          assoc.sourceRef[i] = newName;
        } else if (ref?.id === oldName || ref?.name === oldName) {
          // Reference to a property element - update the reference
        }
      }
    }
    // Check targetRef (single reference or string)
    if (assoc.targetRef === oldName) {
      assoc.targetRef = newName;
    }
  }

  // Update dataOutputAssociations
  const outputAssocs = flowElement.dataOutputAssociations || [];
  for (const assoc of outputAssocs) {
    // Check sourceRef
    if (assoc.sourceRef) {
      for (let i = 0; i < assoc.sourceRef.length; i++) {
        const ref = assoc.sourceRef[i];
        if (typeof ref === 'string' && ref === oldName) {
          assoc.sourceRef[i] = newName;
        }
      }
    }
    // Check targetRef - this is where output goes to process variable
    if (typeof assoc.targetRef === 'string' && assoc.targetRef === oldName) {
      assoc.targetRef = newName;
    } else if (assoc.targetRef?.id === oldName) {
      // This is a reference to a property element - the property was already updated above
    }
  }

  // Update conditionExpressions on sequence flows
  if (flowElement.$type === 'bpmn:SequenceFlow' && flowElement.conditionExpression) {
    const expr = flowElement.conditionExpression;
    if (expr.body && typeof expr.body === 'string') {
      // Replace variable references in expression
      // Match whole word only to avoid partial replacements
      const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g');
      expr.body = expr.body.replace(regex, newName);
    }
  }

  // Update script content in script tasks
  if (flowElement.$type === 'bpmn:ScriptTask' && flowElement.script) {
    const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g');
    flowElement.script = flowElement.script.replace(regex, newName);
  }

  // Handle sequence flows in gateways
  if (flowElement.outgoing) {
    for (const outgoing of flowElement.outgoing) {
      if (outgoing.conditionExpression?.body) {
        const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g');
        outgoing.conditionExpression.body = outgoing.conditionExpression.body.replace(regex, newName);
      }
    }
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Variable Type field
function VariableType(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = () => variable.type || 'string';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { type: value }
    });

    // Update the bpmn:itemDefinition structureRef for IBM BAMOE compatibility
    const variableName = variable.name;
    if (variableName) {
      const bo = getBusinessObject(element);
      const definitions = getDefinitions(bo);
      if (definitions) {
        const itemDefinitionId = `_${variableName}Item`;
        const itemDefinition = findItemDefinition(definitions, itemDefinitionId);
        if (itemDefinition) {
          const javaType = getJavaType(value);
          itemDefinition.structureRef = javaType;
        }
      }
    }
  };

  const getOptions = () => [
    { value: 'string', label: translate('String') },
    { value: 'integer', label: translate('Integer') },
    { value: 'number', label: translate('Decimal') },
    { value: 'boolean', label: translate('Boolean') },
    { value: 'object', label: translate('Object') },
    { value: 'array', label: translate('Array') }
  ];

  return SelectEntry({
    id,
    element,
    label: translate('Type'),
    getValue,
    setValue,
    getOptions
  });
}

// Variable Required field
function VariableRequired(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const getValue = () => variable.required || false;

  const setValue = (value: boolean) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { required: value }
    });
  };

  return CheckboxEntry({
    id,
    element,
    label: translate('Required'),
    getValue,
    setValue
  });
}

// Variable Default Value field
function VariableDefaultValue(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => variable.defaultValue || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { defaultValue: value || undefined }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Default Value'),
    getValue,
    setValue,
    debounce
  });
}

// Variable Description field
function VariableDescription(props: { id: string; variable: any; element: any }) {
  const { id, variable, element } = props;
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => variable.description || '';

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: variable,
      properties: { description: value || undefined }
    });
  };

  return TextFieldEntry({
    id,
    element,
    label: translate('Description'),
    getValue,
    setValue,
    debounce
  });
}

// Process Variables List Group
function ProcessVariablesGroup(props: { element: any; injector: any }) {
  const { element, injector } = props;

  if (!isProcess(element)) {
    return null;
  }

  const bpmnFactory = injector.get('bpmnFactory');
  const commandStack = injector.get('commandStack');
  const translate = injector.get('translate');

  // Sync any existing bpmn:Property elements into bamoe:ProcessVariables
  syncBpmnPropertiesToVariables(element, injector);

  const variables = getVariables(element);

  const items = variables.map((variable: any, index: number) => {
    const id = `${element.id}-variable-${index}`;
    return {
      id,
      label: variable.name || translate('<unnamed>'),
      entries: VariableEntry({
        idPrefix: id,
        variable,
        element
      }),
      autoFocusEntry: `${id}-name`,
      remove: createRemoveHandler(commandStack, element, variable)
    };
  });

  return {
    items,
    add: createAddHandler(bpmnFactory, commandStack, element),
    label: translate('Process Variables')
  };
}

// Create handler to remove a variable
function createRemoveHandler(commandStack: any, element: any, variable: any) {
  return function(event: Event) {
    event.stopPropagation();

    const processVariables = getProcessVariables(element);
    if (!processVariables) return;

    const variableName = variable.name;
    const newVariables = processVariables.variables.filter((v: any) => v !== variable);

    // Remove from bamoe:processVariables
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: processVariables,
      properties: {
        variables: newVariables
      }
    });

    // Also remove the bpmn:property and bpmn:itemDefinition for IBM BAMOE compatibility
    if (variableName) {
      const bo = getBusinessObject(element);
      const definitions = getDefinitions(bo);

      // Remove bpmn:property from process
      const property = findProperty(bo, variableName);
      if (property && bo.properties) {
        const newProperties = bo.properties.filter((p: any) => p !== property);
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: bo,
          properties: { properties: newProperties }
        });
      }

      // Remove bpmn:itemDefinition from definitions
      if (definitions) {
        const itemDefinitionId = `_${variableName}Item`;
        const itemDefinition = findItemDefinition(definitions, itemDefinitionId);
        if (itemDefinition && definitions.rootElements) {
          const newRootElements = definitions.rootElements.filter((e: any) => e !== itemDefinition);
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: definitions,
            properties: { rootElements: newRootElements }
          });
        }
      }
    }
  };
}

// Create handler to add a new variable
function createAddHandler(bpmnFactory: any, commandStack: any, element: any) {
  return function(event: Event) {
    event.stopPropagation();

    const bo = getBusinessObject(element);
    const commands: any[] = [];

    // Ensure extensionElements exists
    let extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: bo,
          properties: { extensionElements }
        }
      });
    }

    // Ensure ProcessVariables container exists
    let processVariables = getProcessVariables(element);
    if (!processVariables) {
      processVariables = bpmnFactory.create('bamoe:ProcessVariables', { variables: [] });
      processVariables.$parent = extensionElements;

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: extensionElements,
          properties: {
            values: [...(extensionElements.values || []), processVariables]
          }
        }
      });
    }

    // Create new variable
    const newVariable = bpmnFactory.create('bamoe:Variable', {
      name: '',
      type: 'string',
      required: false
    });
    newVariable.$parent = processVariables;

    // Add variable to list
    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        element,
        moddleElement: processVariables,
        properties: {
          variables: [...(processVariables.variables || []), newVariable]
        }
      }
    });

    // Execute all commands
    commandStack.execute('properties-panel.multi-command-executor', commands);
  };
}

// Provider class
export default class ProcessVariablesPropertiesProvider {
  static $inject = ['propertiesPanel', 'injector'];

  private injector: any;

  constructor(propertiesPanel: any, injector: any) {
    this.injector = injector;
    propertiesPanel.registerProvider(500, this);
  }

  getGroups(element: any) {
    return (groups: any[]) => {
      if (!isProcess(element)) {
        return groups;
      }

      // Add Process Variables as a ListGroup
      const variablesGroup = ProcessVariablesGroup({ element, injector: this.injector });
      if (variablesGroup) {
        groups.push({
          id: 'process-variables',
          component: ListGroup,
          ...variablesGroup
        });
      }

      return groups;
    };
  }
}
