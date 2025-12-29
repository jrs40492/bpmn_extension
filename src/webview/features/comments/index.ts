/**
 * Collaboration Comments Feature
 * Add commenting/annotation support to BPMN elements
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
  businessObject: {
    id: string;
    name?: string;
    $type: string;
  };
}

interface EventBus {
  on(event: string, callback: (event: unknown) => void): void;
}

// In-memory storage for comments (could be persisted via extension messages)
let comments: Comment[] = [];
let currentElementId: string | null = null;

export function initCommentsPanel(
  eventBus: EventBus,
  onCommentsChange?: (comments: Comment[]) => void
): {
  show: () => void;
  hide: () => void;
  getComments: () => Comment[];
  setComments: (c: Comment[]) => void;
  getCommentsForElement: (elementId: string) => Comment[];
} {
  const panel = createCommentsPanelHTML();
  document.body.appendChild(panel);

  // Create comment indicators overlay
  const overlay = document.createElement('div');
  overlay.id = 'comments-overlay';
  overlay.className = 'comments-overlay';
  document.body.appendChild(overlay);

  const closeButton = panel.querySelector('.comments-panel-close') as HTMLButtonElement;
  const addButton = panel.querySelector('.comments-add-btn') as HTMLButtonElement;
  const input = panel.querySelector('#comment-input') as HTMLTextAreaElement;
  const commentsList = panel.querySelector('.comments-list') as HTMLDivElement;
  const elementName = panel.querySelector('.comments-element-name') as HTMLSpanElement;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
    currentElementId = null;
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

    comments.push(comment);
    input.value = '';
    renderComments();
    updateOverlay();
    onCommentsChange?.(comments);
  }

  function renderComments() {
    if (!currentElementId) {
      commentsList.innerHTML = '<div class="comments-empty">Select an element to view comments</div>';
      return;
    }

    const elementComments = comments.filter(c => c.elementId === currentElementId);

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
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = !comment.resolved;
      renderComments();
      updateOverlay();
      onCommentsChange?.(comments);
    }
  }

  function deleteComment(commentId: string) {
    comments = comments.filter(c => c.id !== commentId);
    renderComments();
    updateOverlay();
    onCommentsChange?.(comments);
  }

  function updateOverlay() {
    // Group comments by element
    const commentsByElement = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!comment.resolved) {
        const existing = commentsByElement.get(comment.elementId) || [];
        existing.push(comment);
        commentsByElement.set(comment.elementId, existing);
      }
    }

    // Update indicators (simplified - would need element positions for real implementation)
    overlay.innerHTML = '';
    // Note: Full implementation would position indicators on actual elements
  }

  // Listen for element selection
  eventBus.on('selection.changed', (event: unknown) => {
    const selectionEvent = event as { newSelection?: Element[] };
    const selection = selectionEvent.newSelection;

    if (selection && selection.length === 1) {
      const element = selection[0];
      if (element.businessObject) {
        currentElementId = element.id;
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
    getComments: () => [...comments],
    setComments: (c: Comment[]) => {
      comments = c;
      renderComments();
      updateOverlay();
    },
    getCommentsForElement: (elementId: string) => comments.filter(c => c.elementId === elementId)
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
