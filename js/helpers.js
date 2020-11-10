async function getAutomaticModeVideosCount(){
    let count =  (await store.get('automaticModeVideosCount')).automaticModeVideosCount;
    if (typeof count == 'undefined') {
        let response = null;
        try {
            response = await api.get('task/getAutoCompletedTasksCount');
        } catch (e) {
            log('error', e)
        }
        if (response && response.type == 'success') {
            count = response.tasksCount;
        } else {
            count = 0;
        }
        await store.set('automaticModeVideosCount', count || 0);
    }
    return count;
}

async function wipeAutomaticModeVideosCount() {
    await store.set('automaticModeVideosCount', 0);
}

async function incrementWatchedTestVideos(){
    let automaticModeVideosCount = await getAutomaticModeVideosCount();
    let limit = await getAutomaticModeLimit();
    automaticModeVideosCount++;
    if (automaticModeVideosCount >= limit) {
        automaticModeVideosCount = 0;
    }
    await store.set('automaticModeVideosCount', automaticModeVideosCount);
    return automaticModeVideosCount;
}

async function disableAutomacticMode(){
    let autoWatchingTabId = (await store.get('autoWatchingTabId')).autoWatchingTabId;                
    if(autoWatchingTabId){
        chrome.tabs.remove(autoWatchingTabId);
        await stopAutomaticMode();
    }
    await store.set('disableAutomaticMode', true);
    await store.remove(['nextEarnType']);
}

async function stopAutomaticMode(){
    await store.remove("autoWatchingTabId");
}

async function checkIsUnsubscribingIllegal(channelId) {
    try{
        return api.post('user/checkUnsubscribe', {
            channelId: channelId
        })
          .then(res => {
              log('user/checkUnsubscribe response', res);
              return res;
          })
    }
    catch(e){
        log(e);
    }
    return 0;
}

async function isAutomaticModeActive(){
    let autoWatchingTabId = (await store.get('autoWatchingTabId')).autoWatchingTabId;
    if(autoWatchingTabId){
        return true;
    }              
    return false;
}

async function getAutomaticModeTimeout(){
    let settings    = await settingsModel.get();
    let amTimeout   = 30;

    try{
        if(settings.amTimeout){
            amTimeout = parseInt(settings.amTimeout);
        }
    }catch(e){
        log(e);
    }
    return amTimeout;
}

async function getAutomaticModeLimit(){
    let settings        = await settingsModel.get();
    let amVideosLimit   = 10;

    try{
        if(settings.amVideosLimit){
            amVideosLimit = parseInt(settings.amVideosLimit);
        }
    }catch(e){
        log(e);
    }
    return amVideosLimit;
}

async function userAndIpCanContinueAfter(){
    try{
        return await api.get('task/userAndIpCanContinueAfter');
    }
    catch(e){
        log(e);
    }
    return null;
}

async function isAutomaticModeEnabled(){
    if((await store.get('disableAutomaticMode')).disableAutomaticMode){
        return false;
    }
    return true;
}

async function nextAvailableTaskAfter(){
    try{
        let response = await api.get('task/nextAvailableTaskAfter');
        if(response.after){
            return response.after;
        }
    }
    catch(e){
        log(e);
    }
    return null;
}

async function getNextTask(){
    if(!isBackgroundContext()){
        return executeFromBackground("getNextTask");
    }

    let user = await userModel.get().catch(exception => { });
    let nextEarnType = (await store.get('nextEarnType').catch(exception => { })).nextEarnType;

    if(!nextEarnType){
        nextEarnType = "points";
    }

    if(nextEarnType == "points" || (nextEarnType == "money" && user && user.canEarnMoney == '1')){
        try{
            await taskModel.get(true, nextEarnType);
        }
        catch(exception){
            if(exception.error == 'ERR_NO_TASK') {
                await store.remove("autoWatchingTabId");
            }
        }
    }
}

async function strikeUser(reason, taskId, channelId){
    if(!isBackgroundContext()){
        return executeFromBackground("strikeUser", [reason, taskId, channelId]);
    }
    return new Promise(async (resolve, reject) => {
        try{
            return api.post('user/strike', {reason, taskId, channelId}).then(response => {
                resolve(response);
            }).catch(e => reject(e));
        }
        catch(e){}
    });
}

async function skipTask(getNewTask = false){
    if(!isBackgroundContext()){
        return executeFromBackground("skipTask", [getNewTask]);
    }
    let response = await taskModel.markCancelled();
    getNewTask && await getNextTask();

    chrome.tabs.query({
        url: [
            "*://www.youtube.com/*",
            "*://youtube.com/*"
        ]
    }, function (tabs) {
        for (var i = 0; i < tabs.length; ++i) {
            chrome.tabs.sendMessage(tabs[i].id, { action: 'taskCancelled' });
        }
    });
}

async function reportTask(reason){
    if(!isBackgroundContext()){
        return executeFromBackground("reportTask", [reason]);
    }
    return new Promise(async (resolve, reject) => {
        try{
            let task = await store.get('task');
            api.post('task/complain', {
                taskId: task.task.data.taskId,
                reason: reason, 
            }).then(response => {
                resolve(response);
            }).catch(e => reject(e));
        }
        catch(e){}
    });
}

async function executeFromBackground(functionName, args){
    if(location.protocol === 'chrome-extension:' && chrome.extension.getBackgroundPage() === window){
        return await window[functionName].apply(null, args);
    }
    else{
        return await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'executeFromBackground', functionName: functionName, args: args}, function(response){
                resolve(response);
            });
        });
    }
}

function isBackgroundContext(){
    return location.protocol == 'chrome-extension:' && chrome.extension.getBackgroundPage() === window;
}

async function waitForElement(selector){
    let element = document.querySelector(selector);

    if(element){
        return element;
    }

    return new Promise(resolve => {
        $('body').on('DOMNodeInserted', selector, function () {
            resolve(this);
        });
    });

}

async function isTabExists(tabId) {
    return await new Promise(resolve => {
        chrome.tabs.get(tabId, () => {
            if (chrome.runtime.lastError) {
                resolve(false);
            }
            resolve(true);
        });
    })
}

function isMobile() {
    return typeof window.orientation !== 'undefined';
}

function saveAdInfo(channelId, adDuration) {
    if (!channelId) {
        return;
    }
    if(!isBackgroundContext()){
        return executeFromBackground("saveAdInfo", [channelId, adDuration]);
    }
    return new Promise((resolve, reject) => {
        api.post('task/saveAdInfo', {
            channelId,
            adDuration,
        })
          .then(response => resolve(response))
          .catch(e => log(e))
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(() => {
        resolve()
    }, ms));
}