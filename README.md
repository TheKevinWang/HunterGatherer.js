# HunterGatherer

![Banner](https://github.com/TheKevinWang/HunterGatherer.js/blob/master/HunterGatherer.png)
HunterGatherer scrapes names from websites, and uses name combinations to generate a list of email addresses, such as firstname.lastname@example.com. HunterGatherer can validate email addresses using the SMTP RCPT TO command or bounce emails.


# Usage

Read names from test.txt and output email guesses to output.txt with domain example.com. The default separator is ".".  

```
node HunterGatherer.js -f test.txt -o output.txt -d example.com
```
Generate emails for name provided, using separators "_" and "-", with output to console. 
```
node HunterGatherer.js -n "Bob Jones" -s "_,-" -d example.com

Bob Jones <bobjones@example.com>
Bob Jones <jonesbob@example.com>
Bob Jones <bjones@example.com>
Bob Jones <jbob@example.com>
Bob Jones <bob_jones@example.com>
Bob Jones <jones_bob@example.com>
Bob Jones <b_jones@example.com>
Bob Jones <j_bob@example.com>
Bob Jones <bob-jones@example.com>
Bob Jones <jones-bob@example.com>
Bob Jones <b-jones@example.com>
Bob Jones <j-bob@example.com>

```

You can also provide your own template using -t. This is useful when you already know the email naming algorithm. The format of the template is:  
{{fn}} = first name  
{{fi}} = first initial  
{{ln}} = last name  
{{li}} = last initial  
{{domain}} = email domain Ex: gmail.com
Validate email address by sending a an email and recording the existence of a bounce email. Subject and body will be "test".
```
node HunterGatherer.js -n "Bob Jones" -d example.com -t {{fi}}{{ln}}@{{domain}} -v bounce -u test@test.com -p test
[*] Sending email to bjones@example.com
[*] Valid emails found:
Bob Jones <bjones@example.com>
```
# TODO

NPM

LinkedIn scraper

Facebook scraper

# License 

MIT License
