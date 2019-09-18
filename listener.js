'use strict';


const helper = require ('./helper');
const channel = 'commercialpaperdev';
const User = require('./user');

async function subcribeEvent (userName, secret, organization, chaincode, eventName) {
    if (!userName || !secret || !organization || !chaincode || !eventName) {
        throw new Error(`Can't subscribe to event. Missing parameters.`);
    }

    let fabricClient;
    let userContext;

    try {
        //lets get the fabric client
        fabricClient = await helper.getFabricClient(organization);
        await User.enrollUser(userName, secret, organization)
        // and change the user context.
        userContext = await fabricClient.getUserContext(userName, true);
        if (!userContext) {
            throw new Error ('Unable to get user context for ' + userName + '. Make sure user is registered and enrolled.');
        }
    } catch (e) {
        throw new Error('Unable to switch user context to ' + userName + '.' + e);
    }

    try {
        const peers = fabricClient.getPeersForOrg();
        // todo validate we have at least one peer
        if (!peers) {
            throw new Error('Can\'t get peer info to connect to. Validate connection profile. ');
        }

        const channel = fabricClient.getChannel('commercialpaperdev');
        const peer = peers[0];

        const channel_event_hub = channel.newChannelEventHub(peer);

        const event_monitor = new Promise((resolve, reject) => {
            let regid = null;
            let handle = setTimeout(() => {
                if (regid) {
                    // might need to do the clean up this listener
                    channel_event_hub.unregisterChaincodeEvent(regid);
                    console.log('Timeout - Failed to receive the chaincode event');
                }
                reject(new Error('Timed out waiting for chaincode event'));
            }, 100000000);

            regid = channel_event_hub.registerChaincodeEvent(chaincode, eventName,
                (event, block_num, txnid, status) => {
                    // This callback will be called when there is a chaincode event name
                    // within a block that will match on the second parameter in the registration
                    // from the chaincode with the ID of the first parameter.
                    console.log('Successfully got a chaincode event with transid:'+ txnid + ' with status:'+status);


                    // to see the event payload, the channel_event_hub must be connected(true)
                    let event_payload = event.payload.toString('utf8');
                    console.log(`Event payload is ${event_payload}`)
                }, (error)=> {
                    clearTimeout(handle);
                    console.log('Failed to receive the chaincode event ::'+error);
                    reject(error);
                }
                // no options specified
                // startBlock will default to latest
                // endBlock will default to MAX
                // unregister will default to false
                // disconnect will default to false
            );

            channel_event_hub.connect(true);

        });

        console.log('Subscribed to event...')
        return Promise.all([event_monitor]);
    } catch (e) {
        console.error(`Error during event subscription: ${e}`)
    }
}

exports.subcribeEvent = subcribeEvent;