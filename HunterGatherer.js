/*
 *      _______----___________________
 *    _____------ |\                 /|
 *        ___---- | \               / |
 * ------________ | /\_____________/\ |
 *            __- |/HunterGatherer.JS\|
 *       ---__--__|___________________|
 *
 * HunterGatherer scrapes names from websites, and uses name combinations to generate a list of email addresses, such as firstname.lastname@example.com.
 * HunterGatherer can validate email addresses using the SMTP RCPT TO command or bounce emails.
 * TODO: use const instead of var when appropriate
 * TODO: https://www.npmjs.com/package/parse-full-name
 * TODO: add -- flags
 * Default output: name <email>
 * Options
 * Input :
 * -p: Proxy for web request in format: type//:address:port, Ex. socks5://127.0.0.1:9050
 * -d: Email domain. Not required if webpage provided Ex: gmail.com
 * -f: Read names from file (one name each line). Either -f or -n required
 * -w: Read names from webpage. Ex. https://example.com/leadership-team
 * -n: Provide single name in command line
 * -s: Default is "." Separator characters to use in email. Can be comma separated. Ex: kevin.wang@example.com
 * -t: Provide custom template string. Useful when you already know the email naming algorithm. Ex: {{fi}}{{ln}}@{{domain}}
 * -v RCPT|BOUNCE: Verify email address using SMTP RCPT TO or bounce emails
 * -b: Check email using bounce emails.
 * -u: Username for imap/smtp for bounce emails
 * -p: Password for imap/smtp for bounce emails
 * -i: imap host for bounce emails
 * -s: smtp host for bounce emails
 * Output:
 * -o: Optional. Save output to file.
 * -l: Only output email addresses, without names.
 * @author Kevin Wang
 * @license MIT
 **/
Mustache = require('mustache');
const phantom = require('phantom');
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var latinize = require('latinize'); //turns ỆᶍǍᶆṔƚÉ into ExAmPlE
Promise = require('bluebird');
var bounceEmailChecker = require('./BounceEmailChecker');
var emailExistence = require('email-existence');
const domainName = argv.d || extractRootDomain(argv.w);
//template format:
//{{fn}} = first name; {{fi}} = first initial; ...
// the {{.}} is the separator(s) that is iterated over (empty string and '.' by default)
var template = argv.t || `{{#template}}
{{fn}}{{.}}{{ln}}@{{domain}}
{{ln}}{{.}}{{fn}}@{{domain}}
{{fi}}{{.}}{{ln}}@{{domain}}
{{li}}{{.}}{{fn}}@{{domain}}
{{/template}}`;
var banner = `      _______----___________________
    _____------ |\\                 /|
        ___---- | \\               / |
 ------________ | /\\_____________/\\ |
            __- |/HunterGatherer.JS\\|
       ---__--__|___________________|`
//capitalize first letter of string
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}
function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname
    if (url.indexOf("://") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }
    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];
    return hostname;
}
function extractRootDomain(url) {
    var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    //extracting the root domain here
/*    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    }*/
    return domain.replace("www.","");
}

/*
* get the rendered contents of the webpage
* **/
var getWebPage = Promise.coroutine(function *(addr,proxy) {
    var phantomArgs = [];
    if (proxy) {
        const proxySettings = proxy.replace('//', '').split(":");
        phantomArgs = ['--proxy-type=' + proxySettings[0], '--proxy=' + proxySettings[1] + ':' + proxySettings[2]]
    }
    const instance = yield phantom.create(phantomArgs);
    const page = yield instance.createPage();
    //Chrome Windows 10 user agent to blend in with regular traffic
    page.setting('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36');
    yield page.on("onResourceRequested", function (requestData) {
        console.info('Requesting', requestData.url)
    });

    const status = yield page.open(addr);
    console.log(status);
    const content = yield page.property('content');
    //console.log(content);

    yield instance.exit();
    return content;
});
/*
* Determines if array of strings is not a name by looking for
* "banned" words in the array, like university or city
* @nNames array of strings to
 **/
function isNotName (nNames, notNames) {
    for (i in nNames) {
        if (notNames.includes(nNames[i].toLowerCase())) {
            return true;
        }
    }
    return false;
}
/*
* get contents of file and store in array separated by new lines
* @file name of file to open
 */
function getFileContentsArray(file) {
    return new Promise((resolve, reject) => {
        var contents = [];
        var lineReader = require('readline').createInterface({
            input: fs.createReadStream(file)
        });
        lineReader.on('line', function (line) {
            if (line)
                contents.push(line.toLowerCase());
        });
        lineReader.on('close', () => {
            resolve(contents);
        });
    })
}
/*
* Get webpage and extract names by getting text between html brackets with two or three words.
* To filter the non-names, the first word is checked with a names list, and the remaining words are
* checked with a ban list.
* @url the webpage to get names from
* @proxy http or socks5 proxy (credentials not supported right now)
* **/
var getNamesFromWebsite = Promise.coroutine(function *(url,proxy) {
    var emails = new Map();
    const content = yield getWebPage(url,proxy);
    const regex = /<.*>([ a-zA-Z-\.]* [a-zA-Z-\.]*)<.*>|<.*>([a-zA-Z-\.]* [a-zA-Z-\.]* [a-zA-Z-\.]*)<.*>/g;
    const fNames = yield getFileContentsArray("names.txt");
    const notNames = yield getFileContentsArray("notNames.txt");
    var names = [];
    //loop through the regex matches of potential names
    while (candidates = regex.exec(content)) {
        if (!candidates[1]) continue;
        const nameTitles = ['md', 'dr', 'jr', 'sr', 'jd', 'ms', 'idt', 'miss', 'mrs', 'mr'];
        //"Dr. Bob Jones" => ['bob','jones']
        const name = candidates[1].trim().split(" ").filter(n => (nameTitles.indexOf(n) < 0));
        const nName = isNotName(name.slice(1),notNames);
        //add to list if first name is in names.txt and other parts aren't non-names, and not already included
        if (fNames.includes(name[0].toLowerCase()) && !nName && !names.includes(name.join(" ").toLowerCase())) {
            const emailPerson = guessEmail(name.join(" ").toLowerCase());
            for (emailAddr of emailPerson['emails'])
                emails.set(emailAddr, emailPerson['name']);
            }
    }
    return emails;
});
//promisify email-existence
function emailCheck(email) {
    return new Promise((resolve, reject) => {
        emailExistence.check(email, (err, data) => {
            if (err) reject(err);
            resolve(data)
        })
    })
}
//Saves to file if -o options used, otherwise print output
function output(name, email) {
    var output;
    if (name) {
        //capitalize names
        name = name.split(" ")[0].capitalizeFirstLetter() + " " + name.split(" ")[1].capitalizeFirstLetter();
        output = argv.l ? email : name + " <" + email + ">";
    } else {
        output = email;
    }
    //if list mode specified, only print email addresses, otherwise print in name <email> form.
    if (argv.o) {
        fs.appendFile(argv.o, output+ '\n', function (err) {
            if (err) console.error("append failed")
        })
    } else {
        console.log(output);
    }
}

/*output only verified emails if -v specified.
 *if -v verify one by one to prevent socket from overloading and only print verified emails
 *@emails array of {name:string, email:[]} objects
 **/
var outputValidEmails = Promise.coroutine(function *(emails) {
    console.log("[*] Valid emails found: ");
    if (argv.v && argv.v.toUpperCase() == "BOUNCE") {
        emails = yield bounceEmailChecker.bounceEmailCheck(emails);
    }
    for([emailAddr,emailName] of emails) {
        if (argv.v && argv.v.toUpperCase() == "RCPT") {
            var valid = yield emailCheck(emailAddr);
            if (valid) {
                output(emailName, emailAddr);
            }
        }
        else {
            output(emailName, emailAddr);
        }
    }
});
/*Generate a list of emails separated by new lines, given a name, and string of separators separated by commas.
 * Middle name ignored. The empty string "" is no separator (firstNameLastName).
 * Returns object {name: name, emails: [array of emails]}
 * TODO:use Maps instead
 **/
function guessEmail(name, separators) {
    //convert latin characters to ascii
    name = latinize(name.toLowerCase());
    //remove non alphanumeric characters and split into array
    var nameArray = name.replace(/[^a-zA-Z- ]/, '').split(" ");
    //remove common titles in name
    var nameTitles = ['md', 'dr', 'jr', 'sr', 'jd', 'ms', 'idt','miss', 'mrs','mr'];
    nameArray = nameArray.filter(name => (nameTitles.indexOf(name) < 0));
    var firstName = nameArray[0]; //first element
    var lastName = nameArray[nameArray.length - 1]; //last element

    //generate array of separators
    var separators = [""].concat(separators ? separators.replace(/\s/g, "").split(",") : ["."]);
    var view = {
        fn: firstName,
        ln: lastName,
        fi: firstName[0],
        li: lastName[0],
        template: separators,
        domain: domainName
    };
    name = firstName + " " + lastName;
    return {'name': name, 'emails': Mustache.render(template, view).split('\n').filter(data => data)};
}
var names = new Map();
//if a file with names is provided, read all lines then generate emails
console.log(banner)
console.log('')
if (argv.f) {
    //TODO: use getFileContentArray
    var lineReader = require('readline').createInterface({
        input: fs.createReadStream(argv.f)
    });
    lineReader.on('line', function (line) {
        if(line) {
            line = line.trim();
            var emailPerson;
            //email address instead of name
            if(line.indexOf('@') != -1) {
                //contains name and email
                if(line.indexOf(' ') != -1) {
                    emailPerson = {"name" : /(.*) </g.exec(line)[1], "emails":[/<(.*)>/g.exec(line)[1]]}
                } else {
                    emailPerson = {"name" : "", "emails":[line]}
                }
            } else {
                emailPerson = guessEmail(line, argv.s);
            }
            for (emailAddr of emailPerson['emails']) {
                names.set(emailAddr, emailPerson['name']);
            }
        }
    });
    lineReader.on('close', () => {
        outputValidEmails(names);
    })
}
//name provided in command line
if (argv.n) {
    //TODO: don't repeat yourself
    var emailPerson = guessEmail(argv.n, argv.s);
    for (emailAddr of emailPerson['emails']) {
        names.set(emailAddr, emailPerson['name']);
    }
    outputValidEmails(names);
}
//webpage of names provided
if (argv.w) {
    //remove argument quotes
    getNamesFromWebsite((argv.w).replace(/['"]+/g, ''), (argv.p).replace(/['"]+/g, '')).then(names => {outputValidEmails(names)})
}