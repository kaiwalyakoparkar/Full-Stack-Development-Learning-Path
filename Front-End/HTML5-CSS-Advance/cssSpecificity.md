Specificity means being more specific about putting any css to html elements like

Inilne css - High priority
Internal css - Lesser priority
External css - Least priority

So that means if you give different css for same component. The brower will decide what to put on the component using specificity

The more the recent the css is given to the component the first preference will  be given to that css

If you give some css to p {} and some css to div p {}. The css in div p{} will be added to all the p in the div as it becomes more specific

Priority high to low
1. !important (div (any:css !important;))
2. Inline styles
3. Id's (#div{})
4. Classes (.div{})
5. Nested elements (div p {})
6. Most recent change (p{//before} p{//after with more specifity})
7. simple notation (div{})

Note use classes as much as possible rather than the id's