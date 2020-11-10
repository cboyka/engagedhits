const store = (function(){

    /**
     * Save data in local storage
     * @param   string    key     data key string
     * @param   mixed     value   data value
     * @return  void
     */
    let set = (key, value) => {
        return new Promise((resolve, reject) => {
            let data = {};
            data[key] = value;
            chrome.storage.local.set(data, () => {
                resolve();
            });
        });
    };

    /**
     * Returns data stored in local storage by key provided
     * @param   string    keys    Array of keys to fetch
     * @param   boolean   remove  Optional boolean flag to remove key after fetching
     * @return  void
     */
    let get = (keys, remove) => {
        return new Promise((resolve, reject) => {
            //chrome.storage.local.clear();
            chrome.storage.local.get(keys, response => {
                if (typeof response != 'undefined') {
                    // remove key if asked for
                    //typeof remove != 'undefined' && chrome.storage.local.remove(key);

                    resolve(response);
                } else {
                    reject();
                }
            });
        });
    };

    /**
     * Removes data from local for provided keys
     * @param   string    keys    Array of keys to delete
     * @return  void
     */
    let remove = (keys) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                resolve();
            });
        });
    };

    return {
        set: set,
        get: get,
        remove: remove
    }
})();