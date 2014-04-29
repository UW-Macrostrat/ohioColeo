var pg = require('pg'),
    credentials = require('./credentials');

// Create postgres connection object
var connString = "postgres://" + credentials.user + "@" + credentials.host + ":" + credentials.port + "/" + credentials.database,
  client = new pg.Client(connString);

// Connect to postgres
client.connect(function(error, success) {
  if (error) {
    console.log("Could not connect to postgres");
  }
});

exports.root = function(req, res) {
  // TODO: Make collectors and counties unqiue api routes
  var collectors, 
      counties;

  client.query("SELECT CONCAT(p.first_name , ' ' , p.last_name) AS name, p.last_name as last_name, p.id FROM neodb.people p WHERE p.id IN (SELECT DISTINCT oc.collector_id FROM neodb.occurrences_collectors oc) ORDER BY p.last_name ASC;", function(err, rows, fields) {
    collectors = rows.rows;
  });

  client.query("SELECT name, fips FROM ohio_summary WHERE taxa > 0 ORDER BY name ASC;", function(err, rows, fields) {
    counties = rows.rows;

    res.render('index', {
      loggedin: (req.session.user_id) ? true : false,
      username: (req.session.user_id) ? req.session.name : "",
      collectors: collectors,
      partials: {
        header: "partials/navbar"
      }
    });
  });
}

exports.occurrences = function(req, res) {
  /*
     Can accept req.query.id || req.query.county
     Either way, same template is rendered and client handles the request for data
  */
  res.render('occurrences', {
    loggedin: (req.session.user_id) ? true : false,
    username: (req.session.user_id) ? req.session.name : "",
    partials: {
      header: "partials/navbar"
    }
  });
}