import { useState, useEffect } from 'react';
import { LogOut, FolderPlus, Plus, Folder, Disc, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';

// --- DND Components ---
function DraggableProject({ project }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `proj-${project.id}`,
    data: { type: 'project', project }
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`glass group flex items-center p-4 rounded-xl transition-all border border-border ${isDragging ? 'opacity-50 ring-2 ring-primary-label/20' : 'hover:bg-highlight'}`}
    >
      <div {...listeners} {...attributes} className="mr-3 cursor-grab text-secondary-label hover:text-primary-label opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-5 h-5" />
      </div>
      <Link to={`/project/${project.id}`} className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer">
        <div className="w-12 h-12 rounded-lg bg-shading flex items-center justify-center shrink-0 overflow-hidden border border-border">
          {project.coverArt ? (
            <img src={project.coverArt} alt={project.name} className="w-full h-full object-cover" />
          ) : (
            <Disc className="w-5 h-5 text-secondary-label" />
          )}
        </div>
        <div>
          <h3 className="font-medium text-primary-label truncate">{project.name}</h3>
          <p className="text-xs text-secondary-label">{new Date(project.createdAt).toLocaleDateString()}</p>
        </div>
      </Link>
    </div>
  );
}

function DroppableFolder({ folder, projects, onProjectClick }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder }
  });

  const folderProjects = projects.filter(p => p.folderId === folder.id);

  return (
    <div 
      ref={setNodeRef} 
      className={`border border-border rounded-2xl p-6 transition-colors ${isOver ? 'bg-highlight/50 border-primary-label/30 ring-2 ring-primary-label/20' : 'bg-shading/30'}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <Folder className="w-6 h-6 text-primary-label" />
        <h3 className="text-lg font-medium">{folder.name}</h3>
        <span className="text-xs text-secondary-label ml-auto bg-shading px-2 py-1 rounded-full">{folderProjects.length} projects</span>
      </div>
      
      {folderProjects.length === 0 ? (
        <div className="text-center py-8 text-secondary-label text-sm border border-dashed border-border/50 rounded-xl">
          Empty Folder. Drag projects here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {folderProjects.map(p => (
            <DraggableProject key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard({ user, onLogout }) {
  const [workspace, setWorkspace] = useState({ folders: [], projects: [] });
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/workspace`);
      const data = await res.json();
      setWorkspace(data);
    } catch (err) {
      console.error('Failed to fetch workspace', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const createFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id })
    });
    const newFolder = await res.json();
    setWorkspace(prev => ({ ...prev, folders: [...prev.folders, newFolder] }));
  };

  const createProject = async () => {
    const name = prompt('Enter project name:');
    if (!name) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, userId: user.id })
    });
    const newProject = await res.json();
    setWorkspace(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const projectId = active.data.current?.project?.id;
    let folderId = null;

    if (over.data.current?.type === 'folder') {
      folderId = over.data.current.folder.id;
    } else if (over.id === 'root') {
      folderId = null;
    } else {
      return; // Invalid drop target
    }

    // Optimistic update
    setWorkspace(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === projectId ? { ...p, folderId } : p)
    }));

    try {
      await fetch(`http://localhost:3001/api/projects/${projectId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      });
    } catch (e) {
      console.error('Failed to move project', e);
      fetchWorkspace(); // Revert on failure
    }
  };

  if (loading) return null;

  const rootProjects = workspace.projects.filter(p => !p.folderId);

  return (
    <div className="min-h-screen bg-primary-background pb-32 animate-fade-in relative">
      <header className="sticky top-0 z-40 glass px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold tracking-tighter text-primary-label">[untitled]</div>
          <div className="w-px h-4 bg-border"></div>
          <h1 className="text-sm font-medium">Welcome, {user.name}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={createFolder} className="flex items-center gap-2 text-secondary-label hover:text-primary-label px-3 py-2 text-sm font-medium transition-colors">
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          <button onClick={createProject} className="flex items-center gap-2 bg-primary-label text-primary-background px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            New Project
          </button>
          <button onClick={onLogout} className="p-2 text-secondary-label hover:text-primary-label transition-colors" title="Log out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Workspace</h2>
          <p className="text-secondary-label">Organize your work-in-progress projects into folders.</p>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="space-y-12">
            
            {/* Folders Section */}
            {workspace.folders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-secondary-label uppercase tracking-widest mb-6">Folders</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {workspace.folders.map(folder => (
                    <DroppableFolder key={folder.id} folder={folder} projects={workspace.projects} />
                  ))}
                </div>
              </div>
            )}

            {/* Root Projects Section */}
            <DroppableRoot>
              <h3 className="text-sm font-medium text-secondary-label uppercase tracking-widest mb-6">Root Projects</h3>
              {rootProjects.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center border border-dashed border-border flex flex-col items-center">
                  <Disc className="w-12 h-12 text-secondary-label mb-4" />
                  <h3 className="text-lg font-medium mb-1">No loose projects</h3>
                  <p className="text-secondary-label text-sm mb-6">Create a new project to get started.</p>
                  <button onClick={createProject} className="text-sm font-medium bg-shading hover:bg-highlight px-4 py-2 rounded-full transition-colors border border-border">
                    Create Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rootProjects.map(p => (
                    <DraggableProject key={p.id} project={p} />
                  ))}
                </div>
              )}
            </DroppableRoot>

          </div>
        </DndContext>
      </main>
    </div>
  );
}

function DroppableRoot({ children }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'root' });
  return (
    <div ref={setNodeRef} className={`p-6 -m-6 rounded-3xl transition-colors ${isOver ? 'bg-highlight/10 ring-2 ring-primary-label/10' : ''}`}>
      {children}
    </div>
  );
}
