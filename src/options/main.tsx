import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/globals.css';
import { Settings, Save, CheckCircle2, Plus, Trash2, Info } from 'lucide-react';
import type { BitableTableConfig } from '../api/feishu';

interface FeishuConfig {
    appId: string;
    appSecret: string;
    tables: BitableTableConfig[];
}

const Options = () => {
    const [config, setConfig] = useState<FeishuConfig>({
        appId: '',
        appSecret: '',
        tables: [{ appToken: '', tableId: '', name: 'Table 1' }],
    });
    const [status, setStatus] = useState('');

    useEffect(() => {
        chrome.storage.local.get(['feishuConfig'], (result) => {
            if (result.feishuConfig) {
                const stored = result.feishuConfig as FeishuConfig;
                // Migrate old config format to new format
                if ('appToken' in stored && 'tableId' in stored) {
                    setConfig({
                        appId: stored.appId,
                        appSecret: stored.appSecret,
                        tables: [{ appToken: (stored as any).appToken, tableId: (stored as any).tableId, name: 'Table 1' }],
                    });
                } else {
                    setConfig(stored);
                }
            }
        });
    }, []);

    const handleSave = () => {
        chrome.storage.local.set({ feishuConfig: config }, () => {
            setStatus('Settings saved successfully!');
            setTimeout(() => setStatus(''), 3000);
        });
    };

    const addTable = () => {
        const tableNum = config.tables.length + 1;
        setConfig({
            ...config,
            tables: [...config.tables, { appToken: '', tableId: '', name: `Table ${tableNum}` }],
        });
    };

    const removeTable = (index: number) => {
        if (config.tables.length <= 1) {
            setStatus('Cannot remove the last table.');
            setTimeout(() => setStatus(''), 2000);
            return;
        }
        setConfig({
            ...config,
            tables: config.tables.filter((_, i) => i !== index),
        });
    };

    const updateTable = (index: number, field: keyof BitableTableConfig, value: string) => {
        const newTables = [...config.tables];
        newTables[index] = { ...newTables[index], [field]: value };
        setConfig({ ...config, tables: newTables });
    };

    return (
        <div className="container" style={{ maxWidth: '640px', margin: '0px auto', height: 'auto', gap: '24px' }}>
            <div className="header" style={{
                padding: '32px 24px',
                borderRadius: '20px',
                backgroundColor: 'var(--claude-card)',
                boxShadow: 'var(--shadow-md)',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Settings size={28} color="var(--claude-primary)" />
                    <h1 className="title" style={{ fontSize: '28px' }}>Aha Collector</h1>
                </div>
                <p style={{ color: 'var(--claude-text-muted)', fontSize: '14px' }}>Configure your Feishu table credentials to start collecting notes.</p>
            </div>

            <div className="glass" style={{
                padding: '32px',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                backgroundColor: 'white'
            }}>
                <div className="input-group">
                    <label className="label">App ID</label>
                    <input
                        type="text"
                        value={config.appId}
                        onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                        placeholder="cli_..."
                        style={{ padding: '14px' }}
                    />
                </div>

                <div className="input-group">
                    <label className="label">App Secret</label>
                    <input
                        type="password"
                        value={config.appSecret}
                        onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                        placeholder="Enter App Secret"
                        style={{ padding: '14px' }}
                    />
                </div>

                <div className="line" style={{ height: '1px', backgroundColor: 'var(--claude-border)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--claude-text)' }}>
                        Bitable Tables
                    </h3>
                    <button
                        onClick={addTable}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            fontSize: '13px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--claude-secondary)',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> Add Table
                    </button>
                </div>

                {config.tables.map((table, index) => (
                    <div key={index} style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--claude-border)',
                        backgroundColor: 'var(--claude-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={table.name}
                                onChange={(e) => updateTable(index, 'name', e.target.value)}
                                placeholder="Table name"
                                style={{
                                    padding: '8px 12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    border: '1px solid var(--claude-border)',
                                    borderRadius: '8px',
                                    width: '200px',
                                }}
                            />
                            {config.tables.length > 1 && (
                                <button
                                    onClick={() => removeTable(index)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        borderRadius: '6px',
                                        backgroundColor: 'transparent',
                                        color: 'var(--claude-error)',
                                        border: '1px solid var(--claude-error)',
                                        cursor: 'pointer',
                                    }}
                                    title="Remove table"
                                >
                                    <Trash2 size={14} /> Remove
                                </button>
                            )}
                        </div>

                        <div className="input-group">
                            <label className="label">App Token</label>
                            <input
                                type="text"
                                value={table.appToken}
                                onChange={(e) => updateTable(index, 'appToken', e.target.value)}
                                placeholder="bas..."
                                style={{ padding: '12px' }}
                            />
                        </div>

                        <div className="input-group">
                            <label className="label">Table ID</label>
                            <input
                                type="text"
                                value={table.tableId}
                                onChange={(e) => updateTable(index, 'tableId', e.target.value)}
                                placeholder="tbl..."
                                style={{ padding: '12px' }}
                            />
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: '8px' }}>
                    <button
                        className="premium-button"
                        onClick={handleSave}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '16px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--claude-secondary)',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        <Save size={20} />
                        Save Configurations
                    </button>
                </div>

                {status && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--claude-success)',
                        fontSize: '15px',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(45, 93, 52, 0.08)',
                        padding: '12px',
                        borderRadius: '10px'
                    }}>
                        <CheckCircle2 size={18} />
                        {status}
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--claude-text-muted)',
                    fontSize: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                    padding: '12px',
                    borderRadius: '10px',
                    marginTop: '8px'
                }}>
                    <Info size={16} />
                    <span>All configuration data is stored locally. We do not upload your credentials.</span>
                </div>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Options />);
