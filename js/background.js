(function () {

    let redirectURLs = {};

    // chrome message listner for various purposes
    let onMessageListner = (msg, sender, callback) => {
        switch (msg['action']) {

            // A simple HACK event askig for tab ID.
            case 'returnTabID':
                callback({ tabID: sender.tab.id });
                break;

            case 'writeLog':
                log(msg['param1'], msg['param2']);
                break;

            case 'sendTaskInProgressPing':
                sendTaskInProgressPing(msg['taskId']);
                break;

            case 'markTaskComplete':
                markTaskComplete(msg['automation'], callback, msg['adsInfo']);
                break;

            case 'setupFocusCheckerForDesktop':
                setupFocusCheckerForDesktop();
                break;

            case 'getVideoRank':
                getVideoRank(msg, callback);
                markTaskComplete(msg['automation'], callback, msg['adsInfo']);
                break;

            case 'saveVideoRank':
                saveVideoRank(msg, callback);
                break;

            case 'continueWhenTimeoutGone':
                continueWhenTimeoutGone(msg['timeout'], msg['tabId']);
                markTaskComplete(msg['automation'], callback, msg['adsInfo']);
                break;

            case 'getRedirectURLs':
                callback(redirectURLs[sender.tab.id] || []);
                break;

            case 'setVideoWatchedBadge':
                setVideoWatchedBadge();
                markTaskComplete(msg['automation'], callback, msg['adsInfo']);
                break;

            // received from googleAccAge/finder.js. pass it further to googleAccAge/supplier.js
            case 'firstMailDatesFound':
                log('firstMailDatesFound event received');

                // get tab ID where supplier.js is injected
                chrome.storage.local.get('googleAccSupplierTabID', response => {
                    if (typeof response['googleAccSupplierTabID'] != 'undefined') {

                        // set message asking to supply firstEmailDate further to hosting page
                        chrome.tabs.sendMessage(response['googleAccSupplierTabID'], { action: 'supplyFirstMailDate' });
                    } else {
                        log('googleAccSupplierTabID error', error);
                    }
                });
                break;
            case 'startAutoWatching':
                startAutoWatching();
                markTaskComplete(msg['automation'], callback, msg['adsInfo']);
                break;
            case 'createNotification':
                createNotification(msg['text']);
                break;

            case 'executeFromBackground':
                window[msg['functionName']].apply(null, msg['args']).then((result) => {
                    callback(result);
                });
                break;
        }

        return true;
    };

    let getYoutubeTabs = async () => {
        return await new Promise(resolve => {
            chrome.tabs.query({
                url: [
                    "*://www.youtube.com/*",
                    "*://youtube.com/*"
                ]
            }, function (tabs) {
                resolve(tabs);
            });
        })
    };

    let getVideoRank = async (data, callback) => {
        let rank = await videoRanksModel.get(data['videoId'], data['country'], data['keywordHash']).catch(exception => {
            log('exception in getting video rank', exception);
            callback(false);
        });
        callback(rank ? rank : false);
    };

    let startAutoWatching = async (tabId = null) => {
        if(await isAutomaticModeEnabled()){
            tabId = tabId || (await store.get('autoWatchingTabId')).autoWatchingTabId;
            const ytTabs = await getYoutubeTabs();
            if (ytTabs.length === 0) {
                tabId = await new Promise((resolve) => {
                    chrome.tabs.create({active: true}, async (tab) => {
                        await store.set('autoWatchingTabId', tab.id);
                        resolve(tab.id);
                    });
                });
            }
            else if (ytTabs.length === 1) {
                tabId = ytTabs[0].id;
                await store.set('autoWatchingTabId', tabId);
            }
            else {
                createNotification(getLocaleMsg('multipleYTTabsNotificationMessage'));
                return;
            }
            chrome.tabs.update(tabId, {
                url: "https://www.youtube.com/",
                active: true,
            });
        }
    };

    
//**************************************************************************************************//
    let setupFocusCheckerForDesktop = async () => {
        const autoWatchingTabIdData = await store.get('autoWatchingTabId');
        const tabId = autoWatchingTabIdData.autoWatchingTabId;
        let notificationShown = false;
        const intervalId = setInterval(async () => {
            const tab = await new Promise(resolve => {
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        clearInterval(intervalId);
                        return;
                    }
                    resolve(tab);
                })
            });
            if (!tab.active) {
                chrome.tabs.sendMessage(tabId, {
                    action: 'pauseVideo',
                });
                if (!notificationShown) {
                    createNotification(getLocaleMsg('taskTabNotInFocusNotificationMessage'));
                    notificationShown = true;
                }
            } else {
                const _window = await new Promise(resolve => {
                    chrome.windows.get(tab.windowId, (wndw) => {
                        if (chrome.runtime.lastError) {
                            clearInterval(intervalId);
                            return;
                        }
                        resolve(wndw);
                    })
                });
                if (!_window.focused) {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'pauseVideo',
                    });
                    if (!notificationShown) {
                        createNotification(getLocaleMsg('taskTabNotInFocusNotificationMessage'));
                        notificationShown = true;
                    }
                }
                else {
                    if (notificationShown) {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'playVideo',
                        });
                        notificationShown = false;
                    }
                }
            }
        }, 1500);
    };
//******************************************************************************************************//



    // sends request to server to save video rank
    let saveVideoRank = async (data, callback) => {
        await videoRanksModel.save(data['videoId'], data['country'], data['keywordHash'], data['rank'])
            .catch(exception => {
                log('exception in getting video rank', exception);
                callback(false);
            });
        callback(true);
        log('video rank saved', data)
    };

    // to send task is in progress ping. 
    // specifically helpful to keep task active when video is of longer duration 
    let sendTaskInProgressPing = taskId => {
        taskModel.ping(taskId)
            .catch(exception => {
                log('exception in sending ping', exception);
            });
    };

    // to set video watched badge
    let setVideoWatchedBadge = () => {
        chrome.browserAction.setBadgeText({
            text: "!"
        }, () => {
            chrome.browserAction.setBadgeBackgroundColor({
                color: '#fb4143'
            });
        });
    };

    let continueWhenTimeoutGone = (timeout, tabId) => {
        setTimeout(async () => {
            await settingsModel.get(true).catch(exception => { });
            await getNextTask();
            await startAutoWatching(tabId);
        }, timeout);
    };

    /**
     * Process request to mark a task complete
     * @param  function callback A function to be called with error or success response after processed
     * @return void
     */
    let markTaskComplete = (automation, callback, adsInfo) => {
        taskModel.markCompleted(automation, adsInfo)
            .then(response => {
                // reset log collection
                window.logCollection = [];

                callback({
                    isSuccessful: true,
                    data: response
                });

                // set task completed tick as badge
                chrome.browserAction.setBadgeText({
                    text: "✔"
                }, () => {
                    chrome.browserAction.setBadgeBackgroundColor({
                        color: '#0dd157'
                    });
                });
            })
            .catch(exception => {
                log('exception in marking task complete', exception);
                callback({
                    isSuccessful: false,
                    data: exception
                });
            })
    };

    let unsubscribeHandler = async (details) => {
        if (typeof details.requestBody.raw != 'undefined') {
            let postData = JSON.parse(new TextDecoder().decode(new Uint8Array(details.requestBody.raw[0].bytes)));
            if (postData) {
                let channelId = postData.channelIds[0];
                const strikesInfo = await checkIsUnsubscribingIllegal(channelId);
                if (strikesInfo.strikesCount > 0) {
                    chrome.tabs.sendMessage(details.tabId, { action: 'showCheaterAlertMessage', strikesCount: strikesInfo.strikesCount });
                }
            }
        }
    };

    // listener for youtube video comment posted
    let isCommentPostedOnYTVideo = request => {
        let comment = '';
        if (typeof request.requestBody.formData != 'undefined') {
            comment = request.requestBody.formData.comment_text;
            log('comment detected in formData', {
                comment: comment
            });
        }
        else if (typeof request.requestBody.raw != 'undefined') {
            let postData = JSON.parse(new TextDecoder().decode(new Uint8Array(request.requestBody.raw[0].bytes)));

            if (typeof postData.commentText != 'undefined') {
                comment = postData.commentText;

                log('comment detected in raw bytes', {
                    comment: comment
                });
            }
        }

        if (!comment) {
            log('comment text not found');
            return;
        }

        if (request.url.indexOf('create_comment_reply') > 0) {
            chrome.tabs.sendMessage(request.tabId, {
                action: 'replyPosted',
                comment: comment
            });
            return;
        }

        chrome.tabs.sendMessage(request.tabId, {
            action: 'commentPosted',
            comment: comment
        });
    };

    // actions to be take when user logs out on engagedhits
    let onUserLogout = () => {
        store.remove(['task', 'user']);
        log('onUserLogout task and user info cleared');

        // clear badge
        chrome.browserAction.setBadgeText({
            text: ""
        });
    };

    // common simple function to create event listeners
    let setupListeners = () => {
        let currentTabId;
        let currentTabUrl;

        chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
            currentTabId = details.tabId;
            currentTabUrl = details.url;
        });

        chrome.webRequest.onCompleted.addListener(function (details) {
            const parsedUrl = new URL(details.url);
            if (currentTabUrl && currentTabUrl.indexOf(parsedUrl.pathname) > -1 && currentTabId) {
                if (details.url.indexOf('https://www.youtube.com/watch') === 0 || details.url.indexOf('https://youtube.com/watch') === 0) {
                    chrome.tabs.sendMessage(details.tabId, {action: 'ytWatch'});
                    log('ytWatch action message sent');
                }
                else if (details.url.indexOf('https://www.youtube.com/results') === 0 || details.url.indexOf('https://youtube.com/results') === 0) {
                    chrome.tabs.sendMessage(details.tabId, { action: 'ytSearch' });
                    log('ytSearch action message sent');
                }
                else if (details.url.indexOf('https://www.youtube.com') === 0 || details.url.indexOf('https://youtube.com') === 0) {
                    chrome.tabs.sendMessage(details.tabId, { action: 'ytOtherURL' });
                    log('YT other URL action message sent');
                }
            }
        }, { urls: ['*://*.youtube.com/*'] });

        chrome.runtime.onMessage.addListener(onMessageListner);

        chrome.webRequest.onBeforeRequest.addListener(isCommentPostedOnYTVideo, {
            urls: ENGAGEDHITS.YT_COMMENT_POST_URLs,
            types: ['xmlhttprequest']
        }, [
            'requestBody'
        ]);

        chrome.webRequest.onBeforeRequest.addListener(unsubscribeHandler, {
            urls: [ENGAGEDHITS.YT_UNSUBSCRIBE_POST_URL],
            types: ['xmlhttprequest']
        }, [
            'requestBody'
        ]);

        chrome.webRequest.onBeforeRequest.addListener(onUserLogout, {
            urls: [ENGAGEDHITS.LOGOUT_URL],
            types: ['main_frame', 'sub_frame', 'xmlhttprequest']
        });

        chrome.tabs.onRemoved.addListener(async (tabId) => {
            let autoWatchingTabIdData = await store.get('autoWatchingTabId');

            if(autoWatchingTabIdData.autoWatchingTabId && autoWatchingTabIdData.autoWatchingTabId === tabId){
                await store.remove("autoWatchingTabId");
            }
        });

        chrome.webRequest.onBeforeRedirect.addListener(function (details) {
            if (typeof redirectURLs[details.tabId] == 'undefined') {
                redirectURLs[details.tabId] = [];
            }

            redirectURLs[details.tabId].push(details.url);
        }, {
            urls: ['<all_urls>']
        }, [
            'responseHeaders'
        ]);
    };

    let tabChangedListener = async function(activeInfo){
        const tab = await store.get("autoWatchingTabId");
        const ytTabId = tab.autoWatchingTabId;
        if (activeInfo.tabId != ytTabId) {
            createNotification(getLocaleMsg('tabChangedNotificationTitle'));
            chrome.tabs.sendMessage(ytTabId, {
                action: 'pauseVideo'
            });
        } else {
            chrome.tabs.sendMessage(ytTabId, {
                action: 'playVideo'
            });
        }
    };

    let createNotification = (msg, title=getLocaleMsg('tabChangedNotificationTitle')) => {
        chrome.notifications.create(null, {
            title: title,
            message: msg,
            type: 'basic',
            iconUrl: '/images/logos/engagedhits.png',
        });
    };

    let removeTabChangedNotification = async () => {
        chrome.tabs.onActivated.removeListener(tabChangedListener);
    };

    let setTabChangedNotification = async () => {
        const tab = await store.get("autoWatchingTabId");
        const ytTabId = tab.autoWatchingTabId;
        chrome.tabs.onActivated.addListener(tabChangedListener);
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            if (tabId == ytTabId) {
                removeTabChangedNotification();
            }
        });
    };

    // Initialize background script
    let init = async () => {
        setupListeners();
        store.remove(['user', 'task', 'settings', 'ytTabsTracked', 'nextEarnType']);

        // clear badge
        chrome.browserAction.setBadgeText({
            text: ""
        });

        let settings = await settingsModel.get().catch(exception => { });
    };

    init();
})();