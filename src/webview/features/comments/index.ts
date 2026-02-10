/**
 * Collaboration Comments Feature
 * Add commenting/annotation support to BPMN elements
 * Comments are persisted in BPMN extension elements (bamoe:comments)
 */

export interface Comment {
  id: string;
  elementId: string;
  text: string;
  author: string;
  timestamp: number;
  resolved: boolean;
}

interface Element {
  id: string;
  businessObject: BusinessObject;
}

interface BusinessObject {
  id: string;
  name?: string;
  $type: string;
  $parent?: BusinessObject;
  extensionElements?: ExtensionElements;
}

interface ExtensionElements {
  values?: ModdleElement[];
  $type: string;
}

interface ModdleElement {
  $type: string;
  comments?: ModdleComment[];
}

interface ModdleComment {
  $type: string;
  id: string;
  text: string;
  author: string;
  timestamp: string;
  resolved: boolean;
  $parent?: ModdleElement;
}

interface EventBus {
  on(event: string, callback: (event: unknown) => void): void;
}

interface BpmnFactory {
  create(type: string, attrs?: Record<string, unknown>): ModdleElement;
}

interface CommandStack {
  execute(cmd: string, context: Record<string, unknown>): void;
}

interface ElementRegistry {
  get(id: string): Element | undefined;
  getAll(): Element[];
}

interface Overlays {
  add(elementId: string, type: string, overlay: {
    position: { top?: number; bottom?: number; left?: number; right?: number };
    html: string | HTMLElement;
  }): string;
  remove(filter: { type?: string }): void;
}

// Overlay type constant
const COMMENT_OVERLAY_TYPE = 'comment-indicator';

// Current element state
let currentElementId: string | null = null;
let currentElement: Element | null = null;

// Services from bpmn-js
let bpmnFactoryRef: BpmnFactory | null = null;
let commandStackRef: CommandStack | null = null;
let elementRegistryRef: ElementRegistry | null = null;
let overlaysRef: Overlays | null = null;

// Callback to show comments panel
let showPanelCallback: (() => void) | null = null;

/**
 * Get comments container from an element's extension elements
 */
function getCommentsContainer(element: Element): ModdleElement | null {
  const bo = element.businessObject;
  if (!bo) return null;

  const extensionElements = bo.extensionElements;
  if (!extensionElements) return null;

  const values = extensionElements.values || [];
  return values.find((ext: ModdleElement) => ext.$type === 'bamoe:Comments') || null;
}

/**
 * Get comments for a specific element from its extension elements
 */
function getCommentsFromElement(element: Element): Comment[] {
  const container = getCommentsContainer(element);
  if (!container || !container.comments) return [];

  return container.comments.map((c: ModdleComment) => ({
    id: c.id,
    elementId: element.id,
    text: c.text || '',
    author: c.author || 'Unknown',
    timestamp: parseInt(c.timestamp, 10) || Date.now(),
    resolved: c.resolved || false
  }));
}

/**
 * Get all comments from all elements in the diagram
 */
function getAllComments(): Comment[] {
  if (!elementRegistryRef) return [];

  const allComments: Comment[] = [];
  const elements = elementRegistryRef.get as unknown as (id: string) => Element | undefined;

  // We need to iterate through all elements - this is a workaround since
  // elementRegistry.getAll() isn't typed properly
  // For now, we just return comments for the current element
  if (currentElement) {
    return getCommentsFromElement(currentElement);
  }

  return allComments;
}

/**
 * Save a comment to the BPMN element's extension elements
 */
function saveCommentToElement(comment: Comment): void {
  if (!bpmnFactoryRef || !commandStackRef || !elementRegistryRef) {
    console.warn('BPMN services not available for saving comment');
    return;
  }

  const element = elementRegistryRef.get(comment.elementId);
  if (!element) {
    console.warn(`Element ${comment.elementId} not found`);
    return;
  }

  const bo = element.businessObject;

  // Ensure extensionElements exists
  let extensionElements = bo.extensionElements;
  if (!extensionElements) {
    extensionElements = bpmnFactoryRef.create('bpmn:ExtensionElements', { values: [] }) as unknown as ExtensionElements;
    (extensionElements as ExtensionElements & { $parent: BusinessObject }).$parent = bo;
    commandStackRef.execute('element.updateModdleProperties', {
      element,
      moddleElement: bo,
      properties: { extensionElements }
    });
  }

  // Find or create Comments container - re-fetch extensionElements after command execution
  extensionElements = bo.extensionElements;
  let commentsContainer = (extensionElements?.values || []).find(
    (ext: ModdleElement) => ext.$type === 'bamoe:Comments'
  ) as ModdleElement | undefined;

  if (!commentsContainer) {
    commentsContainer = bpmnFactoryRef.create('bamoe:Comments', { comments: [] });
    if (extensionElements) {
      (commentsContainer as ModdleElement & { $parent: ExtensionElements }).$parent = extensionElements;
    }
    commandStackRef.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: {
        values: [...(extensionElements?.values || []), commentsContainer]
      }
    });
  }

  // Re-fetch commentsContainer after command execution
  extensionElements = bo.extensionElements;
  commentsContainer = (extensionElements?.values || []).find(
    (ext: ModdleElement) => ext.$type === 'bamoe:Comments'
  ) as ModdleElement | undefined;

  if (!commentsContainer) {
    console.warn('Failed to create comments container');
    return;
  }

  // Check if comment already exists (update) or is new (add)
  const existingComments = commentsContainer.comments || [];
  const existingIndex = existingComments.findIndex((c: ModdleComment) => c.id === comment.id);

  if (existingIndex >= 0) {
    // Update existing comment
    const existingComment = existingComments[existingIndex];
    commandStackRef.execute('element.updateModdleProperties', {
      element,
      moddleElement: existingComment,
      properties: {
        text: comment.text,
        author: comment.author,
        timestamp: String(comment.timestamp),
        resolved: comment.resolved
      }
    });
  } else {
    // Create new comment
    const newComment = bpmnFactoryRef.create('bamoe:Comment', {
      id: comment.id,
      text: comment.text,
      author: comment.author,
      timestamp: String(comment.timestamp),
      resolved: comment.resolved
    }) as ModdleComment;
    newComment.$parent = commentsContainer;

    commandStackRef.execute('element.updateModdleProperties', {
      element,
      moddleElement: commentsContainer,
      properties: {
        comments: [...existingComments, newComment]
      }
    });
  }
}

/**
 * Delete a comment from the BPMN element's extension elements
 */
function deleteCommentFromElement(commentId: string, elementId: string): void {
  if (!commandStackRef || !elementRegistryRef) {
    console.warn('BPMN services not available for deleting comment');
    return;
  }

  const element = elementRegistryRef.get(elementId);
  if (!element) return;

  const commentsContainer = getCommentsContainer(element);
  if (!commentsContainer || !commentsContainer.comments) return;

  const newComments = commentsContainer.comments.filter((c: ModdleComment) => c.id !== commentId);

  commandStackRef.execute('element.updateModdleProperties', {
    element,
    moddleElement: commentsContainer,
    properties: {
      comments: newComments
    }
  });
}

/**
 * Update comment overlays on all elements in the diagram
 */
function updateCommentOverlays(): void {
  if (!overlaysRef || !elementRegistryRef) return;

  // Remove existing comment overlays
  try {
    overlaysRef.remove({ type: COMMENT_OVERLAY_TYPE });
  } catch (_e) {
    // Ignore errors when no overlays exist
  }

  // Get all elements and add overlays for those with comments
  const allElements = elementRegistryRef.getAll();

  for (const element of allElements) {
    // Skip elements without businessObject (like the root)
    if (!element.businessObject) continue;

    // Skip certain element types that don't make sense for comments
    const type = element.businessObject.$type;
    if (type === 'bpmn:Process' || type === 'bpmn:Collaboration' ||
        type === 'bpmn:Participant' || type === 'bpmndi:BPMNDiagram' ||
        type === 'bpmndi:BPMNPlane') continue;

    const comments = getCommentsFromElement(element);
    const unresolvedCount = comments.filter(c => !c.resolved).length;

    if (unresolvedCount > 0) {
      // Create overlay HTML
      const overlayHtml = document.createElement('div');
      overlayHtml.className = 'comment-indicator';
      overlayHtml.innerHTML = `<span class="comment-indicator-icon">💬</span><span class="comment-indicator-count">${unresolvedCount}</span>`;
      overlayHtml.title = `${unresolvedCount} comment${unresolvedCount > 1 ? 's' : ''}`;

      // Add click handler to select element and show comments panel
      overlayHtml.addEventListener('click', (e) => {
        e.stopPropagation();
        currentElementId = element.id;
        currentElement = element;
        if (showPanelCallback) {
          showPanelCallback();
        }
      });

      // Add overlay to top-left corner of element
      try {
        overlaysRef.add(element.id, COMMENT_OVERLAY_TYPE, {
          position: { top: -12, left: -12 },
          html: overlayHtml
        });
      } catch (_e) {
        // Element might not support overlays (e.g., connections)
      }
    }
  }
}

export function initCommentsPanel(
  eventBus: EventBus,
  bpmnFactory?: BpmnFactory,
  commandStack?: CommandStack,
  elementRegistry?: ElementRegistry,
  overlays?: Overlays,
  _onCommentsChange?: (comments: Comment[]) => void
): {
  show: () => void;
  hide: () => void;
  getComments: () => Comment[];
  setComments: (c: Comment[]) => void;
  getCommentsForElement: (elementId: string) => Comment[];
  refreshOverlays: () => void;
} {
  // Store service references
  bpmnFactoryRef = bpmnFactory || null;
  commandStackRef = commandStack || null;
  elementRegistryRef = elementRegistry || null;
  overlaysRef = overlays || null;

  const panel = createCommentsPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.comments-panel-close') as HTMLButtonElement;
  const addButton = panel.querySelector('.comments-add-btn') as HTMLButtonElement;
  const input = panel.querySelector('#comment-input') as HTMLTextAreaElement;
  const commentsList = panel.querySelector('.comments-list') as HTMLDivElement;
  const elementName = panel.querySelector('.comments-element-name') as HTMLSpanElement;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
    currentElementId = null;
    currentElement = null;
  });

  addButton.addEventListener('click', () => {
    addComment();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      addComment();
    }
  });

  function addComment() {
    const text = input.value.trim();
    if (!text || !currentElementId) return;

    const comment: Comment = {
      id: generateId(),
      elementId: currentElementId,
      text,
      author: 'You',
      timestamp: Date.now(),
      resolved: false
    };

    // Save to BPMN element
    saveCommentToElement(comment);

    input.value = '';
    renderComments();
    updateCommentOverlays();
  }

  function renderComments() {
    if (!currentElementId || !currentElement) {
      commentsList.innerHTML = '<div class="comments-empty">Select an element to view comments</div>';
      return;
    }

    // Load comments from BPMN element
    const elementComments = getCommentsFromElement(currentElement);

    if (elementComments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">No comments yet. Add one below!</div>';
      return;
    }

    commentsList.innerHTML = elementComments
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(comment => `
        <div class="comment-item ${comment.resolved ? 'resolved' : ''}" data-comment-id="${comment.id}">
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.author)}</span>
            <span class="comment-time">${formatTime(comment.timestamp)}</span>
          </div>
          <div class="comment-text">${escapeHtml(comment.text)}</div>
          <div class="comment-actions">
            <button class="comment-resolve-btn" title="${comment.resolved ? 'Unresolve' : 'Resolve'}">
              ${comment.resolved ? '↩️ Reopen' : '✓ Resolve'}
            </button>
            <button class="comment-delete-btn" title="Delete">🗑️</button>
          </div>
        </div>
      `).join('');

    // Add event handlers
    commentsList.querySelectorAll('.comment-resolve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.comment-item');
        const commentId = item?.getAttribute('data-comment-id');
        if (commentId) {
          toggleResolve(commentId);
        }
      });
    });

    commentsList.querySelectorAll('.comment-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.comment-item');
        const commentId = item?.getAttribute('data-comment-id');
        if (commentId) {
          deleteComment(commentId);
        }
      });
    });
  }

  function toggleResolve(commentId: string) {
    if (!currentElement) return;

    const comments = getCommentsFromElement(currentElement);
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = !comment.resolved;
      saveCommentToElement(comment);
      renderComments();
      updateCommentOverlays();
    }
  }

  function deleteComment(commentId: string) {
    if (!currentElementId) return;

    deleteCommentFromElement(commentId, currentElementId);
    renderComments();
    updateCommentOverlays();
  }

  // Set up the callback so overlay clicks can show the panel
  showPanelCallback = () => {
    panel.classList.add('visible');
    if (currentElement) {
      const name = currentElement.businessObject.name || currentElement.businessObject.id;
      elementName.textContent = name;
    }
    renderComments();
  };

  // Listen for diagram import to refresh overlays
  eventBus.on('import.done', () => {
    // Delay slightly to ensure elements are fully rendered
    setTimeout(() => {
      updateCommentOverlays();
    }, 100);
  });

  // Listen for element selection
  eventBus.on('selection.changed', (event: unknown) => {
    const selectionEvent = event as { newSelection?: Element[] };
    const selection = selectionEvent.newSelection;

    if (selection && selection.length === 1) {
      const element = selection[0];
      if (element.businessObject) {
        currentElementId = element.id;
        currentElement = element;
        const name = element.businessObject.name || element.businessObject.id;
        elementName.textContent = name;
        renderComments();
      }
    }
  });

  function show() {
    panel.classList.add('visible');
    renderComments();
  }

  function hide() {
    panel.classList.remove('visible');
  }

  return {
    show,
    hide,
    getComments: () => getAllComments(),
    setComments: (_c: Comment[]) => {
      // This is now handled via BPMN element persistence
      renderComments();
      updateCommentOverlays();
    },
    getCommentsForElement: (elementId: string) => {
      const element = elementRegistryRef?.get(elementId);
      if (element) {
        return getCommentsFromElement(element);
      }
      return [];
    },
    refreshOverlays: () => {
      updateCommentOverlays();
    }
  };
}

function generateId(): string {
  return 'comment_' + Math.random().toString(36).substr(2, 9);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createCommentsPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'comments-panel';
  panel.className = 'comments-panel';

  panel.innerHTML = `
    <div class="comments-panel-header">
      <span class="comments-panel-icon">💬</span>
      <span class="comments-panel-title">Comments</span>
      <button class="comments-panel-close" title="Close">&times;</button>
    </div>
    <div class="comments-element-header">
      <span class="comments-element-label">Element:</span>
      <span class="comments-element-name">Select an element</span>
    </div>
    <div class="comments-list">
      <div class="comments-empty">Select an element to view comments</div>
    </div>
    <div class="comments-input-area">
      <textarea id="comment-input" placeholder="Add a comment... (Ctrl+Enter to submit)"></textarea>
      <button class="comments-add-btn">Add Comment</button>
    </div>
  `;

  return panel;
}
