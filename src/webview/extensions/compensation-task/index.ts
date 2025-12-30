/**
 * Compensation Task Extension Module
 * Ensures that Tasks created for compensation have proper context pad options
 * including the ability to change the task type (e.g., to Script Task, Service Task, etc.)
 */

import CompensationTaskContextPad from './context-pad-provider';
import CompensationTaskReplaceMenuProvider from './replace-menu-provider';

export default {
  __init__: ['compensationTaskContextPad', 'compensationTaskReplaceMenuProvider'],
  compensationTaskContextPad: ['type', CompensationTaskContextPad],
  compensationTaskReplaceMenuProvider: ['type', CompensationTaskReplaceMenuProvider]
};
