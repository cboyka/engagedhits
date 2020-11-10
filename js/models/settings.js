const settingsModel = (() => {

    // simple function to make API call to get setting and store in local
    let getFromAPI = () => {
        return new Promise(async (resolve, reject) => {
            let currentExtVersion = chrome.app.getDetails().version;
            api.get('settings?version=' + currentExtVersion)
            .then(response => {
                log('settings api response', response);

                if(!response || response.type != 'success') {
                    reject(response);
                    return;
                }

                // save settings in local storage so that next time we will not need API call
                let storeData = {
                    expireTimestamp: new Date().getTime() + (ENGAGEDHITS.LOCAL_CACHE_EXPIRE_TIME * 1000),
                    data: response.settings
                };
                store.set('settings', storeData);
                resolve(response.settings);
            })
            .catch(exception => {
                log('settings getFromAPI exception', exception);
                reject(exception);
            });
        });
    };

    // public function to get settings
    let get = (fetchFromAPI) => {
        fetchFromAPI = typeof fetchFromAPI == 'undefined' ? true : fetchFromAPI;

        return new Promise(async (resolve, reject) => {
            // try to get settings from local storage
            store.get('settings')
            .then(response => {
                let currentTimestamp = new Date().getTime();
                log('settings local', response);
                if(response && response.settings.expireTimestamp > currentTimestamp) {
                    resolve(response.settings.data);
                    return;
                }

                // if settings not found in local reject promise to be handled in catch
                return Promise.reject();
            })
            .catch(() => {
                log('error or settings not found in local storage');

                if(!fetchFromAPI) {
                    reject();
                    return;
                }
                
                // get settings from API in case settings not found in local or some exception occured. 
                // and then send settings back by resolving promise
                getFromAPI()
                .then(settings => resolve(settings))
                .catch(exception => reject(exception));
            });
        });
    };

    return {
        get: get
    };
})();