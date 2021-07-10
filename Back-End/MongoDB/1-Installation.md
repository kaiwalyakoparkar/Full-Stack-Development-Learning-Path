## Installation MongoDB (for ubuntu 20.04)

Run following commands one after other
[Referece](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)

-

```bash
sudo wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
```

-

```bash
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
```

-

```bash
sudo apt-get update
```

-

```bash
sudo apt-get install -y mongodb-org
```

-

```bash
sudo chown -R mongodb:mongodb /var/lib/mongodb
```

-

```bash
sudo chown mongodb:mongodb /tmp/mongodb-27017.sock
```

- To start db

```bash
sudo systemctl start mongod
```

-To check if db started correctly

```bash
sudo systemctl status mongod
```

-

```bash
sudo systemctl status mongod
```

-

```bash
sudo systemctl enable mongod
```

-To restart the server

```bash
sudo systemctl restart mongod
```

-To stop the server

```bash
sudo systemctl stop mongod
```

- Use Mongo DB after

```bash
mongo
```

## Installing mongodb compass

-

```bash
wget https://downloads.mongodb.com/compass/mongodb-compass_1.26.1_amd64.deb
```

-

```bash
sudo dpkg -i mongodb-compass_1.26.1_amd64.deb
```

-

```bash
mongodb-compass
```
