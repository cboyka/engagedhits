const userModel = (() => {

    // simple function to make API call to get user and store in local
    let getFromAPI = () => {
        return new Promise(async (resolve, reject) => {
            api.get('user')
            .then(response => {
                log('user api response', response);

                if(!response || response.type != 'success') {
                    reject(response);
                    return;
                }

                // save user in local storage so that next time we will not need API call
                let storeData = {
                    expireTimestamp: new Date().getTime() + (ENGAGEDHITS.LOCAL_CACHE_EXPIRE_TIME * 1000),
                    data: response.user
                };
                store.set('user', storeData);
                resolve(response.user);
            })
            .catch(exception => {
                log('user getFromAPI exception', exception);
                reject(exception);
            });
        });
    };

    // public function to get user
    let get = (fetchFromAPI) => {
        fetchFromAPI = typeof fetchFromAPI == 'undefined' ? true : fetchFromAPI;

        return new Promise(async (resolve, reject) => {
            // try to get user from local storage
            store.get('user')
            .then(response => {
                let currentTimestamp = new Date().getTime();
                log('user local', response);
                if(response && response.user.expireTimestamp > currentTimestamp) {
                    resolve(response.user.data);
                    return;
                }

                // if user not found in local reject promise to be handled in catch
                return Promise.reject();
            })
            .catch(() => {
                log('error or user not found in local storage');

                if(!fetchFromAPI) {
                    reject();
                    return;
                }
                
                // get user from API in case user not found in local or some exception occured. 
                // and then send user back by resolving promise
                getFromAPI()
                .then(user => resolve(user))
                .catch(exception => reject(exception));
            });
        });
    };

    return {
        get: get
    };
})();