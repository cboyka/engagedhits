const api = (() => {

    let get = (url) => {
        return new Promise((resolve, reject) => {
            let requestURL = ENGAGEDHITS.API_ENDPPOINT + url;
            $.ajax({
                type: 'get',
                url: requestURL,
                dataType: 'json',
                success: (response) => {
                    resolve(response);
                },
                error: (error) => {
                    log(error);
                    let rejectData = {
                        error: error.status == '401' ? 'unauthorized' : 'httpErrorCode-' + error.status
                    };

                    if(typeof error.responseText != 'undefined' && error.responseText) {
                        let responseJSON = $.parseJSON(error.responseText);
                        if(typeof responseJSON.feedbacks != 'undefined') {
                            rejectData.feedbacks = responseJSON.feedbacks;
                        }
                    }
                    reject(rejectData);
                }
            });
        });
    };

    let post = (url, data, contentType) => {
        return new Promise((resolve, reject) => {
            let requestURL = ENGAGEDHITS.API_ENDPPOINT + url;
            let ajaxParams = {
                type: 'post',
                url: requestURL,
                dataType: 'json',
                data: data,
                success: (response) => {
                    resolve(response);
                },
                error: (error) => {
                    log(error);
                    let rejectData = {
                        error: error.status == '401' ? 'unauthorized' : 'httpErrorCode-' + error.status
                    };

                    if(typeof error.responseText != 'undefined' && error.responseText) {
                        let responseJSON = $.parseJSON(error.responseText);
                        if(typeof responseJSON.feedbacks != 'undefined') {
                            rejectData.feedbacks = responseJSON.feedbacks;
                        }
                    }
                    reject(rejectData);
                }
            };

            if(typeof contentType != 'undefined' && contentType == 'json') {
                ajaxParams.contentType = 'application/json';
                ajaxParams.data = JSON.stringify(data);
            }
            $.ajax(ajaxParams);
        });
    };

    return {
        get: get,
        post: post
    };

})();