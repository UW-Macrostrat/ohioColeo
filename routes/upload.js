var pg = require('pg'),
    async = require('async'),
    easyimg = require('easyimage'),
    fs = require('fs'),
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

// Route for rendering the upload form
exports.upload = function(req, res) {
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
        res.render("upload", {
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
}

// Route for processing the upload form
exports.uploadPost = function(req, res) {
    // Store the contents of the form for (possible) use later
    req.session.upload = req.body;
    console.log(req.body);

    // Create a date for use throughout
    var d = new Date(),
        year = d.getFullYear(),
        month = d.getMonth() + 1,
        day = d.getDate(),
        fullDate = year + "-" + month + "-" + day;

    /* Because many of the SQL inserts depend on values from prior statements, the 
       logic is compartamentalized into a few different async.js control flows.
       
       async.parallel - all functions execute in parallel. Once done, callback is called
       async.waterfall - functions are called in order, passing values between functions
    */

    async.parallel({
        "taxa": function(callback) {
            // Determine which rank should be used for the taxon name and rank
            if (req.body.species) {
                var taxon_name = req.body.genus + " " + req.body.species,
                    taxon_rank = 'species';
            } else if (req.body.genus) {
                var taxon_name = req.body.genus,
                    taxon_rank = 'genus';
            } else {
                var taxon_name = req.body.family,
                    taxon_rank = 'family';
            }
            
            var pbdb_family_no = parseInt(req.body.pbdb_family_no),
                pbdb_genus_no = parseInt(req.body.pbdb_genus_no) || 0,
                pbdb_species_no = parseInt(req.body.pbdb_species_no) || 0;

            // Put it in the database
            client.query("INSERT INTO neodb.taxa (taxon_name, taxon_author, common_name, taxon_family, taxon_genus, taxon_species, taxon_rank, created_on, modified_on, pbdb_family_no, pbdb_genus_no, pbdb_species_no) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now(), $8, $9, $10) RETURNING id", [taxon_name, req.body.author, req.body.common_name, req.body.family, req.body.genus, req.body.species, taxon_rank, pbdb_family_no, pbdb_genus_no, pbdb_species_no], function(err, result) {
                if (err) {
                    callback(err);
                    console.log("Error inserting into table 'taxa' - ", err);
                } else {
                    // Save the new taxon ID for the occurrence table
                    callback(null, result.rows[0].id)
                }
            });
        },
        "notes": function(callback) {
            // Insert taxon note into table notes
            if (req.body.notes) {
                client.query("INSERT INTO neodb.notes(note, created_on, modified_on) VALUES($1, now(), now()) RETURNING id", [req.body.notes], function(err, result) {
                    if (err) {
                        callback(err);
                        console.log("Error inserting into table 'notes' - ", err);
                    } else {
                        // Save the new note ID for the occurrence table
                        callback(null, result.rows[0].id)
                    }
                });
            } else {
                callback(null, 0)
            }
        },
        "collectionMethods": function(callback) {
            // If there is a new collection method insert into table collection_methods
            if (req.body.new_collection_method) {
                client.query("INSERT INTO neodb.collection_methods(collection_method, collection_type_id, created_on, modified_on) VALUES($1, 1, now(), now()) RETURNING id", [req.body.new_collection_method], function(err, result) {
                    if (err) {
                        callback(err);
                        console.log("Error inserting into table 'collection_methods' - ", err);
                    } else {
                        // Save the new method ID for the occurrence table
                        callback(null, result.rows[0].id);
                    }
                });
            } else {
                // If a known collection method is specified, record it - if not, default to 0
                var method_id = req.body.collection_method || 0;
                callback(null, method_id);
            }
        },
        "baitTypes": function(callback) {
            //// If there is a new bait type insert into table bait ////
            if (req.body.new_bait_type) {
                client.query("INSERT INTO neodb.baits(bait, created_on, modified_on) VALUES($1, now(), now()) RETURNING id", [req.body.new_bait_type], function(err, result) {
                    if (err) {
                        callback(err);
                        console.log("Error inserting into table 'baits' - ", err);
                    } else {
                        // Save the new bait ID
                        callback(null, result.rows[0].id);
                    }
                });
            } else {
                // If a known bait is specified, record it - if not, default to 0
                var bait_id = req.body.bait_type || 0;
                callback(null, bait_id);
            }
        },
        "collectionMedia": function(callback) {
            // If there is a new collection media insert into table collection_media
            if (req.body.new_collection_medium) {
                client.query("INSERT INTO neodb.collection_media(collection_medium, created_on, modified_on) VALUES($1, now(), now()) RETURNING id", [req.body.new_collection_medium], function(err, result) {
                    if (err) {
                        callback(err);
                        console.log("Error inserting into table 'collection_media' - ", err);
                    } else {
                        callback(null, result.rows[0].id);
                    }
                });
            } else {
                // If a known collection medium is specified, record it - if not, default to 0
                var medium_id = req.body.collection_media || 0;
                callback(null, medium_id);
            }
        }
    },
    function(error, results) {
        if (error) {
            res.send("Error uploading. Please try again. ", error);
            console.log("There was an issue - ", err);
        } else {
            // Insert into the occurrences table
            var collection_date_start = req.body.collection_date_start,
                collection_date_end = (req.body.collection_date_end) ? req.body.collection_date_end : null,
                only_observed = (req.body.only_observed) ? req.body.only_observed : 0,
                location_note = req.body.location_notes || 'none',
                n_male_specimens = parseInt(req.body.number_male),
                n_female_specimens = parseInt(req.body.number_female),
                n_total_specimens = parseInt(req.body.number_total),
                enterer_id = parseInt(req.session.user_id),
                institution_id = parseInt(req.session.institution_id);

            client.query("INSERT INTO neodb.occurrences(repository_id, note_id, method_id, bait_id, medium_id, collection_date_start, collection_date_end, only_observed, location_note, n_male_specimens, n_female_specimens, n_total_specimens, enterer_id, created_on, modified_on, taxon_id, geom_basis_id) VALUES($1, $2, $3, $4, $5, to_date($6, 'MM/DD/YYYY'), to_date($7, 'MM/DD/YYYY'), $8, $9, $10, $11, $12, $13, now(), now(), $14, $15) RETURNING id", [institution_id, results.notes, results.collectionMethods, results.baitTypes, results.collectionMedia, collection_date_start, collection_date_end, only_observed, location_note, n_male_specimens, n_female_specimens, n_total_specimens, enterer_id, results.taxa, parseInt(req.body.geom_basis)], function(err, result) {
                if (err) {
                    res.send("Error uploading. Please try again. ", err);
                    console.log("Error inserting into table 'occurrences' - ", err);
                } else {
                    var occurrence_id = result.rows[0].id;

                    // Move onto the next step of processing and uploading
                    step2(occurrence_id, results.taxa);
                }
            });
        }
    

        
    });

    function step2(occurrence_id, taxon_id) {
        async.parallel({
            "location": function(callback) {
                // Insert the geometry if provided (it's required)
                if (req.body.lat) {
            /* TODO: Figure out why parameterizing the lat and long doesn't work */
                   client.query("UPDATE neodb.occurrences SET the_geom = ST_geomFromText('POINT(" + parseFloat(req.body.lng) + " " + parseFloat(req.body.lat) + ")', 4326) WHERE id = $1", [occurrence_id], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting geometry into table 'occurrences' - ", err);
                        } else {
                            // Keep track of which county the point belongs to
                            client.query("UPDATE neodb.occurrences SET fips = (SELECT fips FROM neodb.ohio WHERE ST_Contains(geom, (SELECT the_geom FROM neodb.occurrences WHERE id = $1))) WHERE id = $1", [occurrence_id], function(err, result) {
                                if (err) {
                                    callback(err);
                                    console.log("Error updating occurence fips - ", err);
                                } else {
                                    callback(null, null);
                                }
                            });
                        }
                    }); 
               } else {
                    callback(null, null);
               }
            },
            "determiner": function(callback) {
                if (req.body.new_determiner_first_name) {
                    client.query("INSERT INTO neodb.people(first_name, last_name, created_on, modified_on) VALUES ($1, $2, now(), now()) RETURNING id", [req.body.new_determiner_first_name, req.body.new_determiner_last_name], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting new determiner into table 'people' - ", err);
                        } else {
                            var determiner_id = result.rows[0].id;

                            client.query("INSERT INTO neodb.people_roles(person_id, role_id, created_on, modified_on) VALUES($1, $2, now(), now())", [determiner_id, 6], function(err, result) {
                                if (err) {
                                    callback(err);
                                    console.log("Error inserting into table 'people_roles' - ", err);
                                } else {
                                    client.query("INSERT INTO neodb.opinions(occurrence_id, taxon_id, determiner_id, determination_date, created_on, modified_on) VALUES($1, $2, $3, now(), now(), now())", [occurrence_id, taxon_id, determiner_id], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table opinions - ", err);
                                        } else {
                                            callback(null, null);
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else if (req.body.determiner) {
                    client.query("INSERT INTO neodb.opinions(occurrence_id, taxon_id, determiner_id, determination_date, created_on, modified_on) VALUES($1, $2, $3, now(), now(), now())", [occurrence_id, taxon_id, parseInt(req.body.determiner)], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting into table opinions - ", err);
                        } else {
                            callback(null, null);
                        }
                    });
                } else {
                    callback(null, null);
                }
            },
            "collector": function(callback) {
                // If there is a new collector, insert into tables people and people_roles
                if (req.body.new_collector_first_name) {
                    client.query("INSERT INTO neodb.people(first_name, last_name, created_on, modified_on) VALUES($1, $2, now(), now()) RETURNING id", [req.body.new_collector_first_name, req.body.new_collector_last_name], function(err, result) {
                            if (err) {
                                callback(err);
                                console.log("Error inserting into table 'people' - ", err);
                            } else {
                                var collector_id = result.rows[0].id;
                                // Create a role with the classification of 'photographer' for the new person
                                client.query("INSERT INTO neodb.people_roles(person_id, role_id, created_on, modified_on) VALUES($1, $2, now(), now())", [collector_id, 5], function(err, result) {
                                    if (err) {
                                        callback(err);
                                        console.log("Error inserting into table 'people_roles' - ", err);
                                    } else {
                                        // Once new records are created for the new photographer, insert into table images
                                        client.query("INSERT INTO neodb.occurrences_collectors(occurrence_id, collector_id, created_on, modified_on) VALUES($1, $2, now(), now()) RETURNING id", [occurrence_id, collector_id], function(err, result) {
                                            if (err) {
                                                callback(err);
                                                console.log("Error inserting into table 'occurrences_collectors' after inserting into table 'people' - ", err);
                                            } else {
                                                callback(null, null);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                // If there is a specimen collector specified, insert into occurrences_collectors
                } else if (req.body.collector) {
                    var collector_id = parseInt(req.body.collector);
                    client.query("INSERT INTO neodb.occurrences_collectors(occurrence_id, collector_id, created_on, modified_on) VALUES($1, $2, now(), now()) RETURNING id", [occurrence_id, collector_id], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting into table 'occurrences_collectors' - ", err);
                        } else {
                            callback(null, null);
                        }
                    });
                } else {
                    callback(null, null);
                }
            },
            "environment": function(callback) {
                // If a new environment is provided, insert into table environments
                if (req.body.new_environment) {
                    client.query("INSERT INTO neodb.environments(environ, environ_type, environ_class, created_on, modified_on) VALUES($1, $2, $3, now(), now()) RETURNING id", [req.body.new_environment, req.body.new_environment_type, req.body.new_environment_class], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting into table 'environments' - ", err);
                        } else {
                            // Get the new environment ID and insert into occcurrences_environments
                            var enviro_id = result.rows[0].id;
                            client.query("INSERT INTO neodb.occurrences_environments(occurrence_id, environment_id, created_on, modified_on) VALUES($1, $2, now(), now())", [occurrence_id, enviro_id], function(err, result) {
                                if (err) {
                                    callback(err);
                                    console.log("Error inserting into table 'occurrences_environments' after inserting into table 'environments'- ", err);
                                } else {
                                    callback(null, null);
                                }
                            });
                        }
                    });
                // If an existing environment is specified insert into occurrences_environments
                } else if (req.body.environment) {
                    var enviro_id = req.body.environment;
                    client.query("INSERT INTO neodb.occurrences_environments(occurrence_id, environment_id, created_on, modified_on) VALUES($1, $2, now(), now())", [occurrence_id, enviro_id], function(err, result) {
                        if (err) {
                            callback(err);
                            console.log("Error inserting into 'occurrences_environments' - ", err);
                        } else {
                            callback(null, null);
                        }
                    });
                // If no environment, move on
                } else {
                   // req.body.environment = '';
                   callback(null, null);
                }
            },
            "image": function(callback) {
                // If there is one image it will be an object, if there are more than one it will be an array
                if (req.files.filesToUpload.name || Array.isArray(req.files.filesToUpload)) {
                    var photo_id = occurrence_id,
                        image_date = req.body.image_date || fullDate;

                    req.session.upload.image_url = './images/main/' + occurrence_id + '.jpg';

                    // get the temporary location of the file
                    var tempPath = req.files.filesToUpload.path;

                    // set where the file should actually exists - in this case it is in the "images" directory
                    var targetPath =  credentials.path + '/public/images/full/' + photo_id + '.jpg';

                    async.waterfall([
                        // Move and rename image
                        function(callback) {
                            fs.rename(tempPath, targetPath, function(err) {
                                if (err) {
                                    callback(err);
                                    console.log("Error renaming and moving image - ", err);
                                } else {
                                    callback(null);
                                }
                            });
                        },

                        // Get image info
                        function(callback) {
                            easyimg.info(targetPath, function(err, info, stderr) {
                                if (err) {
                                    callback(err);
                                    console.log("Error getting image info - ", err);
                                } else {
                                    if (info.width > info.height) {
                                        var width = { "medium": 720, "thumb": 160 };
                                    } else {
                                        var width = { "medium": 540, "thumb": 120 };
                                    }
                                    callback(null, width);
                                }
                            });
                        },

                        // Create medium version of image
                        function(imgWidth, callback) {
                            easyimg.resize({src: credentials.path + '/public/images/full/' + photo_id + '.jpg', dst: credentials.path + '/public/images/main/' + photo_id + '.jpg', width: imgWidth.medium }, function(err, image) {
                                if (err) {
                                    callback(err);
                                    console.log("Error converting to medium sized version - ", err);
                                } else {
                                    callback(null, imgWidth);
                                }
                            });
                        },

                        // Create thumbnail version of image
                        function(imgWidth, callback) {
                            easyimg.resize({ src: credentials.path + '/public/images/full/' + photo_id + '.jpg', dst: credentials.path + '/public/images/thumbs/' + photo_id + '.jpg', width: imgWidth.thumb }, function(err, image) {
                                if (err) {
                                    callback(err);
                                    console.log("Error converting to thumbnail version - ", err);
                                } else {
                                    callback(null);
                                }
                            })
                        }

                    ], function(error, result) {
                        // if new photographer
                        if (req.body.new_photographer_first_name) {
                            async.waterfall([
                                // Insert new photographer
                                function(callbackB) {
                                    client.query("INSERT INTO neodb.people(first_name, last_name, created_on, modified_on) VALUES($1, $2, now(), now()) RETURNING id", [req.body.new_photographer_first_name, req.body.new_photographer_last_name], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table 'people' - ", err);
                                        } else {
                                            var person_id = result.rows[0].id;
                                            callbackB(null, person_id);
                                        }
                                    });
                                },
                                // Insert new role
                                function(person_id, callbackB) {
                                    client.query("INSERT INTO neodb.people_roles(person_id, role_id, created_on, modified_on) VALUES($1, $2, now(), now())", [person_id, 8], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table 'people_roles' - ", err);
                                        } else {
                                            callbackB(null, person_id);
                                        }
                                    });
                                },
                                // Insert image
                                function(person_id, callbackB) {
                                    client.query("INSERT INTO neodb.images(photographer_id, full_file, main_file, thumb_file, description, image_date, created_on, modified_on) VALUES($1, $2, $3, $4, $5, to_date($6, 'MM/DD/YYYY'), now(), now()) RETURNING id", [person_id, occurrence_id + ".jpg", occurrence_id + ".jpg", occurrence_id + ".jpg", req.body.photo_description, image_date], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table 'images' after inserting into table 'people' - ", err);
                                        } else {
                                            var image_id = result.rows[0].id;
                                            callbackB(null, image_id);
                                        }
                                    });
                                },
                                // Insert image location
                                function(image_id, callbackB) {
                                    if (req.body.photolat) {
                                        client.query("UPDATE neodb.images SET the_geom = ST_geomFromText('POINT(" + parseFloat(req.body.photolng) + " " + parseFloat(req.body.photolat) + ")', 4326) WHERE id = $1", [image_id], function(err, result) {
                                            if (err) {
                                                callback(err);
                                                console.log("Error inserting geometry into table 'images' after inserting into table 'people' - ", err);
                                            } else {
                                                callbackB(null, image_id);
                                            }
                                        });
                                    } else {
                                        callbackB(null, image_id);
                                    }
                                },
                                // Insert into occurrence images
                                function(image_id, callbackB) {
                                    client.query("INSERT INTO neodb.occurrences_images(image_id, occurrence_id, created_on, modified_on) VALUES ($1, $2, now(), now())", [image_id, occurrence_id], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table occurrences_images - ", err);
                                        } else {
                                            callbackB(null, null);
                                        }
                                    });
                                }
                            ], function(errors, done) {
                                // Done with new photog waterfall
                                callback(null, null);
                            });
                        } else {
                        // If we're using an existing photographer
                            async.waterfall([
                                // insert image
                                function(callbackB) {
                                    var photog = parseInt(req.body.photographer);
                                    client.query("INSERT INTO neodb.images(photographer_id, full_file, main_file, thumb_file, description, image_date, created_on, modified_on) VALUES($1, $2, $3, $4, $5, to_date($6, 'MM/DD/YYYY'), now(), now()) RETURNING id", [photog, occurrence_id + ".jpg", occurrence_id + ".jpg", occurrence_id + ".jpg", req.body.photo_description, image_date], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table 'images' - ", err);
                                        } else {
                                            var image_id = result.rows[0].id;
                                            callbackB(null, image_id);
                                        }
                                    });
                                },
                                // Insert image location
                                function(image_id, callbackB) {
                                    if (req.body.photolat) {
                                        client.query("UPDATE neodb.images SET the_geom = ST_geomFromText('POINT(" + parseFloat(req.body.photolng) + " " + parseFloat(req.body.photolat) + ")', 4326) WHERE id = " + image_id, function(err, result) {
                                            if (err) {
                                                callback(err);
                                                console.log("Error inserting geometry into table 'images' - ", err);
                                            } else {
                                                callbackB(null, image_id);
                                            }
                                        });
                                    } else {
                                        callback(null, image_id);
                                    }
                                },
                                // Insert into occurrence images
                                function(image_id, callbackB) {
                                    client.query("INSERT INTO neodb.occurrences_images(image_id, occurrence_id, created_on, modified_on) VALUES ($1, $2, now(), now())", [image_id, occurrence_id], function(err, result) {
                                        if (err) {
                                            callback(err);
                                            console.log("Error inserting into table occurrences_images - ", err);
                                        } else {
                                            callbackB(null, image_id);
                                        }
                                    });
                                }

                            ], function(errors, done) {
                                // Done with existing photog waterfall
                                if (errors) {
                                    callback(errors);
                                } else {
                                    callback(null, null);
                                }
                            });
                        }
                    });
                } else {
                    // If no images, finish up
                    callback(null);
                }
            }
        },
        function(err, done) {
            // Done with step2
            if (err) {
                res.send("Error uploading. Please try again. ", err);
                console.log("There was an issue - ", err);
            } else {
                res.redirect("/addBeetleSuccess");
            }
        });
    } // end step2

}

exports.success = function(req, res) {
    res.render("uploadSuccess", {
      loggedin: (req.session.user_id) ? true : false,
      username: (req.session.user_id) ? req.session.name : "",
      partials: {
        header: "partials/navbar"
      }
    });
}