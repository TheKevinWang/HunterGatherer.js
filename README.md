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
Generate emails for name provided, using separators "_" and "-", with output. 
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
# License 

MIT License
