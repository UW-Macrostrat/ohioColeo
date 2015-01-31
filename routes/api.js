var pg = require('pg'),
    async = require("async"),
    credentials = require('./credentials'),
    dbg = require("dbgeo");

// Create postgres connection object
var connString = "postgres://" + credentials.user + "@" + credentials.host + ":" + credentials.port + "/" + credentials.database,
    client = new pg.Client(connString);

// Connect to postgres
client.connect(function(error, success) {
  if (error) {
    console.log("Could not connect to postgres");
  }
});

// Fetches the map data and returns a valid GeoJSON
exports.map = function(req, res) {
  if (req.query.taxon) {
    client.query("\
      SELECT ohio.fips, ohio.geometry, ohio.name, t.count FROM \
        (SELECT ohio.fips, count (o.fips) as count, ST_AsGeoJSON(ohio.geom) AS geometry, ohio.name \
         from neodb.occurrences o \
         FULL OUTER JOIN neodb.ohio ohio ON o.fips = ohio.fips \
         GROUP BY ohio.fips, ohio.geom, ohio.name \
        ) ohio \
         FULL OUTER JOIN \
          (SELECT o.fips, count (o.occFips) as count \
           FROM (SELECT ohio.fips, o.fips AS occFips, o.taxon_id \
           from neodb.occurrences o \
           FULL OUTER JOIN neodb.ohio ohio ON o.fips = ohio.fips \
           GROUP BY ohio.fips, o.fips, o.taxon_id \
          ) o \
      INNER JOIN \
      (SELECT id FROM neodb.taxa WHERE taxon_name = $1) t ON o.taxon_id = t.id \
      GROUP BY o.fips) t \
      ON ohio.fips = t.fips", [req.query.taxon], function(error, result) {
        dbg.parse({
          "data": result.rows,
          "geometryColumn": "geometry",
          "geometryType": "geojson",
          "callback": function(error, result) {
            res.json(result);
          }
        });
    });
  } else {
    client.query("SELECT ohio.fips, count (o.fips) as count, ST_AsGeoJSON(ohio.geom) AS geometry, ohio.name from neodb.occurrences o FULL OUTER JOIN neodb.ohio ohio ON o.fips = ohio.fips GROUP BY ohio.fips, ohio.geom, ohio.name", [], function(error, result) {
        dbg.parse({
          "data": result.rows,
          "geometryColumn": "geometry",
          "geometryType": "geojson",
          "callback": function(error, result) {
            res.json(result);
          }
        });
    });
  }
}

exports.mapCounty = function(req, res) {
  if (req.query.county) {
    client.query("SELECT taxon_family, count(*) as count FROM neodb.occurrences o JOIN neodb.taxa t ON o.taxon_id = t.id JOIN neodb.ohio ohio ON ST_Intersects(ohio.geom, o.the_geom) WHERE ohio.name = $1 GROUP BY taxon_family", [req.query.county], function(error, data) {
      res.json(data.rows);
    });
  } else {
    res.json({"error": "Please supply a county name"});
  }
}

exports.bounds = function(req, res) {
  if (req.query.county) {
    client.query("SELECT ST_AsGeoJSON(ST_Extent(geom)) AS bounds FROM neodb.ohio WHERE name = $1", [req.query.county], function(error, data) {
      res.json(data.rows);
    });
  } else {
    res.json({"error": "Please supply a county name"});
  }
}

exports.occurrences = function(req, res) {
  /* Possible query params:
    - county || finds all occurrences in a given county || string || exact match
    - mindate || finds all occcurrences with a collection_date_start younger than the given date || YYYY-MM-DD
    - maxdate || finds all occurrences with a collection_date_start older than the given date || YYYY-MM-DD
    - oid || finds all occurrences like a given an occurrence id || int || exact match
    - taxon_name || finds all occurrences given a taxonomic name || string || exact match
    - collector || finds all occurrences given a collector last name || string || exact match

  ** id and taxon_name are different ways to apply essentially the same filter **
  
  */
  console.log(req.query);
  var params = [];

  var query = "SELECT o.id, to_char(o.collection_date_start, 'Mon DD, YYYY') AS collection_start_date, to_char(o.collection_date_end, 'Mon DD, YYYY') AS collection_end_date, o.location_note, o.n_total_specimens, o.only_observed, ST_AsLatLonText(o.the_geom, 'D.DDDDDD') AS geometry, o.fips, CONCAT(p.first_name, ' ', p.last_name) AS collector, p.id AS collector_id, t.taxon_name, t.common_name, t.taxon_author, t.taxon_family, t.taxon_genus, t.taxon_species, cm.collection_method, b.bait, media.collection_medium, n.note, e.environ, i.main_file AS image, i.description AS image_description, ST_AsLatLonText(i.the_geom, 'D.DDDDDD') AS image_geometry, gb.geom_basis FROM neodb.occurrences o LEFT OUTER JOIN neodb.taxa t ON o.taxon_ID = t.id LEFT OUTER JOIN neodb.collection_methods cm ON o.method_id = cm.id LEFT OUTER JOIN neodb.baits b ON o.bait_id = b.id LEFT OUTER JOIN neodb.collection_media media ON o.medium_id = media.id LEFT OUTER JOIN neodb.notes n ON o.note_id = n.id INNER JOIN neodb.occurrences_collectors oc ON o.id = oc.occurrence_id INNER JOIN neodb.people p ON oc.collector_id = p.id LEFT OUTER JOIN neodb.occurrences_environments oe ON o.id = oe.occurrence_id LEFT OUTER JOIN neodb.environments e ON oe.environment_id = e.id LEFT OUTER JOIN neodb.occurrences_images oi ON o.id = oi.occurrence_id LEFT OUTER JOIN neodb.images i ON oi.image_id = i.id LEFT OUTER JOIN neodb.geom_bases gb ON o.geom_basis_id = gb.id ";

  if (req.query.county && req.query.county !== "") {
    var placeholder = "$" + (params.length + 1);
    query += "RIGHT JOIN neodb.ohio ohio ON ST_Intersects(ohio.geom, o.the_geom) WHERE ohio.name = " + placeholder;
    params.push(req.query.county);
  }

  // mindate = all occurrences younger than
  if (req.query.mindate) {
    if (req.query.maxdate) {
      // If both min and max date specified
      if (params.length > 0) {
        query += "AND collection_date_start >= '" + ("$" + (params.length + 1)) + "' AND collection_date_start < '" + ("$" + (params.length + 2)) + "' ";
        params.push(req.query.mindate);
        params.push(req.query.maxdate);
      } else {
        query += "WHERE collection_date_start >= '" + ("$" + (params.length + 1)) + "' AND collection_date_start < '" + ("$" + (params.length + 2)) + "' ";
        params.push(req.query.mindate);
        params.push(req.query.maxdate);
      }
    } else {
      // If only min date specified
      if (params.length > 0) {
        var placeholder = "$" + (params.length + 1);
        query += "AND collection_date_start >= " + placeholder;
        params.push(req.query.mindate);
      } else {
        var placeholder = "$" + (params.length + 1);
        query += "WHERE collection_date_start >= " + placeholder;
        params.push(req.query.mindate);
      }
    }
    
  // maxdate = all occurrences older than 
  } else if (req.query.maxdate) {
    // If only maxdate specified
    if (params.length > 0) {
      var placeholder = "$" + (params.length + 1);
      query += "AND collection_date_start <= " + placeholder;
      params.push(req.query.maxdate);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE collection_date_start <= " + placeholder;
      params.push(req.query.maxdate);
    }
  }

  // If occurrence id
  if (req.query.oid) {
    if (params.length > 0) {
      var placeholder = "$" + (params.length + 1);
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id = " + placeholder + "))) ";
      params.push(req.query.oid);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id = " + placeholder + "))) ";
      params.push(req.query.oid);
    }
  }

  // If taxonomic name
  if (req.query.taxon_name) {
    if (params.length > 0) {
      var placeholder = "$" + (params.length + 1);
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = " + placeholder + " OR taxon_genus = " + placeholder + " OR taxon_species = " + placeholder + " OR taxon_family = " + placeholder + ") ";
      params.push(req.query.taxon_name);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = " + placeholder + " OR taxon_genus = " + placeholder + " OR taxon_species = " + placeholder + " OR taxon_family = " + placeholder + ") ";
      params.push(req.query.taxon_name);
    }
  }

  if (req.query.order) {
    var placeholder = "$" + (params.length + 1);

    if (params.length > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_order = " + placeholder + ") ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_order = " + placeholder + ") ";
    }
    params.push(req.query.order);
  }

  if (req.query.family) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_family = " + placeholder + ") ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_family = " + placeholder + ") ";
    }
    params.push(req.query.family);
  }

  if (req.query.genus) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
    }
    params.push(req.query.genus);
  }

  if (req.query.species) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_species = " + placeholder + ") ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
    }
    params.push(req.query.species);
  }

  // If collector
  if (req.query.collector && req.query.collector !== "") {
    if (params.length > 0) {
      var placeholder = "$" + (params.length + 1);
      query += "AND p.last_name =" + placeholder;
      params.push(req.query.collector);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE p.last_name =" + placeholder;
      params.push(req.query.collector);
    }
  } 

  query += " ORDER BY o.created_on DESC";

  client.query(query, params, function(err, result) {
    if (err) {
      console.log(err);
      console.log(query);
      res.send(err);
    } else {
      if (result.rows.length > 0) {
        var keys = Object.keys(result.rows[0]);

        async.each(result.rows, function(row, callback) {
          async.each(keys, function(key, callbackB) {
            if (row[key] === "unknown") {
              row[key] = "";
            } else if (row[key] === "none") {
              row[key] = "";
            } else if (!row[key]) {
              row[key] = "";
            }
            callbackB();
          }, function(error) {
            callback();
          })
        }, function(err) {
          // Handy for debugging
          result.query = query;
          res.json(result.rows);
        });
      } else {
        res.json([]);
      }
      
    }
      
  });
}

// Fuel for the autocomplete search
exports.autocomplete = function(req, res) {
  req.params.type = req.params.type.replace(".json", "");
  var options = {
    "taxa": "SELECT DISTINCT taxon_name AS name FROM neodb.taxa ORDER BY taxon_name ASC",
    "order": "SELECT DISTINCT taxon_order AS name FROM neodb.taxa ORDER BY taxon_order ASC",
    "family": "SELECT DISTINCT taxon_family AS name FROM neodb.taxa ORDER BY taxon_family ASC",
    "genus": "SELECT DISTINCT taxon_genus AS name FROM neodb.taxa ORDER BY taxon_genus ASC",
    "species": "SELECT DISTINCT taxon_species AS name FROM neodb.taxa ORDER BY taxon_species ASC",
    "collectors": "SELECT CONCAT(first_name, ' ', last_name) AS name, last_name FROM neodb.people ORDER BY last_name ASC",
    "counties": "SELECT DISTINCT name FROM neodb.ohio"
  }

  if (!(req.params.type in options)) {
    res.json({"error": "you must supply a valid option", "options": ["taxa", "collectors", "county"]});
  } else {
    client.query(options[req.params.type], function(err, result) {
      res.json(result.rows);
    });
  }
}
