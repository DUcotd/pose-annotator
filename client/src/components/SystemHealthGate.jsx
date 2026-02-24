import React, { useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../lib/apiClient';
import { useErrorCenter } from '../error/ErrorCenter';

const frontendVersion = import.meta?.env?.VITE_APP_VERSION || 'unknown';

export default function SystemHealthGate({ children }) {
  const { reportError } = useErrorCenter();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [blockedError, setBlockedError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiClient.get('/api/system/health');
        if (!mounted) return;
        if (data?.responseEnvelope !== true) {
          const err = new ApiError({
            message: '后端协议不兼容：未启用统一响应封装',
            code: 'BACKEND_PROTOCOL_MISMATCH',
            status: 500,
            hint: '请确保前后端版本一致并重新安装最新版本。',
            details: data,
            where: { method: 'GET', path: '/api/system/health' }
          });
          reportError(err, { source: 'system-health.protocol' });
          setBlockedError(err);
          return;
        }
        if (data?.startupReady === false) {
          const err = new ApiError({
            message: data?.startupError || '后端启动未就绪',
            code: 'BACKEND_BOOT_FAILED',
            status: 500,
            hint: '请查看启动诊断信息并修复后重试。',
            details: data,
            where: { method: 'GET', path: '/api/system/health' }
          });
          reportError(err, { source: 'system-health.startup' });
          setBlockedError(err);
          return;
        }
        const requiredCapabilities = ['projects', 'annotation', 'settings'];
        const missingCapabilities = requiredCapabilities.filter((key) => data?.capabilities?.[key] !== true);
        if (missingCapabilities.length > 0) {
          const err = new ApiError({
            message: `后端能力缺失: ${missingCapabilities.join(', ')}`,
            code: 'BACKEND_CAPABILITY_MISSING',
            status: 500,
            hint: '请确认安装包完整，重新安装最新版并重启应用。',
            details: { missingCapabilities, health: data },
            where: { method: 'GET', path: '/api/system/health' }
          });
          reportError(err, { source: 'system-health.capabilities' });
          setBlockedError(err);
          return;
        }
        setHealth(data);
      } catch (err) {
        if (!mounted) return;
        reportError(err, { source: 'system-health' });
        setBlockedError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reportError]);

  const versionMismatch = useMemo(() => {
    if (!health?.backendVersion || !frontendVersion || frontendVersion === 'unknown') return false;
    return String(health.backendVersion) !== String(frontendVersion);
  }, [health]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#020617',
        color: '#cbd5e1'
      }}>
        <div>正在检查系统健康状态...</div>
      </div>
    );
  }

  if (blockedError) {
    const details = JSON.stringify({
      message: blockedError.message,
      code: blockedError.code,
      status: blockedError.status,
      hint: blockedError.hint,
      requestId: blockedError.requestId,
      where: blockedError.where,
      details: blockedError.details
    }, null, 2);

    return (
      <div style={{
        minHeight: '100vh',
        background: '#020617',
        color: '#e2e8f0',
        display: 'grid',
        placeItems: 'center',
        padding: 24
      }}>
        <div style={{
          width: 'min(860px, 100%)',
          border: '1px solid #334155',
          borderRadius: 14,
          background: '#0b1220',
          padding: 18
        }}>
          <h2 style={{ margin: 0, color: '#fda4af' }}>后端不可用，已阻断进入业务页面</h2>
          <p style={{ color: '#94a3b8', marginTop: 10 }}>
            这不是普通业务错误，而是系统级故障。请根据下方诊断信息排查后重试。
          </p>
          <pre style={{
            marginTop: 12,
            background: '#020617',
            border: '1px solid #1e293b',
            borderRadius: 10,
            padding: 12,
            color: '#cbd5e1',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>{details}</pre>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(details);
              } catch {}
            }}
            style={{
              marginTop: 10,
              border: '1px solid #475569',
              background: '#111827',
              color: '#e2e8f0',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            复制诊断信息
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {versionMismatch && (
        <div style={{
          position: 'fixed',
          top: 8,
          right: 8,
          zIndex: 9999,
          background: '#78350f',
          border: '1px solid #f59e0b',
          color: '#fef3c7',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 12,
          maxWidth: 420
        }}>
          版本不一致：前端 {frontendVersion}，后端 {health?.backendVersion}。建议升级到同一版本。
        </div>
      )}
      {children}
    </>
  );
}
