/**
 * InputData Behavior
 * Ensures the variable name stays synchronized with the InputData name
 *
 * In DMN, InputData elements have a nested <variable> (InformationItem) element
 * whose name must match the InputData name for proper FEEL expression resolution.
 */

export default class InputDataBehavior {
  static $inject = ['eventBus', 'modeling', 'drdFactory'];

  constructor(eventBus: any, modeling: any, drdFactory: any) {
    console.log('[InputDataBehavior] Initializing...');

    // Listen for element name changes
    eventBus.on('commandStack.element.updateProperties.postExecuted', (event: any) => {
      const { context } = event;
      const { element, properties } = context;

      // Check if this is an InputData element and the name was changed
      const bo = element?.businessObject || element;
      if (!bo || !bo.$instanceOf?.('dmn:InputData')) {
        return;
      }

      // If name was changed, update the variable name to match
      if (properties && 'name' in properties) {
        const newName = properties.name;
        console.log('[InputDataBehavior] InputData name changed to:', newName);

        // Get or create the variable
        if (bo.variable) {
          // Update existing variable name
          if (bo.variable.name !== newName) {
            console.log('[InputDataBehavior] Updating variable name from', bo.variable.name, 'to', newName);
            bo.variable.name = newName;
            // Also update ID to be consistent
            bo.variable.id = `${bo.id}_variable`;
          }
        } else {
          // Create new variable with matching name
          console.log('[InputDataBehavior] Creating new variable with name:', newName);
          const newVariable = drdFactory.create('dmn:InformationItem', {
            id: `${bo.id}_variable`,
            name: newName
          });
          newVariable.$parent = bo;
          bo.variable = newVariable;
        }
      }
    });

    // Listen for element creation
    eventBus.on('commandStack.shape.create.postExecuted', (event: any) => {
      const { context } = event;
      const { shape } = context;

      const bo = shape?.businessObject;
      if (!bo || !bo.$instanceOf?.('dmn:InputData')) {
        return;
      }

      console.log('[InputDataBehavior] InputData element created:', bo.id, 'name:', bo.name);

      // Ensure variable exists with correct name
      if (!bo.variable) {
        const variableName = bo.name || bo.id;
        console.log('[InputDataBehavior] Creating variable for new InputData with name:', variableName);
        const newVariable = drdFactory.create('dmn:InformationItem', {
          id: `${bo.id}_variable`,
          name: variableName
        });
        newVariable.$parent = bo;
        bo.variable = newVariable;
      } else if (bo.variable.name !== bo.name && bo.name) {
        // Fix name if it doesn't match
        console.log('[InputDataBehavior] Fixing variable name to match InputData name');
        bo.variable.name = bo.name;
        bo.variable.id = `${bo.id}_variable`;
      }
    });

    // Also listen for updateModdleProperties which is used by the properties panel
    eventBus.on('commandStack.element.updateModdleProperties.postExecuted', (event: any) => {
      const { context } = event;
      const { element, moddleElement, properties } = context;

      // Check if this is updating an InputData element's name
      const bo = moddleElement;
      if (!bo || !bo.$instanceOf?.('dmn:InputData')) {
        return;
      }

      if (properties && 'name' in properties) {
        const newName = properties.name;
        console.log('[InputDataBehavior] InputData name updated via moddleProperties to:', newName);

        if (bo.variable) {
          if (bo.variable.name !== newName) {
            console.log('[InputDataBehavior] Syncing variable name to:', newName);
            bo.variable.name = newName;
            bo.variable.id = `${bo.id}_variable`;
          }
        } else if (newName) {
          console.log('[InputDataBehavior] Creating variable with name:', newName);
          const newVariable = drdFactory.create('dmn:InformationItem', {
            id: `${bo.id}_variable`,
            name: newName
          });
          newVariable.$parent = bo;
          bo.variable = newVariable;
        }
      }
    });

    console.log('[InputDataBehavior] Initialized');
  }
}
