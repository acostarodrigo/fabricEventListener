'use strict';

var log4js = require('log4js');
var logger = log4js.getLogger('Helper');


var path = require('path');
var fs = require('fs');
var FabricClient = require('fabric-client');
FabricClient.setLogger(logger);

let connection_profile;



/**
 * based on the provided organization, we load and return the correct connection profile to connect to
 * @param organization a valid existint organization
 * @returns a JSON connection profile to be used on the client
 */
function getConnectionProfile(organization) {
    var network_config_file;
    switch (organization.toLowerCase()) {
        case 'issuermsp':
        case 'issuer':
            network_config_file = 'issuer_commercialpaperdev_commercial_paper_profile.json';
            break;
        case 'broker1msp':
        case 'broker1':
            network_config_file = 'broker1_commercialpaperdev_commercial_paper_profile.json';
            break;
        case 'broker2msp':
        case 'broker2':
            network_config_file = 'broker2_commercialpaperdev_commercial_paper_profile.json';
            break;
        default:
            throw new Error ('provided organization does not match any configuration file.');

    }
    try {
        var content = fs.readFileSync(path.join(__dirname, 'connectionProfiles', network_config_file), 'utf8');
        var json = JSON.parse(content);
        connection_profile = json;
        return connection_profile;
    } catch (e) {
        throw new Error('Error loading network configuration file. ' + e)
    }
};

/**
 * create a fabric client, used to interact with fabric chaincode
 * @param organization based on the organization provided, we load the specific configuration file for the client
 * @returns an instantiated HP client
 */
async function getFabricClient (organization) {
    if (!organization) {
        throw new Error ('Organization must be supplied in order to create a fabric client.');
    }

    var connectionProfile = getConnectionProfile((organization));
    if (!connectionProfile.certificateAuthorities) {
        throw new Error ('Loaded connection profile is not valid. CA is missing.');
    }

    let fabricClient = new FabricClient();
    fabricClient.loadFromConfig(connectionProfile);
    await fabricClient.initCredentialStores();

    return fabricClient;
};


/**
 * validates if the passed organization and affiliation group is valid.
 * @param orgName
 * @param affiliation
 * @returns {boolean}
 */
function isValidAffiliation(orgName, affiliation) {
    const file = fs.readFileSync(path.join(__dirname,'config.json'));
    const config = JSON.parse(file);

    for (let organization of config.organizations) {
        if (organization.name == orgName.toLowerCase()) {
            for (let aff of organization.affiliations){
                if (aff.name == affiliation){
                    return true;
                    break;
                }
            }
        }
    }

    return false;
}

function getOrganizationData(orgName) {
    const file = fs.readFileSync(path.join(__dirname,'config.json'));
    const config = JSON.parse(file);

    for (let organization of config.organizations) {
        if (organization.name == orgName.toLowerCase()) {
            return organization;
            break;
        }
    }
}

function getBrokerDealers(orgName) {
    const file = fs.readFileSync(path.join(__dirname,'config.json'));
    const config = JSON.parse(file);

    for (let organization of config.organizations) {
        if (organization.name == orgName.toLowerCase()) {
            return organization.brokerDealers;
            break;
        }
    }
    return;
}

function getSupportedCurrencies(orgName) {
    const file = fs.readFileSync(path.join(__dirname,'config.json'));
    const config = JSON.parse(file);

    return config.supportedCurrencies;
}

exports.getFabricClient = getFabricClient;
exports.isValidAffiliation = isValidAffiliation;
exports.getOrganizationData = getOrganizationData;
exports.getBrokerDealers = getBrokerDealers;
exports.getSupportedCurrencies = getSupportedCurrencies;