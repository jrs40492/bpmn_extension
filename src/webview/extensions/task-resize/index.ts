/**
 * Task Resize Extension
 * Allows resizing of Task elements (Task, ServiceTask, UserTask, etc.)
 */

import TaskResizeProvider from './resize-provider';

export default {
  __depends__: [],
  __init__: ['taskResizeProvider'],
  taskResizeProvider: ['type', TaskResizeProvider]
};
