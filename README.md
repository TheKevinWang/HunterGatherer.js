# EmailGuesser
Guess the email address given name and domain. 

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

Read names from test.txt and output email guesses to output.txt with domain example.com

```
node EmailGuesser.js -f test.txt -o output.txt -d example.com
```
