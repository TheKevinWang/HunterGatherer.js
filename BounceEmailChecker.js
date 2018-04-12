/*
* Check if email addresses are valid by sending it a test email and then if a bounce is received, remove the email address as invalid
**/
var Imap = require('imap');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var argv = require('minimist')(process.argv.slice(2));
var Promise = require('bluebird');
var fs = require('fs');
//remove ' and " from fields
//TODO:remove all argv
try
{
    argv.u = argv.u ? (argv.u).replace(/['"]+/g, '') : null;
    argv.p = argv.p ? (argv.p).replace(/['"]+/g, '') : null;
    argv.i = argv.i ? (argv.i).replace(/['"]+/g, '') : null;
    argv.s = argv.s ? (argv.s).replace(/['"]+/g, '') : null;

var username = argv.u;
var pwd =  argv.p;
var imapHost = argv.i || 'imap.' + argv.u.split("@")[1];
var smtpHost = argv.s || 'smtp.' + argv.u.split("@")[1];
}
catch (err) {

}
var imap = new Imap({
    user: username,
    password: pwd,
    host: imapHost,
    port: 993,
    tls: true,
    //tlsOptions: { rejectUnauthorized: false }
});
var smtpConfig = {
    host: smtpHost,
    port: 465,
    tls: {
        rejectUnauthorized: false
    },
    auth: {
        user: username,
        pass: pwd
    },
    secure: true,
    pool: false
};

function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

//var htmlBody = '<br>test</br>';
var textBody = argv.body || "test";
var transporter = nodemailer.createTransport(smtpConfig);
transporter.auth = smtpConfig.auth;
var mailOptions = {
    subject: argv.subject || "test",
    text: textBody,
    xMailer: false,
    from: username,
    to: null
};
var sendEmail = Promise.coroutine(function* (addr) {
    mailOptions.to = addr;
    mailOptions.envelope = {
        from: username,
        to: addr
    }
    var tries = 0;
    var sentSuccess = false;
    while (!sentSuccess && tries < 3) {
        try {
            var smtpResponse = yield transporter.sendMail(mailOptions);
            //console.log(smtpResponse);
            sentSuccess = true;
        } catch (error) {
            console.error(error);
            tries++;
        }
    }
});
/**
 * Get emails and then use a regex to extract email addresses in the bounce emails. Removes bounced emails from the valid list
 */
var getRecentEmails = Promise.coroutine(function* (count,wordFilter) {
    //number of emails to grab. max number of bounces is the number of emails sent
    //var count = toCheck.length;
    //TODO:make this better
    var emails = [];
    var reportType;
    return new Promise((resolve, reject) => {
        function openInbox(cb) {
            imap.openBox('INBOX', true, cb);
        }
        imap.once('ready', function () {
            openInbox(function (err, box) {
                if (err) throw err;
                var lastEmail = count > box.messages.total ? box.messages.total : count;
                //what's the value of this???
                f = imap.seq.fetch(box.messages.total + ':' + (box.messages.total - lastEmail + 1), {
                    bodies: ['HEADER.FIELDS (FROM)', 'TEXT'],
                    struct: true
                });
                f.on('message', function (msg, seqno) {
                    //console.log('Message #%d', seqno);
                    var prefix = '(#' + seqno + ') ';
                    var buffer = '';
                    var attributes;
                    msg.on('body', function (stream, info) {
                        count = 0;
                        stream.on('data', function (chunk) {
                            count += chunk.length;
                            buffer += chunk.toString('utf8');

                        });
                       // stream.once('end', function () {
                          //  if (info.which !== 'TEXT')
                           //     console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                          //  else
                          //      console.log(prefix + 'Body [%s] Finished', inspect(info.which));
                       // });
                    });
                    msg.once('attributes', function (attrs) {
                        //reportType = attrs.struct[0].params["report-type"];
                        attributes = attrs;
                    });
                    msg.once('end', function () {
                       /* const regex = /\s?([!#$%&'*+\/=?^_`{|}~.0-9a-zA-Z-]*@[0-9a-zA-Z-.]*)\s?/g;
                        while (candidates = regex.exec(buffer)) {
                            var found = toCheck.indexOf(candidates[1]);

                            while (found !== -1) {
                                toCheck.splice(found, 1);
                                found = toCheck.indexOf(candidates[1]);
                            }
                        }*/
                       //if filter is turned on, only push emails that match filter.
                        if (wordFilter) { //reportType == "delivery-status"
                            if (buffer.includes(wordFilter)) {
                                emails.push(buffer)
                            }
                        } else {
                            emails.push(buffer)
                        }
                        //console.log(buffer);
                        //console.log(prefix + 'Finished');
                    });
                });
                f.once('error', function (err) {
                    console.log('Fetch error: ' + err);
                });
                f.once('end', function () {

                    //console.log('Done fetching all messages!');
                    imap.end();
                    resolve(emails);
                });
            });
        });
        imap.connect();
    });
});
function filterEmailsAfter (emails,hash) {
    if (hash == null) return emails;
    for(var i = 0; i < emails.length; i++) {
        if (crypto.createHash('md5').update(emails[i]).digest("hex") == hash) {
            return emails.splice(i+1);
        }
    }
}
/**
 * Send 1 email to each email address on the list, then wait, then get inbox using imap, and get bounce emails to determine valid emails.
 */
var bounceEmailCheck = Promise.coroutine(function* (toCheck, waitTime = 20) {
    var emailsArray = Array.from(toCheck.keys());
    const lastEmail = yield getRecentEmails(1);
    //send an email to each address
    for ([emailAddr,emailName] of toCheck) {
            console.log("[*] Sending email to " + emailAddr)
            yield sendEmail(emailAddr);
        }
    yield sleep(waitTime);
    //Max possible bounces is equal to number of emails sent (all addresses bounced)
    const possibleEmails = yield getRecentEmails(emailsArray.length+1+5)//, "delivery-status"); //5 is to be safe
    const lastEmailHash = lastEmail.length === 0 ? null : crypto.createHash('md5').update(lastEmail[0]).digest("hex");
    const bouncedEmails = filterEmailsAfter(possibleEmails, lastEmailHash);
    var bouncedEmailAddresses = [];
    for (bouncedEmail of bouncedEmails) {
        const bouncedEmailAddressReg = new RegExp(emailsArray.join("|")).exec(bouncedEmail);
        if (bouncedEmailAddressReg){
            bouncedEmailAddresses.push(bouncedEmailAddressReg[0]);
            toCheck.delete(bouncedEmailAddressReg[0])
        }
    }
    return toCheck;
});
exports.bounceEmailCheck = bounceEmailCheck;
