const taskModel = (() => {

    // simple function to make API call to get task and store in local
    let getFromAPI = (earnType) => {
        return new Promise(async (resolve, reject) => {
            api.get(`task?earnType=${earnType}`)
            .then(response => {
                log('tasks api response', response);

                if(!response || response.type != 'success') {
                    reject(response);
                    return;
                }

                // save task in local storage so that next time we will not need API call
                let storeData = {
                    expireTimestamp: new Date().getTime() + (ENGAGEDHITS.LOCAL_CACHE_EXPIRE_TIME * 1000),
                    data: response.task
                };
                store.set('task', storeData);
                resolve(response.task);
            })
            .catch(exception => {
                log('task getFromAPI exception', exception);
                reject(exception);
            });
        });
    };

    // public function to get task
    let get = (fetchFromAPI, earnType) => {
        fetchFromAPI = typeof fetchFromAPI == 'undefined' ? true : fetchFromAPI;

        return new Promise((resolve, reject) => {
            // try to get task from local storage
            store.get('task')
            .then(response => {
                let currentTimestamp = new Date().getTime();
                log('task local', response);
                if(response && 
                    response.task.expireTimestamp > currentTimestamp && 
                    (typeof earnType == 'undefined' || response.task.data.earnType == earnType)
                ) {
                    resolve(response.task.data);
                    return;
                }

                // if task not found in local reject promise to be handled in catch
                return Promise.reject();
            })
            .catch(() => {
                log('error or task not found in local storage');

                if(!fetchFromAPI) {
                    reject();
                    return;
                }

                // get task from API in case task not found in local or some exception occured. 
                // and then send task back by resolving promise
                getFromAPI(earnType)
                .then(task => resolve(task))
                .catch(exception => reject(exception));
            });
        });
    };

    /**
     * To send api request for marking task completed
     * @return Promise
     */
    let markCompleted = (automation = 0, adsInfo = {adsMet: 0, adsWatched: 0}) => {
        return new Promise((resolve, reject) => {
            store.get('task')
            .then(response => {
                let currentTimestamp = new Date().getTime();
                log('task local', response);
                if(response && response.task.expireTimestamp > currentTimestamp) {
                    let task = response.task.data;
                    api.post('task/completed', {
                        channelId: task.channelId,
                        taskId: task.taskId,
                        userId: task.userId,
                        convertedToDirect: typeof task.convertedToDirect != 'undefined' ? 1 : 0,
                        automation: automation,
                        adsMet: adsInfo.adsMet,
                        adsWatched: adsInfo.adsWatched,
                    })
                    .then(response => {
                        if(response && response.type == 'success') {
                            store.remove(['task']);
                            resolve(response);
                        }
                        else {
                            reject(response);
                        }
                    })
                    .catch(exception => {
                        if(exception && typeof exception.error != 'undefined' && exception.error == 'unauthorized') {
                            store.remove(['task']);
                        }
                        log('task completed exception', exception);
                        reject(exception);
                    });
                }
                else {
                    reject();
                }
            })
            .catch(() => {
                log('error or task not found in local storage');
                reject();
            });
        });
    };

    /**
     * To send api request for marking task cancelled
     * @return void
     */
    let markCancelled = () => {
        return new Promise((resolve, reject) => {
            store.get('task')
            .then(response => {
                let currentTimestamp = new Date().getTime();
                log('task local', response);
                if(response && response.task.expireTimestamp > currentTimestamp) {
                    let task = response.task.data;
                    api.post('task/cancel', {
                        taskId: task.taskId
                    }, 'json')
                    .then(response => {
                        if(response && response.type == 'success') {
                            store.remove(['task']);
                            resolve(response);
                        }
                        else {
                            reject(response);
                        }
                    })
                    .catch(exception => {
                        if(exception && typeof exception.error != 'undefined' && exception.error == 'unauthorized') {
                            store.remove(['task']);
                        }
                        log('task cancel exception', exception);
                        reject(exception);
                    });
                }
                else {
                    reject();
                }
            })
            .catch(() => {
                log('error or task not found in local storage');
                reject();
            });
        });
    };

    /**
     * To update task flag of converted to direct and save in local storage
     * @return void
     */
    let convertToDirect = () => {
        return new Promise((resolve, reject) => {
            store.get('task')
            .then(response => {
                log('task local', response);
                if(response) {
                    response.task.data.convertedToDirect = true;
                    store.set('task', response.task)
                    .then(() => resolve())
                    .catch(() => reject());
                }
                else {
                    reject();
                }
            })
            .catch(() => {
                log('error or task not found in local storage');
                reject();
            });
        });
    };

    /**
     * To send api request for to set updated time to latest time
     * @return void
     */
    let ping = taskId => {
        return new Promise((resolve, reject) => {
            api.get('task/ping/' + taskId)
            .then(response => {
                if(response && response.type == 'success') {
                    resolve(response);
                }
                else {
                    reject(response);
                }
            })
            .catch(exception => {
                reject(exception);
            });
        });
    };

    /**
     * To update the task flag of search and save in local storage
     * @return Promise
     */
    let searchDone = () => {
        return new Promise((resolve, reject) => {
            store.get('task')
            .then(response => {
                log('task local', response);
                if(response) {
                    response.task.data.searchDone = true;
                    store.set('task', response.task)
                    .then(() => resolve())
                    .catch(() => reject());
                }
                else {
                    reject();
                }
            })
            .catch(() => {
                log('error or task not found in local storage');
                reject();
            });
        });
    }

    return {
        get: get,
        markCompleted: markCompleted,
        markCancelled: markCancelled,
        convertToDirect: convertToDirect,
        searchDone: searchDone,
        ping: ping
    };
})();