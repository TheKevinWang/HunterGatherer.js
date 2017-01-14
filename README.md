# EmailGuesser

Organizations tend to have predicatable email addresses for employees, such as kevin.wang@example.com. This Node.js script uses common name combinations to generate a list of common email addresses. 

# Requirements

Node.js 6.9.2 or later  
mustache -- template engine   
minimist -- argument parser  
latinize -- convert strings to latin characters   
readline -- read from file  

```
npm install mustache minimist latinize readline
```

# Usage

Email guesser accepts a file of names separated by new lines, such as output from [theHarvester](https://github.com/laramies/theHarvester). The email addresses can then be validated using [iSMTP](https://github.com/altjx/ipwn). 

Read names from test.txt and output email guesses to output.txt with domain example.com. The default separator is ".".  

```
node EmailGuesser.js -f test.txt -o output.txt -d example.com
```
Generate emails for name provided, using separators "_" and "-", with output to console. 
```
node EmailGuesser.js -n "Kevin Wang" -s "_,-" -d example.com

kevinwang@example.com
wangkevin@example.com
kwang@example.com
wkevin@example.com
kevin_wang@example.com
wang_kevin@example.com
k_wang@example.com
w_kevin@example.com
kevin-wang@example.com
wang-kevin@example.com
k-wang@example.com
w-kevin@example.com
```

You can also provide your own template using -t. This is useful when you already know the email naming algorithm. The format of the template is: 

{{fn}} = first name
{{fi}} = first initial
{{ln}} = last name
{{li}} = last initial
{{domain}} = email domain Ex: gmail.com
-n "Kevin Wang" -s "_,-" -d example.com -t {{fi}}{{ln}}@{{domain}}
```
kwang@example.com
```


# License 

MIT License
