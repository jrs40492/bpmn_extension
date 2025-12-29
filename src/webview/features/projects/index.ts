/**
 * Multi-file Projects
 * Support for BPMN projects with multiple diagrams
 */

export interface BpmnFile {
  path: string;
  name: string;
  type: 'process' | 'collaboration' | 'choreography';
  lastModified: number;
  processIds: string[];
  hasErrors: boolean;
}

export interface ProjectLink {
  sourceFile: string;
  sourceElement: string;  // CallActivity ID
  targetFile: string;
  targetProcess: string;
}

export interface BpmnProject {
  name: string;
  rootPath: string;
  files: BpmnFile[];
  links: ProjectLink[];
}

// Current project state
let currentProject: BpmnProject | null = null;

export function initProjectsPanel(
  onFileSelect: (filePath: string) => void,
  onRefresh: () => Promise<BpmnFile[]>
): {
  show: () => void;
  hide: () => void;
  setProject: (project: BpmnProject) => void;
  getProject: () => BpmnProject | null;
  addFile: (file: BpmnFile) => void;
  updateLinks: (links: ProjectLink[]) => void;
} {
  const panel = createProjectsPanelHTML();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector('.projects-panel-close') as HTMLButtonElement;
  const refreshBtn = panel.querySelector('#refresh-project-btn') as HTMLButtonElement;
  const filesList = panel.querySelector('.project-files-list') as HTMLDivElement;
  const linksList = panel.querySelector('.project-links-list') as HTMLDivElement;
  const projectName = panel.querySelector('.project-name') as HTMLSpanElement;

  closeButton.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';

    try {
      const files = await onRefresh();
      if (currentProject) {
        currentProject.files = files;
        renderFiles();
      }
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
    }
  });

  function renderFiles() {
    if (!currentProject || currentProject.files.length === 0) {
      filesList.innerHTML = `
        <div class="project-empty">
          <p>No BPMN files found in project</p>
          <p class="hint">Create a new diagram or open a folder with .bpmn files</p>
        </div>
      `;
      return;
    }

    // Group files by directory
    const grouped = groupFilesByDirectory(currentProject.files);

    filesList.innerHTML = Object.entries(grouped).map(([dir, files]) => `
      <div class="file-group">
        ${dir !== '.' ? `<div class="file-group-header">📁 ${dir}</div>` : ''}
        <div class="file-group-items">
          ${files.map(file => renderFileItem(file)).join('')}
        </div>
      </div>
    `).join('');

    // Add click handlers
    filesList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.getAttribute('data-file-path');
        if (filePath) {
          onFileSelect(filePath);
        }
      });
    });
  }

  function renderLinks() {
    if (!currentProject || currentProject.links.length === 0) {
      linksList.innerHTML = `
        <div class="links-empty">No cross-diagram links found</div>
      `;
      return;
    }

    linksList.innerHTML = currentProject.links.map(link => `
      <div class="link-item">
        <div class="link-source">
          <span class="link-file">${getFileName(link.sourceFile)}</span>
          <span class="link-element">${link.sourceElement}</span>
        </div>
        <span class="link-arrow">→</span>
        <div class="link-target">
          <span class="link-file">${getFileName(link.targetFile)}</span>
          <span class="link-process">${link.targetProcess}</span>
        </div>
      </div>
    `).join('');
  }

  function show() {
    panel.classList.add('visible');
    renderFiles();
    renderLinks();
  }

  function hide() {
    panel.classList.remove('visible');
  }

  return {
    show,
    hide,
    setProject: (project: BpmnProject) => {
      currentProject = project;
      projectName.textContent = project.name;
      renderFiles();
      renderLinks();
    },
    getProject: () => currentProject,
    addFile: (file: BpmnFile) => {
      if (currentProject) {
        currentProject.files.push(file);
        renderFiles();
      }
    },
    updateLinks: (links: ProjectLink[]) => {
      if (currentProject) {
        currentProject.links = links;
        renderLinks();
      }
    }
  };
}

function renderFileItem(file: BpmnFile): string {
  const icon = file.type === 'collaboration' ? '👥' :
               file.type === 'choreography' ? '💃' : '📄';
  const statusIcon = file.hasErrors ? '⚠️' : '';
  const modified = formatDate(file.lastModified);

  return `
    <div class="file-item ${file.hasErrors ? 'has-errors' : ''}" data-file-path="${file.path}">
      <span class="file-icon">${icon}</span>
      <div class="file-info">
        <div class="file-name">${file.name} ${statusIcon}</div>
        <div class="file-meta">
          <span class="file-type">${file.type}</span>
          ${file.processIds.length > 0 ? `<span class="file-processes">${file.processIds.length} process(es)</span>` : ''}
          <span class="file-modified">${modified}</span>
        </div>
      </div>
    </div>
  `;
}

function groupFilesByDirectory(files: BpmnFile[]): Record<string, BpmnFile[]> {
  const grouped: Record<string, BpmnFile[]> = {};

  for (const file of files) {
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

    if (!grouped[dir]) {
      grouped[dir] = [];
    }
    grouped[dir].push(file);
  }

  // Sort files within each group
  for (const dir of Object.keys(grouped)) {
    grouped[dir].sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (date.toDateString() === now.toDateString()) {
    return 'today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'yesterday';
  }

  return date.toLocaleDateString();
}

// Helper to analyze BPMN XML and extract file info
export function analyzeBpmnFile(xml: string, filePath: string): BpmnFile {
  const name = getFileName(filePath);
  const processIds: string[] = [];
  let type: BpmnFile['type'] = 'process';
  let hasErrors = false;

  // Extract process IDs
  const processMatches = xml.matchAll(/bpmn:process[^>]+id="([^"]+)"/gi);
  for (const match of processMatches) {
    processIds.push(match[1]);
  }

  // Detect type
  if (xml.includes('bpmn:collaboration') || xml.includes('bpmn:participant')) {
    type = 'collaboration';
  } else if (xml.includes('bpmn:choreography')) {
    type = 'choreography';
  }

  return {
    path: filePath,
    name,
    type,
    lastModified: Date.now(),
    processIds,
    hasErrors
  };
}

// Helper to find call activity links between diagrams
export function findProjectLinks(files: BpmnFile[], getXml: (path: string) => string | null): ProjectLink[] {
  const links: ProjectLink[] = [];
  const processToFile = new Map<string, string>();

  // Build process ID to file mapping
  for (const file of files) {
    for (const processId of file.processIds) {
      processToFile.set(processId, file.path);
    }
  }

  // Find call activities that reference other processes
  for (const file of files) {
    const xml = getXml(file.path);
    if (!xml) continue;

    const callActivityMatches = xml.matchAll(/bpmn:callActivity[^>]+id="([^"]+)"[^>]*calledElement="([^"]+)"/gi);
    for (const match of callActivityMatches) {
      const sourceElement = match[1];
      const targetProcess = match[2];
      const targetFile = processToFile.get(targetProcess);

      if (targetFile && targetFile !== file.path) {
        links.push({
          sourceFile: file.path,
          sourceElement,
          targetFile,
          targetProcess
        });
      }
    }
  }

  return links;
}

function createProjectsPanelHTML(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'projects-panel';
  panel.className = 'projects-panel';

  panel.innerHTML = `
    <div class="projects-panel-header">
      <span class="projects-panel-icon">📂</span>
      <span class="projects-panel-title">Project Files</span>
      <button class="projects-panel-close" title="Close">&times;</button>
    </div>
    <div class="projects-panel-body">
      <div class="project-header">
        <span class="project-name">No project loaded</span>
        <button id="refresh-project-btn" class="refresh-btn">Refresh</button>
      </div>

      <div class="project-section">
        <div class="project-section-title">BPMN Files</div>
        <div class="project-files-list">
          <div class="project-empty">
            <p>No BPMN files found</p>
          </div>
        </div>
      </div>

      <div class="project-section">
        <div class="project-section-title">Cross-Diagram Links</div>
        <div class="project-links-list">
          <div class="links-empty">No cross-diagram links found</div>
        </div>
      </div>

      <div class="project-help">
        <p>💡 Use <strong>Call Activity</strong> elements to link processes across files</p>
        <p>Set the <em>calledElement</em> property to the target process ID</p>
      </div>
    </div>
  `;

  return panel;
}
