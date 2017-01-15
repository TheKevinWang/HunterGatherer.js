/*
 * Guesses the email address of a person given a name and email domain.
 * Default output: name <email>
 * Options
 * Input :
 * -d: Required. Email domain. Ex: gmail.com
 * -f: Read names from file (one name each line). Either -f or -n required
 * -n: Provide single name in command line
 * -s: Default is "." Separator characters to use in email. Can be comma separated. Ex: kevin.wang@example.com
 * -t: Provide custom template string. Useful when you already know the email naming algorithm. Ex: {{fi}}{{ln}}@{{domain}}
 * -v: Only output if email exists by attempting to send an email using telnet. The email is never sent. Make sure port 25 outbound is not blocked.
 * Output:
 * -o: Optional. Save output to file.
 * -l: Only output email addresses, without names.
 * @author Kevin Wang
 * @license MIT
 **/
Mustache = require('mustache');
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var latinize = require('latinize'); //turns ỆᶍǍᶆṔƚÉ into ExAmPlE
Promise = require('bluebird');
var emailExistence = require('email-existence');

//template format:
//{{fn}} = first name; {{fi}} = first initial; ...
// the {{.}} is the separator(s) that is iterated over (empty string and '.' by default)
var template = argv.t || `{{#template}}
{{fn}}{{.}}{{ln}}@{{domain}}
{{ln}}{{.}}{{fn}}@{{domain}}
{{fi}}{{.}}{{ln}}@{{domain}}
{{li}}{{.}}{{fn}}@{{domain}}
{{/template}}`;

//capitalize first letter of string
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}
/*output only verified emails if -v specified.
 *if -v verify one by one to prevent socket from overloading and only print verified emails
 *@emails array of {name:string, email:[]} objects
 **/
var outputEmails = Promise.coroutine(function *(emails) {
    for (var i = 0; i < emails.length; i++) {
        var thisName = emails[i]['name'];
        var thisEmail = emails[i]['emails'];
        for (var j = 0; j < thisEmail.length; j++) {
            if (argv.v) {
                var valid = yield emailCheck(thisEmail[j]);
                if (valid)
                    output(thisName, thisEmail[j]);
            } else {
                output(thisName, thisEmail[j]);
            }
        }
    }
});
//if a file with names is provided, read all lines then generate emails
if (argv.f) {
    var names = [];
    var lineReader = require('readline').createInterface({
        input: fs.createReadStream(argv.f)
    });
    lineReader.on('line', function (line) {
        if(line)
            names.push(guessEmail(line, argv.s));
    });
    lineReader.on('close', () => {
        outputEmails(names);
    })

} else { // argv.n
    outputEmails([guessEmail(argv.n, argv.s)]);
}
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
    //if list mode specified, only print email addresses, otherwise print in name <email> form.
    var output = argv.l ? email : name + " <" + email + ">";
    if (argv.o) {
        fs.appendFile(argv.o, output+ '\n', function (err) {
            if (err) console.error("append failed")
        })
    } else {
        console.log(output);
    }
}


/*Generate a list of emails separated by new lines, given a name, and string of separators separated by commas.
 * Middle name ignored. The empty string "" is no separator (firstNameLastName).
 * Returns object {name: name, emails: [array of emails]}
 **/
function guessEmail(name, separators) {
    //convert latin characters to ascii
    name = latinize(name.toLowerCase());
    //remove non alphanumeric characters and split into array
    var nameArray = name.replace(/[^a-zA-Z ]/, '').split(" ");
    //remove common titles in name
    var nameTitles = ['md', 'dr', 'jr', 'sr', 'jd', 'ms', 'idt'];
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
        domain: argv.d
    };
    name = firstName.capitalizeFirstLetter() + " " + lastName.capitalizeFirstLetter();
    return {'name': name, 'emails': Mustache.render(template, view).split('\n').filter(data => data)};
}