/*
 * Guesses the email address of a person given a name and email domain.
 * Options
 * Input :
 * -d: Required. Email domain. Ex: gmail.com
 * -f: Read names from file (one name each line). Either -f or -n required
 * -n: Provide single name in command line
 * -s: Default is "." Separator characters to use in email. Can be comma separated. Ex: kevin.wang@example.com
 * -t: Provide custom template string. Useful when you already know the email naming algorithm. Ex: {{fi}}{{ln}}@{{domain}}
 * Output:
 * -o: Optional. Save output to file.
 * @author Kevin Wang
 * @license MIT
 **/
Mustache = require('mustache');
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var latinize = require('latinize'); //turns ỆᶍǍᶆṔƚÉ into ExAmPlE

//template format:
//{{fn}} = first name; {{fi}} = first initial; ...
// the {{.}} is the separator(s) that is iterated over (empty string and '.' by default)
var template = argv.t || `{{#template}}
{{fn}}{{.}}{{ln}}@{{domain}}
{{ln}}{{.}}{{fn}}@{{domain}}
{{fi}}{{.}}{{ln}}@{{domain}}
{{li}}{{.}}{{fn}}@{{domain}}
{{/template}}`;
//if a file with names is provided, guess emails line by line
if (argv.f) {
    var lineReader = require('readline').createInterface({
        input: fs.createReadStream(argv.f)
    });
    lineReader.on('line', function (line) {
        //generate output line by line
        output(guessEmail(line), argv.s);
    });
} else {
    output(guessEmail(argv.n, argv.s));
}
//Saves to file if -o options used, otherwise print output
function output(output) {
    if (argv.o) {
        fs.appendFile(argv.o, output, function (err) {
            if (err) console.error("append failed")
        })
    } else {
        process.stdout.write(output);
    }
}

//Generate a list of emails separated by new lines, given a name, and string of separators separated by commas.
// Middle name ignored. The empty string "" is no separator (firstNameLastName).
function guessEmail(name, separators) {
    //convert latin characters to ascii
    name = latinize(name.toLowerCase());
    //remove non alphanumeric characters and split into array
    var nameArray = name.replace(/[^a-zA-Z ]/, '').split(" ");
    //remove common titles in name
    var nameTitles = ['md', 'dr', 'jr', 'sr', 'jd'];
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
    return Mustache.render(template, view);
}