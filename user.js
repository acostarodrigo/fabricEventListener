'use strict';

const helper = require('./helper');

/**
 * Register a new user into organization's CA
 * @param userName new username to create. Can't be reserved word like admin
 * @param secret a valid secret to use
 * @param organization new user's organization. Must exists.
 */
async function registerUser (userName, secret, organization, affiliation, fullname, email) {
    // parameter validation
    if (!userName || !secret || !organization || !affiliation || !fullname || !email) {
        throw new Error ('Can\'t register user. UserName, secret, organization, affiliation, fullName and email are required parameters');
    }


    // we get the clients
    var fabricClient = await helper.getFabricClient(organization);
    const caClient = fabricClient.getCertificateAuthority();

    // we register organization's admin
    var admin = await registerAdmin(organization);

    // affiliation name is MSPId.Affiliation
    const affiliationName = fabricClient.getMspid() + "." + affiliation;
    try {
        // we will create the affiliation
        await createAffiliation(caClient, affiliationName, admin);
    } catch (e) {
        // do nothing, affiliation probably already created
    }

    // lets register the new user
    try {
         await caClient.register({
                enrollmentID: userName,
                enrollmentSecret: secret,
                role: 'client',
                affiliation: affiliationName,
                maxEnrollments: 0,
                 attr_reqs: [
                     {name: "hf.Registrar.Roles"},
                     {name: "hf.Registrar.Attributes"},
                     {name: "hf.AffiliationMgr"}
                 ],
                 attrs: [
                     {name: "email",
                     value: email,
                         ecert: true},
                     {name: "fullName",
                         value: fullname,
                         ecert: true}
                 ]
            },
            admin);
        let response = `User ${userName} registered successfully.`;
        return response;
    } catch (e) {
       throw new Error ('There was an error registering user ' + userName + '.' + e);
    }
}

/**
 * Enrolls the provided user in organization's CA.
 * @param userName existing valid user
 * @param secret created during registration
 * @param organization that the user belongs to
 * @returns {Promise<User>} the user context if enrolled successfully.
 */
async function enrollUser (userName, secret, organization) {
    // parameter validation
    if (!userName || !organization) {
        throw new Error ('Can\'t register user. UserName and Organization are required parameters');
    }

    // we get the clients
    var fabricClient = await helper.getFabricClient(organization);
    const caClient = fabricClient.getCertificateAuthority();
    try {
        let user;
        if (secret) {
            // first enrollment requires password.

            // lets enroll admin using registrar credentials
            var userEnrollment = await caClient.enroll({
                enrollmentID: userName,
                enrollmentSecret: secret
            })

            // we create the user from ca credentials
            var caUser = await fabricClient.createUser({
                username: userName,
                mspid: fabricClient.getMspid(),
                cryptoContent: {
                    privateKeyPEM: userEnrollment.key.toBytes(),
                    signedCertPEM: userEnrollment.certificate
                },
                skipPersistence: false
            })

            const orgUnits = caUser.getIdentity().getOrganizationUnits();
            const affiliation = caUser.getAffiliation();
            const identity = caUser.getIdentity().serialize().toString('utf8');

            user = await fabricClient.setUserContext(caUser, false);

        } else {
            // for second enrollments we don't use password.
            user = await fabricClient.setUserContext({username: userName});
        }

        // to retrieve affiliation and attributes, we need to get them using an Identity Service with admin
        const identityService = caClient.newIdentityService();
        const admin = await registerAdmin(organization);
        const result = await identityService.getOne(userName, admin);
        user = result.result;

        return user;
    } catch (e) {
        throw new Error ('There was an error enrolling user ' + userName + '.' + e);
    }
}

/**
 * enrolls the admin into the Organization's CA and sets the user context.
 * @param organization a string representing the organization to load the connection profile from
 * @returns {Promise<Client.User>} the admin user context
 */
async function registerAdmin(organization) {
    // we get the client, ca and his registrar data
    var fabricClient = await helper.getFabricClient(organization);
    let caClient = fabricClient.getCertificateAuthority();
    var registrar = caClient.getRegistrar();

    // we make sure we have all data
    if (!registrar.enrollId || !registrar.secret) {
        throw new Error ('Registrar information is not complete. We need both id and secret for admin identity.');
    }

    try {
        // lets enroll admin using registrar credentials
        var adminEnrollment = await caClient.enroll({
            enrollmentID: registrar.enrollId,
            enrollmentSecret: registrar.secret,
            attr_reqs: [
                {name: "hf.Registrar.Roles"},
                {name: "hf.Registrar.Attributes"},
                {name: "hf.AffiliationMgr"}
            ]
        })

        // we create the user from ca credentials
        var adminUser = await fabricClient.createUser({
            username: registrar.enrollId,
            mspid: fabricClient.getMspid(),
            cryptoContent: {
                privateKeyPEM: adminEnrollment.key.toBytes(),
                signedCertPEM: adminEnrollment.certificate
            },
            skipPersistence: false
        })
        adminUser.setAffiliation(organization.toLowerCase());

        // we set the admin contect and return it.
        return await fabricClient.setUserContext(adminUser);
    } catch (e) {
        throw new Error ('There was an error registering admin user for organization ' + organization);
    }
}

async function createAffiliation(fabricCA, name, admin) {
    const affiliationService = fabricCA.newAffiliationService();
    const affiliationRequest = {name: name, caname: fabricCA.getName(), force: true};
    await affiliationService.create(affiliationRequest,admin)
}

exports.registerUser = registerUser;
exports.enrollUser = enrollUser;
