# Week 1

## Learning:
### Basics of HTTP/How the internet and web work

1. **What is DNS:**

    - Whenever we type in the website name such as google.com how would our computer know which computer to communicate with in order to show/fetch us the information and get our work done? This thing is managed using **DNS (Domain Name System)** 

    - Work of DNS is to convert google.com into a number (Internet Protocol Address aka IP address).
    - Go to Inspect element in any website -> Networks -> Docs -> website.com -> And see the remote address. This remote address is the conversion of the site into an address using DNS

2. **How does DNS work?**

    So basically it contacts with the DNS resolver on your computer. (Either ISP provides it or you have to Manually add it)
    - **So what is DNS resolver?** : A DNS resolver is a hard coded IP address given to your computer to generate a request like (ip address of website.com). 

    - Common Primary DNS of computer is `1.1.1.1`
    - This means the computer is going to ask what is ip address of website.com with the help of `1.1.1.1`
    - It takes a question from a client (browser or OS). 
        - Client asks the `1.1.1.1` for the IP address of the website.com

        - `1.1.1.1` calls a another DNS(1) and asks him what is the IP address of domains with ".com" are stored. It return a another DNS(2)
        - `1.1.1.1` calls a DNS(2) and asks him for the IP address of website.com. Then it returns the another DNS(3).
        - `1.1.1.1` calls a DNS(3) and asks for the IP address of the website.com. Then it returns the IP address of the website.com
        - After this it gets connected to the website.com
        - Now `1.1.1.1` may cache the IP address of website.com to save the time in the next call

3. HTTP

    - There are certain rules to be followed by the client and the server in order to establish a successful communication.

    **What is HTTP:**
    - It is a plain text protocol.
    - So when you go to the Request headers in the Network -> Doc -> Request headers. What ever you see is the response needed by the client to establish a successful network with the IP address.

    **What is Status Code?**

    - `HTTP` response status codes indicate whether a specific `HTTP` request has been successfully completed. Responses are grouped in five classes:

        - Informational responses (`100–199`)
        - Successful responses (`200–299`)
        - Redirects (`300–399`)
        - Client errors (`400–499`)
        - Server errors (`500–599`)
    Check more [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

    **What are port numbers?**

    - For example if the computer runs the http and ftp at the same time. How would a server know which service should handle it if the query is comming from the computer. This task is handled by the ports (eg: 62.43.83.43:80) so 80 si the port here (anything after `:`)

    - So when you are visiting http://example.com you are acutally visiting http://example.com:80
    - Some comman port numbers
        - `http` = `80`
        - `https` = `443`
    - Each internet protocol is associated with a default port
        - `SMTP` (`25`)
        - `POP3` (`110`)
        - `IMAP` (`143`)
        - `IRC` (`194`)
    Check more [here](https://developer.mozilla.org/en-US/docs/Glossary/Port)
    - Whenever you make a request the computer is listening to the post number.
    - It is not mandatory to use https://example.com:443 as it is predefied but if your have a service running on other port than 443 then you might require to use https://example.com:333 here 333 is a port defined by us
    - In this way the computer can manage different services cleanly and simultaneously

    **What are Request Methods?**

    - When we are done with resolving the IP address to the domain name and the port, the next thing it is going to do is sending a request methods.

    - It is the very first thing which is sent when a connection is established between client and a server.
    - `GET` - It is only used when there is **no sending of data** from the client to the server (eg : uploading the files, photos)
    - `POST` - Is used when you want to send the data or interact with the server. eg: (login)
    Get more [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
    - `GET` and `POST` are the most important methods. You can pretty much do anything with this methods.
    - `POST` is superior than any other method because it can function like `GET`, `PATCH`, `DELETE`, `PUT` etc. because it works on the body. 

    **What are Request Headers?**

    - HTTP headers let the client and the server pass additional information with an HTTP request or response. An HTTP header consists of its case-insensitive name followed by a colon (:), then by its value. Whitespace before the value is ignored.
    - Headers can be grouped according to their contexts:

        - General headers apply to both requests and responses, but with no relation to the data transmitted in the body.
        - Request headers contain more information about the resource to be fetched, or about the client requesting the resource.
        - Response headers hold additional information about the response, like its location or about the server providing it.
        - Entity headers contain information about the body of the resource, like its content length or MIME type.

    - Headers can also be grouped according to how proxies handle them:

        - Connection
        - Keep-Alive
        - Proxy-Authenticate
        - Proxy-Authorization
        - TE
        - Trailer
        - Transfer-Encoding
        - Upgrade (see also Protocol upgrade mechanism).
    Check out more infor [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)

4. Raw HTTP requests using netcat :

- Open netcat shell
- Type in command `nc example.com 80 -vvv` This will establish the connection to example.com by port 80.
- Then type `GET / HTTP/ 1.1
- Then type `Host : example.com`. This is mandatory after 1.1 (if we use GET/ HTTP/ 1 then you can skip it)
- Then just simply hit enter
- In this way you can learn to establish the network successfully