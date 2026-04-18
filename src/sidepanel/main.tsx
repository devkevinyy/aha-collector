import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { Settings, FileEdit, Eye, Globe, ExternalLink, Loader2, CheckCircle, Video } from 'lucide-react';
import { addBitableRecord, type FeishuConfig } from '../api/feishu';
import '../styles/globals.css';

const SidePanel = () => {
    const [content, setContent] = useState('');
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');
    const [pageInfo, setPageInfo] = useState<{ title: string; url: string }>({ title: '', url: '' });
    const [config, setConfig] = useState<FeishuConfig | null>(null);
    const [selectedTableIndex, setSelectedTableIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [isPlaying, setIsPlaying] = useState(true);
    const [lastClickTime, setLastClickTime] = useState<number>(0);

    const updatePageInfo = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                const title = tabs[0].title || '';
                const url = tabs[0].url || '';
                setPageInfo({ title, url });
                setContent(prev => prev ? prev : `## Notes from: ${title}\n\n`);
            }
        });
    };

    useEffect(() => {
        updatePageInfo();

        const tabListener = (_tabId: number, changeInfo: any, tab: chrome.tabs.Tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                updatePageInfo();
            }
        };

        const activeListener = (_activeInfo: any) => {
            updatePageInfo();
        };

        chrome.tabs.onUpdated.addListener(tabListener);
        chrome.tabs.onActivated.addListener(activeListener);

        // Load config
        chrome.storage.local.get(['feishuConfig'], (result) => {
            if (result.feishuConfig) {
                const stored = result.feishuConfig as any;
                // Migrate old config format to new format if needed
                if ('appToken' in stored && 'tableId' in stored) {
                    const migrated: FeishuConfig = {
                        appId: stored.appId,
                        appSecret: stored.appSecret,
                        tables: [{ appToken: stored.appToken, tableId: stored.tableId, name: 'Table 1' }],
                    };
                    setConfig(migrated);
                } else {
                    setConfig(stored as FeishuConfig);
                }
            }
        });

        // Listen for messages from background (context menu)
        const messageListener = (message: any) => {
            if (message.type === 'SET_SELECTION') {
                let newContent = `\n> ${message.text}\n`;

                // Add links if present
                if (message.links && message.links.length > 0) {
                    newContent += `\n**Links:**\n`;
                    message.links.forEach((link: string) => {
                        newContent += `- ${link}\n`;
                    });
                    newContent += '\n';
                }

                setContent(prev => prev + newContent);
                setMode('edit');
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            chrome.tabs.onUpdated.removeListener(tabListener);
            chrome.tabs.onActivated.removeListener(activeListener);
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    const captureTimestamp = async () => {
        const now = Date.now();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const video = document.querySelector('video');
                    if (video) {
                        if (video.paused) {
                            video.play();
                            return { action: 'play' };
                        } else {
                            const currentTime = video.currentTime;
                            video.pause();
                            const time = Math.floor(currentTime);
                            const minutes = Math.floor(time / 60);
                            const seconds = time % 60;
                            const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                            return { action: 'pause', timestamp, rawTime: currentTime };
                        }
                    }
                    return null;
                }
            });

            const result = results[0]?.result as any;
            if (result) {
                if (result.action === 'pause' && result.timestamp) {
                    setIsPlaying(false);
                    let subtitleText = '';

                    // Fetch subtitles if on supported platforms
                    const isYT = pageInfo.url.includes('youtube.com/watch');
                    const isBili = pageInfo.url.includes('bilibili.com/video');

                    if (isYT || isBili) {
                        try {
                            const subResults = await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                world: 'MAIN',
                                func: async (time: number, url: string) => {
                                    try {
                                        if (url.includes('youtube.com')) {
                                            // 1. 尝试自动打开字幕
                                            const subButton = document.querySelector('.ytp-subtitles-button') as HTMLElement;
                                            if (subButton && subButton.getAttribute('aria-pressed') === 'false') {
                                                subButton.click();
                                            }

                                            // 2. 预先抓取 DOM 字幕保底
                                            const domText = Array.from(document.querySelectorAll('.ytp-caption-segment'))
                                                .map(el => el.textContent?.trim())
                                                .filter(Boolean)
                                                .join(' ');

                                            try {
                                                // @ts-ignore
                                                let pr = document.getElementById('movie_player')?.getPlayerResponse?.();
                                                if (!pr) {
                                                    // @ts-ignore
                                                    pr = window.ytInitialPlayerResponse;
                                                }

                                                const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                                                if (!tracks || tracks.length === 0) return domText;

                                                const track = tracks.find((t: any) => t.languageCode === 'zh-Hans') ||
                                                    tracks.find((t: any) => t.languageCode === 'zh-Hant') ||
                                                    tracks.find((t: any) => t.languageCode === 'en') ||
                                                    tracks[0];

                                                const res = await fetch(track.baseUrl + "&fmt=json3");
                                                const data = await res.json();
                                                const allEvents = data.events || [];

                                                const segments = allEvents
                                                    .filter((e: any) => e.segs)
                                                    .map((e: any) => ({
                                                        text: e.segs.map((s: any) => s.utf8).join(''),
                                                        start: e.tStartMs / 1000,
                                                        end: (e.tStartMs + (e.dDurationMs || 0)) / 1000
                                                    }));

                                                if (segments.length === 0) return domText;

                                                let currentIndex = segments.findIndex((s: any) => s.start <= time && s.end >= time);
                                                if (currentIndex === -1) {
                                                    currentIndex = segments.reduce((prev: number, curr: any, idx: number) => {
                                                        return Math.abs(curr.start - time) < Math.abs(segments[prev].start - time) ? idx : prev;
                                                    }, 0);
                                                }

                                                const sentenceEndRegex = /[.!?。！？]\s*$/;
                                                let startIdx = currentIndex;
                                                let endIdx = currentIndex;

                                                for (let i = currentIndex; i > 0; i--) {
                                                    if (i < currentIndex && sentenceEndRegex.test(segments[i - 1].text)) break;
                                                    startIdx = i;
                                                    if (currentIndex - startIdx > 12) break;
                                                }

                                                for (let i = currentIndex; i < segments.length; i++) {
                                                    endIdx = i;
                                                    if (sentenceEndRegex.test(segments[i].text)) break;
                                                    if (endIdx - currentIndex > 8) break;
                                                }

                                                const apiText = segments.slice(startIdx, endIdx + 1).map((s: any) => s.text).join(' ').replace(/\s+/g, ' ').trim();
                                                return apiText || domText;
                                            } catch (e) {
                                                return domText;
                                            }
                                        }

                                        if (url.includes('bilibili.com')) {
                                            const domText = Array.from(document.querySelectorAll('.bpx-player-subtitle-item-text'))
                                                .map(el => el.textContent?.trim())
                                                .filter(Boolean)
                                                .join(' ');

                                            try {
                                                // @ts-ignore
                                                const state = window.__INITIAL_STATE__;
                                                const subtitleList = state?.videoData?.subtitle?.list;
                                                if (!subtitleList || subtitleList.length === 0) return domText;

                                                const sub = subtitleList.find((s: any) => s.lan === 'zh-Hans') ||
                                                    subtitleList.find((s: any) => s.lan === 'zh-Hant') ||
                                                    subtitleList[0];

                                                const subUrl = sub.subtitle_url.startsWith('//') ? 'https:' + sub.subtitle_url : sub.subtitle_url;
                                                const res = await fetch(subUrl);
                                                const data = await res.json();
                                                const body = data.body || [];

                                                if (body.length === 0) return domText;

                                                let currentIndex = body.findIndex((item: any) => item.from <= time && item.to >= time);
                                                if (currentIndex === -1) {
                                                    currentIndex = body.reduce((prev: number, curr: any, idx: number) => {
                                                        return Math.abs(curr.from - time) < Math.abs(body[prev].from - time) ? idx : prev;
                                                    }, 0);
                                                }

                                                const sentenceEndRegex = /[.!?。！？]\s*$/;
                                                let startIdx = currentIndex;
                                                let endIdx = currentIndex;

                                                for (let i = currentIndex; i > 0; i--) {
                                                    if (i < currentIndex && sentenceEndRegex.test(body[i - 1].content)) break;
                                                    startIdx = i;
                                                    if (currentIndex - startIdx > 12) break;
                                                }

                                                for (let i = currentIndex; i < body.length; i++) {
                                                    endIdx = i;
                                                    if (sentenceEndRegex.test(body[i].content)) break;
                                                    if (endIdx - currentIndex > 8) break;
                                                }

                                                const apiText = body.slice(startIdx, endIdx + 1).map((item: any) => item.content).join(' ').trim();
                                                return apiText || domText;
                                            } catch (e) {
                                                return domText;
                                            }
                                        }
                                        return '';
                                    } catch (e) { return ''; }
                                },
                                args: [result.rawTime, pageInfo.url]
                            });
                            subtitleText = subResults[0]?.result as string || '';
                        } catch (e) {
                            console.error('Failed to fetch subtitles:', e);
                        }
                    }

                    const timeSeconds = Math.floor(result.rawTime);
                    const timestampLabel = `- [Timestamp ${result.timestamp}](${pageInfo.url}${pageInfo.url.includes('?') ? '&' : '?'}t=${timeSeconds}s)`;
                    const quotedSubtitle = subtitleText
                        ? subtitleText.split('\n').map(line => `> ${line}`).join('\n')
                        : '';

                    const newContent = quotedSubtitle
                        ? `${timestampLabel}\n${quotedSubtitle}\n\n`
                        : `${timestampLabel}\n\n`;

                    const isWithinOneMinute = lastClickTime > 0 && (now - lastClickTime < 60000);

                    setContent(prev => {
                        if (isWithinOneMinute && prev.trim()) {
                            if (subtitleText) {
                                const extraQuoted = subtitleText.split('\n').map(line => `> ${line}`).join('\n');
                                return prev.trimEnd() + '\n' + extraQuoted + '\n\n';
                            }
                            return prev;
                        } else {
                            const separator = prev && !prev.endsWith('\n\n') ? (prev.endsWith('\n') ? '\n' : '\n\n') : '';
                            return prev + separator + newContent;
                        }
                    });
                    setLastClickTime(now);
                } else if (result.action === 'play') {
                    setIsPlaying(true);
                }
            } else {
                setStatus({ type: 'error', message: 'No video found on this page.' });
                setTimeout(() => setStatus(null), 3000);
            }
        } catch (err) {
            console.error('Failed to capture timestamp:', err);
        }
    };

    const handleSave = async () => {
        if (!config || !config.appId || !config.appSecret || !config.tables || config.tables.length === 0) {
            setStatus({ type: 'error', message: 'Please configure Feishu settings first.' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }

        const selectedTable = config.tables[selectedTableIndex];
        if (!selectedTable || !selectedTable.appToken || !selectedTable.tableId) {
            setStatus({ type: 'error', message: 'Please select a valid table to save to.' });
            setTimeout(() => setStatus(null), 3000);
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const fields = {
                'Title': pageInfo.title,
                'URL': pageInfo.url,
                'Content': content,
                'Date': new Date().toISOString().split('T')[0],
            };

            await addBitableRecord(config, selectedTable, fields);
            setStatus({ type: 'success', message: `Successfully saved to "${selectedTable.name}"!` });
            setContent('');
            setTimeout(() => setStatus(null), 3000);
        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.message || 'Failed to save record.' });
            setTimeout(() => setStatus(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    const isSupportedVideo = pageInfo.url.includes('youtube.com/watch') || pageInfo.url.includes('bilibili.com/video');

    return (
        <div className="container" style={{ padding: '20px', backgroundColor: 'var(--claude-bg)' }}>
            <div className="header" style={{ marginBottom: '16px' }}>
                <h2 className="title" style={{ fontSize: '22px' }}>Aha Collector</h2>
                <button
                    onClick={openOptions}
                    className="glass"
                    style={{
                        padding: '8px',
                        borderRadius: '10px',
                        color: 'var(--claude-text-muted)',
                        backgroundColor: 'transparent'
                    }}
                    title="Settings"
                >
                    <Settings size={20} />
                </button>
            </div>

            <div className="glass" style={{
                padding: '12px',
                borderRadius: '12px',
                fontSize: '13px',
                color: 'var(--claude-text-muted)',
                backgroundColor: 'var(--claude-sidebar)',
                border: '1px solid var(--claude-border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Globe size={14} />
                    <span style={{ fontWeight: 500, color: 'var(--claude-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageInfo.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ExternalLink size={14} />
                    <span style={{ fontSize: '11px', color: 'var(--claude-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageInfo.url}</span>
                </div>
            </div>

            {config && config.tables && config.tables.length > 1 && (
                <div className="glass" style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--claude-sidebar)',
                    border: '1px solid var(--claude-border)'
                }}>
                    <label style={{ fontSize: '11px', color: 'var(--claude-text-muted)', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                        Save to table:
                    </label>
                    <select
                        value={selectedTableIndex}
                        onChange={(e) => setSelectedTableIndex(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '13px',
                            borderRadius: '8px',
                            border: '1px solid var(--claude-border)',
                            backgroundColor: 'white',
                            color: 'var(--claude-text)',
                            cursor: 'pointer',
                        }}
                    >
                        {config.tables.map((table, index) => (
                            <option key={index} value={index}>
                                {table.name || `Table ${index + 1}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                {isSupportedVideo && (
                    <button
                        onClick={captureTimestamp}
                        className="glass"
                        style={{
                            flex: 1,
                            padding: '10px',
                            fontSize: '13px',
                            color: 'var(--claude-text)',
                            backgroundColor: 'var(--claude-card)'
                        }}
                    >
                        <Video size={16} color="var(--claude-primary)" /> {isPlaying ? 'Aha' : 'Resume'}
                    </button>
                )}
            </div>

            <div style={{
                display: 'flex',
                backgroundColor: 'var(--claude-sidebar)',
                padding: '4px',
                borderRadius: '10px',
                marginTop: '16px'
            }}>
                <button
                    onClick={() => setMode('edit')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        backgroundColor: mode === 'edit' ? 'var(--claude-card)' : 'transparent',
                        color: mode === 'edit' ? 'var(--claude-text)' : 'var(--claude-text-muted)',
                        boxShadow: mode === 'edit' ? 'var(--shadow-sm)' : 'none'
                    }}
                >
                    <FileEdit size={16} /> Edit
                </button>
                <button
                    onClick={() => setMode('preview')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        backgroundColor: mode === 'preview' ? 'var(--claude-card)' : 'transparent',
                        color: mode === 'preview' ? 'var(--claude-text)' : 'var(--claude-text-muted)',
                        boxShadow: mode === 'preview' ? 'var(--shadow-sm)' : 'none'
                    }}
                >
                    <Eye size={16} /> Preview
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: '16px' }}>
                {mode === 'edit' ? (
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Type your markdown notes here..."
                        style={{
                            flex: 1,
                            resize: 'none',
                            padding: '16px',
                            backgroundColor: 'white',
                            lineHeight: '1.6',
                            fontSize: '14px',
                            border: '1px solid var(--claude-border)'
                        }}
                    />
                ) : (
                    <div className="markdown-body" style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px',
                        borderRadius: '12px',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        backgroundColor: 'white',
                        border: '1px solid var(--claude-border)',
                        color: 'var(--claude-text)'
                    }}>
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {status && (
                    <div style={{
                        padding: '12px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        textAlign: 'center',
                        backgroundColor: status.type === 'success' ? 'rgba(45, 93, 52, 0.08)' : 'rgba(177, 57, 43, 0.08)',
                        border: `1px solid ${status.type === 'success' ? 'var(--claude-success)' : 'var(--claude-error)'}`,
                        color: status.type === 'success' ? 'var(--claude-success)' : 'var(--claude-error)',
                        fontWeight: 500
                    }}>
                        {status.message}
                    </div>
                )}

                <button
                    className="premium-button"
                    onClick={handleSave}
                    disabled={loading || !content}
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        fontSize: '15px',
                        backgroundColor: 'var(--claude-secondary)',
                        color: 'white',
                        boxShadow: 'var(--shadow-md)'
                    }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                    {loading ? 'Saving to Feishu...' : 'Save'}
                </button>
            </div>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                textarea::placeholder {
                    color: #a19f99;
                }
                .markdown-body h1, .markdown-body h2, .markdown-body h3 {
                    margin-top: 24px;
                    margin-bottom: 12px;
                    color: var(--claude-text);
                    font-weight: 600;
                }
                .markdown-body p {
                    margin-bottom: 16px;
                }
                .markdown-body blockquote {
                    border-left: 3px solid var(--claude-primary);
                    padding-left: 16px;
                    color: var(--claude-text-muted);
                    font-style: italic;
                    margin: 20px 0;
                    background: var(--claude-bg);
                    padding-top: 8px;
                    padding-bottom: 8px;
                    border-radius: 0 8px 8px 0;
                }
                .markdown-body ul, .markdown-body ol {
                    padding-left: 20px;
                    margin: 16px 0;
                }
                .markdown-body li {
                    margin-bottom: 8px;
                }
                .markdown-body a {
                    color: var(--claude-primary);
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: border-color 0.2s;
                }
                .markdown-body a:hover {
                    border-bottom: 1px solid var(--claude-primary);
                }
            `}</style>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<SidePanel />);
