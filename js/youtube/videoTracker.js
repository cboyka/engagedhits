const videoTracker = (function(){
    let isInit = false;
    let video = null;
    let seekAlerted = false;
    let seekAlertVisible = false;
    let taskVideoId = null;
    let likedStatus = null;
    let likedCommentStatus = false;
    let dislikedStatus = null;
    let subscribedStatus = null;
    let lsInterval = null;
    let pingInterval = null;
    let statusUIHtml = `
        <link href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet" integrity="sha384-wvfXpqpZZVQGK6TAh5PVlGOfQNHSoD2xbE+QkPxCAFlNEevoEH3Sl0sibVcOQVnN" crossorigin="anonymous">
        <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700" rel="stylesheet">
        <div class="eh-task-status">
            <div class="eh-task-header">
                <img src="{{logoPath}}" />
            </div>
            <div class="eh-task-list"></div>
        </div>
    `;
    let prevCurrentTime = null;
    let currentTask = null;
    let updatePingInterval = 5; // default update ping interval in minute
    let settings;
    let skipAttemptByKbTime = null;
    let skipAttemptByMouseTime = null;
    let skipAttemptVidTime = null;
    let vidResumeTime = false;
    let maxPlayBackRate = 1;

    let subscriptionScheduled = false;
    let likeScheduled = false;
    let commentScheduled = false;
    let likeCommentScheduled = false;
    let replyScheduled = false;

    let commentTimeout = null;
    let replyTimeout = null;
    let likeCommentTimeout = null;

    let checkerIntervalId = null;
    let videoLoadingCheckerTimeoutId = null;

    let likeCommentBtn = null;
    let pinnedComment = null;
    let adsInfo = {
        adsMet: 0,
        adsWatched: 0,
    };
    let needToWatchAdsCount = 0;

    // list of tasks which this tracker can handle
    let tasks = {
        watchVideo: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_watchVideo'),
            seconds: 0
        },
        likeVideo: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_likeVideo')
        },
        dislikeVideo: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_dislikeVideo')
        },
        subscribeChannel: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_subscribeChannel')
        },
        postComment: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_postComment'),
            comment: 'great video'
        },
        replyToPinned: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_replyToPinned'),
            comment: 'Thank You!'
        },
        likeComment: {
            required: false,
            isCompleted: false,
            text: getLocaleMsg('ytTask_likeComment'),
            comment: 'great video',
            underPinnedComment: false,
        }
    };

    let getStatusUIHtml = () => {
        let logoPath = chrome.runtime.getURL('/images/logos/engagedhits.png');

        let tasksHtml = $('<div/>').addClass('eh-tasks-wrap');

        for(let taskIndex in tasks) {
            let task = tasks[taskIndex];

            if(!task.required) {
                continue;
            }

            let taskText = task.text;
            if (taskIndex === 'likeComment' && task.underPinnedComment) {
                taskText += ' (look for it in replies under pinned comment)';
            }
            let extraHtml = '';
            if(taskIndex == 'watchVideo') {
                extraHtml += `
                    <div class="eh-task-info eh-time-left">` + getLocaleMsg('timeLeft') + `: <span></span></div>
                `;

                let hours = Math.floor(task.watchDuration / 3600);
                let minutes = Math.floor(task.watchDuration % 3600 / 60);
                let seconds = Math.floor(task.watchDuration % 3600 % 60);
                taskText = getLocaleMsg('ytTask_watchVideo',[
                    hours ? getLocaleMsg('hours', hours.toString()) : '',
                    minutes ? getLocaleMsg('minutes', minutes.toString()) : '',
                    seconds ? getLocaleMsg('seconds', seconds.toString()) : ''
                ]);
            }
            else if(taskIndex == 'postComment') {
                extraHtml += `
                <div class="eh-task-info">
                    <div class="commentInfo">
                        <input type="text" id="ehTaskComment" value="` + task.comment + `" readonly>
                        <button class="btn btn-primary btn-sm btn-copy" data-copy-ele="ehTaskComment" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
                `;
            } else if (taskIndex === 'replyToPinned') {
                extraHtml += `
                <div class="eh-task-info">
                    <div class="commentInfo">
                        <input type="text" id="ehTaskReply" value="` + task.comment + `" readonly>
                        <button class="btn btn-primary btn-sm btn-copy" data-copy-ele="ehTaskReply" type="button">` + getLocaleMsg('copy') + `</button>
                    </div>
                </div>
                `;
            } else if (taskIndex === 'likeComment') {
                extraHtml += `
                <div class="eh-task-info">
                    <div class="commentInfo">
                        <input type="text" value="` + task.comment + `" readonly>
                    </div>
                </div>
                `;
            }

            let faClass = task.isCompleted ? 'fa-check-circle' : 'fa-circle';
            tasksHtml.append(`
                <div class="eh-task ` + (task.isCompleted ? 'eh-task-completed' : '') + ` ehTask-` + taskIndex + `">
                    <div class="eh-task-status-icon"><i class="fa ` + faClass + `"></i></div>
                    <div class="eh-task-text">` + taskText + `</div>
                    ` + extraHtml + `
                </div>
            `);
        }

        statusUIHtml = statusUIHtml.replace('{{logoPath}}', logoPath);
        let tempDiv = $('<div/>').append(statusUIHtml)
        tempDiv.find('.eh-task-list').append(tasksHtml);

        return tempDiv.html();
    };

    // create UI of tasks status in primary column of youtube video watching page
    let createPrimaryColTaskStatusUI = () => {

        if($('#primary.ytd-watch-flexy .eh-task-status').length && $('#primary.ytd-watch-flexy #related.ytd-watch-flexy').length == 0) {
            $('#primary.ytd-watch-flexy .eh-task-status').hide();
            return;
        }

        if($('#primary.ytd-watch-flexy .eh-task-status').length || $('#primary.ytd-watch-flexy #related.ytd-watch-flexy').length == 0) {
            $('#primary.ytd-watch-flexy .eh-task-status').length && $('#primary.ytd-watch-flexy .eh-task-status').show();
            return;
        }

        $('#primary.ytd-watch-flexy #related.ytd-watch-flexy').before(getStatusUIHtml());

        log('primary column task status UI created');
    };

    // create UI of tasks status in secondary column of youtube video watching page
    let createSecondaryColTaskStatusUI = () => {
        if($('#secondary.ytd-watch-flexy .eh-task-status').length) {
            return;
        }

        $('#secondary.ytd-watch-flexy').prepend(getStatusUIHtml());

        log('secondary column task status UI created');
    };

    // to remove task status UI
    let removeTaskStatusUI = () => {
        $('#secondary.ytd-watch-flexy .eh-task-status').remove();
        log('task status UI removed');
    };

    // common utility function to mark task as completed by taskId provided
    let markTaskComplete = async (taskId) => {
        if(taskId == 'watchVideo' && video) {
            video.pause();
        }

        tasks[taskId].isCompleted = true;
        $('.ehTask-' + taskId).addClass('eh-task-completed');
        $('.ehTask-' + taskId).find('.eh-task-status-icon i').addClass('fa-check-circle').removeClass('fa-circle');
        log('task marked complete', taskId);

        // check if all tasks completed
        let isAllCompleted = true;
        for(let taskId in tasks) {
            if(tasks[taskId].required == false) {
                continue;
            }
            if(tasks[taskId].isCompleted == false) {
                isAllCompleted = false;
                break;
            }
        }

        let autoWatchingTaskCompleteHandler = async () => {
            await executeFromBackground('incrementWatchedTestVideos');
            const response = await executeFromBackground('userAndIpCanContinueAfter');
            if (response && response.userCanContinueAfter === 0 && response.ipCanContinueAfter === 0){
                await executeFromBackground('getNextTask');
                window.location.href = "https://www.youtube.com/";
            }
            else {
                const tab = await store.get("autoWatchingTabId");
                await stopAutomaticMode();
                ehPopup.alert(getLocaleMsg('msgAutomaticModeEnd', [(await executeFromBackground('getAutomaticModeTimeout'))]));
                chrome.runtime.sendMessage({
                    action: 'continueWhenTimeoutGone',
                    timeout: await getAutomaticModeTimeout() * 60 * 1000,
                    tabId: tab.autoWatchingTabId,
                });
            }
        };

        if (isAllCompleted) {
            chrome.runtime.sendMessage({
                action: 'markTaskComplete',
                automation: isTabAutoWatching,
                adsInfo,
            }, response => {
                if (response.isSuccessful) {
                    if(isTabAutoWatching){
                        autoWatchingTaskCompleteHandler();
                    }
                    else{
                        if (currentTask.earnType == 'money' && typeof currentTask.earnMoneyOffer != 'undefined' && (currentTask.earnMoneyOffer.watched_videos + 1) == currentTask.earnMoneyOffer.total_videos) {
                            store.remove('nextEarnType');
                            ehPopup.alert(getLocaleMsg('ytVideoEmConvCompleted'));
                        }
                        else if(currentTask.visitType == 'search') {
                            ehPopup.alert(getLocaleMsg('ytVideoSearchTaskCompleted'));
                        }
                        else {
                            ehPopup.alert(getLocaleMsg('ytVideoTaskCompleted'));
                        }
                    }
                    clear();
                }
                else if(response.data && typeof response.data.error != 'undefined' && response.data.error == 'unauthorized') {
                    ehPopup.alert(getLocaleMsg('msgUnauthorized'));
                    clear();
                }
                else if(response.data && typeof response.data.error != 'undefined' && response.data.error == 'INVALID_TIMEFRAME'){
                    ehPopup.alert(getLocaleMsg('speedUpAlert'), async () => {
                        window.location = "https://youtube.com";
                    }, true, getLocaleMsg('speedUpSubmitBtn'));
                }
                else {
                    ehPopup.alert(getLocaleMsg('msgFailedToMarkTaskComplete'));
                }
            });
        }

        if(!isAllCompleted && taskId == 'watchVideo') {
            chrome.runtime.sendMessage({action: 'setVideoWatchedBadge'});
        }
    };

    // common function to mark task as incoplete provided taskId
    let markTaskIncomplete = (taskId) => {
        tasks[taskId].isCompleted = false;
        $('.ehTask-' + taskId).removeClass('eh-task-completed');
        $('.ehTask-' + taskId).find('.eh-task-status-icon i').removeClass('fa-check-circle').addClass('fa-circle');
        log('task marked incomplete', taskId);
    };


//****************************************************************************************************//

    // simple common function to handle messages received via chrome runtime
    let onMessageListener = (msg, sender, callback) => {
        if(!video) return;

        switch(msg['action']) {
          // received from background.js when first email date found
            case 'commentPosted':
                if (tasks.postComment.required) {
                    log('comment posted', {
                        commentPosted: msg['comment'],
                        taskComment: tasks.postComment.comment
                    });
                    if($.trim(msg['comment']) == $.trim(tasks.postComment.comment)) {
                        markTaskComplete('postComment');
                        checkCommentStatus();
                    }
                    else {
                        ehPopup.alert(getLocaleMsg('ytVideoIncorrectCommentPosted'));
                    }
                }
                break;
            case 'replyPosted':
                if (tasks.replyToPinned.required) {
                    log('replyPosted posted', {
                        commentPosted: msg['comment'],
                        taskComment: tasks.postComment.comment
                    });
                    if($.trim(msg['comment']) == $.trim(tasks.replyToPinned.comment)) {
                        markTaskComplete('replyToPinned');
                    }
                    else {
                        ehPopup.alert(getLocaleMsg('ytVideoIncorrectCommentPosted'));
                    }
                }
                break;
            case 'playVideo':
                video.pause();
                break;
            case 'playVideo':
                video.play();
                break;
        }

        return true;
    };

//*****************************************************************************************************//


    // To update remaining time of watching video and mark task complete
    let videoTimeUpdateListener = () => {
        if(tasks.watchVideo.isCompleted) {
            log('ignored timeupdate as watch video task is completed');
            return;
        }

        if(seekAlertVisible) {
            log('ignored timeupdate as seek alert is visible');
            return;
        }


        // skip task if video stuck for 45 consecutive seconds
        if (video.readyState < video.HAVE_FUTURE_DATA) {
            if (!videoLoadingCheckerTimeoutId) {
                videoLoadingCheckerTimeoutId = setTimeout(async () => {
                    if (video.readyState < video.HAVE_FUTURE_DATA) {
                        await skipTask(true);
                        window.location = "https://www.youtube.com";
                    }
                }, 45 * 1000);
            }
            return;
        } else if (videoLoadingCheckerTimeoutId) {
            clearTimeout(videoLoadingCheckerTimeoutId);
            videoLoadingCheckerTimeoutId = null;
        }

        // only mouse event skip to consider.
        // right arrow press skip can get tricky when user might not have actually tried to skip such as while typing in search box or comment box
        if(skipAttemptByMouseTime) {
            setTimeout(videoTimeUpdateListener, 1000);
            log('delayed timeupdate by a second as seek has been detected', {
                skipAttemptByMouseTime: skipAttemptByMouseTime,
                skipAttemptByKbTime: skipAttemptByKbTime
            });
            return;
        }

        let currentTime = video.currentTime;

        // check if it is ad video playing
        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            if(isTabAutoWatching){
                const skipBtn = $("button.ytp-ad-skip-button.ytp-button");
                if (skipBtn && (adsInfo.adsWatched >= needToWatchAdsCount || video.duration > 30)) {
                    skipBtn.simulate("click");
                }
            }
            else{
                showSkipAdHighlight();
            }
            return;
        }

        hideSkipAdHighlight();

        //log('timeupdate', {prevCurrentTime: prevCurrentTime, currentTime: currentTime});

        // check if yt going to resume video
        if((prevCurrentTime === null && currentTime > 1) || (prevCurrentTime === 0 && vidResumeTime && currentTime == vidResumeTime)) {
            log('resume play detected. starting from 0', {
                currentTime: currentTime,
                prevCurrentTime: null
            });
            video.currentTime = 0;
            prevCurrentTime = 0;
            vidResumeTime = false;
            return;
        }

        if(currentTime > 0) {
            prevCurrentTime = currentTime;
        }

        if(!tasks.watchVideo.isCompleted && (currentTime >= tasks.watchVideo.watchDuration || currentTime >= (video.duration-1))) {
            markTaskComplete('watchVideo');
        }
        else {

            let remaining = tasks.watchVideo.watchDuration - Math.ceil(currentTime);
            if(remaining <= 5) {
                $('.ehTask-watchVideo .eh-task-info').addClass('few-sec-left');
            }
            else {
                $('.ehTask-watchVideo .eh-task-info').removeClass('few-sec-left');
            }

            if(remaining > 0) {
                let remainingTimeStr = '';
                let hours = Math.floor(remaining / 3600);
                if(hours != 0) {
                    remainingTimeStr += ('0' + hours).slice(-2) + ':';
                }
                remainingTimeStr += ('0' + Math.floor(remaining % 3600 / 60)).slice(-2) + ':';
                remainingTimeStr += ('0' + Math.floor(remaining % 3600 % 60)).slice(-2);
                $('.ehTask-watchVideo .eh-task-info span').text(remainingTimeStr);
            }
            else {
                $('.ehTask-watchVideo .eh-task-info span').text('00:00');
            }
        }
    };

    // In case user tries to skip video, alert him and restart play
    let videoSeekingListener = () => {
        if(!video) {
            return;
        }

        let currentTime = video.currentTime;

        log('video seek detected', {
            seekAlerted: seekAlerted,
            prevCurrentTime: prevCurrentTime,
            currentTime: currentTime,
            skipAttemptByKbTime: skipAttemptByKbTime,
            skipAttemptByMouseTime: skipAttemptByMouseTime,
            skipAttemptVidTime: skipAttemptVidTime
        });

        if(seekAlerted) {
            seekAlerted = false;
        }

        if(seekAlertVisible) {
            log('seek ignored as seek alert is visible');
            return;
        }

        // don't process if use has NOT attempted to skip video by keyboard arrow keys or by clicking on progress bar
        if(skipAttemptByKbTime === null && skipAttemptByMouseTime === null) {
            log('seek ignored as no skip attempt detected', {
                currentTime: currentTime
            });
            return;
        }

        // if video is already watched don't do anything
        if(tasks['watchVideo'].isCompleted) {
            log('seek ignored as video watch task is already completed', {
                currentTime: currentTime
            });
            return;
        }

        // in some rare case seek event is received 2 times, so need to detect that and ignore if user already alerted
        if(seekAlerted) {
            log('seek ignored as it has been already alerted', {
                currentTime: currentTime
            });
            return;
        }

        // ignore seek if user is seeking in past, we don't care
        if(prevCurrentTime !== null && currentTime <= prevCurrentTime) {
            // reset skip vars
            skipAttemptByKbTime = null;
            skipAttemptByMouseTime = null;
            skipAttemptVidTime = null;

            log('seek ignored as currentTime is less than prevCurrentTime', {
                currentTime: currentTime,
                prevCurrentTime: prevCurrentTime
            });
            return;
        }

        // if all above passes, then first pause the video
        video && video.pause();

        // also incomplete task the task to make sure user watches whole asked duration
        markTaskIncomplete('watchVideo');

        // alert user that they cannot skip video
        let alertMsg = '<i class="fa fa-exclamation-triangle"></i>&nbsp;&nbsp;' + getLocaleMsg('ytVidSeekedAlert');
        ehPopup.alert(alertMsg, () => {
            seekAlertVisible = false;
            seekAlerted = true;
            if(video) {

                // resume from last recorded play time
                let timeToSet = skipAttemptVidTime === null ? 0 : skipAttemptVidTime;
                prevCurrentTime = timeToSet;
                video.currentTime = timeToSet;
                video.play();
                log('video played after seek', {
                    newCurrentTime: timeToSet
                });

                // also incomplete task the task to make sure user watches whole asked duration
                markTaskIncomplete('watchVideo');

                // reset skip vars
                skipAttemptByKbTime = null;
                skipAttemptByMouseTime = null;
                skipAttemptVidTime = null;
            }
        });
        seekAlertVisible = true;
    };

    // To mark video wathching task complete in case video ended. 
    // helpful when video duration is shorter than required
    let videoPlayEndedListener = () => {
        log('video play ended');
        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            adsInfo.adsWatched += 1;
            log('ad video play ended');
            return false;
        }

        /*
        markTaskComplete('watchVideo');
         */
    };

    let videoPlayStartedListener = () => {
        log('video play started');
        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            adsInfo.adsMet += 1;
            saveAdInfo(currentTask.channelId, video.duration);
        }
    };

    // to detect if user changed video
    let videoMetaDataLoadedListner = () => {

        // reset skip vars
        skipAttemptByKbTime = null;
        skipAttemptByMouseTime = null;
        skipAttemptVidTime = null;

        log('video meta data loaded');
        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            return;
        }

        let videoId = getParameterByName('v');
        if(videoId && video && videoId != taskVideoId) {
            log('video changed');
            ehPopup.alert(getLocaleMsg('ytVidChangedAlert'));
            clearInterval(checkerIntervalId);
            chrome.runtime.sendMessage({action: 'removeTabChangedNotification'});
            clear();
        }
    };

    /**
     * Detects and stores time of right arrow key down to handle video skip
     * @param  object   event   JS object containing event info
     * @return void
     */
    let docKeydownListener = event => {
        // 39 is keycode of right arrow key
        if(event.keyCode !== 39) {
            return;
        }

        log('right arrow press detected');

        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            log('ignored right arrow press as AD is playing');
            return;
        }

        if(skipAttemptVidTime === null) {
            skipAttemptVidTime = video.currentTime < prevCurrentTime ? video.currentTime : prevCurrentTime;
        }
        skipAttemptByKbTime = new Date().getTime();
    };

    /**
     * Detects and stores time of mouse click down on progress bar to handle video skip
     * @return void
     */
    let progressMousedownListener = () => {
        log('mousedown detected on progress bar');

        if($('video:first').parents('.html5-video-player').hasClass('ad-showing')) {
            log('ignored mousedown as AD is playing');
            return;
        }

        if(skipAttemptVidTime === null) {
            skipAttemptVidTime = video.currentTime < prevCurrentTime ? video.currentTime : prevCurrentTime;
        }
        skipAttemptByMouseTime = new Date().getTime();
    };

    /**
     * To detect change in playbackrate and reset it to 1x if required
     * @return {[type]} [description]
     */
    let onPlayBackRateChangeListener = () => {
        if(video && video.playbackRate > maxPlayBackRate) {
            log('playbackRate reset', video.playbackRate);
            video.playbackRate = 1;
        }
    };

    // simple utility function to create event listeners
    let createEventListeners = () => {

        chrome.runtime.onMessage.addListener(onMessageListener);

        // keep listening to video play progress and mark video watching task complete according to requirement
        video.addEventListener('timeupdate', videoTimeUpdateListener);

        // restart video watching if user tries to skip video
        video.addEventListener('seeking', videoSeekingListener);

        video.addEventListener('ended', videoPlayEndedListener);

        video.addEventListener('loadeddata', videoPlayStartedListener);

        video.addEventListener('loadedmetadata', videoMetaDataLoadedListner);

        // to disallow higher speed watch in case user tries to do so
        video.addEventListener('ratechange', onPlayBackRateChangeListener);

        // in case youtube dynamically modifies whole secondary DOM div, we need to create our UI again
        $('body').on('DOMSubtreeModified', '#secondary.ytd-watch-flexy', createSecondaryColTaskStatusUI);
        $('body').on('DOMNodeInserted', '#primary.ytd-watch-flexy', createPrimaryColTaskStatusUI);

        $(document).on('click', '.eh-task-status .btn-copy', copyInputText);
        $(document).on('keydown', docKeydownListener);
        $(document).on('mousedown', 'ytd-player .ytp-progress-bar', progressMousedownListener);

        log('event listeners created');
    };

    // to remove all event listeners created
    let removeEventListeners = () => {
        if(video) {
            video.removeEventListener('timeupdate', videoTimeUpdateListener);
            video.removeEventListener('seeking', videoSeekingListener);
            video.removeEventListener('ended', videoPlayEndedListener);
            video.removeEventListener('loadeddata', videoPlayStartedListener);
            video.removeEventListener('loadedmetadata', videoMetaDataLoadedListner);
            video.removeEventListener('ratechange', onPlayBackRateChangeListener);
        }

        $('body').off('DOMSubtreeModified', '#secondary.ytd-watch-flexy', createSecondaryColTaskStatusUI);
        $('body').off('DOMNodeInserted', '#primary.ytd-watch-flexy', createPrimaryColTaskStatusUI);

        $(document).off('click', '.eh-task-status .btn-copy', copyInputText);
        $(document).off('keydown', docKeydownListener);
        $(document).off('mousedown', 'ytd-player .ytp-progress-bar', progressMousedownListener);

        log('event listeners removed');
    };

    let startTracking = () => {
        createEventListeners();
        createSecondaryColTaskStatusUI();
        createPrimaryColTaskStatusUI();

        // send ping every per set interval
        let tempUpdatePingInterval = parseFloat(typeof settings.updatePingInterval != 'undefined' ? settings.updatePingInterval : updatePingInterval);
        pingInterval = setInterval(() => {
            chrome.runtime.sendMessage({action: 'sendTaskInProgressPing', taskId: currentTask.taskId});
        }, 1000 * 60 * tempUpdatePingInterval);
        log('update ping interval ', tempUpdatePingInterval);
        if(
          tasks['likeVideo'].required ||
          tasks['dislikeVideo'].required ||
          tasks['subscribeChannel'].required ||
          tasks['postComment'].required ||
          tasks['likeComment'].required ||
          tasks['replyToPinned'].required
        ) {
            lsInterval = setInterval(() => {
                tasks['likeVideo'].required && checkLikeStatus();
                tasks['dislikeVideo'].required && checkDislikeStatus();
                tasks['subscribeChannel'].required && checkSubscribeStatus();
                tasks['postComment'].required && checkCommentStatus();
                tasks['replyToPinned'].required && checkReplyToPinnedStatus();
                tasks['likeComment'].required && checkLikeToCommentStatus();
            }, 1000);
        }

        if(video.playbackRate > maxPlayBackRate) {
            video.playbackRate = 1;
        }

        log('video tracker initialized');
    };

    // simple function to check video like status
    let checkLikeStatus = () => {
        let likeBtn = $('#primary.ytd-watch-flexy #menu-container #top-level-buttons ytd-toggle-button-renderer:first-child button');
        let status = likeBtn.attr('aria-pressed');

        // hide/show highlights
        if(status == 'true') {
            $('#likeBtnHighlight').remove();
        }
        else{
            if(isTabAutoWatching){
                if(!likeScheduled) {
                    let likeTimeout = 10;
                    if(tasks['watchVideo'].required && tasks['watchVideo'].watchDuration > 20) {
                        likeTimeout = chance.integer({ min: 10, max: tasks['watchVideo'].watchDuration/2 });
                    }
                    likeScheduled = true;
                    log(`Like scheduled with ${likeTimeout} second delay`);
                    setTimeout(() => {
                        $("#top-level-buttons > ytd-toggle-button-renderer:nth-child(1) > a button").simulate("click");
                    }, likeTimeout * 1000);
                }
            }
            else{
                if($('#likeBtnHighlight').length == 0) {
                    likeBtn.parents('ytd-toggle-button-renderer').first().after(`
                    <div id="likeBtnHighlight" class="eh-yt-highlight">
                        <div class="eh-arrow">↑</div>
                        <div class="eh-text">` + getLocaleMsg('msgLikeVideoHightlight') + `</div>
                    </div>
                    `);
                }
            }
        }

        if( status == likedStatus) {
            return;
        }
        likedStatus = status;
        if(status == 'true') {
            markTaskComplete('likeVideo');
        } else {
            markTaskIncomplete('likeVideo');
        }
    };

    // not really simple function to check comment like status
    let checkLikeToCommentStatus = async () => {
        if (isTabAutoWatching) {
            if(!likeCommentScheduled){
                likeCommentScheduled = true;
                likeCommentTimeout = Math.max(commentTimeout + 5, replyTimeout + 5, 5);
                setTimeout(() => {
                    new Promise((resolve) => {
                        $("html, body").animate({ scrollTop: $("ytd-comments#comments").position().top - 200 }, 1000, () => {
                            resolve();
                        });
                    }).then(() => new Promise((resolve) => {
                        // waiting for comments loading
                        const check = setInterval(() => {
                            if($("#comments #contents").length > 0){
                                clearInterval(check);
                                resolve();
                            }
                        }, 1000);
                    })).then(async () => {
                        // if need like comment replied to pinned comment then wait until replies loads
                        if (tasks['likeComment'].underPinnedComment) {
                            $(`ytd-comments#comments #contents ytd-comment-thread-renderer #more-replies`).first().simulate('click');
                            await new Promise(resolve => {
                                const check = setInterval(() => {
                                    if(typeof $('#comments #contents #expander-contents').attr('hidden') === 'undefined'){
                                        clearInterval(check);
                                        resolve();
                                    }
                                }, 1000);
                            });
                        }
                        const tmpBtn = $(`#comments #body:contains('${tasks['likeComment'].comment}') #like-button`);
                        if (tmpBtn.length) {
                            likeCommentBtn = tmpBtn;
                            await $("html, body").animate({ scrollTop: likeCommentBtn.position().top - 200 }, 1000);
                            if (!likeCommentBtn.hasClass('style-default-active')) {
                                likeCommentBtn.simulate('click');
                            }
                        } else {
                            // notfound
                            console.log('likeCommentBtnNotFound');
                            await skipTask(true);
                            window.location = "https://www.youtube.com";
                        }
                    })
                }, likeCommentTimeout * 1000)
            }
        } else {
            const tmpBtn = $(`#comments #body:contains(${tasks['likeComment'].comment}) #like-button`);
            if (tmpBtn.length) {
                likeCommentBtn = tmpBtn;
                likeCommentBtn.parent().css({"position": "relative"});
                if($('#likeCommentHighlight').length === 0 && !likeCommentBtn.hasClass('style-default-active')) {
                    likeCommentBtn.after(
                      `<div id="likeCommentHighlight" class="eh-yt-highlight">
                            <div class="eh-arrow">↑</div>
                            <div class="eh-text">` + getLocaleMsg('msgLikeCommentHightlight') + `</div>
                        </div>`
                    );
                }
            }
        }

        let status = false;
        if (likeCommentBtn && likeCommentBtn.hasClass('style-default-active')){
            status = true;
        }
        if (likedCommentStatus === status) {
            return;
        }

        if (status) {
            $('#likeCommentHighlight').remove();
            await markTaskComplete('likeComment');
        } else {
            await markTaskIncomplete('likeComment');
        }
        likedCommentStatus = status;
    };

    // function to check comment like status
    let checkReplyToPinnedStatus = async () => {
        if (tasks.postComment.required && !tasks.postComment.isCompleted) {
            return;
        }
        if(tasks.replyToPinned.isCompleted) {
            $('#postReplyHighlight').remove();
            return;
        }
        if (isTabAutoWatching) {
            if(!replyScheduled){
                replyScheduled = true;
                replyTimeout = Math.max(commentTimeout + 5, 5);
                setTimeout(() => {
                    new Promise((resolve) => {
                        $("html, body").animate({ scrollTop: $("ytd-comments#comments").position().top - 200 }, 1000, () => {
                            resolve();
                        });
                    }).then(() => new Promise((resolve) => {
                        let check = setInterval(() => {
                            if($("#comments #contents #comment").length > 0){
                                clearInterval(check);
                                resolve();
                            }
                        }, 3000);
                    })).then(async () => {
                        const tmpPinnedComment = $(`#comments #comment`).first();
                        const replyMessage = tasks.replyToPinned.comment;
                        if (tmpPinnedComment.length > 0 && tmpPinnedComment.find('pinned-comment-badge') !== 0) {
                            pinnedComment = tmpPinnedComment;
                            const replyBtn = pinnedComment.find('#reply-button-end #button').first();
                            replyBtn.simulate('click');

                            const replyInput = pinnedComment.find('#contenteditable-root[contenteditable=true]').first();
                            await sleep(200);
                            replyInput.simulate('click');
                            replyInput.simulate('focus');
                            await sleep(500);
                            replyInput.html(replyMessage);
                            await sleep(250 * replyMessage.length);
                            pinnedComment.find('#contenteditable-root[contenteditable=true]')[0].dispatchEvent(new Event('input', {
                                bubbles: true,
                                cancelable: true,
                            }));
                            await sleep(650);
                            $("ytd-button-renderer#submit-button paper-button#button").simulate("click");
                        } else {
                            // notfound
                            console.log('pinnedCommentBtnNotFound');
                            await skipTask(true);
                            window.location = "https://www.youtube.com";
                        }
                    })
                }, replyTimeout * 1000)
            }
        } else {
            if($('#postReplyHighlight').length == 0) {
                const replyBtn = $(`#comments #comment`).first().find('#reply-button-end #button').first();
                replyBtn.parent().css({position: 'relative'});
                replyBtn.after(`
                    <div id="postReplyHighlight" class="eh-yt-highlight">
                        <div class="eh-arrow">↑</div>
                        <div class="eh-text">` + getLocaleMsg('msgPostCommentHightlight') + `</div>
                    </div>
                `);
            }
        }
    };

    // simple function to check video dislike status
    let checkDislikeStatus = () => {
        let likeBtn = $('#primary.ytd-watch-flexy #menu-container #top-level-buttons ytd-toggle-button-renderer:nth-child(2) button');
        let status = likeBtn.attr('aria-pressed');
        // hide/show highlights
        if(status == 'true') {
            $('#dislikeBtnHighlight').remove();
        } else if($('#dislikeBtnHighlight').length == 0) {
            likeBtn.parents('ytd-toggle-button-renderer').first().after(`
            <div id="dislikeBtnHighlight" class="eh-yt-highlight">
                <div class="eh-arrow">↑</div>
                <div class="eh-text">` + getLocaleMsg('msgDislikeVideoHightlight') + `</div>
            </div>
            `);
        }

        if( status == dislikedStatus) {
            return;
        }
        dislikedStatus = status;

        if(status == 'true') {
            markTaskComplete('dislikeVideo');
        }
        else {
            markTaskIncomplete('dislikeVideo');
        }
    };

    let checkUserUnsubscribed = async () => {
        const btn = await waitForElement("#primary.ytd-watch-flexy #subscribe-button paper-button");
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(btn.getAttribute('subscribed') == null)
            }, 2000);
        })

    };

    // simple function to check subscribe status
    let checkSubscribeStatus = async () => {
        let btn = $('#primary.ytd-watch-flexy #subscribe-button paper-button');
        if (!btn) {
            return;
        }
        let status = btn.attr('subscribed');

        // hide/show highlights
        if(typeof status != 'undefined' || tasks['subscribeChannel'].isCompleted) {
            $('#subscribeBtnHighlight').remove();
        }
        else {
            if(isTabAutoWatching){
                if(!subscriptionScheduled) {
                    subscriptionScheduled = true;
                    let subscribeTimeout = 10;
                    if(tasks['watchVideo'].required && tasks['watchVideo'].watchDuration > 20) {
                        subscribeTimeout = chance.integer({min: 10, max: tasks['watchVideo'].watchDuration / 2});
                    }
                    log(`Subscription scheduled with ${subscribeTimeout} second delay`);
                    setTimeout(() => {
                        if (!tasks['subscribeChannel'].isCompleted) {
                            $('#meta #subscribe-button paper-button.ytd-subscribe-button-renderer:not([subscribed])').simulate("click");
                        }
                    }, subscribeTimeout * 1000);
                }
            }
            else{
                if($('#subscribeBtnHighlight').length == 0) {
                    $('#primary.ytd-watch-flexy #subscribe-button').append(`
                    <div id="subscribeBtnHighlight" class="eh-yt-highlight">
                        <div class="eh-arrow">↑</div>
                        <div class="eh-text">` + getLocaleMsg('msgSubscribeVideoHightlight') + `</div>
                    </div>
                    `);
                }
            }
        }

        if( status == subscribedStatus) {
            return;
        }
        subscribedStatus = status;
        if(typeof status != 'undefined') {
            markTaskComplete('subscribeChannel');
        }
        else {
            markTaskIncomplete('subscribeChannel');
        }
    };

    // simple function to check if comment posted and if not highlight the comment box
    let checkCommentStatus = () => {
        if(tasks['postComment'].isCompleted) {
            $('#postCommentHighlight').remove();
            return;
        }
        if(isTabAutoWatching){
            if(!commentScheduled) {
                commentScheduled = true;

                if(document.querySelector("#comments yt-formatted-string#message")){
                    reportTask("Premiere video").then(async () => {
                        await skipTask(true);
                    }).then(() => {
                        window.location = "https://www.youtube.com";
                    })
                }
                else {
                    commentTimeout = 10;

                    if(tasks['watchVideo'].required && tasks['watchVideo'].watchDuration > 31) {
                        commentTimeout = chance.integer({ min: 10, max: tasks['watchVideo'].watchDuration/3 });
                    }
                    log(`Comment scheduled with ${commentTimeout} second delay`);
                    setTimeout(() => {
                        new Promise((resolve) => {
                            $("html, body").animate({ scrollTop: $("ytd-comments#comments").position().top - 200 }, 1000, () => {
                                resolve();
                            });
                        }).then(() => new Promise((resolve) => {
                            let check = setInterval(() => {
                                if($("ytd-comment-simplebox-renderer #placeholder-area").length > 0){
                                    clearInterval(check);
                                    resolve();
                                }
                            }, 1000);
                        })).then(() => {
                            let commentMessage = tasks['postComment']['comment'];
                            $("ytd-comment-simplebox-renderer #placeholder-area").simulate("click");
                            setTimeout(() => {
                                $("#comment-dialog #contenteditable-root[contenteditable=true]").simulate("focus").html(commentMessage);
                                setTimeout(()=>{
                                    $("#comment-dialog #contenteditable-textarea")[0].dispatchEvent(new Event('input', {
                                        bubbles: true,
                                        cancelable: true,
                                    }));
                                    setTimeout(() => {
                                        $("#comment-dialog ytd-button-renderer#submit-button paper-button#button").simulate("click");
                                    }, 650);
                                }, commentMessage.length * 250);
                            }, 800);
                        })
                    }, commentTimeout * 1000);
                }
            }
        }
        else{
            if($('#postCommentHighlight').length == 0) {
                $('#primary.ytd-watch-flexy #comments #placeholder-area').after(`
                    <div id="postCommentHighlight" class="eh-yt-highlight">
                        <div class="eh-arrow">↑</div>
                        <div class="eh-text">` + getLocaleMsg('msgPostCommentHightlight') + `</div>
                    </div>
                `);
            }
        }
    };

    // simple function to highlight and show message to skip ad
    let showSkipAdHighlight = () => {
        if($('#skipAdHighlight').length) {
            return;
        }
        $('.ytp-ad-skip-button-slot:first').append(`
            <div id="skipAdHighlight" class="eh-yt-highlight">
                <div class="eh-arrow">↑</div>
                <div class="eh-text">` + getLocaleMsg('msgSkipAdHightlight') + `</div>
            </div>
        `);
    };

    // to hide highlight message of skip ad
    let hideSkipAdHighlight = () => {
        $('#skipAdHighlight').length && $('#skipAdHighlight').remove();
    };

    // Wrapper function to get video rank via background js in synchronous way
    let getRedirectURLs = () => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({action: 'getRedirectURLs'}, response => {
                resolve(response);
            });
        });
    };

    /**
     * Returns clean 3rd party URL
     * @param  string   url URL to clean
     * @return string   Cleaned URL
     */
    let clean3rdPartyURL = url => {
        url = url.toLowerCase();
        if(url.indexOf('?') > -1) {
            url = url.split('?')[0];
        }
        url = url.indexOf('https://') === 0 ? url.substr(8) : url;
        url = url.indexOf('http://') === 0 ? url.substr(7) : url;
        url = url.substr(-1) == '/' ? url.substr(0, url.length - 1) : url;
        url = url.indexOf('www.') === 0 ? url.substr(4) : url;
        return url;
    };

    let setupFocusCheckerForMobile = () => {
        let notificationShown = false;
        const text = getLocaleMsg('taskTabNotInFocusNotificationMessage');
        checkerIntervalId = setInterval(async () => {
            if (document.visibilityState === 'hidden') {
                if (!notificationShown) {
                    video.pause();
                    chrome.runtime.sendMessage({
                        action: 'createNotification',
                        text,
                    });
                    notificationShown = true;
                }
            } else {
                if (notificationShown) {
                    video.play();
                    notificationShown = false;
                }
            }
        }, 1500);
    };

    let setupFocusChecker = () => {
        if (isMobile()) {
            setupFocusCheckerForMobile();
        } else {
            chrome.runtime.sendMessage({
                action: 'setupFocusCheckerForDesktop',
            });
        }
        navigator.mediaSession.setActionHandler('play', function(e) {
            if(ifvisible.now()){
                video.play();
            }
        });
    };

    // initialization of tracker
    let init = async task => {
        if(isInit) {
            return;
        }

        log('videoTracker init call received');
        // if task found then init tracker else don't
        if(!task || task.campaignType != 'youtube') {
            return;
        }
        needToWatchAdsCount = task.needToWatchAdsCount;

        // check if video being watched is correct one
        let videoId = getParameterByName('v');
        if(!videoId) {
            log('videoId not found in URL', window.location.href);
            return;
        }

        if(videoId != task.videoId) {
            log('incorrect video', {
                videoId: videoId,
                taskVideoId: task.videoId
            });
            return;
        }

        // check for correct referral if it is third party visitType
        if(task.visitType == 'third-party') {
            let cleanThirdPartyURL = clean3rdPartyURL(task.thirdPartyURL);
            let redirectURLs = await getRedirectURLs();
            let referrerMatched = false;
            for(let i=0; i<redirectURLs.length; i++) {
                if(cleanThirdPartyURL == clean3rdPartyURL(redirectURLs[i])) {
                    referrerMatched = true;
                    break;
                }
            }
            if(!referrerMatched) {
                log('third party URL match failed', {
                    cleanThirdPartyURL: cleanThirdPartyURL,
                    redirectURLs: redirectURLs
                });
                ehPopup.alert(getLocaleMsg('msgIncorrectThirdPartyURL', [task.thirdPartyURL]));
                return false;
            }
        }

        // check that user has searched for keyword if visit type is search  
        if(task.visitType == 'search' && typeof task.convertedToDirect == 'undefined' && typeof task.searchDone == 'undefined') {
            log('video tracker started without search', task);
            return;
        }

        settings = await settingsModel.get(false).catch(exception => {});

        isInit = true;
        taskVideoId = task.videoId;
        $.each(tasks, (index) => {
            tasks[index] = $.extend(tasks[index], task.tasks[index]);
        });
        tasks.dislikeVideo.required = false;
        log('tasks to perform', task);

        currentTask = task;

        if(getParameterByName('t')) {
            vidResumeTime = parseFloat(getParameterByName('t'));
            log('vid will be resumed by yt', getParameterByName('t'))
        }

        waitForElement("yt-player-error-message-renderer").then(async () => {
            let reason = document.querySelector("yt-player-error-message-renderer #reason").innerText;
            await reportTask(reason);
            await skipTask(true);
            window.location = "https://www.youtube.com";
        });

        waitForElement(".ytp-offline-slate").then(async (element) => {
            if(element.style.display !== 'none'){
                await reportTask("Premiere video");
                await skipTask(true);
                window.location = "https://www.youtube.com";
            }
        });

        video = await waitForElement("video");
        startTracking();
        await video.pause();
        setupFocusChecker();
        await video.play();
        if (task.mustAlreadyBeSubscribed && await checkUserUnsubscribed(task)) {
            const strikesInfo = await strikeUser('user must already be subscribed to this channel', task.taskId, task.channelId);
            const strikesCount = strikesInfo.strikesCount <= 3 ? strikesInfo.strikesCount : 3;
            if (strikesCount > 0) {
                await video.pause();
                ehPopup.alert(getLocaleMsg('cheaterAlertMessage' + strikesCount), () => {
                    video.play();
                });
            }
        }
    };

    // removing tracker
    let clear = () => {
        wasInit = isInit;
        removeEventListeners();
        removeTaskStatusUI();
        lsInterval && clearInterval(lsInterval);
        pingInterval && clearInterval(pingInterval);
        clearInterval(checkerIntervalId);
        clearTimeout(videoLoadingCheckerTimeoutId);

        $('#subscribeBtnHighlight').length && $('#subscribeBtnHighlight').remove();
        $('#postCommentHighlight').length && $('#postCommentHighlight').remove();
        $('#skipAdHighlight').length && $('#skipAdHighlight').remove();
        $('#postReplyHighlight').length && $('#postReplyHighlight').remove();
        $('#likeCommentHighlight').length && $('#likeCommentHighlight').remove();

        video = null;
        seekAlerted = false;
        seekAlertVisible = false;
        taskVideoId = null;
        likedStatus = null;
        dislikedStatus = null;
        subscribedStatus = null;
        lsInterval = null;
        pingInterval = null;
        prevCurrentTime = null;
        updatePingInterval = 5;
        skipAttemptByKbTime = null;
        skipAttemptByMouseTime = null;
        skipAttemptVidTime = null;
        vidResumeTime = false;
        isInit = false;

        tasks = {
            watchVideo: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_watchVideo'),
                seconds: 0
            },
            likeVideo: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_likeVideo')
            },
            dislikeVideo: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_dislikeVideo')
            },
            subscribeChannel: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_subscribeChannel')
            },
            postComment: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_postComment'),
                comment: 'great video'
            },
            replyToPinned: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_replyToPinned'),
                comment: 'Thank You!'
            },
            likeComment: {
                required: false,
                isCompleted: false,
                text: getLocaleMsg('ytTask_likeComment'),
                comment: 'great video',
                underPinnedComment: false,
            }
        };
        return wasInit;
    };

    return {
        init: init,
        clear: clear
    };
})();