window.logCollection = [];

/** 
 * Returns value of given parameter name from URL or current window URL
 * @param  string 	name  	Name of paramer
 * @param  string 	url   	Optional. URL from which parameter value will be extracted
 * @return mixed        	NULL, empty or paramter value string
 */
let getParameterByName = (name, url) => {
    if (!url) url = window.location.href;
    name          = name.replace(/[\[\]]/g, '\\$&');
    const regex   = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'), results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Creates AJAX request object and returns it
 * @param  string  method        	Request method type (GET, POST, PUT, DELETE, OPTIONS)
 * @param  string  url           	Request URL
 * @param  Boolean isBlockingReq 	Boolean flag to create blocking request
 * @return object					XMLHttpRequest object
 */
let createAjaxRequest = (method, url, isBlockingReq) => {
	isBlockingReq = typeof isBlockingReq == 'undefined' ? false : isBlockingReq;
	let hdl = new XMLHttpRequest();
	hdl.open(method, url, !isBlockingReq);
	return hdl;
}

/**
 * Returns locale message/string based on key provided and replacement strings
 * @param  string   key             Locale message key
 * @param  array    replacements    Optional. Replacement strings array
 * @return string                   Locale message string
 */
let getLocaleMsg = (key, replacements) => {
    if(typeof replacements == 'undefined') {
        replacements = [];
    }
    return chrome.i18n.getMessage(key, replacements);
}

/**
 * To log data in console based on environment configuration
 * @param  any  param1 Anything to log
 * @param  any  param2 Optional. Second item to log on same line
 * @return void
 */
let log = (param1, param2) => {
    let d = new Date();
    let time = d.getHours() + ':' + d.getSeconds() + '.' + d.getMilliseconds();

    let isBgScript = false;
    if(window.location.protocol == "chrome-extension:" && window.location.href.indexOf('_generated_background_page.html') > -1) {
        window.logCollection.push([time, param1, param2]);
        isBgScript = true;
    }
    
    // don't create log for prod env
    if(ENGAGEDHITS.ENV == 'prod') {
        return;
    }

    if(isBgScript) {
        if(typeof param2 != 'undefined') {
            console.log(time, param1, param2);
        }
        else {
            console.log(time, param1);
        }
    }
    else {
        chrome.runtime.sendMessage({
            action: 'writeLog',
            time: time,
            param1: param1,
            param2: typeof param2 == 'undefined' ? '' : param2
        });
    }
}

/**
 * Javascript way to trigger event in content script
 * @param  string   eventName   Name of event
 * @param  mixed    data        Event data
 * @return void
 */
let triggerDocEvent = (eventName, data) => {
    var event = document.createEvent('Event');
    event.initEvent(eventName);
    if(typeof data != 'undefined') {
        event.detail = data;
    }
    document.dispatchEvent(event);
    log('event dispatched', eventName);
}

// to copy text from input element
let copyInputText = function() {
    var elem = document.getElementById($(this).data('copyEle'));
    var currentFocus = document.activeElement;
    elem.focus();
    elem.select();
    var isCopied = false;
    try {
        isCopied = document.execCommand("copy");
    } catch(e) {
        isCopied = false;
    }

    if (currentFocus && typeof currentFocus.focus === "function") {
        currentFocus.focus();
    }

    if(!isCopied) {
        alert(getLocaleMsg('msgErrCopyText'))
    }
    else {
        let btn = this;
        $(this).text(getLocaleMsg('copied'));
        setTimeout(() => {
            $(btn).text(getLocaleMsg('copy'));
        }, 2000);
    }

    return isCopied;
};

let hasAdBlocker = () => {
    return new Promise(async (resolve, reject) => {
        let v = + new Date();
        let ads = await fetch(ENGAGEDHITS.WEBSITE_URL + `/ads.html?v=${v}`)
        .catch(exception => log('ads.html load exception'));
        if(ads) resolve(false);
        else resolve(true);
    });
};