/**
 * Engaged Hits chrome extension configuration
 * @type {Object}
 */
const ENGAGEDHITS = {

    // ENV can be 'prod' or 'dev'. if env is not prod, logs will be printed in console.
    // When publishing this extension or using in live enviornment, value should be 'prod'
    ENV: 'dev',

    // gmail POP setting URL
    GMAIL_POP_SETTING_URL: 'https://mail.google.com/mail/u/0/?ogbl#settings/fwdandpop',

    // gmail accounts setting URL
    GMAIL_ACC_SETTING_URL: 'https://mail.google.com/mail/u/0/?ogbl#settings/accounts',

    // gmail inbox URL
    GMAIL_INBOX_URL: 'https://mail.google.com/mail/u/0/#all',

    // gmail inbox URL with pagination
    GMAIL_INBOX_PAGE_URL: 'https://mail.google.com/mail/u/0/#all/p',

    // gmail sent box URL
    GMAIL_SENT_BOX_URL: 'https://mail.google.com/mail/u/0/#sent',

    // gmail sent box URL with pagination
    GMAIL_SENT_BOX_PAGE_URL: 'https://mail.google.com/mail/u/0/#sent/p',

    // AJAX URL where comment post is sent. field is comment_text: messi the best
    YT_COMMENT_POST_URLs: [
        'https://www.youtube.com/service_ajax?name=createCommentEndpoint',
        'https://www.youtube.com/*/create_comment*'
    ],

    // AJAX URL where unsubscribe post is sent
    YT_UNSUBSCRIBE_POST_URL: 'https://www.youtube.com/youtubei/v1/subscription/unsubscribe*',

    LOCAL_CACHE_EXPIRE_TIME: (30 * 60),

    WEBSITE_URL: 'https://engagedhits.com',

    LOGOUT_URL: 'https://engagedhits.com/logout',

    API_ENDPPOINT: 'https://engagedhits.com/api/',

    AUTO_MODE_VIDEOS_COUNT: 3
}
