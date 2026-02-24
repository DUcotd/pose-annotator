import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clipboard, X } from 'lucide-react';
import { ApiError, apiClient } from '../lib/apiClient';

const ErrorCenterContext = createContext(null);

function normalizeError(error, context = {}) {
  const now = new Date().toISOString();
  if (error instanceof ApiError) {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: now,
      message: error.message,
      code: error.code || 'API_ERROR',
      hint: error.hint || '',
      status: error.status || 500,
      requestId: error.requestId || null,
      where: error.where || null,
      details: error.details || null,
      retryable: error.retryable === true,
      context
    };
  }

  if (error instanceof Error) {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: now,
      message: error.message || '发生未知错误',
      code: 'UNEXPECTED_ERROR',
      hint: '',
      status: 500,
      requestId: null,
      where: null,
      details: { name: error.name, stack: error.stack },
      retryable: false,
      context
    };
  }

  if (typeof error === 'string') {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: now,
      message: error,
      code: 'UNEXPECTED_ERROR',
      hint: '',
      status: 500,
      requestId: null,
      where: null,
      details: null,
      retryable: false,
      context
    };
  }

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    time: now,
    message: '发生未知错误',
    code: 'UNEXPECTED_ERROR',
    hint: '',
    status: 500,
    requestId: null,
    where: null,
    details: error || null,
    retryable: false,
    context
  };
}

function ErrorToast({ error, onClose, onOpenDetail }) {
  if (!error) return null;
  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      zIndex: 99999,
      width: 420,
      maxWidth: 'calc(100vw - 32px)',
      background: '#7f1d1d',
      border: '1px solid #ef4444',
      borderRadius: 14,
      boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
      color: '#fee2e2',
      padding: '14px 14px 12px 14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertTriangle size={18} />
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{error.message}</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#fee2e2', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.92 }}>
        错误码: <b>{error.code}</b>
        {error.requestId ? <> · Request ID: <b>{error.requestId}</b></> : null}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button
          onClick={onOpenDetail}
          style={{
            background: '#111827',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          查看详情
        </button>
      </div>
    </div>
  );
}

function ErrorDrawer({ error, onClose }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  if (!error) return null;
  const payload = JSON.stringify(error, null, 2);

  const exportDiagnostics = async () => {
    setExportError('');
    setExporting(true);
    try {
      const response = await apiClient.requestRaw('/api/system/diagnostics/export', {
        method: 'POST'
      });
      const blob = await response.blob();
      const cd = response.headers.get('content-disposition') || '';
      const match = cd.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || `pose-annotator-diagnostics-${Date.now()}.zip`;
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setExportError(err?.message || '导出诊断包失败');
      console.error('Failed to export diagnostics package:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2,6,23,0.65)',
      zIndex: 100000,
      display: 'flex',
      justifyContent: 'flex-end'
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '100vw',
          background: '#0b1220',
          borderLeft: '1px solid #334155',
          padding: 16,
          overflow: 'auto',
          color: '#e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>错误诊断详情</div>
          <button
            onClick={exportDiagnostics}
            disabled={exporting}
            style={{
              background: '#111827',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: exporting ? 'not-allowed' : 'pointer'
            }}
          >
            {exporting ? '导出中...' : '导出诊断包'}
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payload);
              } catch {}
            }}
            style={{
              background: '#111827',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center'
            }}
          >
            <Clipboard size={14} />
            复制诊断 JSON
          </button>
        </div>
        {exportError ? <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>{exportError}</div> : null}
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div><b>消息:</b> {error.message}</div>
          <div><b>错误码:</b> {error.code}</div>
          <div><b>HTTP 状态:</b> {error.status}</div>
          <div><b>Request ID:</b> {error.requestId || '-'}</div>
          <div><b>接口路径:</b> {error.where?.path || '-'}</div>
          <div><b>方法:</b> {error.where?.method || '-'}</div>
          <div><b>可重试:</b> {error.retryable ? '是' : '否'}</div>
          <div><b>建议:</b> {error.hint || '无'}</div>
        </div>
        <pre style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          background: '#020617',
          border: '1px solid #1e293b',
          color: '#cbd5e1',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 12
        }}>{payload}</pre>
      </div>
    </div>
  );
}

export function ErrorCenterProvider({ children }) {
  const [lastError, setLastError] = useState(null);
  const [openDetail, setOpenDetail] = useState(false);

  const reportError = useCallback((error, context = {}) => {
    const normalized = normalizeError(error, context);
    setLastError(normalized);
    return normalized;
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
    setOpenDetail(false);
  }, []);

  useEffect(() => {
    const onError = (event) => {
      if (event?.error) reportError(event.error, { source: 'window.error' });
    };
    const onUnhandled = (event) => {
      if (event?.reason) reportError(event.reason, { source: 'window.unhandledrejection' });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [reportError]);

  const value = useMemo(() => ({
    reportError,
    lastError,
    clearError
  }), [reportError, lastError, clearError]);

  return (
    <ErrorCenterContext.Provider value={value}>
      {children}
      <ErrorToast
        error={lastError}
        onClose={clearError}
        onOpenDetail={() => setOpenDetail(true)}
      />
      <ErrorDrawer error={openDetail ? lastError : null} onClose={() => setOpenDetail(false)} />
    </ErrorCenterContext.Provider>
  );
}

export function useErrorCenter() {
  const ctx = useContext(ErrorCenterContext);
  if (!ctx) {
    throw new Error('useErrorCenter must be used inside ErrorCenterProvider');
  }
  return ctx;
}
