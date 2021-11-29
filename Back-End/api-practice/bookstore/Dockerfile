# Run command `docker build -t bookstore_container` 
# Then run `docker run -it -p 3000:3000 bookstore_container`

FROM node:ubuntu

COPY . /bookstore

WORKDIR /bookstore

RUN npm install

EXPOSE 3000

CMD node server.js