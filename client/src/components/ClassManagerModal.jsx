import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Plus, Trash2, Tag, Save } from 'lucide-react';

export const ClassManagerModal = ({ isOpen, onClose, config, onSave }) => {
    const [mappings, setMappings] = useState([]);
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (config && config.classMapping) {
            const list = Object.entries(config.classMapping).map(([id, name]) => ({
                id: parseInt(id),
                name
            })).sort((a, b) => a.id - b.id);
            setMappings(list);
        }
    }, [config, isOpen]);

    const handleAdd = () => {
        const id = parseInt(newId);
        if (isNaN(id)) return;
        if (mappings.some(m => m.id === id)) {
            alert('Class ID ' + id + ' 已经存在');
            return;
        }
        setMappings([...mappings, { id, name: newName || `class_${id}` }].sort((a, b) => a.id - b.id));
        setNewId('');
        setNewName('');
    };

    const handleRemove = (id) => {
        setMappings(mappings.filter(m => m.id !== id));
    };

    const handleUpdateName = (id, name) => {
        setMappings(mappings.map(m => m.id === id ? { ...m, name } : m));
    };

    const handleSave = () => {
        const mappingObj = {};
        mappings.forEach(m => {
            mappingObj[m.id] = m.name;
        });
        onSave({ ...config, classMapping: mappingObj });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay modal-overlay-high" onClick={onClose}>
            <div
                className="animate-scale-in modal-panel modal-panel-md"
                onClick={e => e.stopPropagation()}
                style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
                <div className="modal-header-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="modal-icon modal-icon-accent">
                            <Tag size={20} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ margin: 0 }}>类别管理器</h3>
                    </div>
                    <button onClick={onClose} className="icon-btn hover-card" style={{ padding: '8px' }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        定义类别 ID 与名称的映射关系。这些名称将显示在侧边栏并用于数据集导出（data.yaml）。
                    </p>

                    {/* Add New Mapping */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr auto',
                        gap: '12px',
                        marginBottom: '2rem',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div>
                            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>类别 ID</label>
                            <input
                                type="number"
                                min="0"
                                value={newId}
                                onChange={e => setNewId(e.target.value)}
                                className="input-modern"
                                style={{ height: '40px', fontSize: '0.9rem' }}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>类别名称</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="input-modern"
                                style={{ height: '40px', fontSize: '0.9rem' }}
                                placeholder="例如: Person"
                            />
                        </div>
                        <div style={{ alignSelf: 'end' }}>
                            <button
                                onClick={handleAdd}
                                className="btn-modern-primary"
                                style={{ height: '40px', width: '40px', padding: 0, justifyContent: 'center' }}
                                disabled={newId === ''}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Mapping List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', gap: '12px', padding: '0 12px', opacity: 0.5, fontSize: '11px' }}>
                            <span>ID</span>
                            <span>名称</span>
                            <span>操作</span>
                        </div>
                        {mappings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                尚未定义任何类别映射
                            </div>
                        ) : (
                            mappings.map(m => (
                                <div key={m.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '80px 1fr 40px',
                                    gap: '12px',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.03)'
                                }}>
                                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{m.id}</span>
                                    <input
                                        type="text"
                                        value={m.name}
                                        onChange={e => handleUpdateName(m.id, e.target.value)}
                                        className="input-inline"
                                        style={{ width: '100%', background: 'transparent', border: 'none', padding: '4px 0' }}
                                    />
                                    <button onClick={() => handleRemove(m.id)} className="icon-btn" style={{ color: 'var(--danger)', opacity: 0.7 }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                    <button onClick={onClose} className="btn-modern-secondary" style={{ padding: '0 1.5rem', height: '42px' }}>
                        取消
                    </button>
                    <button onClick={handleSave} className="btn-modern-primary" style={{ padding: '0 1.5rem', height: '42px' }}>
                        <Save size={18} /> 保存配置
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
