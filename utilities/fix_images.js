var pg = require('pg'),
    fs = require('fs'),
    credentials = require("../routes/credentials"),
    async = require("async");

// Create postgres connection object
var connString = "postgres://" + credentials.user + "@" + credentials.host + ":" + credentials.port + "/" + credentials.database,
    client = new pg.Client(connString);

// Connect to postgres
client.connect(function(error, success) {
  if (error) {
    console.log("Could not connect to postgres");
  }
});

client.query("SELECT * FROM neodb.images", function(errror, result) {
  var images = result.rows;

  //return console.log(images);
  async.each(images, function(image, callback) {

    var occ_id = parseInt(image.full_file.replace(".jpg", "")),
        image_id = image.id;

    async.parallel([

      function(callbackB) {
        client.query("INSERT INTO neodb.occurrences_images (image_id, occurrence_id, modified_on) VALUES ($1, $2, now())", [image_id, occ_id], function(error, done) {
          if (error) {
            console.log(error);
          } else {
            console.log("Inserted into occurrences_images_images");
            callbackB(null);
          }
        });
      },

      function(callbackB) {
        fs.rename(credentials.path + "/public/images/full/" + occ_id + ".jpg", credentials.path + "/public/images_new/full/" + image_id + ".jpg", function(err) {
          if (err) {
              callbackB(err);
              console.log("Error renaming and moving image - ", err);
          } else {
              callbackB(null);
          }
        });
      },

      function(callbackB) {
        fs.rename(credentials.path + "/public/images/main/" + occ_id + ".jpg", credentials.path + "/public/images_new/main/" + image_id + ".jpg", function(err) {
          if (err) {
              callbackB(err);
              console.log("Error renaming and moving image - ", err);
          } else {
              callbackB(null);
          }
        });
      },

      function(callbackB) {
        fs.rename(credentials.path + "/public/images/thumbs/" + occ_id + ".jpg", credentials.path + "/public/images_new/thumbs/" + image_id + ".jpg", function(err) {
          if (err) {
              callbackB(err);
              console.log("Error renaming and moving image - ", err);
          } else {
              callbackB(null);
          }
        });
      }
    ], function(error) {
      if (error) {
        callback(error);
      } else {
        callback(null);
      }
    });


  }, function(error) {
    client.query("UPDATE neodb.images SET full_file = concat(id,'.jpg'), main_file = concat(id,'.jpg'), thumb_file = concat(id,'.jpg')", function(error, done) {
      if (error) {
        console.log(error);
      } else {
        console.log("DONE");
      }
    });
  });

});

