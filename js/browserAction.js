$(() => {

    let task = null;
    let settings = null;
    let user = null;
    let currentExtVersion = null;

    // simple function to add locale strings in HTML
    let replaceLocaleStrings = () => {
        $('[data-locale]').each((index, element) => {
            $(element).html(getLocaleMsg($(element).data('locale')));
        });
    };

    // to show login button
    let askForLogin = () => {

        // show login button
        let loginBtnHtml = `
        <div class="text-center">
            <label class="mb-2">` + getLocaleMsg('msgLoginToGetStarted') + `</label>
            <div>
                <button type="button" class="btn btn-sm btn-primary btn-block-200 btn-login"><i class="fa fa-sign-in-alt"></i>&nbsp;&nbsp;` + getLocaleMsg('loginInWithGoogle') + `</button>
            </div>
        </div>
        `;
        $('section#main').html(loginBtnHtml);

        // bind login button click event
        $(document).on('click', '.btn-login', redirectToLogin);
    };

    let showUpdateExtMsg = () => {
        // show download button
        let downloadBtnHtml = `
        <div class="container">
            <div class="row mb-3">
                <div class="col text-center">
                    <label class="mb-2">` + getLocaleMsg('msgDownloadUpdatedExt', [ENGAGEDHITS.WEBSITE_URL + '/user/pages/show/download_ext']) + `</label>
                    <div>
                        <button type="button" class="btn btn-sm btn-success btn-down-ext"><i class="fa fa-download"></i>&nbsp;&nbsp;` + getLocaleMsg('downloadUpdatedExt') + `</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('section#main').html(downloadBtnHtml);

        // bind download button click event
        $(document).on('click', '.btn-down-ext', () => {
            chrome.tabs.update({ url: ENGAGEDHITS.WEBSITE_URL + '/extension/download/' + settings.latestExtVersion });
            window.close();
        });
    };

    let showAutomaticModeProgressInfo = async () => {
        let earnMoneyProgressHtml = '';
        if (task.earnType == 'money' && typeof task.earnMoneyOffer != 'undefined') {
            let watchedVideos = task.earnMoneyOffer.watched_videos + 1;
            let totalVideos = task.earnMoneyOffer.total_videos;
            let percentCompleted = (watchedVideos / totalVideos) * 100;
            percentCompleted = percentCompleted.toFixed(2);
            let earnValue = parseFloat(task.earnMoneyOffer.satoshi_value);
            earnMoneyProgressHtml = `
            <div class="row mb-2 earn-money-provider">
                <div class="col text-center">
                    <span class="badge badge-primary">` + task.earnMoneyOffer.provider_name + ` - ` + user.mttRefId + `</span>
                </div>
            </div>
            <div class="row mb-3 earn-money-progress">
                <div class="col text-center">
                    <div class="progress">
                        <div class="progress-info">
                            <span class="font-weight-bold">Video ` + watchedVideos + `/` + totalVideos + ` | $` + earnValue + `</span>
                        </div>
                        <div class="progress-bar bg-success" role="progressbar" style="width: ` + percentCompleted + `%" aria-valuenow="` + percentCompleted + `" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            </div>
            `;
        }

        const limit = await getAutomaticModeLimit();
        const count = await getAutomaticModeVideosCount();

        let data = `<div class="container">
            ${earnMoneyProgressHtml}
            <div class="row mt-3 mb-2">
                <div class="col text-center"><small>${getLocaleMsg('msgAutomaticModeProgress', [limit - count])}</small></div>
            </div>
            <div class="row mb-3">
                <div class="col text-center"><small>` + getLocaleMsg('msgAutomaticModeOptions') + `</small></div>
            </div>
            <div class="row mb-2">
                <div class="col text-center"><div class="muted-link" id="stop-auto-mode">` + getLocaleMsg('msgRunManualModeBtn') + `</div></div>
            </div>
        </div>`;
        $('section#main').html(data);
    };

    let showTimeoutCountdown = async (noTask=false) => {
        let data = `<div class="container text-center">
            <div class="row mb-3">
                <div class="col">
                    <div class="countdown" id="timeout-countdown"></div>
                </div>
            </div>
            <div class="row">
                <div class="col">${noTask ? getLocaleMsg('msgNoTaskInfo') : getLocaleMsg('msgTestAutomaticMode', [settings.amVideosCount])}</div>
            </div>
        </div>`;
        $('section#main').html(data);

        let seconds = await nextAvailableTaskAfter();
        if(seconds){
            $("#timeout-countdown").countdown((+new Date()) + seconds * 1000, function(event) {
                $(this).text(seconds > 60 * 60 ? event.strftime('%H:%M:%S') : event.strftime('%M:%S'));
            }).on('finish.countdown', function(){
                reinit();
            });
        }
    };

    let showTimeoutTaskCountdown = async (seconds, msg) => {
        let user = await userModel.get().catch(exception => { });
        let currentEarnType = '';
        let btnForEarnTypeSwitching = '';
        if (user && user.canEarnMoney == '1' && msg == 'msgAutomaticMode') {
            let nextEarnTypeData = await store.get('nextEarnType').catch(exception => { });
            if (nextEarnTypeData && typeof nextEarnTypeData.nextEarnType != 'undefined') {
                currentEarnType = nextEarnTypeData.nextEarnType == 'money' ? 'money' : 'advertising points';
            }
            btnForEarnTypeSwitching = `
            <div class="row">
                <div class="col change-earntype-block">
                    <div>${getLocaleMsg('switchEarnType')}</div>
                    <div class="change-earntype-btns-block">
                        <button class="btn btn-sm btn-success" id="btnChooseMoney">${getLocaleMsg('earnMoney')}</button>
                        <button class="btn btn-sm btn-primary" id="btnChoosePoints">${getLocaleMsg('earnPointsShort')}</button>
                    </div>
                    <div>${getLocaleMsg('currentEarnType')}<strong id="currentEarnType">${currentEarnType}</strong>.</div>
                </div>
            </div>
            `
        }

        let msgHtml = `
        <div class="container text-center">
            <div class="row mb-3">
                <div class="col">
                    <div class="countdown" id="no-task-countdown"></div>
                </div>
            </div>
            <div class="row">
                <div class="col">` + getLocaleMsg(msg) + `</div>
            </div>
            ${currentEarnType && btnForEarnTypeSwitching}
        </div>
        `;
        $('section#main').html(msgHtml);
        $("#no-task-countdown").countdown((+new Date()) + seconds * 1000, function(event) {
            $(this).text(seconds > 60 * 60 ? event.strftime('%H:%M:%S') : event.strftime('%M:%S'));
        }).on('finish.countdown', function(){
            reinit();
        });
    };

    // to redirect to login page when user click on login button
    let redirectToLogin = () => {
        chrome.tabs.update({ url: ENGAGEDHITS.WEBSITE_URL + '/login/social/google' });
        window.close();
    };

    // simple function to get task and then init display of tasks
    let getTask = async (earnType) => {

        $.blockUI({ message: '<i class="fa fa-circle-notch fa-spin"></i>' });
        let autoModeStopped = false;

        // try to get task information
        task = await taskModel.get(true, earnType)
            .catch(async exception => {
                log('getTask exception', exception);
                if (exception.error == 'unauthorized') {
                    askForLogin();
                }
                else if (exception.error == 'ERR_NO_TASK') {
                    if (await isAutomaticModeActive()) {
                        await stopAutomaticMode();
                        getTask(earnType);
                        autoModeStopped = true;
                    }
                    else {
                        showTimeoutCountdown(true);
                    }
                }
                else if(exception.error == 'ERR_TIMEOUT_USER'){
                    await wipeAutomaticModeVideosCount();
                    await showTimeoutTaskCountdown(exception.after, 'msgAutomaticMode');
                }
                else if(exception.error == 'ERR_TIMEOUT_IP'){
                    showTimeoutTaskCountdown(exception.after, 'msgTimeoutIp');
                }
                else if (exception.error == 'ERR_PROXY_NOT_ALLOWED') {
                    displayMessage('msgProxyNotAllowed');
                }
                else if (exception.error == 'httpErrorCode-302') {
                    showMaintenanceONMessage();
                }

                if (exception.error != 'unauthorized') {
                    showMenu();
                }
            });

        if (autoModeStopped) {
            return;
        }

        if (task) {
            if (await isAutomaticModeEnabled()) {
                if (await isAutomaticModeActive()) {
                    await showAutomaticModeProgressInfo();
                }
                else{
                    chrome.runtime.sendMessage({ action: 'startAutoWatching' });
                }
            }
            else{
                displayTasks();
            }
    
            showMenu();
            store.set('nextEarnType', earnType);
        }

        $.unblockUI();
    };

    let showMenu = () => {
        let menuHtml = `
        <a href="` + ENGAGEDHITS.WEBSITE_URL + `/user/welcome" target="_blank">` + getLocaleMsg('dashboard') + `</a>
        <a href="javascript: void(0)" id="logout">` + getLocaleMsg('logout') + `</a>
        `;
        $('header #menu').html(menuHtml).show();
    };

    let displayMessage = msgKey => {
        let msgHtml = `
        <div class="container">
            <div class="row">
                <div class="col text-center">` + getLocaleMsg(msgKey) + `</div>
            </div>
        </div>
        `;
        $('section#main').html(msgHtml);
    };

    let displayTasks = async () => {
        // show no task info
        if (!task) {
            return;
        }

        let tasksListHtml = '';
        if (task.visitType == 'direct') {
            tasksListHtml += `
            <li class="mb-2">
                <div>` + getLocaleMsg('ytTask_directVisitDesc') + `</div>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="url" value="` + task.videoURL + `" readonly>
                    <div class="input-group-append">
                        <button class="btn btn-primary btn-copy" data-copy-ele="url" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
            </li>`;
        }
        else if (task.visitType == 'third-party') {
            tasksListHtml += `
            <li class="mb-2">
                <div>` + getLocaleMsg('ytTask_thirdPartyVisitDesc') + `</div>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="url" value="` + task.thirdPartyURL + `" readonly>
                    <div class="input-group-append">
                        <button class="btn btn-primary btn-copy" data-copy-ele="url" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
            </li>`;
        }
        else if (task.visitType == 'search') {
            tasksListHtml += `
            <li class="mb-2">
                <div>` + getLocaleMsg('ytTask_searchVisitDesc', [task.keyword]) + `</div>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="keyword" value="` + task.keyword + `" readonly>
                    <div class="input-group-append">
                        <button class="btn btn-primary btn-copy" data-copy-ele="keyword" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
            </li>`;
        }

        let tasksList = ['watchVideo', 'likeVideo', 'dislikeVideo', 'subscribeChannel', 'postComment', 'replyToPinned', 'likeComment'];
        for (let i = 0; i < tasksList.length; i++) {
            let taskIndex = tasksList[i];
            let tempTask = task.tasks[taskIndex];
            if (!tempTask.required) {
                continue;
            }

            let taskText = getLocaleMsg(`ytTask_` + taskIndex);
            let extraHtml = '';
            if (taskIndex == 'watchVideo') {
                let hours = Math.floor(tempTask.watchDuration / 3600);
                let minutes = Math.floor(tempTask.watchDuration % 3600 / 60);
                let seconds = Math.floor(tempTask.watchDuration % 3600 % 60);
                taskText = getLocaleMsg('ytTask_watchVideo', [
                    hours ? getLocaleMsg('hours', hours.toString()) : '',
                    minutes ? getLocaleMsg('minutes', minutes.toString()) : '',
                    seconds ? getLocaleMsg('seconds', seconds.toString()) : ''
                ]);
            }
            else if (taskIndex === 'postComment' || taskIndex === 'replyToPinned') {
                extraHtml += `
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" id="comment" value="` + tempTask.comment + `" readonly>
                    <div class="input-group-append">
                        <button class="btn btn-primary btn-sm btn-copy" data-copy-ele="comment" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
                `;
            } else if (taskIndex == 'likeComment') {
                extraHtml += `
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" value="` + tempTask.comment + `" readonly>
                </div>
                `;
            }

            tasksListHtml += `<li class="mb-2"><div>` + taskText + `</div>` + extraHtml + `</li>`;
        }

        let earnMoneyProgressHtml = '';
        if (task.earnType == 'money' && typeof task.earnMoneyOffer != 'undefined') {
            let watchedVideos = task.earnMoneyOffer.watched_videos + 1;
            let totalVideos = task.earnMoneyOffer.total_videos;
            let percentCompleted = (watchedVideos / totalVideos) * 100;
            percentCompleted = percentCompleted.toFixed(2);
            let earnValue = parseFloat(task.earnMoneyOffer.satoshi_value);
            earnMoneyProgressHtml = `
            <div class="row mb-2 earn-money-provider">
                <div class="col text-center">
                    <span class="badge badge-primary">` + task.earnMoneyOffer.provider_name + ` - ` + user.mttRefId + `</span>
                </div>
            </div>
            <div class="row mb-3 earn-money-progress">
                <div class="col text-center">
                    <div class="progress">
                        <div class="progress-info">
                            <span class="font-weight-bold">Video ` + watchedVideos + `/` + totalVideos + ` | $` + earnValue + `</span>
                        </div>
                        <div class="progress-bar bg-success" role="progressbar" style="width: ` + percentCompleted + `%" aria-valuenow="` + percentCompleted + `" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            </div>
            `;
        }

        let tasksHtml = `
        <div class="container">`
            + earnMoneyProgressHtml
            + `<div class="row mb-3 tasks-info-heading">
                <div class="col text-center">` + getLocaleMsg('tasksInfoHeading') + `</div>
            </div>
            <div class="row mb-1">
                <div class="col"><ol id="tasksList">` + tasksListHtml + `</ol></div>
            </div>
            <div class="row mb-4">
                <div class="col text-center">
                    <a href="#" id="start-auto-mode">` + getLocaleMsg('msgRunAutomaticModeBtn') + `</a>
                </div>
            </div>
            <div class="row mb-2">
                <div class="col text-center"><div class="stuck-que">` + getLocaleMsg('stuckQue') + `</div></div>
            </div>
        </div>
        `;

        $('section#main').html(tasksHtml);

        return true;
    };

    let showMaintenanceONMessage = () => {
        let maintenanceMsgHtml = `
        <div class="container">
            <div class="row">
                <div class="col text-center">` + getLocaleMsg('msgMaintenanceON') + `</div>
            </div>
        </div>
        `;
        $('section#main').html(maintenanceMsgHtml);
    };

    let showEarnOptions = () => {
        let maintenanceMsgHtml = `
        <div class="container">
            <div class="row">
                <div class="col-12 text-center mb-4">
                    <button type="button" class="btn btn-sm btn-success btn-earn-op btn-block-200" data-op="money">` + getLocaleMsg('earnMoney') + `&nbsp;&nbsp;<i class="fa fa-dollar-sign"></i><i class="fa fa-dollar-sign"></i><i class="fa fa-dollar-sign"></i></button>
                </div>
                <div class="col-12 text-center">
                    <button type="button" class="btn btn-sm btn-primary btn-earn-op btn-block-200" data-op="points">` + getLocaleMsg('earnPoints') + `</button>
                </div>
            </div>
        </div>
        `;
        $('section#main').html(maintenanceMsgHtml);

        // bind earn options button click event
        $(document).on('click', '.btn-earn-op', function () {
            getTask($(this).data('op'));
        });
    };

    /**
     * Simple function to redirect user to logout URL
     * @return void
     */
    let logoutUser = () => {
        chrome.tabs.update({ url: ENGAGEDHITS.LOGOUT_URL });
    };

    /**
     * Simple function to clear everything and re-init
     * Userful when task is skipped. Uerr can get new task without closing extension
     * @return void
     */
    let reinit = () => {
        clear();
        init();
    };

    let handleSkipTaskBtn = async () => {
        $.blockUI({ message: '<i class="fa fa-circle-notch fa-spin"></i>' });
        await skipTask(true);
        $.unblockUI();
        reinit();
        chrome.runtime.sendMessage({ action: 'startAutoWatching' });
    }
    
    let handleStopAutoModeBtn = () => {
        disableAutomacticMode();
    }

    let handleStartAutomaticModeBtn = async () => {
        await store.set('disableAutomaticMode', false);
        chrome.runtime.sendMessage({ action: 'startAutoWatching' });
    };

    let handleChooseMoney = async () => {
        await store.set('nextEarnType', 'money');
        document.querySelector('#currentEarnType').innerHTML = 'money';
    };

    let handleChoosePoints = async () => {
        await store.set('nextEarnType', 'points');
        document.querySelector('#currentEarnType').innerHTML = 'advertising points';
    };

    // initialization of browser action popup
    let init = async () => {
        // clear badge
        chrome.browserAction.setBadgeText({
            text: ""
        });

        $.blockUI({ message: '<i class="fa fa-circle-notch fa-spin"></i>' });

        // add version number in footer
        currentExtVersion = chrome.app.getDetails().version;
        $('#version').html(currentExtVersion);
        replaceLocaleStrings();

        try{
            settings = await settingsModel.get();
            let currentExtVersionInt = parseInt(currentExtVersion.replace(/\./g, ''));
            let latestExtVersionInt = parseInt(settings.latestExtVersion.replace(/\./g, ''));
            if(latestExtVersionInt > currentExtVersionInt) {
                $.unblockUI();
                showUpdateExtMsg();
                return;
            }
            user = await userModel.get();
        }
        catch(e){
            askForLogin();
            return;
        }
        finally{
            $.unblockUI();
        }

        if(await isAutomaticModeEnabled()){
            let autoWatchingTabId = (await store.get('autoWatchingTabId')).autoWatchingTabId;
            if (autoWatchingTabId) {
                await new Promise((resolve) => {
                    chrome.tabs.get(autoWatchingTabId, async function (tab) {
                        if (chrome.runtime.lastError) {
                            await stopAutomaticMode();
                        }
                        resolve();
                    });
                });
            }
        }

        const response = await executeFromBackground('userAndIpCanContinueAfter');
        if (response && response.userCanContinueAfter === 0 && response.ipCanContinueAfter === 0){
            if (user && user.canEarnMoney == '1') {
                let nextEarnTypeData = await store.get('nextEarnType').catch(exception => { });
                log('nextEarnTypeData', nextEarnTypeData);
                let activeTask = await taskModel.get(false).catch(exception => { });
                if (activeTask) {
                    await getTask(activeTask.earnType);
                }
                else if (nextEarnTypeData && typeof nextEarnTypeData.nextEarnType != 'undefined' && nextEarnTypeData.nextEarnType == 'money') {
                    await getTask(nextEarnTypeData.nextEarnType);
                }
                else {
                    showMenu();
                    showEarnOptions();
                }
            }
            else {
                await getTask('points');
            }
        }
        else{
            if (response) {
                response.userCanContinueAfter > response.ipCanContinueAfter ?
                  await showTimeoutTaskCountdown(response.userCanContinueAfter, 'msgAutomaticMode') :
                  await showTimeoutTaskCountdown(response.ipCanContinueAfter, 'msgTimeoutIp');
            }
            showMenu();
        }

        $(document).on('click', '.btn-copy', copyInputText);
        $(document).on('click', '#stop-auto-mode', handleStopAutoModeBtn);
        $(document).on('click', '#start-auto-mode', handleStartAutomaticModeBtn);
        $(document).on('click', '#restart-auto-mode', handleStartAutomaticModeBtn);
        $(document).on('click', 'header a#logout', logoutUser);
        $(document).on('click', '.stuck-que', handleSkipTaskBtn);
        $(document).on('click', '#skip-task', handleSkipTaskBtn);
        $(document).on('click', '#btnChooseMoney', handleChooseMoney);
        $(document).on('click', '#btnChoosePoints', handleChoosePoints);

        $.unblockUI();
    };

    let clear = () => {
        task = null;
        settings = null;
        user = null;
        currentExtVersion = null;

        $(document).off('click', '.btn-copy', copyInputText);
        $(document).off('click', '#stop-auto-mode', handleStopAutoModeBtn);
        $(document).off('click', '#start-auto-mode', handleStartAutomaticModeBtn);
        $(document).off('click', '#restart-auto-mode', handleStartAutomaticModeBtn);
        $(document).off('click', 'header a#logout', logoutUser);
        $(document).off('click', '.stuck-que', handleSkipTaskBtn);
        $(document).off('click', '#skip-task', handleSkipTaskBtn);
        $(document).off('click', '#btnChooseMoney', handleChooseMoney);
        $(document).off('click', '#btnChoosePoints', handleChoosePoints);
    };

    init();
});