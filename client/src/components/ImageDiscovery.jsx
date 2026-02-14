import React, { useState, useMemo } from 'react';
import { FolderOpen, Search, Check, X, Copy, Move, ChevronLeft, AlertCircle, Image as ImageIcon, Clock, HardDrive, CheckCircle, XCircle } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const formatSize = (bytes) => {
    if (!bytes) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (dateStr) => {
    if (!dateStr) return '未知';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '未知';
    }
};

const ImagePreviewItem = ({ image, isSelected, onToggle }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    return (
        <div
            onClick={() => onToggle(image.path)}
            style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.03)',
                border: isSelected ? '2px solid rgba(77, 161, 255, 0.8)' : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
            }}
        >
            {!loaded && !error && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(110deg, rgba(255,255,255,0.03) 8%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0.03) 33%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s linear infinite'
                }} />
            )}
            
            {error ? (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)'
                }}>
                    <ImageIcon size={24} />
                </div>
            ) : (
                <img
                    src={`file://${image.path}`}
                    alt={image.name}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: loaded ? 1 : 0,
                        transition: 'opacity 0.3s ease'
                    }}
                />
            )}
            
            {isSelected && (
                <div style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(77, 161, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    <Check size={14} color="white" strokeWidth={3} />
                </div>
            )}
            
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '6px 8px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 500
            }}>
                <div style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {image.name}
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '2px',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.6)'
                }}>
                    <span>{formatSize(image.size)}</span>
                    {image.width && image.height && (
                        <span>{image.width}×{image.height}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ImageDiscovery = ({ projectId, onClose, onImportComplete }) => {
    const { selectFolder, scanImages, importImages } = useProject();
    
    const [step, setStep] = useState('select');
    const [folderPath, setFolderPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [selectedPaths, setSelectedPaths] = useState(new Set());
    const [importMode, setImportMode] = useState('copy');
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
    const [importResult, setImportResult] = useState(null);
    const [error, setError] = useState('');

    const handleSelectFolder = async () => {
        const result = await selectFolder();
        if (result.path) {
            setFolderPath(result.path);
            setError('');
        } else if (result.error) {
            setError(result.error);
        }
    };

    const handleScan = async () => {
        if (!folderPath) {
            setError('请先选择文件夹');
            return;
        }

        setScanning(true);
        setError('');
        setScanResult(null);
        setSelectedPaths(new Set());

        const result = await scanImages(folderPath);
        
        setScanning(false);
        
        if (result.success) {
            setScanResult(result);
            setStep('preview');
        } else {
            setError(result.error || '扫描失败');
        }
    };

    const handleToggleImage = (imagePath) => {
        const newSelected = new Set(selectedPaths);
        if (newSelected.has(imagePath)) {
            newSelected.delete(imagePath);
        } else {
            newSelected.add(imagePath);
        }
        setSelectedPaths(newSelected);
    };

    const handleSelectAll = () => {
        if (scanResult?.images) {
            setSelectedPaths(new Set(scanResult.images.map(img => img.path)));
        }
    };

    const handleDeselectAll = () => {
        setSelectedPaths(new Set());
    };

    const selectedImages = useMemo(() => {
        if (!scanResult?.images) return [];
        return scanResult.images.filter(img => selectedPaths.has(img.path));
    }, [scanResult?.images, selectedPaths]);

    const handleImport = async () => {
        if (selectedImages.length === 0) {
            setError('请选择要导入的图片');
            return;
        }

        setImporting(true);
        setError('');
        setImportProgress({ done: 0, total: selectedImages.length });
        setImportResult(null);

        const batchSize = 20;
        let allResults = { success: [], failed: [], duplicates: [] };
        
        for (let i = 0; i < selectedImages.length; i += batchSize) {
            const batch = selectedImages.slice(i, i + batchSize);
            const result = await importImages(projectId, batch, importMode);
            
            if (result.success) {
                allResults.success.push(...(result.results?.success || []));
                allResults.failed.push(...(result.results?.failed || []));
                allResults.duplicates.push(...(result.results?.duplicates || []));
            }
            
            setImportProgress({ done: Math.min(i + batchSize, selectedImages.length), total: selectedImages.length });
        }

        setImporting(false);
        setImportResult({
            successCount: allResults.success.length,
            failedCount: allResults.failed.length,
            duplicateCount: allResults.duplicates.length
        });
        setStep('complete');
        
        if (onImportComplete) {
            onImportComplete();
        }
    };

    const handleBack = () => {
        if (step === 'preview') {
            setStep('select');
            setScanResult(null);
            setSelectedPaths(new Set());
        } else if (step === 'complete') {
            onClose();
        }
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
                maxWidth: '1000px',
                maxHeight: '90vh',
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
                        {step !== 'select' && (
                            <button
                                onClick={handleBack}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.4rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)'
                            }}>
                                {step === 'select' && '从文件夹导入图片'}
                                {step === 'preview' && '预览并选择图片'}
                                {step === 'complete' && '导入完成'}
                            </h2>
                            <p style={{
                                margin: '4px 0 0 0',
                                fontSize: '0.9rem',
                                color: 'var(--text-tertiary)'
                            }}>
                                {step === 'select' && '选择包含图片的文件夹进行扫描'}
                                {step === 'preview' && `发现 ${scanResult?.totalFound || 0} 张图片，已选择 ${selectedPaths.size} 张`}
                                {step === 'complete' && '查看导入结果'}
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
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '24px 28px'
                }} className="custom-scrollbar">
                    {error && (
                        <div style={{
                            marginBottom: '20px',
                            padding: '14px 18px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9rem'
                        }}>
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    {step === 'select' && (
                        <div>
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                borderRadius: '16px',
                                padding: '40px',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '20px',
                                    background: 'rgba(77, 161, 255, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 20px auto',
                                    border: '1px solid rgba(77, 161, 255, 0.2)'
                                }}>
                                    <FolderOpen size={36} color="#4da1ff" />
                                </div>
                                
                                <h3 style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '1.2rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                }}>
                                    选择图片文件夹
                                </h3>
                                <p style={{
                                    margin: '0 0 24px 0',
                                    color: 'var(--text-tertiary)',
                                    fontSize: '0.9rem'
                                }}>
                                    支持递归扫描子目录，自动识别 JPG、PNG、GIF、BMP、WEBP 格式
                                </p>
                                
                                <button
                                    onClick={handleSelectFolder}
                                    style={{
                                        background: 'linear-gradient(135deg, #4da1ff, #2188ff)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '14px 32px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: 'white',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 15px rgba(77, 161, 255, 0.3)'
                                    }}
                                >
                                    选择文件夹
                                </button>
                            </div>

                            {folderPath && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '16px 20px',
                                    background: 'rgba(77, 161, 255, 0.05)',
                                    border: '1px solid rgba(77, 161, 255, 0.2)',
                                    borderRadius: '12px'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <FolderOpen size={20} color="#4da1ff" />
                                        <span style={{
                                            color: 'var(--text-primary)',
                                            fontWeight: 500,
                                            fontSize: '0.95rem'
                                        }}>
                                            {folderPath}
                                        </span>
                                    </div>
                                    
                                    <button
                                        onClick={handleScan}
                                        disabled={scanning}
                                        style={{
                                            width: '100%',
                                            background: scanning ? 'rgba(77, 161, 255, 0.3)' : 'linear-gradient(135deg, #4da1ff, #2188ff)',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: 'white',
                                            cursor: scanning ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px'
                                        }}
                                    >
                                        {scanning ? (
                                            <>
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    border: '2px solid rgba(255,255,255,0.3)',
                                                    borderTopColor: 'white',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }} />
                                                扫描中...
                                            </>
                                        ) : (
                                            <>
                                                <Search size={18} />
                                                开始扫描
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && scanResult && (
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '20px',
                                flexWrap: 'wrap',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={handleSelectAll}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '8px 16px',
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        全选
                                    </button>
                                    <button
                                        onClick={handleDeselectAll}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '8px 16px',
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        取消全选
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 14px',
                                        background: 'rgba(77, 161, 255, 0.1)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(77, 161, 255, 0.2)'
                                    }}>
                                        <ImageIcon size={16} color="#4da1ff" />
                                        <span style={{ color: '#4da1ff', fontWeight: 600, fontSize: '0.9rem' }}>
                                            {scanResult.totalFound} 张图片
                                        </span>
                                    </div>
                                    
                                    {scanResult.errorCount > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 14px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(239, 68, 68, 0.2)'
                                        }}>
                                            <AlertCircle size={14} color="#ef4444" />
                                            <span style={{ color: '#ef4444', fontWeight: 500, fontSize: '0.85rem' }}>
                                                {scanResult.errorCount} 个错误
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {scanResult.wasLimited && (
                                <div style={{
                                    marginBottom: '16px',
                                    padding: '12px 16px',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '10px',
                                    color: '#f59e0b',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <AlertCircle size={16} />
                                    图片数量过多，仅显示前 {scanResult.returnedCount} 张（共发现 {scanResult.totalFound} 张）
                                </div>
                            )}

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '12px',
                                marginBottom: '24px'
                            }}>
                                {scanResult.images.map((image, index) => (
                                    <ImagePreviewItem
                                        key={image.path + index}
                                        image={image}
                                        isSelected={selectedPaths.has(image.path)}
                                        onToggle={handleToggleImage}
                                    />
                                ))}
                            </div>

                            <div style={{
                                padding: '20px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '16px'
                                }}>
                                    <div>
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-tertiary)',
                                            marginBottom: '8px'
                                        }}>
                                            导入模式
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => setImportMode('copy')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '10px 18px',
                                                    background: importMode === 'copy' ? 'rgba(77, 161, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                                    border: importMode === 'copy' ? '1px solid rgba(77, 161, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '10px',
                                                    color: importMode === 'copy' ? '#4da1ff' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <Copy size={16} />
                                                复制
                                            </button>
                                            <button
                                                onClick={() => setImportMode('move')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '10px 18px',
                                                    background: importMode === 'move' ? 'rgba(77, 161, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                                    border: importMode === 'move' ? '1px solid rgba(77, 161, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '10px',
                                                    color: importMode === 'move' ? '#4da1ff' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <Move size={16} />
                                                移动
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-tertiary)',
                                            marginBottom: '8px'
                                        }}>
                                            已选择 <span style={{ color: '#4da1ff', fontWeight: 600 }}>{selectedPaths.size}</span> 张图片
                                        </div>
                                        <button
                                            onClick={handleImport}
                                            disabled={selectedPaths.size === 0 || importing}
                                            style={{
                                                background: selectedPaths.size === 0 || importing 
                                                    ? 'rgba(77, 161, 255, 0.3)' 
                                                    : 'linear-gradient(135deg, #4da1ff, #2188ff)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '12px 28px',
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: 'white',
                                                cursor: selectedPaths.size === 0 || importing ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: selectedPaths.size > 0 && !importing ? '0 4px 15px rgba(77, 161, 255, 0.3)' : 'none'
                                            }}
                                        >
                                            {importing ? `导入中 ${importProgress.done}/${importProgress.total}` : '开始导入'}
                                        </button>
                                    </div>
                                </div>
                                
                                {importing && (
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{
                                            width: '100%',
                                            height: '6px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '3px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${(importProgress.done / importProgress.total) * 100}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #2188ff, #4da1ff)',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'complete' && importResult && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                background: importResult.failedCount > 0 
                                    ? 'rgba(245, 158, 11, 0.1)' 
                                    : 'rgba(52, 211, 153, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px auto',
                                border: importResult.failedCount > 0 
                                    ? '1px solid rgba(245, 158, 11, 0.3)' 
                                    : '1px solid rgba(52, 211, 153, 0.3)'
                            }}>
                                {importResult.failedCount > 0 ? (
                                    <AlertCircle size={48} color="#f59e0b" />
                                ) : (
                                    <CheckCircle size={48} color="#34d399" />
                                )}
                            </div>
                            
                            <h3 style={{
                                margin: '0 0 8px 0',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)'
                            }}>
                                {importResult.failedCount > 0 ? '导入完成（部分失败）' : '导入成功！'}
                            </h3>
                            
                            <p style={{
                                margin: '0 0 32px 0',
                                color: 'var(--text-tertiary)',
                                fontSize: '1rem'
                            }}>
                                成功导入 {importResult.successCount} 张图片
                                {importResult.failedCount > 0 && `，失败 ${importResult.failedCount} 张`}
                                {importResult.duplicateCount > 0 && `，重命名 ${importResult.duplicateCount} 张重复文件`}
                            </p>
                            
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '16px'
                            }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'linear-gradient(135deg, #4da1ff, #2188ff)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '14px 32px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: 'white',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 15px rgba(77, 161, 255, 0.3)'
                                    }}
                                >
                                    完成
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
};
