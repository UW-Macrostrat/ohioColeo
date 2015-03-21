# Ohio beetle database

### Dependencies:

- PostgreSQL 9.3 (and <a href='https://github.com/UW-Macrostrat/neodb'>neodb schema</a>)
- PostGIS 2.x
- Node/NPM (````brew install node````)
- Bower (````npm install -g bower````)
-  Jake (````npm install -g jake````)

### Getting started:
1. Clone this repo
2. Edit the database configuration in ````setup.sh````
2. ````./setup.sh````
9.  Rename ````routes/credentials.js.example```` to ````routes/credentials.js````
10.  Edit ````routes/credentials.js```` with your credentials
11.  You must make sure that the user handling scripts has write permissions to the directory containing images /public/images
