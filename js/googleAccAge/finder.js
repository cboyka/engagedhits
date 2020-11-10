$(function(){
    
    // lookup timer settings
    let lookup = {
        page: null,
        timer: null,
        interval: 250,
        count: 0,
        maxTry: 250
    };

    let isWindowLoaded = false;

    /**
     * Common method to handle successful or failed POP setting finder and initate next step
     * @param  string   firstPOPMailDate  date of first email according to POP setting
     * @return void
     */
    let endPOPSettingFinder = firstPOPMailDate => {
        lookup.timer && clearInterval(lookup.timer);
        chrome.storage.local.set({'firstPOPMailDate': firstPOPMailDate});
        setTimeout(() => {
            window.stop();
            window.location.replace(ENGAGEDHITS.GMAIL_ACC_SETTING_URL);
            lookup.count = 0;
            lookup.page = 'accSetting';
            lookup.timer = setInterval(findPrimaryEmail, lookup.interval);
        }, 3000);
    }

    /**
     * Common method to handle successful or failed primary email finder and initate next step
     * @param  string   primaryEmail  primary email of user
     * @return void
     */
    let endPrimaryEmailFinder = primaryEmail => {
        lookup.timer && clearInterval(lookup.timer);
        chrome.storage.local.set({'primaryEmail': primaryEmail});
        chrome.runtime.sendMessage({action: 'firstMailDatesFound'});
    }

    /**
     * Common method to handle successful or failed inbox finder and initate next step
     * @param  string   firstInboxMailDate  date of first email received
     * @return void
     */
    let endInboxFinder = firstInboxMailDate => {
        lookup.timer && clearInterval(lookup.timer);
        chrome.storage.local.set({'firstInboxMailDate': firstInboxMailDate});
        setTimeout(() => {
            window.stop();
            window.location.replace(ENGAGEDHITS.GMAIL_SENT_BOX_URL);
            window.location.reload();
        }, 3000);
    }

    /**
     * Common method to handle successful or failed Send BOX finder, send extracted info back and close window
     * @param  string   firstSentMailDate  date of first sent email
     * @return void
     */
    let endSentBoxFinder = firstSentMailDate => {
        lookup.timer && clearInterval(lookup.timer);
        chrome.storage.local.set({'firstSentMailDate': firstSentMailDate});
        setTimeout(() => {
            window.stop();
            window.location.replace(ENGAGEDHITS.GMAIL_POP_SETTING_URL);
        }, 3000);
    }

    /**
     * To find first mail date by looking into POP setting of gmail
     * @return void
     */
    let findByPOPSetting = () => {
        lookup.count++;
        log('findByPOPSetting called. Attempt # ', lookup.count);
        
        // if POP setting HTML element found
        let element = $('span:contains("POP download:")');
        if(element.length) {

            // stop timer
            clearInterval(lookup.timer);
            log('POP download setting found. Attempt # = ', lookup.count);

            // find date from HTML text
            let firstMailDate = null;
            let textTd = $(element).parent('td').next();
            if(textTd) {
                $(textTd).find('>div:first-child div, table, span').remove();
                let firstMailText = $(textTd).find('>div:first-child').text();
                log('POP setting first mail text', firstMailText);

                // check if POP setting text has arrived since text. if so extract date and send it back
                if(firstMailText.indexOf('arrived since') > -1) {
                    firstMailDate = $.trim(firstMailText).split(' ').pop();
                    firstMailDate = moment(firstMailDate, 'D/MM/YY').format('Y-MM-DD');
                    log('POP setting first mail date found', firstMailDate);
                    endPOPSettingFinder(firstMailDate);
                }
            }
            else {
                log('POP setting controls TD not found');
            }

            // if time not found still, stop timer and initiate inbox method
            if(!firstMailDate) {
                log('POP setting first mail date not found');
                endPOPSettingFinder('-');
            }
            return;
        }

        // if maxTry limit reached, stop timer and initiate inbox method
        if(lookup.count == lookup.maxTry) {
            log('POP download setting not found. findByPOPSetting stopped. Attempt # = ', lookup.count);
            endPOPSettingFinder('-');
        }
    }

    /**
     * To find last page number of email listing in inbox or sent box
     * @return void
     */
    let findLastEmailListingPage = () => {
        lookup.count++;
        log('findLastEmailListingPage called. Attempt # ', lookup.count);

        // look for div where page numbers are available
        let pagesText = $("div[aria-label*='Show more messages']").first().text();
        if(pagesText) {

            // stop timer
            clearInterval(lookup.timer);
            log('paging numbers found. Attempt # = ', lookup.count);

            // check if page numbers text has at least 3 words. It would be in form of '1-32 of 4848'
            let pagesWords = pagesText.split(' ');
            if(pagesWords.length <= 2) {
                log('Unrecognizable page numbers. findLastEmailListingPage stopped. Attempt # = ', lookup.count);
                endInboxFinder('-');
            }

            // extract paging information from page number text
            let totalRecords = parseInt(pagesWords.pop().replace(/\,/g, ''));
            let recordsPerPage = parseInt(pagesWords[0].split('–').pop().replace(/\,/g, ''));
            let lastPageNum = Math.ceil(totalRecords / recordsPerPage);
            log('paging info found', {
                attempts:lookup.count, 
                totalRecords: totalRecords,
                recordsPerPage: recordsPerPage,
                lastPageNum: lastPageNum
            });

            // in case only one page, initate next step of finding date instead of redirecting to last page URL.
            // Google redirects back to sent box URL, in case of only page and we redirect to last page URL. i.e. page 1
            if(lastPageNum == 1) {
                lookup.count = 0;
                findFirstEmailDate();
                return;
            }

            setTimeout(() => {
                window.stop();

                // stop timer and redirect to page URL
                if(lookup.page == 'inbox') {
                    window.location.replace(ENGAGEDHITS.GMAIL_INBOX_PAGE_URL + lastPageNum);
                }
                else {
                    window.location.replace(ENGAGEDHITS.GMAIL_SENT_BOX_PAGE_URL + lastPageNum);
                }
                window.location.reload();
            }, 3000);
            return;
        }

        // if maxTry limit reached, stop timer and initiate next method
        if(lookup.count == lookup.maxTry || (isWindowLoaded && !pagesText)) {
            log('Paging info not found. findLastEmailListingPage stopped. Attempt # = ', lookup.count);
            if(lookup.page == 'inbox') {
                endInboxFinder('-');
            }
            else {
                endSentBoxFinder('-');
            }
        }
    }

    /**
     * To find first email date from email listing page
     * @return void
     */
    let findFirstEmailDate = () => {
        lookup.count++;
        log('findFirstEmailDate called. Attempt # ', lookup.count);

        // check if at least one thread ID span exists
        let threadIDSpan = $('span[data-thread-id]:first');
        if(threadIDSpan.length) {

            // stop timer
            clearInterval(lookup.timer);
            log('email listing found. Attempt # = ', lookup.count);

            // get date information of last email from email listing
            let firstMailDate = $('span[data-thread-id]:first').parents('tbody').find('tr:last td').eq(-2).find('span').attr('title');
            firstMailDate = moment(firstMailDate.split(',').splice(1).join(','), 'MMM DD, YYYY').format('Y-MM-DD');
            log('first mail date found', firstMailDate);

            // end execution according to the page/method
            if(lookup.page == 'inbox') {
                endInboxFinder(firstMailDate);
            }
            else {
                endSentBoxFinder(firstMailDate);
            }
            return;
        }

        // if maxTry limit reached, stop timer and initiate next method
        if(lookup.count == lookup.maxTry) {
            log('last email not found. findFirstEmailDate stopped. Attempt # = ', lookup.count);
            if(lookup.page == 'inbox') {
                endInboxFinder('-');
            }
            else {
                endSentBoxFinder('-');
            }
        }
    }

    /**
     * To find primaru email from account settings page
     * @return void
     */
    let findPrimaryEmail = () => {
        lookup.count++;
        log('findPrimaryEmail called. Attempt # ', lookup.count);

        let sendEmailAsSpan = $("span:contains('Send mail as:')");
        if(sendEmailAsSpan.length) {
            // stop timer
            clearInterval(lookup.timer);
            log('primary account info span found. Attempt # = ', lookup.count);

            let primaryEmail = '-'
            let accountTRs = $(sendEmailAsSpan).parents('td:first').next().find('tr');
            for(let i=0; i<accountTRs.length-1; i++) {
                let secondTDText = $(accountTRs[i]).find('td').eq(1).text().trim();
                if(secondTDText == 'default' || secondTDText == '') {
                    let accInfoText = $(accountTRs[i]).find('td:first').text().trim();
                    if(accInfoText.indexOf('<') > -1) {
                        primaryEmail = accInfoText.split('<').pop().replace('>', '');
                        break;
                    }
                }
            }

            // end execution
            endPrimaryEmailFinder(primaryEmail);
            return;
        }

        // if maxTry limit reached, stop timer and initiate next method
        if(lookup.count == lookup.maxTry) {
            log('primary account info not found. findPrimaryEmail stopped. Attempt # = ', lookup.count);
            endPrimaryEmailFinder('-');
        }
    }

    /**
     * Handles window load event and extract info based on URL
     * @return void
     */
    let startFinder = () => {
        // if current status is to check by pop setting
        if(window.location.href == ENGAGEDHITS.GMAIL_POP_SETTING_URL) {
            // start timer to find date from POP setting
            lookup.count = 0;
            lookup.page = 'popSetting';
            lookup.timer = setInterval(findByPOPSetting, lookup.interval);
        }

        else if(window.location.href == ENGAGEDHITS.GMAIL_ACC_SETTING_URL) {
            // start timer to find primary acount info
            lookup.count = 0;
            lookup.page = 'accSetting';
            lookup.timer = setInterval(findPrimaryEmail, lookup.interval);
        }

        else if(window.location.href == ENGAGEDHITS.GMAIL_INBOX_URL) {
            // start timer to find last inbox page
            lookup.count = 0;
            lookup.page = 'inbox';
            lookup.timer = setInterval(findLastEmailListingPage, lookup.interval);
        }

        else if(window.location.href.indexOf(ENGAGEDHITS.GMAIL_INBOX_PAGE_URL) > -1) {
            // start timer to find date of first inbox email
            lookup.count = 0;
            lookup.page = 'inbox';
            lookup.timer = setInterval(findFirstEmailDate, lookup.interval);
        }

        else if(window.location.href == ENGAGEDHITS.GMAIL_SENT_BOX_URL) {
            // start timer to find last sent page
            lookup.count = 0;
            lookup.page = 'sentBox';
            lookup.timer = setInterval(findLastEmailListingPage, lookup.interval);
        }

        else if(window.location.href.indexOf(ENGAGEDHITS.GMAIL_SENT_BOX_PAGE_URL) > -1) {
            // start timer to find date of first sent email
            lookup.count = 0;
            lookup.page = 'sentBox';
            lookup.timer = setInterval(findFirstEmailDate, lookup.interval);
        }
        else {
            window.stop();
            window.location.replace(ENGAGEDHITS.GMAIL_INBOX_URL);
            window.location.reload();
        }
    }

    /**
     * Starts finder by querying supplier tab ID from background script. 
     * This ensures we do not start finder on normal gmail browsing
     */
    chrome.storage.local.get('googleAccSupplierTabID', response => {
        if (typeof response['googleAccSupplierTabID'] != 'undefined') {
            
            // start finding first mail date, after window is loaded
            startFinder();

            // show please wait message and block UI, so we can avoid user action
            let logoURL = chrome.runtime.getURL('images/logos/engagedhits.png');
            $.blockUI({
                message: `
                    <div class="logoWrap"><img src="` + logoURL + `" /></div>
                    <div class="waitMsg">` + getLocaleMsg('pleaseWait') + `</div>
                `
            });

            log('Google account age finder activated');
        }
    });

    // mark window loaded flag true
    window.addEventListener('load', () => {
        isWindowLoaded = true;
    }, false);
});