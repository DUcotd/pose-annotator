
import React, { useState, useEffect, useRef } from 'react';
import { Check, Tag } from 'lucide-react';

export const ClassInputModal = ({ isOpen, onClose, onSubmit, initialValue }) => {
    const [value, setValue] = useState(initialValue || 0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue || 0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(parseInt(value) || 0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay modal-overlay-high">
            <div className="animate-fade-in modal-panel modal-panel-sm">
                <div className="modal-header">
                    <div className="modal-icon modal-icon-accent">
                        <Tag size={20} color="var(--accent-primary)" />
                    </div>
                    <h3>输入类别 ID</h3>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div>
                        <label className="form-label">Class Index (整数)</label>
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="input input-mono"
                        />
                    </div>

                    <div className="modal-footer" style={{ marginTop: 0 }}>
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            取消
                        </button>
                        <button type="submit" className="btn-primary">
                            <Check size={18} /> 确认
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
