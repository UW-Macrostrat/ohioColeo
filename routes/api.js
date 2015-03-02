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

exports.bounds = function(req, res) {
  if (req.query.county) {
    client.query("SELECT ST_AsGeoJSON(ST_Extent(geom)) AS bounds FROM neodb.ohio WHERE name = $1", [req.query.county], function(error, data) {
      res.json(data.rows);
    });
  } else {
    res.json({"error": "Please supply a county name"});
  }
}

exports.families = function(req, res) {
  var params = [],
      joins = "",
      where = "WHERE ";

  if (req.query.oid) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " o.id = " + placeholder;
    params.push(req.query.oid);
  }

  if (req.query.taxon_name) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " t.taxon_name LIKE " + placeholder;
    params.push("%" + req.query.taxon_name + "%");
  }
  if (req.query.order) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " t.taxon_order LIKE " + placeholder;
    params.push("%" + order + "%");
  }

  if (req.query.family) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " t.taxon_family LIKE " + placeholder;
    params.push("%" + req.query.family + "%");
  }

  if (req.query.genus) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " t.taxon_genus LIKE " + placeholder;
    params.push("%" + req.query.genus + "%");
  } 

  if (req.query.species) {
    var placeholder = "$" + (params.length + 1);
    where += ((params.length > 0) ? " AND " : "") + " t.taxon_species LIKE " + placeholder;
    params.push("%" + req.query.species + "%");
  }

  if (req.query.collector) {
    var placeholder = "$" + (params.length + 1);
    joins += " JOIN neodb.occurrences_collectors oc ON o.id = oc.occurrence_id JOIN neodb.people p ON oc.collector_id = p.id ";
    where += ((params.length > 0) ? " AND " : "") + " p.last_name LIKE " + placeholder;
    params.push("%" + req.query.collector + "%");
  }

  if (req.query.county) {
    var placeholder = "$" + (params.length + 1);
    joins += " JOIN neodb.ohio ohio ON ST_Intersects(ohio.geom, o.the_geom) ";
    where += ((params.length > 0) ? " AND " : "") + " ohio.name = " + placeholder;
    params.push(req.query.county);
  }

  if (params.length < 1) {
    where = "";
  }

  //console.log(joins, where, params);

  client.query("SELECT taxon_family, count(*) as count, count(distinct concat(taxon_genus, ' ', taxon_species)) as distinct_taxa FROM neodb.occurrences o JOIN neodb.taxa t ON o.taxon_id = t.id " + joins + where + " GROUP BY taxon_family ORDER BY taxon_family asc", params, function(error, data) { 
    if (error) {
      console.log(error);
      res.json("Error on /api/familes - ", error);
    } else {
      res.json(data.rows);
    }
  });

}

exports.occurrences = function(req, res) {
  /* Possible query params:
    - county || finds all occurrences in a given county || string || exact match
    - mindate || finds all occcurrences with a collection_date_start younger than the given date || YYYY-MM-DD
    - maxdate || finds all occurrences with a collection_date_start older than the given date || YYYY-MM-DD
    - oid || finds all occurrences with a given occurrence id || int || exact match
    - taxon_name || finds all occurrences given a taxonomic name || string || exact match
    - order || finds all occurrences given a order || string || exact match
    - family || finds all occurrences given a family || string || exact match
    - genus || finds all occurrences given a genus || string || exact match
    - species || finds all occurrences given a species|| string || exact match
    - collector || finds all occurrences given a collector last name || string || exact match

  ** id and taxon_name are different ways to apply essentially the same filter **
  
  */

  var params = [];
  var query = "\
    SELECT DISTINCT ON (o.id) o.id, to_char(o.collection_date_start, 'Mon DD, YYYY') AS collection_start_date, to_char(o.collection_date_end, 'Mon DD, YYYY') AS collection_end_date, o.location_note, o.n_total_specimens, o.n_male_specimens, o.n_female_specimens, o.only_observed, ST_AsLatLonText(o.the_geom, 'D.DDDDDD') AS geometry, o.fips, CONCAT(p.first_name, ' ', p.last_name) AS collector, p.id AS collector_id, t.id AS taxon_id, t.taxon_name, t.common_name, t.taxon_author, t.taxon_family, t.pbdb_family_no, t.taxon_genus, t.pbdb_genus_no, t.taxon_species, t.pbdb_species_no, cm.id AS collection_method_id, cm.collection_method, b.id AS bait_id, b.bait, media.id AS collection_medium_id, media.collection_medium, n.id AS note_id, n.note, e.id AS environ_id, e.environ, i.id AS image_id, i.main_file AS image, i.description AS image_description, to_char(i.image_date, 'Mon DD, YYYY') AS image_date, ST_AsLatLonText(i.the_geom, 'D.DDDDDD') AS image_geometry, CONCAT(p3.first_name, ' ', p3.last_name) AS photographer, p3.id AS photographer_id, gb.id AS geom_basis_id, gb.geom_basis, CONCAT(p2.first_name, ' ', p2.last_name) AS determiner, p2.id AS determiner_id \
    FROM neodb.occurrences o \
    LEFT JOIN neodb.taxa t ON o.taxon_id = t.id \
    LEFT JOIN neodb.collection_methods cm ON o.method_id = cm.id \
    LEFT JOIN neodb.baits b ON o.bait_id = b.id \
    LEFT JOIN neodb.collection_media media ON o.medium_id = media.id \
    LEFT JOIN neodb.notes n ON o.note_id = n.id \
    JOIN neodb.occurrences_collectors oc ON o.id = oc.occurrence_id \
    JOIN neodb.people p ON oc.collector_id = p.id \
    LEFT JOIN neodb.occurrences_environments oe ON o.id = oe.occurrence_id \
    LEFT JOIN neodb.environments e ON oe.environment_id = e.id \
    LEFT JOIN neodb.occurrences_images oi ON o.id = oi.occurrence_id \
    LEFT JOIN neodb.images i ON oi.image_id = i.id \
    LEFT JOIN neodb.people p3 ON i.photographer_id = p3.id \
    LEFT JOIN neodb.opinions ops ON o.id = ops.occurrence_id \
    LEFT JOIN neodb.people p2 ON ops.determiner_id = p2.id \
    LEFT JOIN neodb.geom_bases gb ON o.geom_basis_id = gb.id \
    ";


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
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id = " + placeholder + "))) ";
      params.push(req.query.oid);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id = " + placeholder + "))) ";
      params.push(req.query.oid);
    }
  }

  // If taxonomic name
  if (req.query.taxon_name) {
    if (params.length > 0) {
      var placeholder = "$" + (params.length + 1);
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = " + placeholder + " OR taxon_genus = " + placeholder + " OR taxon_species = " + placeholder + " OR taxon_family = " + placeholder + ") ";
      params.push(req.query.taxon_name);
    } else {
      var placeholder = "$" + (params.length + 1);
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = " + placeholder + " OR taxon_genus = " + placeholder + " OR taxon_species = " + placeholder + " OR taxon_family = " + placeholder + ") ";
      params.push(req.query.taxon_name);
    }
  }

  if (req.query.order) {
    var placeholder = "$" + (params.length + 1);

    if (params.length > 0) {
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_order = " + placeholder + ") ";
    } else {
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_order = " + placeholder + ") ";
    }
    params.push(req.query.order);
  }

  if (req.query.family) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_family = " + placeholder + ") ";
    } else {
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_family = " + placeholder + ") ";
    }
    params.push(req.query.family);
  }

  if (req.query.genus) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
    } else {
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
    }
    params.push(req.query.genus);
  }

  if (req.query.species) {
    var placeholder = "$" + (params.length + 1);
    
    if (params.length > 0) {
      query += "AND o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_species = " + placeholder + ") ";
    } else {
      query += "WHERE o.taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_genus = " + placeholder + ") ";
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

  query += " ORDER BY o.id DESC";
  console.log(query);
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



exports.calendarstats = function(req, res) {
  var where = [],
      params = [];

  if (req.query.family) {
    where.push(" taxon_id IN (SELECT id FROM neodb.taxa WHERE taxon_family ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.family);
  }

  if (req.query.collector) {
    where.push(" id IN (select occurrence_id from neodb.occurrences_collectors JOIN neodb.people ON occurrences_collectors.collector_id = people.id WHERE last_name ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.collector);
  }

  if (req.query.taxon_name) {
    where.push(" taxon_id IN (select id from neodb.taxa WHERE taxon_name ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.taxon_name);
  }

  if (req.query.county) {
    where.push(" id IN (select id from neodb.occurrences join neodb.ohio on occurrences.fips = ohio.fips WHERE name ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.county);
  }

  if (req.query.order) {
    where.push(" taxon_id IN (select id from neodb.taxa WHERE taxon_order ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.order);
  }

  if (req.query.genus) {
    where.push(" taxon_id IN (select id from neodb.taxa WHERE taxon_genus ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.genus);
  }

  if (req.query.species) {
    where.push(" taxon_id IN (select id from neodb.taxa WHERE taxon_species ILIKE $" + (params.length + 1) + ")");
    params.push(req.query.species);
  }

  client.query("select date_part('month', collection_date_start) as month, count(occurrences.id) FROM neodb.occurrences " + ((where.length > 0) ? "WHERE " + where.join(", AND ")  : "") + " group by month order by month", params, function(e, data) {
    if (e) console.log(e);
    res.json(data.rows);
  });

}





