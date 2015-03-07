var pg = require('pg'),
    credentials = require('./credentials'),
    async = require('async'),
    csv = require('express-csv');

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
      last_name: (req.session.last_name) ? req.session.last_name : "",
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
    last_name: (req.session.last_name) ? req.session.last_name : "",
    partials: {
      header: "partials/navbar"
    }
  });
}

exports.family = function(req, res) {
  res.render('family', {
    loggedin: (req.session.user_id) ? true : false,
    username: (req.session.user_id) ? req.session.name : "",
    last_name: (req.session.last_name) ? req.session.last_name : "",
    partials: {
      header: "partials/navbar"
    }
  });
}

exports.mybeetles = function(req, res) {
  /*
     Can accept req.query.id || req.query.county
     Either way, same template is rendered and client handles the request for data
  */
  res.render('mybeetles', {
    loggedin: (req.session.user_id) ? true : false,
    username: (req.session.user_id) ? req.session.name : "",
    last_name: (req.session.last_name) ? req.session.last_name : "",
    partials: {
      header: "partials/navbar"
    }
  });
}

exports.deleteBeetle = function(req, res) {
  // Verify ownership
  client.query("SELECT enterer_id FROM neodb.occurrences WHERE id = $1", [req.query.id], function(error, response) {
    if (error) {
      console.log(error);
    } else {
      if (response.rows[0].enterer_id === req.session.user_id) {
        // DELETE IT
        console.log("DELETING");
        async.series([
          function(callback) {
            client.query("delete from neodb.occurrences_environments where occurrence_id = $1", [req.query.id], function(e, d) {
              if (e) {
                callback(e);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("delete from neodb.opinions where occurrence_id = $1", [req.query.id], function(e, d) {
              if (e) {
                callback(e);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("delete from neodb.occurrences_collectors where occurrence_id = $1;", [req.query.id], function(e, d) {
              if (e) {
                callback(e);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("delete from neodb.occurrences_images where occurrence_id = $1;", [req.query.id], function(e, d) {
              if (e) {
                callback(e);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("delete from neodb.occurrences where id = $1;", [req.query.id], function(e, d) {
              if (e) {
                callback(e);
              } else {
                callback(null);
              }
            });
          },

        ], function(err, result) {
          if (err) {
            console.log("ERROR DELETEING - ", err);
            res.send("Something went wrong...");
          } else {
            res.redirect("/myBeetles?collector=" + req.session.last_name);
          }
        });

      }
    }
  });
  //Delete
}


exports.edit = function(req, res) {
  client.query("SELECT enterer_id FROM neodb.occurrences WHERE id = $1", [req.query.id], function(error, response) {
    if (error) {
      console.log(error);
    } else {

      async.parallel({
        people: function(callback) {
            client.query("SELECT id, first_name || ' ' || last_name as name FROM neodb.people ORDER BY last_name ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
        collection_methods: function(callback) {
            client.query("SELECT id, collection_method FROM neodb.collection_methods ORDER BY lower(collection_method) ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
        baits: function(callback) {
            client.query("SELECT id, bait FROM neodb.baits ORDER BY lower(bait) ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
        collection_media: function(callback) {
            client.query("SELECT id, collection_medium FROM neodb.collection_media ORDER BY lower(collection_medium) ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
        geom_bases: function(callback) {
            client.query("SELECT id, geom_basis FROM neodb.geom_bases ORDER BY lower(geom_basis) ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
        environments: function(callback) {
            client.query("SELECT id, environ FROM neodb.environments ORDER BY lower(environ) ASC", function(err, result) {
                callback(null, result.rows);
            });
        },
    },
    function(error, results) {
        res.render("editBeetle", {
            loggedin: (req.session.user_id) ? true : false,
            username: (req.session.user_id) ? req.session.name : "",
            people: results.people,
            collection_methods: results.collection_methods,
            baits: results.baits,
            collection_media: results.collection_media,
            geom_bases: results.geom_bases,
            environments: results.environments
        });
    });

      //if (response.rows[0].enterer_id === req.session.user_id) {

      //}
    }
  });
}


exports.editUpdate = function(req, res) {
  client.query("SELECT enterer_id FROM neodb.occurrences WHERE id = $1", [req.query.id], function(error, response) {
    if (error) {
      console.log(error);
    } else {
      //if (response.rows[0].enterer_id === req.session.user_id) {
        // Good to go
        // update taxa
        Object.keys(req.body).forEach(function(d) {
          if (req.body[d] == '') {
            switch (d) {
              case 'collection_method' :
                return req.body[d] = 0;
              case 'bait_type':
                return req.body[d] = 0;
              case 'environ' :
                return req.body[d] = 0;
              case 'collection_method' :
                return req.body[d] = 0;
              case 'n_male_specimens' :
                return req.body[d] = 0;
              case 'n_female_specimens' :
                return req.body[d] = 0;
              case 'pbdb_genus_no' :
                return req.body[d] = 0;
              case 'pbdb_species_no' :
                return req.body[d] = 0;
              case 'n_total_specimens' :
                return req.body[d] = 0;
              case 'taxon_species' :
                return req.body[d] = '';
              case 'taxon_genus' :
                return req.body[d] = '';
              case 'common_name' :
                return req.body[d] = '';
              case 'taxon_author' :
                return req.body[d] = '';
              default :
                return req.body[d] = null;
            }
          }
        });
        console.log(req.body);
        async.parallel([
          function(callback) {
            client.query("UPDATE neodb.taxa SET taxon_family = $1, common_name = $2, taxon_genus = $3, taxon_species = $4, pbdb_genus_no = $5, pbdb_species_no = $6, taxon_author = $7, pbdb_family_no = $8 WHERE id = $9", [req.body.taxon_family, req.body.common_name, req.body.taxon_genus, req.body.taxon_species, req.body.pbdb_genus_no, req.body.pbdb_species_no, req.body.taxon_author, req.body.pbdb_family_no, req.body.taxon_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("UPDATE neodb.opinions SET determiner_id = $1 WHERE occurrence_id = $2", [req.body.determiner, req.body.occurrence_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            var coords = (req.body.lat) ? ("POINT(" + req.body.lng + " " + req.body.lat + ")") : null;
            client.query("UPDATE neodb.occurrences SET n_total_specimens = $1, n_male_specimens = $2, n_female_specimens = $3, the_geom = ST_GeomFromText($4, 4326), geom_basis_id = $5, location_note = $6, collection_date_start = to_date($7, 'Mon DD, YYYY'), collection_date_end = to_date($8, 'Mon DD, YYYY'), method_id = $9, bait_id = $10, medium_id = $11 WHERE id = $12", [req.body.n_total_specimens, req.body.n_male_specimens, req.body.n_female_specimens, coords, req.body.geom_basis, req.body.location_note, req.body.collection_start_date, req.body.collection_end_date, req.body.collection_method, req.body.bait_type, req.body.medium_id, req.body.occurrence_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("UPDATE neodb.occurrences_environments SET environment_id = $1 WHERE occurrence_id = $2", [req.body.environ, req.body.occurrence_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            client.query("UPDATE neodb.occurrences_collectors SET collector_id = $1 WHERE occurrence_id = $2", [req.body.collector, req.body.occurrence_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            if (req.body.note.length < 2) {
              return callback(null);
            }

            client.query("UPDATE neodb.notes SET note = $1 WHERE id = $2", [req.body.note, req.body.note_id], function(error, r) {
              if (error) {
                callback(error);
              } else {
                callback(null);
              }
            });
          },

          function(callback) {
            var coords = (req.body.photolat) ? ("POINT(" + req.body.photolng + " " + req.body.photolat + ")") : null
            client.query("UPDATE neodb.images SET photographer_id = $1, description = $2, image_date = to_date($3, 'Mon DD, YYYY'), the_geom = ST_GeomFromText($4, 4326) WHERE id = $5", [parseInt(req.body.photographer), req.body.image_description, req.body.image_date, coords, req.body.image_id.replace(".jpg", "") ], function(error, r) {
              if (error) {
                callback(error);
              } else {
                console.log("Updated images");
                callback(null);
              }
            });
          }
        ], function(error, d) {
          if (error) {
            console.log(error);
            res.json("Something went wrong");
          } else {
            res.redirect("/myBeetles?collector=" + req.session.last_name);
          }
        });

      //} else {
      //  res.redirect("/")
     // }
    }
  });
}

exports.download = function(req, res) {
  client.query("SELECT  occurrences.id, ST_AsLatLonText(occurrences.the_geom) geom, geom_basis, 'OH' AS state, ohio.name AS county, location_note, taxon_name, taxon_author, taxon_family, taxon_genus, taxon_species, taxon_subspecies, pbdb_family_no,pbdb_genus_no,pbdb_species_no,pbdb_subspecies_no,concat(determiner.first_name, ' ', determiner.last_name) determined_by, concat(collector.first_name, ' ', collector.last_name) collected_by, concat(enterer.first_name, ' ', enterer.last_name) entered_by,  TO_CHAR(collection_date_start, 'DD Mon YYYY') collection_date_start, TO_CHAR(collection_date_end, 'DD Mon YYYY') collection_date_end, collection_method, bait,collection_medium,environ,environ_type,n_total_specimens,n_male_specimens,n_female_specimens,institution_name, notes.note, to_char(occurrences.created_on, 'DD Mon YYYY') created_on,to_char(occurrences.modified_on, 'DD Mon YYYY') modified_on \
  FROM neodb.occurrences \
  LEFT JOIN neodb.geom_bases ON geom_basis_id = geom_bases.id \
  LEFT JOIN neodb.collection_methods ON method_id=collection_methods.id \
  LEFT JOIN neodb.baits ON bait_id=baits.id \
  LEFT JOIN neodb.occurrences_environments ON occurrences_environments.occurrence_id=occurrences.id \
  LEFT JOIN neodb.environments ON environment_id=environments.id \
  LEFT JOIN neodb.taxa ON taxon_id=taxa.id \
  LEFT JOIN neodb.collection_media ON collection_media.id=medium_id \
  LEFT JOIN neodb.opinions ON occurrences.id=neodb.opinions.occurrence_id \
  LEFT JOIN neodb.people determiner ON determiner_id=determiner.id \
  LEFT JOIN neodb.occurrences_collectors ON occurrences_collectors.occurrence_id=occurrences.id \
  LEFT JOIN neodb.people collector ON collector_id=collector.id \
  LEFT JOIN neodb.people enterer ON enterer_id=enterer.id \
  LEFT JOIN neodb.institutions ON institutions.id=repository_id \
  LEFT JOIN neodb.notes ON note_id=notes.id \
  JOIN neodb.ohio ON ohio.fips=occurrences.fips", function(error, result) {
    res.csv(result.rows, true);
  });
}








