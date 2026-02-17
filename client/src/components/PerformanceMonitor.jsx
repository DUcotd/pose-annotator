import React, { useEffect, useState } from 'react';

export const PerformanceMonitor = () => {
    const [fps, setFps] = useState(60);
    const [memory, setMemory] = useState(null);

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId;

        const loop = () => {
            const now = performance.now();
            frameCount++;

            if (now - lastTime >= 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;

                if (performance.memory) {
                    setMemory({
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                    });
                }
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff00',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 9999,
            pointerEvents: 'none'
        }}>
            <div>FPS: {fps}</div>
            {memory && (
                <div>Memory: {memory.used}MB / {memory.limit}MB</div>
            )}
        </div>
    );
};
