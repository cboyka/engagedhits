const ehPopup = (() => {

    const popupHTMLtemplate = `
        <div id="ehPopupAlert">
            <div class="eh-alert-header"><img src="` + chrome.runtime.getURL('images/logos/engagedhits.png') + `"></div>
            <div class="eh-alert-body">{{message}}</div>
            <div class="eh-alert-footer"><a href="javascript:void(0)" rel="modal:close">{{btnLabel}}</button></div>
        </div>
    `;

    let showAlert = (message, callback, showOkBtn, btnLabel = "OK") => {
        showOkBtn = typeof showOkBtn == 'undefined' ? true : showOkBtn;
        let popupHTML = popupHTMLtemplate.replace('{{message}}', message);
        popupHTML = popupHTML.replace('{{btnLabel}}', btnLabel);
        $('body').append(popupHTML);
        $('#ehPopupAlert').modal({
            escapeClose: false,
            clickClose: false,
            showClose: false
        });
        
        let tempCallback = () => {
            $('#ehPopupAlert .eh-alert-footer a').off('click', tempCallback);
            $('#ehPopupAlert').remove();;
            typeof callback == 'function' && callback();
        };
        $('#ehPopupAlert .eh-alert-footer a').show().on('click', tempCallback);
        
        if(!showOkBtn) {
            $('#ehPopupAlert .eh-alert-footer a').hide();
        }
    };

    let hide = () => {
        if($('#ehPopupAlert').length == 0) {
            return;
        }
        $('#ehPopupAlert .eh-alert-footer a').trigger('click');
    };

    return {
        alert: showAlert,
        hide: hide
    };
})();