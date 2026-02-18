/**
 * Error Boundary Extension Module
 * Provides multi-error code support for boundary error events.
 *
 * Features:
 * - Comma-separated HTTP error codes on a single boundary event
 * - Export expansion to multiple BPMN-compliant boundary events
 * - Import collapse back to a single visual boundary event
 */

import ErrorBoundaryPropertiesProvider from './properties-provider';
import errorBoundaryDescriptor from './moddle-descriptor';

// Export the moddle descriptor separately (needed for modeler config)
export { errorBoundaryDescriptor };

// Export the module for bpmn-js additionalModules
export default {
  __init__: ['errorBoundaryPropertiesProvider'],
  errorBoundaryPropertiesProvider: ['type', ErrorBoundaryPropertiesProvider]
};
