// Background script for Feishu Bitable Collector

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: Error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log('Aha Collector installed');
    chrome.contextMenus.create({
        id: 'sendToBitable',
        title: 'Send selection to Aha Collector',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'sendToBitable' && tab?.id) {
        // Open side panel first
        chrome.sidePanel.open({ tabId: tab.id });

        // Give it a moment to load and then send the selection
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'SET_SELECTION',
                text: info.selectionText
            });
        }, 500);
    }
});
