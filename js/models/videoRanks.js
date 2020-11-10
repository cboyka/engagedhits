const videoRanksModel = (() => {

    // simple function to make API call to get video rank and store in local
    let getFromAPI = (videoId, country, keywordHash) => {
        return new Promise((resolve, reject) => {
            api.get('video_ranks/getLatestRank/' + videoId + '/' + country + '/' + keywordHash)
            .then(response => {
                log('videoRanks api response', response);

                if(!response || response.type != 'success') {
                    reject(response);
                    return;
                }

                if(typeof response.data.rank == 'undefined') {
                    resolve();
                    return;
                }

                let vrKey = 'vr_' + videoId + '_' + country + '_' + keywordHash;

                // save rank in local storage so that next time we will not need API call
                store.set(vrKey, {
                    expireTimestamp: (response.data.expireTimestamp - (new Date().getTimezoneOffset() * 60)) * 1000,
                    rank: response.data.rank
                });
                resolve(response.data.rank);
            })
            .catch(exception => {
                log('videoRanks getFromAPI exception', exception);
                reject(exception);
            });
        });
    };

    // public function to get rank
    let get = (videoId, country, keywordHash, fetchFromAPI) => {
        fetchFromAPI = typeof fetchFromAPI == 'undefined' ? true : fetchFromAPI;

        return new Promise((resolve, reject) => {
            let vrKey = 'vr_' + videoId + '_' + country + '_' + keywordHash;
            // try to get videoRank from local storage
            store.get(vrKey)
            .then(response => {
                log('video rank local for ' + vrKey, response);

                let currentTimestamp = new Date().getTime();
                if(response && response[vrKey].expireTimestamp > currentTimestamp) {
                    resolve(response[vrKey].rank);
                    return;
                }

                // if rank not found in local reject promise to be handled in catch
                return Promise.reject();
            })
            .catch(() => {
                log('error or video rank not found in local storage', vrKey);

                if(!fetchFromAPI) {
                    reject();
                    return;
                }

                // get rank from API in case rank not found in local or some exception occured. 
                // and then send rank back by resolving promise
                getFromAPI(videoId, country, keywordHash)
                .then(rank => resolve(rank))
                .catch(exception => reject(exception));
            });
        });
    };

    /**
     * To send api request for saving video rank
     * @return void
     */
    let save = (videoId, country, keywordHash, rank) => {
        return new Promise((resolve, reject) => {
            api.post('video_ranks/save', {
                videoId: videoId,
                country: country,
                rank: rank,
                keywordHash: keywordHash
            })
            .then(response => {
                if(response && response.type == 'success') {

                    // save rank in local storage so that next time we will not need API call
                    let vrKey = 'vr_' + videoId + '_' + country + '_' + keywordHash;
                    store.set(vrKey, {
                        expireTimestamp: new Date().getTime() + (60 * 60 * 24),
                        rank: rank
                    });

                    resolve(true);
                }
                else {
                    reject(false);
                }
            })
            .catch(exception => {
                log('videoRanks save exception', exception);
                reject(exception);
            });
        });
    };

    return {
        get: get,
        save: save
    };
})();