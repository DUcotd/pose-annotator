import React from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Plus, Upload, Target, Download } from 'lucide-react';

export const QuickGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const steps = [
        { icon: Plus, title: '创建项目', desc: '点击"新建项目"，输入名称创建您的数据集空间。', color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.1)' },
        { icon: Upload, title: '上传图片', desc: '进入项目后，在"图库"页面上传待标注的图片。', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
        { icon: Target, title: '进行标注', desc: '点击图库中的图片进入编辑器，绘制边界框并分配标签。', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
        { icon: Download, title: '导出数据集', desc: '标注完成后，点击侧边栏的"导出"按钮生成 YOLO 格式数据。', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.1)' }
    ];

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="animate-scale-in glass-panel"
                style={{ 
                    border: '1px solid var(--border-subtle)', 
                    maxWidth: '600px', 
                    width: '90%', 
                    padding: '2.5rem', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '24px' 
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Zap size={24} className="text-gradient" /> 
                        快速上手指南
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            transition: 'all 0.2s'
                        }}
                        className="hover-card"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
                            <div style={{ background: step.bg, padding: '12px', borderRadius: '12px', color: step.color, flexShrink: 0 }}>
                                <step.icon size={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 600 }}>{i + 1}. {step.title}</h4>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '2.5rem' }}>
                    <button type="button" className="btn-modern-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
                        我明白了
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
