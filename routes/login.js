var pg = require('pg'),
    credentials = require("./credentials");

// Create postgres connection object
var connString = "postgres://" + credentials.user + "@" + credentials.host + ":" + credentials.port + "/" + credentials.database,
  client = new pg.Client(connString);

// Connect to postgres
client.connect(function(error, success) {
  if (error) {
    console.log("Could not connect to postgres");
  }
});


exports.login = function(req, res) {
  client.query(credentials.checkLogin, [req.body.email, req.body.password], function(err, result) {
    if (err) {
      console.log(err);
    }
    // Store user ID and name in a cookie
    req.session.user_id = result.rows[0].id;
    req.session.name = result.rows[0].first_name + " " + result.rows[0].last_name;
    req.session.last_name = result.rows[0].last_name;
    req.session.institution_id = result.rows[0].institution_id;

    // Redirect back to whatever page they are currently on
    res.redirect('back');
  });
}

exports.logout = function(req, res) {
  if (req.session && req.session.user_id) {
    delete req.session.user_id;
  }
  
  res.redirect('/');
}

exports.verify = function(req, res) {
  req.query.email = decodeURIComponent(req.query.email);
  if (req.query.password) {
    req.query.password = decodeURIComponent(req.query.password);
  }
  
  if (req.query.email && req.query.password) {
    client.query("SELECT EXISTS (SELECT 1 FROM neodb.people WHERE email = $1 AND password = md5($2)) AS exists", [req.query.email, req.query.password], function(err, result) {
      if (err) {
        console.log(err);
      }
      res.json(result.rows[0].exists);
    });
  } else {
    client.query("SELECT EXISTS (SELECT 1 FROM neodb.people WHERE email = $1) AS exists", [req.query.email], function(err, result) {
      if (err) {
        console.log(err);
      }
      res.json(result.rows[0].exists);
    });
  }
}