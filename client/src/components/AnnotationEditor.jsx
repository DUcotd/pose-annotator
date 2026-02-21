import React, { Suspense } from 'react';

const useLegacyEditor = import.meta?.env?.VITE_EDITOR_USE_LEGACY === '1';

const AnnotationEditorModern = React.lazy(() =>
    import('./AnnotationEditorModern').then((m) => ({ default: m.AnnotationEditor }))
);

const AnnotationEditorLegacy = React.lazy(() =>
    import('./AnnotationEditorLegacy').then((m) => ({ default: m.AnnotationEditor }))
);

export function AnnotationEditor(props) {
    const EditorImpl = useLegacyEditor ? AnnotationEditorLegacy : AnnotationEditorModern;
    return (
        <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>加载编辑器...</div>}>
            <EditorImpl {...props} />
        </Suspense>
    );
}
