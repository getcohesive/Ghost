//@ts-check
const debug = require('@tryghost/debug')('api:canary:utils:serializers:output:members');
const {unparse} = require('@tryghost/members-csv');
const labs = require('../../../../../../shared/labs');

module.exports = {
    hasActiveStripeSubscriptions: createSerializer('hasActiveStripeSubscriptions', passthrough),

    browse: createSerializer('browse', paginatedMembers),
    read: createSerializer('read', singleMember),
    edit: createSerializer('edit', singleMember),
    add: createSerializer('add', singleMember),
    editSubscription: createSerializer('editSubscription', singleMember),
    createSubscription: createSerializer('createSubscription', singleMember),
    bulkDestroy: createSerializer('bulkDestroy', passthrough),
    bulkEdit: createSerializer('bulkEdit', bulkAction),
    exportCSV: createSerializer('exportCSV', exportCSV),

    importCSV: createSerializer('importCSV', passthrough),
    memberStats: createSerializer('memberStats', passthrough),
    mrrStats: createSerializer('mrrStats', passthrough),
    subscriberStats: createSerializer('subscriberStats', passthrough),
    grossVolumeStats: createSerializer('grossVolumeStats', passthrough),
    activityFeed: createSerializer('activityFeed', passthrough)
};

/**
 * @template PageMeta
 *
 * @param {{data: import('bookshelf').Model[], meta: PageMeta}} page
 * @param {APIConfig} _apiConfig
 * @param {Frame} frame
 *
 * @returns {{members: SerializedMember[], meta: PageMeta}}
 */
function paginatedMembers(page, _apiConfig, frame) {
    return {
        members: page.data.map(model => serializeMember(model, frame.options)),
        meta: page.meta
    };
}

/**
 * @param {import('bookshelf').Model} model
 * @param {APIConfig} _apiConfig
 * @param {Frame} frame
 *
 * @returns {{members: SerializedMember[]}}
 */
function singleMember(model, _apiConfig, frame) {
    return {
        members: [serializeMember(model, frame.options)]
    };
}

/**
 * @param {object} bulkActionResult
 * @param {APIConfig} _apiConfig
 * @param {Frame} frame
 *
 * @returns {{bulk: SerializedBulkAction}}
 */
function bulkAction(bulkActionResult, _apiConfig, frame) {
    return {
        bulk: {
            action: frame.data.action,
            meta: {
                stats: {
                    successful: bulkActionResult.successful,
                    unsuccessful: bulkActionResult.unsuccessful
                },
                errors: bulkActionResult.errors,
                unsuccessfulData: bulkActionResult.unsuccessfulData
            }
        }
    };
}

/**
 * @template PageMeta
 *
 * @param {{data: import('bookshelf').Model[], meta: PageMeta}} page
 * @param {APIConfig} _apiConfig
 * @param {Frame} frame
 *
 * @returns {string} - A CSV string
 */
function exportCSV(page, _apiConfig, frame) {
    debug('exportCSV');

    const members = page.data.map(model => serializeMember(model, frame.options));

    return unparse(members);
}

/**
 * @param {import('bookshelf').Model} member
 * @param {object} options
 *
 * @returns {SerializedMember}
 */
function serializeMember(member, options) {
    const json = member.toJSON ? member.toJSON(options) : member;

    const comped = json.status === 'comped';

    const subscriptions = json.subscriptions || [];

    const serialized = {
        id: json.id,
        uuid: json.uuid,
        email: json.email,
        name: json.name,
        note: json.note,
        geolocation: json.geolocation,
        subscribed: json.subscribed,
        created_at: json.created_at,
        updated_at: json.updated_at,
        labels: json.labels,
        subscriptions: subscriptions,
        avatar_image: json.avatar_image,
        comped: comped,
        email_count: json.email_count,
        email_opened_count: json.email_opened_count,
        email_open_rate: json.email_open_rate,
        email_recipients: json.email_recipients,
        status: json.status
    };

    if (labs.isSet('membersLastSeenFilter')) {
        serialized.last_seen_at = json.last_seen_at;
    }

    if (json.products) {
        serialized.products = json.products;
    }

    return serialized;
}

/**
 * @template Data
 * @param {Data} data
 * @returns Data
 */
function passthrough(data) {
    return data;
}

/**
 * @template Data
 * @template Response
 * @param {string} debugString
 * @param {(data: Data, apiConfig: APIConfig, frame: Frame) => Response} serialize - A function to serialize the data into an object suitable for API response
 *
 * @returns {(data: Data, apiConfig: APIConfig, frame: Frame) => void}
 */
function createSerializer(debugString, serialize) {
    return function serializer(data, apiConfig, frame) {
        debug(debugString);
        const response = serialize(data, apiConfig, frame);
        frame.response = response;
    };
}

/**
 * @typedef {Object} SerializedMember
 * @prop {string} id
 * @prop {string} uuid
 * @prop {string} email
 * @prop {string=} name
 * @prop {string=} note
 * @prop {null|string} geolocation
 * @prop {boolean} subscribed
 * @prop {string} created_at
 * @prop {string} updated_at
 * @prop {string[]} labels
 * @prop {SerializedMemberStripeSubscription[]} subscriptions
 * @prop {SerializedMemberProduct[]=} products
 * @prop {string} avatar_image
 * @prop {boolean} comped
 * @prop {number} email_count
 * @prop {number} email_opened_count
 * @prop {number} email_open_rate
 * @prop {null|SerializedEmailRecipient[]} email_recipients
 * @prop {'free'|'paid'} status
 */

/**
 * @typedef {Object} SerializedMemberProduct
 * @prop {string} id
 * @prop {string} name
 * @prop {string} slug
 */

/**
 * @typedef {Object} SerializedMemberStripeData
 * @prop {SerializedMemberStripeSubscription[]} subscriptions
 */

/**
 * @typedef {Object} SerializedMemberStripeSubscription
 *
 * @prop {string} id
 * @prop {string} status
 * @prop {string} start_date
 * @prop {string} default_payment_card_last4
 * @prop {string} current_period_end
 * @prop {boolean} cancel_at_period_end
 *
 * @prop {Object} customer
 * @prop {string} customer.id
 * @prop {null|string} customer.name
 * @prop {string} customer.email
 *
 * @prop {Object} price
 * @prop {string} price.id
 * @prop {string} price.nickname
 * @prop {number} price.amount
 * @prop {string} price.interval
 * @prop {string} price.currency
 *
 * @prop {Object} price.product
 * @prop {string} price.product.id
 * @prop {string} price.product.product_id
 */

/**
 * @typedef {Object} SerializedEmailRecipient
 *
 * @prop {string} id
 * @prop {string} email_id
 * @prop {string} batch_id
 * @prop {string} processed_at
 * @prop {string} delivered_at
 * @prop {string} opened_at
 * @prop {string} failed_at
 * @prop {string} member_uuid
 * @prop {string} member_email
 * @prop {string} member_name
 * @prop {SerializedEmail[]} email
 */

/**
 * @typedef {Object} SerializedEmail
 *
 * @prop {string} id
 * @prop {string} post_id
 * @prop {string} uuid
 * @prop {string} status
 * @prop {string} recipient_filter
 * @prop {null|string} error
 * @prop {string} error_data
 * @prop {number} email_count
 * @prop {number} delivered_count
 * @prop {number} opened_count
 * @prop {number} failed_count
 * @prop {string} subject
 * @prop {string} from
 * @prop {string} reply_to
 * @prop {string} html
 * @prop {string} plaintext
 * @prop {boolean} track_opens
 * @prop {string} created_at
 * @prop {string} created_by
 * @prop {string} updated_at
 * @prop {string} updated_by
 */

/**
 *
 * @typedef {Object} SerializedBulkAction
 *
 * @prop {string} action
 *
 * @prop {object} meta
 * @prop {object[]} meta.unsuccessfulData
 * @prop {Error[]} meta.errors
 * @prop {object} meta.stats
 *
 * @prop {number} meta.stats.successful
 * @prop {number} meta.stats.unsuccessful
 */

/**
 * @typedef {Object} APIConfig
 * @prop {string} docName
 * @prop {string} method
 */

/**
 * @typedef {Object<string, any>} Frame
 * @prop {Object} options
 */
