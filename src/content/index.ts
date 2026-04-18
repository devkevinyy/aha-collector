
const hideSidebar = () => {
    // Hide the right sidebar
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebar) {
        (sidebar as HTMLElement).style.display = 'none';
    }

    // Expand the main content area to use full width
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (primaryColumn) {
        (primaryColumn as HTMLElement).style.maxWidth = '100%';
        (primaryColumn as HTMLElement).style.width = '100%';
    }

    // Adjust the main container to center the content
    const mainContainer = document.querySelector('main[role="main"]');
    if (mainContainer) {
        const innerDiv = mainContainer.querySelector('div[style*="max-width"]');
        if (innerDiv) {
            (innerDiv as HTMLElement).style.maxWidth = '900px';
            (innerDiv as HTMLElement).style.margin = '0 auto';
        }
    }

    // Find and adjust the layout container
    const layoutContainer = document.querySelector('div[style*="display: flex"]');
    if (layoutContainer) {
        const parent = layoutContainer.parentElement;
        if (parent) {
            (parent as HTMLElement).style.justifyContent = 'center';
        }
    }
};

const injectSaveButtons = () => {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach(tweet => {
        if (tweet.querySelector('.aha-save-button')) return;

        const actionBar = tweet.querySelector('[role="group"]');
        if (!actionBar) return;

        const saveButton = document.createElement('div');
        saveButton.className = 'aha-save-button';
        saveButton.innerHTML = `
            <div role="button" tabindex="0" style="
                cursor: pointer;
                outline-style: none;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 12px;
                color: rgb(113, 118, 123);
                font-size: 13px;
                transition: background-color 0.2s;
            ">
                <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 18px; fill: currentColor; margin-right: 4px;">
                    <g><path d="M12 2C6.46 2 2 6.46 2 12s4.46 10 10 10 10-4.46 10-10S17.54 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"></path></g>
                </svg>
                <span>Save</span>
            </div>
        `;

        saveButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
            const userName = tweet.querySelector('[data-testid="User-Name"]')?.textContent || 'Someone';

            // Clean up user name (it often contains handle and separator)
            // Example: "Kevin · @kevin" -> "Kevin"
            const nameOnly = userName.split('·')[0].trim();

            // Remove empty lines and extra whitespace from tweet text
            const cleanedText = tweetText
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join(' ');

            // Extract links from the tweet
            const links: string[] = [];

            // Get all external http links (t.co links and others)
            const httpLinks = tweet.querySelectorAll('a[href^="http"]');
            httpLinks.forEach(anchor => {
                const href = (anchor as HTMLAnchorElement).href;
                // Skip x.com internal links
                if (href && !href.includes('x.com/') && !href.includes('twitter.com/')) {
                    if (!links.includes(href)) {
                        links.push(href);
                    }
                }
            });

            // Get the tweet's own URL (from the time/link element)
            const tweetLinks = tweet.querySelectorAll('a[href*="/status/"]');
            tweetLinks.forEach(link => {
                const href = (link as HTMLAnchorElement).href;
                // Only get the direct tweet status link (not analytics or other sub-paths)
                const cleanUrl = href.split('/analytics')[0].split('/likes')[0].split('/retweets')[0].split('?')[0];
                if (href.includes('/status/') && !links.includes(cleanUrl)) {
                    links.unshift(cleanUrl); // Add tweet URL first
                }
            });

            // Check if extension context is still valid
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({
                    type: 'SET_SELECTION',
                    text: `${nameOnly}: ${cleanedText}`,
                    links: links.length > 0 ? links : undefined
                });
            }

            // Visual feedback
            const span = saveButton.querySelector('span');
            if (span) {
                span.textContent = 'Saved!';
                setTimeout(() => {
                    span.textContent = 'Save';
                }, 2000);
            }
        });

        // Insert before the last action (share button usually)
        actionBar.appendChild(saveButton);
    });
};

// Run regularly as X uses a lot of dynamic loading
const init = () => {
    if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
        hideSidebar();

        // Initial run
        injectSaveButtons();

        // Observe changes
        const observer = new MutationObserver(() => {
            hideSidebar();
            injectSaveButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// ==================== Reddit functionality ====================

const injectRedditSaveButtons = () => {
    console.log('[Aha Collector] Looking for Reddit posts and comments...');

    // Debug: Log what we can find
    const customElements = Array.from(document.querySelectorAll('*'))
        .filter(el => el.tagName.toLowerCase().includes('shreddit') ||
                     el.tagName.toLowerCase().includes('reddit') ||
                     el.tagName.toLowerCase().includes('comment') ||
                     el.tagName.toLowerCase().includes('post'))
        .map(el => el.tagName.toLowerCase());
    const uniqueElements = [...new Set(customElements)];
    console.log('[Aha Collector] Found custom elements:', uniqueElements);

    // Try multiple selectors for posts
    const postSelectors = [
        'shreddit-post',
        '[data-testid="post"]',
        '[data-testid="post-container"]',
        'div[data-adclicklocation="media"]',
        'div[data-click-id="media"]',
        '.Post',
        '[id^="post"]',
        'article'
    ];

    let postsFound = 0;
    postSelectors.forEach(selector => {
        const posts = document.querySelectorAll(selector);
        console.log(`[Aha Collector] Selector "${selector}": found ${posts.length} posts`);

        posts.forEach((post, index) => {
            const postEl = post as HTMLElement;
            // Skip if already has our button
            if (postEl.querySelector('.aha-save-button')) return;

            // Skip if this doesn't look like a Reddit post (basic validation)
            if (!postEl.querySelector('[href*="/comments/"]') &&
                !postEl.querySelector('[href*="/r/"]') &&
                !postEl.textContent?.includes('comments')) {
                return;
            }

            console.log(`[Aha Collector] Processing post ${index} with selector: ${selector}`);

            // Find action buttons container - try multiple approaches
            let actionBar: Element | null = null;

            // Method 1: Look for button container
            actionBar = postEl.querySelector('[slot="post-action-bar"]') ||
                       postEl.querySelector('[data-testid="post-action-bar"]') ||
                       postEl.querySelector('faceplate-tracker[action-type="post"]');

            // Method 2: Look for the container that has vote/comment/share buttons
            if (!actionBar) {
                const buttons = Array.from(postEl.querySelectorAll('button, faceplate-button'));
                const buttonParent = buttons.find(b => {
                    const label = b.getAttribute('aria-label') || b.getAttribute('id') || '';
                    return label.includes('vote') || label.includes('upvote') || label.includes('downvote');
                })?.parentElement;
                if (buttonParent) {
                    actionBar = buttonParent.parentElement;
                }
            }

            // Method 3: Look for any container with multiple buttons
            if (!actionBar) {
                const allButtonContainers = Array.from(postEl.querySelectorAll('div'));
                for (const container of allButtonContainers) {
                    const buttonCount = container.querySelectorAll('button, faceplate-button').length;
                    if (buttonCount >= 3) { // Usually has vote, comment, share
                        actionBar = container;
                        break;
                    }
                }
            }

            if (!actionBar) {
                console.log(`[Aha Collector] Could not find action bar for post ${index}`);
                return;
            }

            console.log(`[Aha Collector] Found action bar for post ${index}`);

            const saveButton = document.createElement('button');
            saveButton.className = 'aha-save-button';
            saveButton.type = 'button';
            saveButton.setAttribute('aria-label', 'Save to Aha Collector');
            saveButton.style.cssText = `
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 6px 14px;
                color: #0047AB;
                font-size: 13px;
                font-weight: 600;
                border-radius: 999px;
                transition: all 0.15s ease;
                background: rgba(0, 71, 171, 0.1);
                border: 1px solid rgba(0, 71, 171, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-sizing: border-box;
                white-space: nowrap;
            `;
            saveButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; flex-shrink: 0;">
                    <path d="M12 2C6.46 2 2 6.46 2 12s4.46 10 10 10 10-4.46 10-10S17.54 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
                <span style="line-height: 1;">Save</span>
            `;

            // Add hover effect
            saveButton.addEventListener('mouseenter', () => {
                saveButton.style.background = 'rgba(0, 71, 171, 0.15)';
                saveButton.style.borderColor = 'rgba(0, 71, 171, 0.5)';
            });
            saveButton.addEventListener('mouseleave', () => {
                saveButton.style.background = 'rgba(0, 71, 171, 0.1)';
                saveButton.style.borderColor = 'rgba(0, 71, 171, 0.3)';
            });

            saveButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('[Aha Collector] Save button clicked!');

                // Extract post title - try multiple selectors
                const titleSelectors = [
                    'h1[slot="title"]',
                    '[slot="title"]',
                    'a[data-click-id="body"]',
                    'h3',
                    '[data-testid="post-content"] h3',
                    'div[data-adclicklocation="title"] a',
                    'a[href*="/comments/"]'
                ];

                let title = '';
                for (const ts of titleSelectors) {
                    const el = postEl.querySelector(ts);
                    if (el?.textContent) {
                        title = el.textContent.trim();
                        break;
                    }
                }

                // Extract post content/body
                const bodySelectors = [
                    'div[slot="post-body"]',
                    '[data-testid="post-content"]',
                    'div[data-click-id="text"]',
                    'div[data-adclicklocation="body"]'
                ];

                let bodyContent = '';
                for (const bs of bodySelectors) {
                    const el = postEl.querySelector(bs);
                    if (el?.textContent) {
                        // Remove extra whitespace and empty lines
                        bodyContent = el.textContent
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0)
                            .join(' ');
                        break;
                    }
                }

                // Get post URL
                const postLink = postEl.querySelector('a[href*="/comments/"]') as HTMLAnchorElement;
                const postUrl = postLink?.href || window.location.href;

                // Get subreddit from URL or page
                const subredditMatch = window.location.pathname.match(/\/r\/([^\/]+)/);
                const subreddit = subredditMatch?.[1] || postEl.querySelector('a[href^="/r/"]')?.textContent?.replace('r/', '') || '';

                // Get author
                const authorSelectors = [
                    'a[data-click-id="author"]',
                    '[data-testid="post-author-link"]',
                    'a[href*="/user/"]',
                    'a[href*="/u/"]'
                ];
                let author = 'Unknown';
                for (const as of authorSelectors) {
                    const el = postEl.querySelector(as);
                    if (el?.textContent) {
                        author = el.textContent.trim().replace('u/', '');
                        break;
                    }
                }

                // Build the content
                let content = `### ${title || 'Reddit Post'}\n\n`;
                if (subreddit) {
                    content += `**r/${subreddit}** • Posted by u/${author}\n\n`;
                }
                if (bodyContent) {
                    content += `${bodyContent}\n\n`;
                }
                content += `**Source:** ${postUrl}\n`;

                console.log('[Aha Collector] Sending content:', content);

                // Send to sidepanel
                if (chrome.runtime?.id) {
                    chrome.runtime.sendMessage({
                        type: 'SET_SELECTION',
                        text: content,
                        links: [postUrl]
                    });
                    if (chrome.runtime.lastError) {
                        console.error('[Aha Collector] Error sending message:', chrome.runtime.lastError);
                    }
                }

                // Visual feedback
                saveButton.style.color = '#fff';
                saveButton.style.background = '#10b981';
                saveButton.style.borderColor = '#10b981';
                saveButton.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; flex-shrink: 0;">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span style="line-height: 1;">Saved!</span>
                `;
                setTimeout(() => {
                    saveButton.style.color = '#0047AB';
                    saveButton.style.background = 'rgba(0, 71, 171, 0.1)';
                    saveButton.style.borderColor = 'rgba(0, 71, 171, 0.3)';
                    saveButton.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; flex-shrink: 0;">
                            <path d="M12 2C6.46 2 2 6.46 2 12s4.46 10 10 10 10-4.46 10-10S17.54 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                        </svg>
                        <span style="line-height: 1;">Save</span>
                    `;
                }, 2000);
            });

            // Insert the button
            actionBar.appendChild(saveButton);
            postsFound++;
        });
    });

    // Try multiple selectors for comments
    const commentSelectors = [
        'shreddit-comment',
        '[data-testid="comment"]',
        '[data-testid="comment-container"]',
        '.Comment',
        'div[id^="comment"]',
        'div[data-testid*="comment"]'
    ];

    let commentsFound = 0;
    commentSelectors.forEach(selector => {
        const comments = document.querySelectorAll(selector);
        console.log(`[Aha Collector] Selector "${selector}": found ${comments.length} comments`);

        comments.forEach((comment, index) => {
            const commentEl = comment as HTMLElement;
            // Skip if already has our button
            if (commentEl.querySelector('.aha-save-button')) return;

            // Skip if this doesn't look like a Reddit comment
            if (!commentEl.textContent?.includes('points') &&
                !commentEl.textContent?.includes('ago') &&
                !commentEl.querySelector('[href*="/comments/"]')) {
                return;
            }

            console.log(`[Aha Collector] Processing comment ${index} with selector: ${selector}`);

            // Find action buttons container
            let actionBar: Element | null = null;

            // Method 1: Look for comment action bar slot
            actionBar = commentEl.querySelector('[slot="comment-action-bar"]') ||
                       commentEl.querySelector('[data-testid="comment-action-bar"]') ||
                       commentEl.querySelector('faceplate-tracker[action-type="comment"]');

            // Method 2: Look for vote button parent
            if (!actionBar) {
                const voteButton = Array.from(commentEl.querySelectorAll('button, faceplate-button'))
                    .find(b => {
                        const label = b.getAttribute('aria-label') || b.getAttribute('id') || '';
                        return label.includes('vote') || label.includes('upvote') || label.includes('downvote');
                    });
                if (voteButton) {
                    actionBar = voteButton.parentElement?.parentElement || null;
                }
            }

            // Method 3: Look for container with multiple buttons
            if (!actionBar) {
                const allContainers = Array.from(commentEl.querySelectorAll('div'));
                for (const container of allContainers) {
                    const buttonCount = container.querySelectorAll('button, faceplate-button').length;
                    if (buttonCount >= 2) {
                        actionBar = container;
                        break;
                    }
                }
            }

            if (!actionBar) {
                console.log(`[Aha Collector] Could not find action bar for comment ${index}`);
                return;
            }

            const saveButton = document.createElement('button');
            saveButton.className = 'aha-save-button';
            saveButton.type = 'button';
            saveButton.setAttribute('aria-label', 'Save to Aha Collector');
            saveButton.style.cssText = `
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                padding: 5px 12px;
                color: #0047AB;
                font-size: 12px;
                font-weight: 600;
                border-radius: 999px;
                transition: all 0.15s ease;
                background: rgba(0, 71, 171, 0.1);
                border: 1px solid rgba(0, 71, 171, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-sizing: border-box;
                white-space: nowrap;
            `;
            saveButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; flex-shrink: 0;">
                    <path d="M12 2C6.46 2 2 6.46 2 12s4.46 10 10 10 10-4.46 10-10S17.54 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
                <span style="line-height: 1;">Save</span>
            `;

            // Add hover effect
            saveButton.addEventListener('mouseenter', () => {
                saveButton.style.background = 'rgba(0, 71, 171, 0.15)';
                saveButton.style.borderColor = 'rgba(0, 71, 171, 0.5)';
            });
            saveButton.addEventListener('mouseleave', () => {
                saveButton.style.background = 'rgba(0, 71, 171, 0.1)';
                saveButton.style.borderColor = 'rgba(0, 71, 171, 0.3)';
            });

            saveButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('[Aha Collector] Comment save button clicked!');

                // Extract comment author
                const authorSelectors = [
                    'a[slot="author"]',
                    '[data-testid="comment-author-link"]',
                    'span[slot="author"]',
                    'a[href*="/user/"]',
                    'a[href*="/u/"]'
                ];
                let author = 'Unknown';
                for (const as of authorSelectors) {
                    const el = commentEl.querySelector(as);
                    if (el?.textContent) {
                        author = el.textContent.trim().replace('u/', '');
                        break;
                    }
                }

                // Extract comment content
                const bodySelectors = [
                    'div[slot="comment-body"]',
                    '[data-testid="comment-body-content"]',
                    'div[data-testid="comment"]',
                    '.md',
                    'div[class*="CommentBody"]',
                    'div[class*="comment-body"]'
                ];
                let bodyContent = '';
                for (const bs of bodySelectors) {
                    const el = commentEl.querySelector(bs);
                    if (el?.textContent) {
                        // Remove extra whitespace and empty lines
                        bodyContent = el.textContent
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0)
                            .join(' ');
                        break;
                    }
                }

                // Get comment URL (permalink)
                const permalink = commentEl.querySelector('a[href*="/comments/"]') as HTMLAnchorElement;
                const commentUrl = permalink?.href || window.location.href;

                // Build the content
                let content = `> u/${author} said:\n\n`;
                content += `${bodyContent}\n\n`;
                content += `**Source:** ${commentUrl}\n`;

                console.log('[Aha Collector] Sending comment content:', content);

                // Send to sidepanel
                if (chrome.runtime?.id) {
                    chrome.runtime.sendMessage({
                        type: 'SET_SELECTION',
                        text: content,
                        links: [commentUrl]
                    });
                }

                // Visual feedback
                saveButton.style.color = '#fff';
                saveButton.style.background = '#10b981';
                saveButton.style.borderColor = '#10b981';
                saveButton.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; flex-shrink: 0;">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span style="line-height: 1;">Saved!</span>
                `;
                setTimeout(() => {
                    saveButton.style.color = '#0047AB';
                    saveButton.style.background = 'rgba(0, 71, 171, 0.1)';
                    saveButton.style.borderColor = 'rgba(0, 71, 171, 0.3)';
                    saveButton.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; flex-shrink: 0;">
                            <path d="M12 2C6.46 2 2 6.46 2 12s4.46 10 10 10 10-4.46 10-10S17.54 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                        </svg>
                        <span style="line-height: 1;">Save</span>
                    `;
                }, 2000);
            });

            // Insert the button
            actionBar.appendChild(saveButton);
            commentsFound++;
        });
    });

    console.log(`[Aha Collector] Injection complete: ${postsFound} posts, ${commentsFound} comments`);
};

const initReddit = () => {
    if (window.location.hostname.includes('reddit.com')) {
        console.log('[Aha Collector] Reddit detected, initializing...');

        // Wait a bit for Reddit to load
        setTimeout(() => {
            injectRedditSaveButtons();
        }, 1000);

        // Initial run
        injectRedditSaveButtons();

        // Observe changes for dynamic content
        const observer = new MutationObserver(() => {
            injectRedditSaveButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// Check if we are on X/Twitter or Reddit
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initReddit();
    });
} else {
    init();
    initReddit();
}
