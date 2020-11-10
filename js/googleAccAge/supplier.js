$(function(){
    log('Google account age supplier loaded');

    let popupWindow;
    let supplyFirstMailDateEventRec = false;
    let popupWindowTimer = false;
    let popupWindowMaxTimer = false;

    // keep listeing to onMessage event
    chrome.runtime.onMessage.addListener((msg, sender, callback) => {
        switch(msg['action']) {

            // received from background.js when first email date found
            case 'supplyFirstMailDate':
                popupWindowMaxTimer && clearInterval(popupWindowMaxTimer);
                popupWindowTimer && clearInterval(popupWindowTimer);
                supplyFirstMailDateEventRec = true;
                popupWindow.close();
                log('supplyFirstMailDate event received');

                chrome.storage.local.get([
                    'firstPOPMailDate',
                    'firstInboxMailDate',
                    'firstSentMailDate',
                    'primaryEmail'
                ], response => {
                    if (typeof response != 'undefined') {
                        log('firstMailDates', response);
                        chrome.storage.local.remove([
                            'firstPOPMailDate',
                            'firstInboxMailDate',
                            'firstSentMailDate',
                            'primaryEmail',
                            'googleAccSupplierTabID'
                        ]);
                        
                        // inject dates in DOM
                        $('body').append($('<div/>').css('display', 'none').attr('id', 'firstPOPMailDate').text(response['firstPOPMailDate']));
                        $('body').append($('<div/>').css('display', 'none').attr('id', 'firstInboxMailDate').text(response['firstInboxMailDate']));
                        $('body').append($('<div/>').css('display', 'none').attr('id', 'firstSentMailDate').text(response['firstSentMailDate']));
                        $('body').append($('<div/>').css('display', 'none').attr('id', 'primaryEmail').text(response['primaryEmail']));

                        // trigger event to update hosting page that dates are found and pick it from DOM.
                        // NOTE: event data passing do not work when event trigerred from content script to hosting page
                        triggerDocEvent('firstMailDatesFound');

                    } else {
                        log('googleAccSupplierTabID error', error);
                    }
                });
                break;
        }

        return true;
    });

    // listent to message event
    window.addEventListener('message', event => {
        // same window source required. and 'getFirstMailDates' action to be processed only
        if(event.source != window || event.data.action != 'getFirstMailDates') {
            return;
        }

        log('getFirstMailDates event received');

        // first get tab ID and save it for later use in background.js to receive message back
        chrome.runtime.sendMessage({action: 'returnTabID'}, response => {
            log('googleAccSupplierTabID', response.tabID);
            
            // save tab ID in local store for later use
            chrome.storage.local.set({'googleAccSupplierTabID': response.tabID}, () => {
                log('googleAccSupplierTabID saved in local');

                // open gmail inbox URL. 
                // this will auto trigger finder.js via content-script injection configured through manifest
                popupWindow = window.open(ENGAGEDHITS.GMAIL_INBOX_URL);

                popupWindowTimer = setInterval(function(){
                    if(popupWindow.closed && popupWindowTimer) {
                        log('finder window closed by user');

                        clearTimeout(popupWindowMaxTimer);
                        clearInterval(popupWindowTimer);
                        popupWindowTimer = false;
                        popupWindowMaxTimer = false;

                        // remove supplier tab ID from local storage
                        chrome.storage.local.remove('googleAccSupplierTabID');

                        // trigger event to update hosting page that dates are not found
                        triggerDocEvent('firstMailDatesNotFound');
                    }
                }, 100);

                // wait for 1 minute for finder to process and extract dates else close popup and trigger error
                popupWindowMaxTimer = setTimeout(() => {
                    log('timed out. closed finder and sent error back to host page');

                    popupWindowTimer && clearInterval(popupWindowTimer);
                    popupWindowTimer = false;
                    
                    // remove supplier tab ID from local storage
                    chrome.storage.local.remove('googleAccSupplierTabID');

                    // close popup window
                    popupWindow.close();

                    // trigger event to update hosting page that dates are not found
                    triggerDocEvent('firstMailDatesNotFound');
                }, 1000 * 120);
            });
        });
    });

    $('body').append($('<div/>').css('display', 'none').attr('id', 'ehgase'));
});