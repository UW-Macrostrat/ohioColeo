var express = require('express'),
    cons = require('consolidate'),
    standard = require('./routes/routes'),
    login = require('./routes/login'),
    upload = require('./routes/upload'),
    api = require('./routes/api'),
    app = express();

app.set('port', 8081);
app.engine('html', cons.mustache);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// GZIP responses
app.use(express.compress());

// Ensures we can read the parameters of a POST request
app.use(express.bodyParser({uploadDir: __dirname + '/uploads', limit: '150mb'}));
app.use(express.logger('dev'));
app.use(express.cookieParser()); 
app.use(express.methodOverride());
app.use(express.session({secret: '1234567890QWERTY'}));
app.use(express.errorHandler());
app.enable('trust proxy');

// Check if user is logged in on certain routes
function checkAuth(req, res, next) {
  if (!req.session.user_id) {
    res.send(401);
  } else {
    next();
  }
}

// Simple page routes
app.get('/', standard.root);
app.get('/occurrences', standard.occurrences);
app.get('/families', standard.family);
app.get('/map', standard.map);
app.get('/mybeetles', checkAuth, standard.mybeetles);

// Upload form routes
app.get('/addBeetle', checkAuth, upload.upload);
app.get('/addBeetle/:form', checkAuth, upload.upload);
app.post('/addBeetle', checkAuth, upload.uploadPost);
app.get('/addBeetleSuccess', checkAuth, upload.success);

app.get('/edit', checkAuth, standard.edit);
app.post('/edit', checkAuth, standard.editUpdate);

app.get('/delete', checkAuth, standard.deleteBeetle);

app.get('/download', standard.download);

// Log in and out
app.post('/verify', login.verify); // Boolean check of email and password
app.post('/login', login.login);
app.get('/logout', login.logout);

// Get data
app.get('/api/map', api.map);
app.get('/api/map/bounds', api.bounds);
app.get('/api/families', api.families);
app.get('/api/occurrences', api.occurrences);
app.get('/api/autocomplete', api.autocomplete);
app.get('/api/autocomplete/:type', api.autocomplete);
app.get('/api/calendar', api.calendarstats);
app.get('/api/stats', api.stats);

// Handle 404
app.use(function(req, res) {
   res.send('404: Page not Found', 404);
});

// Handle 500
app.use(function(error, req, res, next) {
   res.send('500: Internal Server Error - ' + error, 500);
});

app.listen(app.get('port'), function() {
  console.log('Beetle app listening on port ' + app.get('port'));
});
