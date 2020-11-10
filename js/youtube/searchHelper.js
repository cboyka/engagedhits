const searchHelper = (function(){

    // flag to keep status if search helper is initialized or not
    // Needed, in case when search is happening multiple times to avoid registering event listeners more than one time
    let isInit = false;
    
    // To store timer ID of video search loop
    let searchVideoTimer;

    // to store count of search attempts in one go
    let searchCount = 0;

    // to store status if video is found or not
    let videoFound = false;

    // to store status if fideo is not found
    let videoNotFound = false;

    // to hold video HTML element reference when video found
    let videoBlock;

    // to store status of keyword match 
    let keywordMatched = false;

    // to hold task information for global use within this helper
    let currentTask;
    
    let videoRank;

    let country;

    let maxVideosToSearch;

    let searchResponseTimer = null;

    /**
     * DOMNodeInserted event handler
     * it will suppress further processing until all nodes are inserted by use of timer
     */
    let waitForSearchResult = () => {
        if(!keywordMatched) {
            return;
        }
        searchResponseTimer && clearTimeout(searchResponseTimer) && log('searchResponseTimer cleared');
        searchVideoTimer && clearTimeout(searchVideoTimer);
        searchVideoTimer = setTimeout(searchForVideo, 1000);
    };

    /**
     * Method to search for video in youtube search result HTML. 
     * if not found and max video search is not reached, it will scroll page to bottom
     */
    let searchForVideo = () => {
        
        if(videoFound || videoNotFound) {
            return;
        }

        $('ytd-search ytd-item-section-renderer > #contents ytd-video-renderer a#thumbnail').each((index, thumbnail) => {
            let videoId = getParameterByName('v', $(thumbnail).attr('href'));
            if(videoId && videoId == currentTask.videoId) {
                videoBlock = $(thumbnail).parents('ytd-video-renderer').first();
                videoFound = true;
                if(!videoRank || typeof videoRank == 'undefined') {
                    chrome.runtime.sendMessage({
                        action: 'saveVideoRank',
                        videoId: currentTask.videoId,
                        country: country,
                        keywordHash: currentTask.keywordHash,
                        rank: index + 1
                    });
                }
            }
        });

        if(videoFound) {
            log('videoFound');
            searchVideoTimer && clearTimeout(searchVideoTimer);

            setTimeout(function(){
                $(videoBlock).find("a[href^='/watch']").attr('href', '/watch?v=' + currentTask.videoId);
                $(videoBlock).addClass('eh-video-found');
                
                if(!isTabAutoWatching){
                    $(videoBlock).append(`
                        <div id="clickVidHighlight" class="eh-yt-highlight">
                            <div class="eh-arrow">↑</div>
                            <div class="eh-text">` + getLocaleMsg('msgClickOnThisVideo') + `</div>
                        </div>
                    `);
                }

                new Promise((resolve) => {
                    $("html, body").animate({ scrollTop: $(videoBlock).position().top }, 1000, () => {
                        resolve();
                    });
                }).then(async () => {
                    ehPopup.hide();
                    currentTask.searchDone = true;
                    await taskModel.searchDone();
                    if(isTabAutoWatching){
                        setTimeout(()=>{
                            log("Auto click by video at the search results");
                            $(videoBlock).find(".text-wrapper.style-scope.ytd-video-renderer").simulate("click");
                        }, 2000);
                    }
                });
            }, 2000);
            log('videoFound');
            
            return;
        }
        
        // check if max video search limit reached
        let resultVideosCount = $('ytd-search ytd-item-section-renderer > #contents ytd-video-renderer').length;
        if(resultVideosCount >= maxVideosToSearch) {
            log('video not found in top results');
            takeVideoNotFoundAction();
            return;
        }
        
        setTimeout(function(){
            $("html, body").animate({ scrollTop: $(document).height() }, (1000 + Math.floor(Math.random() * 5000)), 'swing');
            log('page scrolled down')
        }, 2000);

        searchResponseTimer = setTimeout(() => {
            log('video not found in search');
            takeVideoNotFoundAction(true);
        }, 1000 * 20);
    };

    /**
     * Common function to execute actions of video not found in search results
     */
    let takeVideoNotFoundAction = (isEmptyResult) => {
        videoNotFound = true;
        ehPopup.hide();
        if(isTabAutoWatching){
            openDirectWatch();
        }
        else{
            if(typeof isEmptyResult != 'undefined' && isEmptyResult) {
                ehPopup.alert(getLocaleMsg('msgNoVideoVideoFound'), () => {
                    openDirectWatch();
                });
            }
            else {
                ehPopup.alert(getLocaleMsg('msgCantFindVideoInSearchResults', [maxVideosToSearch]), () => {
                    openDirectWatch();
                });
            }
        }

        chrome.runtime.sendMessage({
            action: 'saveVideoRank',
            videoId: currentTask.videoId,
            country: country,
            keywordHash: currentTask.keywordHash,
            rank: -1
        });
    };

    // Wrapper function to get video rank via background js in synchronous way
    let getVideoRank = (videoId, country, keywordHash) => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'getVideoRank',
                videoId: videoId,
                country, country,
                keywordHash: keywordHash
            }, response => {
                if(!response) {
                    reject();
                    return;
                }
                resolve(response);
            });
        });
    };

    let openDirectWatch = () => {
        log('open direct watch call received');
        taskModel.convertToDirect()
        .then(() => {
            log('opening direct watch');
            window.location.replace('https://www.youtube.com/watch?v=' + currentTask.videoId);
        }).catch(exception => {
            ehPopup.alert(getLocaleMsg('msgSomethingWentWrong'));
        });
    };

    /**
     * search helper init action
     */
    let init = async (task, param_maxVideosToSearch) => {
        log('searchHelper init call received', {
            isInit: isInit,
            task: task,
            param_maxVideosToSearch: param_maxVideosToSearch
        });
        if(isInit || !task || task.campaignType != 'youtube' || task.visitType != 'search') {
            return;
        }

        // check if search keyword is expected
        let searchQuery = getParameterByName('search_query');
        log('searchQuery', searchQuery);
        if(!searchQuery) {
            return;
        }
        
        if(!searchQuery || searchQuery != task.keyword) {
            return;
        }

        maxVideosToSearch = parseInt(param_maxVideosToSearch);
        country = $('#country-code').length && $('#country-code').text().trim() != '' ? $('#country-code').text() : 'US';
        currentTask = task;
        videoRank = await getVideoRank(task.videoId, country, task.keywordHash).catch(exception => {videoRank = false;});
        log('videoRank', videoRank);
        if(videoRank && (videoRank == -1 || parseInt(videoRank) > maxVideosToSearch)) {
            if(isTabAutoWatching){
                openDirectWatch()
            }else{
                ehPopup.alert(getLocaleMsg('msgVideoRankTooLow'), () => {
                    openDirectWatch();
                });
            }
            return;
        }

        ehPopup.alert(getLocaleMsg('msgSearchingVideo'), '', false);
        keywordMatched = true;
        $(document).on('DOMNodeInserted', 'ytd-search ytd-item-section-renderer > #contents', waitForSearchResult);
        $(document).on('click', 'ytd-search ytd-item-section-renderer > #contents ytd-video-renderer', function(event){
            videoBlock && $(videoBlock).removeClass('eh-video-found');
            $('#clickVidHighlight').length && $('#clickVidHighlight').remove();
            event.preventDefault();
            event.stopPropagation();
            taskModel.searchDone();
        });
        searchForVideo();

        isInit = true;
    };

    /**
     * To clear the search helper configs and event listeners
     * @return void
     */
    let clear = () => {
        isInit = false;
        searchCount = 0;
        searchCountMax = 5;
        videoFound = false;
        keywordMatched = false;
        searchVideoTimer = null;
        searchResponseTimer = null;
        $(document).off('DOMNodeInserted', 'ytd-search ytd-item-section-renderer > #contents', waitForSearchResult);
        $('.eh-video-found').length && $('.eh-video-found').removeClass('eh-video-found');
        $('#clickVidHighlight').length && $('#clickVidHighlight').remove();
    }

    /**
     * Return publicly available properties and methods
     */
    return {
        init: init,
        clear: clear
    }
})();