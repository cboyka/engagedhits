let isTabAutoWatching; 

$(() => {
    // returns tab ID. simple wrapper to get tab ID in synchronous way
    let getTabId = () => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'returnTabID' }, response => {
                log('youtube.js tabID', response.tabID);
                if (typeof response.tabID != 'undefined' && response.tabID) {
                    resolve(response.tabID);
                }
                else {
                    reject(false);
                }
            });
        });
    };

    // returns boolean based on if tab is tracked for youtube or not
    let isTabTracked = async tabID => {
        let storeResponse = await store.get('ytTabsTracked').catch(exception => { });
        if (storeResponse && storeResponse.ytTabsTracked) {
            return storeResponse.ytTabsTracked.indexOf(tabID) > -1;
        }
        return false;
    };

    // is current tab for auto watching
    let isAutoWatchingTab = async tabID => {
        let storeData = await store.get("autoWatchingTabId");
        return tabID === storeData.autoWatchingTabId;
    };

    // adds tab ID to tracked list managed in local storage
    let addTabToTrackedList = async tabID => {
        let storeResponse = await store.get('ytTabsTracked').catch(exception => { });
        if (storeResponse && storeResponse.ytTabsTracked) {
            if (storeResponse.ytTabsTracked.indexOf(tabID) > -1) {
                return;
            }
            ytTabsTracked = storeResponse.ytTabsTracked;
            ytTabsTracked.push(tabID);
            await store.set('ytTabsTracked', ytTabsTracked);
        }
        else {
            await store.set('ytTabsTracked', [tabID]);
        }

        log('youtube.js tab added to tracked list', tabID);
    };

    let init = async () => {

        log('youtube.js init call received');

        chrome.runtime.onMessage.addListener(async (msg, sender, callback) => {
            switch (msg['action']) {
                case 'showCheaterAlertMessage':
                    const msgNumber = msg['strikesCount'] <= 3 ? msg['strikesCount'] : 3;
                    ehPopup.alert(getLocaleMsg('cheaterAlertMessage' + msgNumber));
                    break;
            }
        });

        // get tab ID
        let tabID = await getTabId().catch(exception => { });
        if (!tabID) {
            return;
        }
        isTabAutoWatching = await isAutoWatchingTab(tabID);

        // try to get task information
        let task = await taskModel.get(false).catch(exception => { });

        if (!task || task.campaignType != 'youtube') {
            return;
        }

        // try to get settings information
        let settings = await settingsModel.get(false).catch(exception => { });

        let isTabTrackedStatus = await isTabTracked(tabID);
        log('youtube.js isTabTrackedStatus', isTabTrackedStatus);

        // if adblockes is not allowed, check for same
        if (settings && settings.adblockerAllowed == '0') {
            let adBlockerFound = await hasAdBlocker();
            if (adBlockerFound) {
                log('adBlockerFound');
                ehPopup.alert(getLocaleMsg('msgAdBlockerNotAllowed'));
                return;
            }
        }

        // keep listeing to onMessage event
        chrome.runtime.onMessage.addListener(async (msg, sender, callback) => {
            log('callback', callback);
            typeof callback != 'undefined' && callback(true) && log('callback sent');
            log('message received', msg);
            task = await taskModel.get(false).catch(exception => {
                log('#!exception', exception);
                console.log('#!exception', exception);
            });
            switch (msg['action']) {
                case 'ytWatch':
                    if (task) {
                        videoTracker.init(task);
                    }
                    break;
                case 'ytSearch':
                    if (task) {
                        searchHelper.clear();
                        searchHelper.init(task, settings.maxVideosToSearch);
                    }
                    break;
                case 'ytOtherURL':
                    let wasInit = videoTracker.clear();
                    if (wasInit) {
                        ehPopup.alert(getLocaleMsg('msgVideoTrackingStopped'));
                    }
                    break;
                case 'taskCancelled':
                    searchHelper.clear();
                    videoTracker.clear();
            }
        });

        // init search result in case, user lands directy on search result page
        let currentURL = window.location.href;
        if (currentURL.indexOf('https://www.youtube.com/results') === 0 || currentURL.indexOf('https://youtube.com/results') === 0) {
            searchHelper.init(task, settings.maxVideosToSearch);
        }

        // init video tracker, if visit type is direct or third party. but only if tab is not tracked before
        // also allow search visit type task converted to direct type
        if (
            (task.visitType == 'direct' || task.visitType == 'third-party' || typeof task.convertedToDirect != 'undefined' || task.searchDone) &&
            (currentURL.indexOf('https://www.youtube.com/watch') === 0 || currentURL.indexOf('https://youtube.com/watch') === 0)
        ) {
            if (isTabTrackedStatus && typeof task.convertedToDirect == 'undefined' && !task.searchDone) {
                ehPopup.alert(getLocaleMsg('msgVideoAlreadyTrackedInSameTab'));
            }
            else {
                videoTracker.clear();
                videoTracker.init(task);
            }
        }

        if (!isTabTrackedStatus) {
            addTabToTrackedList(tabID);
        }

        if (isTabAutoWatching) {
            log("Auto watching");
            if ($.inArray(currentURL, ['https://www.youtube.com/', 'https://www.youtube.com', 'https://youtube.com/', 'https://youtube.com']) > -1) {
                switch (task.visitType) {
                    case "search":
                        if(task.keyword.trim() === ""){
                            taskModel.convertToDirect().then(() => {
                                window.location.href = task.videoURL;
                            });
                        }else{
                            $("input#search").simulate("focus").val(task.keyword).simulate("change").simulate("blur");
                            setTimeout(() => $("button#search-icon-legacy").simulate("click"), 100);
                        }
                        break;
                    case "direct":
                        taskModel.convertToDirect().then(() => {
                            window.location.href = task.videoURL;
                        });
                        break;
                    case "third-party":
                        taskModel.convertToDirect().then(() => {
                            window.location.href = task.thirdPartyURL;
                        });
                    default:
                        break;
                }
            }
        }
    };
    init();
});