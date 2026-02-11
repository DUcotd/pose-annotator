
import React, { useState } from 'react';
import { Folder, Trash2, Plus, Image as ImageIcon, ChevronRight } from 'lucide-react';

export const ProjectDashboard = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newProjectName.trim()) {
            onCreateProject(newProjectName);
            setNewProjectName('');
            setIsCreating(false);
        }
    };

    return (
        <div>
            {/* Action Bar */}
            <div className="action-bar">
                <div style={{ flex: 1 }}></div>
                <button className="btn-create" onClick={() => setIsCreating(true)}>
                    <Plus size={20} />
                    新建项目
                </button>
            </div>

            {/* Creation Modal */}
            {isCreating && (
                <div className="modal-overlay" onClick={() => setIsCreating(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className="animate-scale-in modal-panel"
                    >
                        <div className="modal-header">
                            <div className="modal-icon modal-icon-success">
                                <Plus size={20} color="var(--success)" />
                            </div>
                            <h3>创建新项目</h3>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-body">
                            <div>
                                <label className="form-label">项目名称</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="请输入项目名称..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="modal-footer" style={{ marginTop: 0 }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsCreating(false)}>
                                    取消
                                </button>
                                <button type="submit" className="btn-success">
                                    <Plus size={18} />
                                    创建项目
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Projects Grid */}
            <div className="card-grid">
                {projects.map((project, index) => (
                    <div
                        key={project.id}
                        className={`card animate-slide-up delay-${(index % 4) + 1}`}
                        onClick={() => onSelectProject(project.id)}
                    >
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div className="card-icon">
                                    <Folder color="var(--accent-primary)" size={24} />
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                                    className="btn-ghost-danger"
                                    title="删除项目"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>{project.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <ImageIcon size={14} />
                                <span>{project.imageCount || 0} 张图片</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', color: 'var(--accent-primary)', opacity: 0.8 }}>
                            <ChevronRight size={20} />
                        </div>
                    </div>
                ))}

                {projects.length === 0 && !isCreating && (
                    <div className="card-empty">
                        <p>暂无项目，请创建一个新项目以开始。</p>
                    </div>
                )}
            </div>
        </div>
    );
};
