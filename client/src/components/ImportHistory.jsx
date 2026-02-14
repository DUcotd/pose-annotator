import React, { useState, useEffect } from 'react';
import { Clock, Copy, Move, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const formatDate = (dateStr) => {
    if (!dateStr) return '未知';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return '未知';
    }
};

export const ImportHistory = ({ projectId, onClose }) => {
    const { getImportHistory } = useProject();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedIndex, setExpandedIndex] = useState(null);

    useEffect(() => {
        const loadHistory = async () => {
            setLoading(true);
            const data = await getImportHistory(projectId);
            setHistory(data);
            setLoading(false);
        };
        loadHistory();
    }, [projectId, getImportHistory]);

    const toggleExpand = (index) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '700px',
                maxHeight: '80vh',
                background: 'linear-gradient(145deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.99))',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '24px 28px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'rgba(77, 161, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(77, 161, 255, 0.2)'
                        }}>
                            <Clock size={24} color="#4da1ff" />
                        </div>
                        <div>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.3rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)'
                            }}>
                                导入历史记录
                            </h2>
                            <p style={{
                                margin: '4px 0 0 0',
                                fontSize: '0.85rem',
                                color: 'var(--text-tertiary)'
                            }}>
                                查看最近的图片导入记录
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '20px'
                }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px',
                            color: 'var(--text-tertiary)'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                border: '3px solid rgba(77, 161, 255, 0.2)',
                                borderTopColor: '#4da1ff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                marginBottom: '16px'
                            }} />
                            <span>加载中...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px',
                            color: 'var(--text-tertiary)'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px'
                            }}>
                                <Clock size={36} />
                            </div>
                            <p style={{ margin: 0, fontSize: '1rem' }}>暂无导入记录</p>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                                从文件夹导入图片后，记录将显示在这里
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {history.map((record, index) => (
                                <div
                                    key={index}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '14px',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div
                                        onClick={() => toggleExpand(index)}
                                        style={{
                                            padding: '16px 20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                background: record.mode === 'copy' 
                                                    ? 'rgba(77, 161, 255, 0.1)' 
                                                    : 'rgba(168, 85, 247, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {record.mode === 'copy' ? (
                                                    <Copy size={18} color="#4da1ff" />
                                                ) : (
                                                    <Move size={18} color="#a855f7" />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    marginBottom: '4px'
                                                }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: 'var(--text-primary)',
                                                        fontSize: '0.95rem'
                                                    }}>
                                                        {record.successCount} 张图片
                                                    </span>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        background: record.mode === 'copy' 
                                                            ? 'rgba(77, 161, 255, 0.1)' 
                                                            : 'rgba(168, 85, 247, 0.1)',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500,
                                                        color: record.mode === 'copy' ? '#4da1ff' : '#a855f7'
                                                    }}>
                                                        {record.mode === 'copy' ? '复制' : '移动'}
                                                    </span>
                                                    {record.failedCount > 0 && (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500,
                                                            color: '#ef4444'
                                                        }}>
                                                            {record.failedCount} 失败
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    <Clock size={12} />
                                                    {formatDate(record.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {record.successCount === record.totalRequested && record.failedCount === 0 ? (
                                                <CheckCircle size={18} color="#34d399" />
                                            ) : record.failedCount > 0 ? (
                                                <AlertCircle size={18} color="#f59e0b" />
                                            ) : (
                                                <XCircle size={18} color="#ef4444" />
                                            )}
                                            {expandedIndex === index ? (
                                                <ChevronUp size={18} color="var(--text-tertiary)" />
                                            ) : (
                                                <ChevronDown size={18} color="var(--text-tertiary)" />
                                            )}
                                        </div>
                                    </div>
                                    
                                    {expandedIndex === index && (
                                        <div style={{
                                            padding: '0 20px 16px 20px',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}>
                                            <div style={{
                                                marginTop: '16px',
                                                padding: '14px',
                                                background: 'rgba(0, 0, 0, 0.2)',
                                                borderRadius: '10px',
                                                fontSize: '0.85rem'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '10px',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    <ImageIcon size={14} />
                                                    <span>来源路径：</span>
                                                </div>
                                                <div style={{
                                                    color: 'var(--text-primary)',
                                                    wordBreak: 'break-all',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.8rem',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    padding: '8px 12px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {record.sourcePath || '未知'}
                                                </div>
                                            </div>
                                            
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '10px',
                                                marginTop: '14px'
                                            }}>
                                                <div style={{
                                                    textAlign: 'center',
                                                    padding: '12px',
                                                    background: 'rgba(52, 211, 153, 0.05)',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(52, 211, 153, 0.1)'
                                                }}>
                                                    <div style={{
                                                        fontSize: '1.3rem',
                                                        fontWeight: 700,
                                                        color: '#34d399'
                                                    }}>
                                                        {record.successCount}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-tertiary)',
                                                        marginTop: '4px'
                                                    }}>
                                                        成功
                                                    </div>
                                                </div>
                                                <div style={{
                                                    textAlign: 'center',
                                                    padding: '12px',
                                                    background: 'rgba(239, 68, 68, 0.05)',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(239, 68, 68, 0.1)'
                                                }}>
                                                    <div style={{
                                                        fontSize: '1.3rem',
                                                        fontWeight: 700,
                                                        color: '#ef4444'
                                                    }}>
                                                        {record.failedCount}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-tertiary)',
                                                        marginTop: '4px'
                                                    }}>
                                                        失败
                                                    </div>
                                                </div>
                                                <div style={{
                                                    textAlign: 'center',
                                                    padding: '12px',
                                                    background: 'rgba(77, 161, 255, 0.05)',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(77, 161, 255, 0.1)'
                                                }}>
                                                    <div style={{
                                                        fontSize: '1.3rem',
                                                        fontWeight: 700,
                                                        color: '#4da1ff'
                                                    }}>
                                                        {record.totalRequested}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-tertiary)',
                                                        marginTop: '4px'
                                                    }}>
                                                        总计
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
