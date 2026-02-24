import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Tag, Save, Hash, Edit3 } from 'lucide-react';

const CLASS_COLORS = [
    '#58a6ff', '#3fb950', '#f0883e', '#f778ba', '#a371f7', 
    '#7ee787', '#ffa657', '#ff7b72', '#79c0ff', '#d2a8ff'
];

const getClassColor = (id) => CLASS_COLORS[id % CLASS_COLORS.length];

export const ClassManagerModal = ({ isOpen, onClose, config, onSave }) => {
    const [mappings, setMappings] = useState([]);
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');
    const [inlineError, setInlineError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (config && config.classMapping && Object.keys(config.classMapping).length > 0) {
                const list = Object.entries(config.classMapping).map(([id, name]) => ({
                    id: parseInt(id),
                    name
                })).sort((a, b) => a.id - b.id);
                setMappings(list);
            } else {
                setMappings([]);
            }
            setNewId('');
            setNewName('');
            setInlineError('');
        }
    }, [config, isOpen]);

    const handleAdd = () => {
        const id = parseInt(newId);
        if (isNaN(id)) return;
        if (mappings.some(m => m.id === id)) {
            setInlineError(`Class ID ${id} 已经存在`);
            return;
        }
        const newMappings = [...mappings, { id, name: newName || `class_${id}` }].sort((a, b) => a.id - b.id);
        setMappings(newMappings);
        setNewId('');
        setNewName('');
        setInlineError('');
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && newId !== '') {
            handleAdd();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay modal-overlay-high" onClick={onClose}>
            <div
                className="animate-scale-in modal-panel"
                onClick={e => e.stopPropagation()}
                style={{ 
                    width: '480px',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    display: 'flex', 
                    flexDirection: 'column'
                }}
            >
                <div className="modal-header-between" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.2), rgba(163, 113, 247, 0.2))',
                            border: '1px solid rgba(88, 166, 255, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Tag size={20} color="var(--accent-primary)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>类别管理器</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>管理类别ID与名称映射</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="icon-btn hover-card" style={{ padding: '8px' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    <div style={{
                        padding: '1rem',
                        background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(163, 113, 247, 0.05))',
                        borderRadius: '14px',
                        border: '1px solid rgba(88, 166, 255, 0.15)',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                            <Plus size={14} color="var(--accent-primary)" />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>添加新类别</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            <div style={{ flex: '0 0 80px' }}>
                                <label className="form-label" style={{ fontSize: '10px', marginBottom: '6px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID</label>
                                <div style={{ position: 'relative' }}>
                                    <Hash size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                    <input
                                        type="number"
                                        min="0"
                                        value={newId}
                                        onChange={e => setNewId(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="input-modern"
                                        style={{ height: '38px', fontSize: '0.9rem', paddingLeft: '28px', textAlign: 'center' }}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '10px', marginBottom: '6px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>名称</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="input-modern"
                                    style={{ height: '38px', fontSize: '0.9rem' }}
                                    placeholder="例如: Person, Car, Dog..."
                                />
                            </div>
                            <button
                                onClick={handleAdd}
                                className="btn-modern-primary"
                                style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center', flexShrink: 0 }}
                                disabled={newId === ''}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        {inlineError ? (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#fca5a5' }}>
                                {inlineError}
                            </div>
                        ) : null}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>已定义类别</span>
                        <span style={{ 
                            fontSize: '11px', 
                            color: 'var(--text-tertiary)',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 8px',
                            borderRadius: '10px'
                        }}>{mappings.length} 个</span>
                    </div>

                    {mappings.length === 0 ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '2.5rem 1rem', 
                            color: 'var(--text-tertiary)',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '12px',
                            border: '1px dashed rgba(255,255,255,0.1)'
                        }}>
                            <Tag size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>尚未定义任何类别映射</div>
                            <div style={{ fontSize: '0.75rem' }}>添加类别后，标注时将显示名称而非数字ID</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {mappings.map((m, index) => {
                                const color = getClassColor(m.id);
                                return (
                                    <div 
                                        key={m.id} 
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px 14px',
                                            background: 'rgba(0,0,0,0.25)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: 'black',
                                            flexShrink: 0,
                                            boxShadow: `0 2px 8px ${color}40`
                                        }}>
                                            {m.id}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <input
                                                type="text"
                                                value={m.name}
                                                onChange={e => handleUpdateName(m.id, e.target.value)}
                                                style={{ 
                                                    width: '100%',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    padding: '6px 0',
                                                    fontSize: '0.95rem',
                                                    fontWeight: 500,
                                                    color: 'var(--text-primary)',
                                                    outline: 'none'
                                                }}
                                                placeholder="输入类别名称"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleRemove(m.id)} 
                                            className="icon-btn trash-btn" 
                                            style={{ 
                                                opacity: 0.5,
                                                padding: '6px',
                                                borderRadius: '6px',
                                                flexShrink: 0
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ 
                    padding: '1rem 1.5rem', 
                    borderTop: '1px solid rgba(255,255,255,0.05)', 
                    background: 'rgba(0,0,0,0.15)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px'
                }}>
                    <button onClick={onClose} className="btn-modern-secondary" style={{ padding: '0 1.25rem', height: '40px' }}>
                        取消
                    </button>
                    <button onClick={handleSave} className="btn-modern-primary" style={{ padding: '0 1.25rem', height: '40px' }}>
                        <Save size={16} /> 保存配置
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
