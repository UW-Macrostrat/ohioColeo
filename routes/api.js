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

// Helpers via http://stackoverflow.com/questions/12766289/format-geojson-from-postgis
function FeatureCollection(){
  this.type = 'FeatureCollection';
  this.features = new Array();
}

function Feature(){
  this.type = 'Feature';
  this.geometry = new Object;
  this.properties = new Object;
} 

// Fetches the map data and returns a valid GeoJSON
exports.map = function(req, res) {
  client.query("SELECT name, taxa, ST_AsGeoJSON(geom) as geometry FROM ohio_summary", function(err, result) {
    if (err) {
      console.log("Error retrieving map data - ", err);
    } else {

      // Build a GeoJSON and return it
      var featureCollection = new FeatureCollection();

      for (var i=0; i < result.rows.length; i++) {
        var feature = new Feature();
        feature.geometry = JSON.parse(result.rows[i].geometry);
        feature.properties = {"name": result.rows[i].name, "occurrences": result.rows[i].taxa};
        featureCollection.features.push(feature);
      }

      res.jsonp(featureCollection);
    }
  });
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
  var params = 0;

  var query = "SELECT o.id, to_char(o.collection_date_start, 'Mon DD, YYYY') AS collection_start_date, to_char(o.collection_date_end, 'Mon DD, YYYY') AS collection_end_date, o.location_note, o.n_total_specimens, o.only_observed, ST_AsLatLonText(o.the_geom, 'D.DDDDDD') AS geometry, o.fips, CONCAT(p.first_name, ' ', p.last_name) AS collector, p.id AS collector_id, t.taxon_name, t.common_name, t.taxon_author, t.taxon_family, t.taxon_genus, t.taxon_species, cm.collection_method, b.bait, media.collection_medium, n.note, e.environ, i.main_file AS image, i.description AS image_description, ST_AsLatLonText(i.the_geom, 'D.DDDDDD') AS image_geometry, gb.geom_basis FROM neodb.occurrences o LEFT OUTER JOIN neodb.taxa t ON o.taxon_ID = t.id LEFT OUTER JOIN neodb.collection_methods cm ON o.method_id = cm.id LEFT OUTER JOIN neodb.baits b ON o.bait_id = b.id LEFT OUTER JOIN neodb.collection_media media ON o.medium_id = media.id LEFT OUTER JOIN neodb.notes n ON o.note_id = n.id INNER JOIN neodb.occurrences_collectors oc ON o.id = oc.occurrence_id INNER JOIN neodb.people p ON oc.collector_id = p.id LEFT OUTER JOIN neodb.occurrences_environments oe ON o.id = oe.occurrence_id LEFT OUTER JOIN neodb.environments e ON oe.environment_id = e.id LEFT OUTER JOIN neodb.occurrences_images oi ON o.id = oi.occurrence_id LEFT OUTER JOIN neodb.images i ON oi.image_id = i.id LEFT OUTER JOIN neodb.geom_bases gb ON o.geom_basis_id = gb.id ";

  if (req.query.county) {
    if (req.query.county === "") {
      query += "";
    } else {
      query += "RIGHT JOIN neodb.ohio ohio ON ST_INTERSECTS(ohio.geom, o.the_geom) WHERE ohio.name = '" + req.query.county + "' ";
    }
    
    params += 1;
  }

  // mindate = all occurrences younger than
  if (req.query.mindate) {
    if (req.query.maxdate) {
      // If both min and max date specified
      if (params > 0) {
        query += "AND collection_date_start >= '" + req.query.mindate + "' AND collection_date_start < '" + req.query.maxdate + "' ";
      } else {
        query += "WHERE collection_date_start >= '" + req.query.mindate + "' AND collection_date_start < '" + req.query.maxdate + "' ";
      }
    } else {
      // If only min date specified
      if (params > 0) {
        query += "AND collection_date_start >= '" + req.query.mindate + "' ";
      } else {
        query += "WHERE collection_date_start >= '" + req.query.mindate + "' ";
      }
    }
    
    params += 1;
  // maxdate = all occurrences older than 
  } else if (req.query.maxdate) {
    // If only maxdate specified
    if (params > 0) {
      query += "AND collection_date_start <= '" + req.query.maxdate + "' ";
    } else {
      query += "WHERE collection_date_start <= '" + req.query.maxdate + "' ";
    }
    params += 1;
  }

  // If occurrence id
  if (req.query.oid) {
    if (params > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id =" + req.query.oid + "))) ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name in (SELECT taxon_name FROM neodb.taxa WHERE id in (SELECT taxon_id FROM neodb.occurrences WHERE id =" + req.query.oid + "))) ";
    }
    params += 1;
  }

  // If taxonomic name
  if (req.query.taxon_name) {
    if (params > 0) {
      query += "AND taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = '" + req.query.taxon_name + "') ";
    } else {
      query += "WHERE taxon_id in (SELECT id FROM neodb.taxa WHERE taxon_name = '" + req.query.taxon_name + "') ";
    }
    params += 1;
  }

  // If collector
  if (req.query.collector && req.query.collector === "") {
    query += "";
  } else if (req.query.collector) {
    if (params > 0) {
      query += "AND p.last_name = '" + req.query.collector + "' ";
    } else {
      query += "WHERE p.last_name = '" + req.query.collector + "' ";
    }
  }

  query += "ORDER BY o.collection_date_start DESC";

  client.query(query, function(err, result) {
    if (err) {
      console.log(err);
      console.log(query);
      res.send(err);
    } else {
      // Handy for debugging
      result.query = query;
      res.jsonp(result.rows);
    }
      
  });
}

// Distinct taxa for the taxa typeahead
exports.taxa = function(req, res) {
  var query = "SELECT DISTINCT taxon_name FROM neodb.taxa ORDER BY taxon_name ASC;"

  client.query(query, function(err, result) {
    res.jsonp(result.rows);
  });
}