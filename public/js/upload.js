var uploadForm = (function() {
  var map;

  // Form pages - used for the history API
  var formPages = {
    "taxon_info": {
      div: "taxon_info",
      num: 1
    },
    "location": {
      div: "location",
      num: 2
    },
    "collection_info": {
      div: "collection_info",
      num: 3
    },
    "notes": {
      div: "notes",
      num: 4
    },
    "photo": {
      div: "image",
      num: 5
    },
    "review": {
      div: "review",
      num: 6
    }
  }

  // Used for making sure either collection or photo location is populated
  var referrer = "";

  function init() {

    // Setup the map
    setupMap();

    // Setup the automcomplets
    setupAutocomplete();

    // Setup Datepickers
    var date = new Date(),
      today =  date.getMonth() + 1 + "-" + date.getDate() + "-" + date.getFullYear();

    $('#collectionDatepicker').datepicker({
        endDate: "today",
        autoclose: true,
        startView: 2
    });

    $('#photoDatepicker').datepicker({
        endDate: "today",
        autoclose: true,
        startView: 2
    });

    // Allows us to use 1 map and 1 modal for two different fields
    $('.locationSelect').click(function() {
      referrer = 'location';
      $('#locationModal').modal('show');
    });
    $('.locationSelectPhoto').click(function() {
      referrer = 'photo';
      $('#locationModal').modal('show');
    });


    // Handler for back button in map modal
    $('.modalBack').click(function() {
      $('.tab-pane').removeClass('active');
      $('#method.tab-pane').addClass('active');
    });

    // Fill the number of specimen selects. I don't want to write 100 lines of HTML manually
    for(var i=1;i<51;i++) {
      $('[name=number_male]').append('<option value="' + i + '">' + i + '</option>');
      $('[name=number_female]').append('<option value="' + i + '">' + i + '</option>');
      $('[name=number_total]').append('<option value="' + i + '">' + i + '</option>');
    }


    // Default all selects that involve a person's name to whomever is filling out this form
    var options = $('option');
    for (var i = 0; i < options.length; i++) {
      if($(options[i]).html() === $("#username").attr("data-user")) {
        $(options[i]).prop("selected", true);
      }
    }

    // if the option -- Not Listed -- is ever selected, show the inputs for adding a new thing
    $("select").on("change", function() {
      var name = $(this).attr("name");
      if (this.value === "na") {
        $("#new" + name).show();
      } else {
        $("#new" + name).hide();
      }
    });

    // Resize the modal on window resize
    $(window).resize(function() {
      resizeModal();
    });

  

    // Special handler for all links related to form page navigation
    $(".previous, .next, .dotLink").on("click", function(event) {

      /* Via http://stackoverflow.com/questions/4748655/how-to-make-serialize-take-into-account-those-disabled-input-elements */
       // Enable the disabled
      var disabled = $("#uploadForm").find(':input:disabled').removeAttr('disabled');

      // Store the data
      var formData = $("#uploadForm").serializeObject();
      localStorage.setItem("formData", JSON.stringify(formData));;

       // Disable the enabled
      disabled.attr('disabled','disabled');
      
      handleClick(event);
    });

    // Fill out the review page
    $("a[href='/addBeetle/review']").on("click", review);

    // Bind handles for the file upload
    $('#filesToUpload').on('change', fileSelect);

    $('#dropTarget').click(function() {
      $('input[type=file]').click();
    });

    // Read and use the EXIF data, if available
    document.getElementById('filesToUpload').onchange = function(e) {
      EXIF.getData(e.target.files[0], function() {
          var datetime = EXIF.getTag(e.target.files[0], "DateTimeOriginal"),
              lat = EXIF.getTag(e.target.files[0], "GPSLatitude"),
              lng = EXIF.getTag(e.target.files[0], "GPSLongitude");

          if (datetime) {
            var date = datetime.split(" ")[0],
                dateArray = date.split(":"),
                dateString = dateArray[1] + "/" + dateArray[2] + "/" + dateArray[0];

            $('#photoDatepicker').data({ date: dateString });
            $('#photoDatepicker').datepicker('update');
            $('#photoDatepicker').datepicker().children('input').val(dateString);

          }

          if (lat) {
            var formattedLat = lat[0].numerator / lat[0].denominator,
                formattedLng = -(lng[0].numerator / lng[0].denominator);

            $("#selectedLatPhoto").html(formattedLat.toFixed(4));
            $("#selectedLngPhoto").html(formattedLng.toFixed(4));
            $("#selectedLocationPhoto").css("display", "inline");
            $("#photoLocationBtn").hide();

            $("[name=photolat]").val(formattedLat.toFixed(4));
            $("[name=photolng]").val(formattedLng.toFixed(4));

            if (Object.keys(map._layers).length < 2) {

              var marker = new L.Marker([formattedLat, formattedLng], {
                draggable: true
              }).addTo(map);

              marker.on('dragend', function() {
                var latlng = marker.getLatLng();
                $('#lat').val(latlng.lat.toFixed(5));
                $('#lng').val(latlng.lng.toFixed(5));
              });

              map.panTo([formattedLat,formattedLng]);

              if (map.getZoom() < 11) {
                map.setZoom(14);
              } 

            } else {
              var indices = Object.keys(map._layers);
              map._layers[indices[1]].setLatLng([formattedLat,formattedLng]);
              map.panTo([formattedLat,formattedLng]);
            }

          } 
            
      });
    }

    $(".edit.image").on("click", function() {
      $("output").hide();
      $("#dropTarget").show();
    })
    // record the full text value of the selects in hidden inputs for use on the success page
    $('[name=photographer], [name=collector], [name=collection_method], [name=bait_type], [name=collection_media], [name=environment], [name=geom_basis], [name=determiner]').change(function() {
      var name = $(this).attr('name'),
          full_text = $('[name=' + name + '] option:selected').text();
      $('[name=' + name + '_full]').val(full_text);
    });

    // Change these to accept new values as well
    $('[name=photographer_full]').val($('[name=photographer] option:selected').text());
    $('[name=collector_full]').val($('[name=collector] option:selected').text());
    $('[name=collection_method_full]').val($('[name=collection_method] option:selected').text());
    $('[name=bait_type_full]').val($('[name=bait_type] option:selected').text());
    $('[name=collection_media_full]').val($('[name=collection_media] option:selected').text());
    $('[name=environment_full]').val($('[name=environment] option:selected').text());
    $('[name=geom_basis_full]').val($('[name=geom_basis] option:selected').text());
    $('[name=determiner_full]').val($('[name=determiner] option:selected').text());

  } // end init()

  function setupMap() {
    map = new L.Map('map', {
      center: new L.LatLng(40.2, -82.9),
      zoom: 7,
      minZoom: 7,
      zoomControl: true,
      zoomAnimation: false
    });

    var roads = new L.Google('ROADMAP'),
        sat = new L.Google('HYBRID');

    map.addLayer(roads);

    var basemaps = {
      "Roads": roads,
      "Satellite": sat
    };

    var toggler = L.control.layers(basemaps, {}, {position:'bottomleft'}).addTo(map);

    var enterAddress = L.control({position: 'topright'});

    enterAddress.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'mapInstructions');
        $.ajax({
          type: 'GET',
          url: '/partials/enter_address.html',
          async: false,
          success: function(partial) {
            div.innerHTML += partial;
          }
        });
        
        return div;
    };

    enterAddress.addTo(map);
    $("#enterAddress").parent().on("mousedown click", function(e) {
      e.stopPropagation();
    });

    var enterCoordinates = L.control({position: 'topright'});

    enterCoordinates.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'mapInstructions');
        $.ajax({
          type: 'GET',
          url: '/partials/enter_coordinates.html',
          async: false,
          success: function(partial) {
            div.innerHTML += partial;
          }
        });
        
        return div;
    };

    enterCoordinates.addTo(map);
    $("#enterCoordinates").parent().on("mousedown click", function(e) {
      e.stopPropagation();
    });

    // Handler for selecting coordinate type
    $("input[name=llType]").change(function() {

      var type = $("input[name=llType]:checked").val();

      if (type === "dd") {
        $(".coordInput").hide();
        $("#dd").show();
      } else if (type === "dm") {
        $(".coordInput").hide();
        $("#dm").show();
      } else {
        $(".coordInput").hide();
        $("#dms").show();
      }
    });

    var clickMap = L.control({position: 'topright'});

    clickMap.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'mapInstructions');
        div.innerHTML += '<div id="clickMap"><p><i>Click on the map to add a marker.<br> Drag the marker to the desired location</i></p><div class="btn btn-success mapSelectDone">Done</div></div>';
        return div;
    };

    clickMap.addTo(map);
    $("#clickMap").parent().on("mousedown click", function(e) {
      e.stopPropagation();
    });

    // Hide all the controls
    $("#enterCoordinates").parent().hide();
    $("#clickMap").parent().hide();
    $("#enterAddress").parent().hide();

    // For the last type of selection method
    map.on('click', function(e) {
      if (Object.keys(map._layers).length < 2) {
        marker = new L.Marker([e.latlng.lat, e.latlng.lng], {
          draggable:true
        });
        map.addLayer(marker);
        map.setView([e.latlng.lat, e.latlng.lng], 10);
      }
    });


    function viewOnMap(type) {
      if (type === "address") {
        var address = $('#addressInput').val();
        $.ajax({
          type:'GET',
          url:'http://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&sensor=false',
          dataType: 'json', 
          async: false,
          success: function(data) {
            var lat = data.results[0].geometry.location.lat,
                lng = data.results[0].geometry.location.lng;

            if (Object.keys(map._layers).length < 2) {
              marker = new L.Marker([lat, lng], {
                draggable: true
              }).addTo(map);

              map.panTo([lat,lng]);
              map.setZoom(14);
            } else {
              marker.setLatLng([lat, lng]);
              map.panTo([lat,lng]);
            }

            return false;
          }
        });
      } else {
        var llFormat = $("input[name=llType]:checked").val();

        if (llFormat === "dd") {
          var lat = parseFloat($('input#lat').val()),
              lng = parseFloat($('input#lng').val());

        } else if (llFormat === "dm") {
          // convert from DD MM.mmm here
          var degreesLat = parseFloat($("input#dm_lat_deg").val()),
              minutesLat = parseFloat($("input#dm_lat_min").val()),

              degreesLng = parseFloat($("input#dm_lng_deg").val()),
              minutesLng = parseFloat($("input#dm_lng_min").val());

          var latDirection = (degreesLat < 0 ? -1 : 1),
              lngDirection = (degreesLng < 0 ? -1 : 1);

          var lat = latDirection * (Math.abs(degreesLat) + (minutesLat/60)),
              lng = lngDirection * (Math.abs(degreesLng) + (minutesLng/60));

        } else {
          // convert from DMS here
          var degreesLat = parseFloat($("input#dms_lat_deg").val()),
              minutesLat = parseFloat($("input#dms_lat_min").val()),
              secondsLat = parseFloat($("input#dms_lat_sec").val()),

              degreesLng = parseFloat($("input#dms_lng_deg").val()),
              minutesLng = parseFloat($("input#dms_lng_min").val()),
              secondsLng = parseFloat($("input#dms_lng_sec").val());

          var latDirection = (degreesLat < 0 ? -1 : 1),
              lngDirection = (degreesLng < 0 ? -1 : 1);

          var lat = latDirection * (Math.abs(degreesLat) + (minutesLat/60) + (secondsLat/3600)),
              lng = lngDirection * (Math.abs(degreesLng) + (minutesLng/60) + (secondsLng/3600));

        }

        if (Object.keys(map._layers).length < 2) {

          marker = new L.Marker([lat, lng], {
            draggable: true
          }).addTo(map);

          marker.on('dragend', function() {
            var latlng = marker.getLatLng();
            $('#lat').val(latlng.lat.toFixed(5));
            $('#lng').val(latlng.lng.toFixed(5));
          });

          map.panTo([lat,lng]);

          if (map.getZoom() < 11) {
            map.setZoom(14);
          } 

        } else {
          marker.setLatLng([lat, lng]);
          map.panTo([lat,lng]);
        }
      }
      
    }

    $('#viewAddressOnMap').click(function() {
      viewOnMap("address");
    });

    $('#viewCoordinatesOnMap').click(function() {
      viewOnMap("coordinates");
    });

    // When done with the map
    $('.mapSelectDone').click(function() {
      try {
        var markerCoords = marker.getLatLng();
      } catch(e) {
        return alert("Please verify the coordinates by selecting 'View on Map'");
      }

      var occurrenceLocation = [markerCoords.lat, markerCoords.lng];

      $('#locationModal').modal('hide');
      
      if (referrer === 'location') {
        $("#selectedLat").html(occurrenceLocation[0].toFixed(4));
        $("#selectedLng").html(occurrenceLocation[1].toFixed(4));
        $("#selectedLocation").css("display", "inline");
        $("[data-toggle=#locationModal]").hide();

        $("[name=lat]").val(occurrenceLocation[0].toFixed(4));
        $("[name=lng]").val(occurrenceLocation[1].toFixed(4));
      } else {
        $("#selectedLatPhoto").html(occurrenceLocation[0].toFixed(4));
        $("#selectedLngPhoto").html(occurrenceLocation[1].toFixed(4));
        $("#selectedLocationPhoto").css("display", "inline");
        $("#photoLocationBtn").hide();

        $("[name=photolat]").val(occurrenceLocation[0].toFixed(4));
        $("[name=photolng]").val(occurrenceLocation[1].toFixed(4));
      }
      
    });

    $('.locationMethod').click(function() {
      $('.tab-pane').removeClass('active');
      
      var theID = $(this).attr("id");

      if (theID === "coordinates") {
        $("#clickMap").parent().hide();
        $("#enterAddress").parent().hide();
        $("#enterCoordinates").parent().show();
      } else if (theID === "mapSelector") {
        $("#enterCoordinates").parent().hide();
        $("#enterAddress").parent().hide();
        $("#clickMap").parent().show();
      } else {
        $("#enterCoordinates").parent().hide();
        $("#clickMap").parent().hide();
        $("#enterAddress").parent().show();
      }

      $('#mapPane.tab-pane').addClass('active');
      map.invalidateSize();
    });
  } // end setupMap

  function resizeModal() {
    var size = {width: $(window).width() , height: $(window).height() },
        offset = 40,
        offsetBody = 150;

    $('.modal-body').css('height', size.height - offset - 56);
    $('#map').css('height', size.height - offset - 60);
    $('#locationModal').css('top', 0);
  }

  // Used for the photo upload
  function fileSelect(evt) {

    var files = evt.target.files;

    for (var i = 0; i < files.length; i++) {
      // if the file is not an image, continue
      if (!files[i].type.match('image.*')) {
        alert("Not a valid image format. Please try again.");
        continue;
      }

      var reader = new FileReader();
      reader.onload = (function() {
        return function(evt) {
          // This checks the dimensions of the image
          var img = new Image;
          img.onload = function() {
            $("#imageToUpload").attr("src", evt.target.result);
            if (img.width > img.height) {
              $("#imageToUpload").css("width", "160px");
            } else {
              $("#imageToUpload").css("width", "90px");
            }
          }
          img.src = evt.target.result; 

          $("#selectedImages").show();
          $("#dropTarget").hide();

        }
      }(files[i]));
      reader.readAsDataURL(files[i]);
    }
  }

  function setupAutocomplete() {
    var families = new Bloodhound({
      datumTokenizer: function(d) {
        return Bloodhound.tokenizers.whitespace(d.value);
      },
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      prefetch: {
        url: 'http://paleobiodb.org/data1.1/taxa/list.json?name=Coleoptera&rel=all_children&extant=true&rank=family',
        filter: function(taxa) {
            return $.map(taxa.records, function(taxon) {
                if (taxon.rnk === 9) {
                  return {
                      value: taxon.nam
                  };
                }
            });
        }
      }
    });

    families.initialize();

    $('[name=family]').typeahead(null, {
      name: 'families',
      minLength: 2,
      source: families.ttAdapter()
    });


    var genera = new Bloodhound({
      datumTokenizer: function(d) {
        return Bloodhound.tokenizers.whitespace(d.value);
      },
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      prefetch: {
        url: 'http://paleobiodb.org/data1.1/taxa/list.json?name=Coleoptera&rel=all_children&extant=true&rank=genus',
        filter: function(taxa) {
            return $.map(taxa.records, function(taxon) {
                return {
                    value: taxon.nam
                };
            });
        }
      }
    });

    genera.initialize();

    $('[name=genus]').typeahead(null, {
      name: 'genera',
      minLength: 2,
      source: genera.ttAdapter()
    });

    // lock species
    $("[name=species]").prop("disabled", true);

    // When the family input autocomplete is completed
    $('[name=family]').on("typeahead:selected", function(event, suggestion, dataset) {
      /* Fill in info about the selected family */
      $.getJSON("http://paleobiodb.org/data1.1/taxa/single.json?name=" + suggestion.value + "&show=attr", function(data) {
        // Fill in common name
        if (data.records[0].nm2) {
          $('[name=common_name]').val(data.records[0].nm2);
          $('[name=common_name]').prop('disabled', true);
        }
        // Fill in author
        $('[name=author]').val(data.records[0].att);
        $('[name=author]').prop('disabled', true);

        // Fill in family PBDB id
        $('[name=pbdb_family_no]').val(data.records[0].oid);

        // Save author and common name as data attributes!
        $("[name=family]").data('common', (data.records[0].nm2) ? data.records[0].nm2 : "");
        $("[name=family]").data('author', data.records[0].att);

      });

      /* Set up the genus autocomplete */
      // First, out with the old
      $("[name=genus]").typeahead("destroy");

      // Then in with the new
      var genera = new Bloodhound({
        datumTokenizer: function(d) {
          return Bloodhound.tokenizers.whitespace(d.value);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        prefetch: {
          url: 'http://paleobiodb.org/data1.1/taxa/list.json?name=' + suggestion.value + '&rel=all_children&extant=true&rank=genus',
          filter: function(taxa) {
              return $.map(taxa.records, function(taxon) {
                  return {
                      value: taxon.nam
                  };
              });
          }
        }
      });

      genera.initialize();

      $('[name=genus]').typeahead(null, {
        name: 'genera',
        minLength: 2,
        source: genera.ttAdapter()
      });

    }); // End family.on('selected')

    // When the genus autocomplete is completed
    $("[name=genus]").on("typeahead:selected", function(event, suggestion, dataset) {
      /* Fill in info about the selected genus */
      $.getJSON("http://paleobiodb.org/data1.1/taxa/single.json?name=" + suggestion.value + "&show=attr", function(data) {
        if (data.records.length > 0) {
          // Fill in common name
          if (data.records[0].nm2) {
            $('[name=common_name]').val(data.records[0].nm2);
            $('[name=common_name]').prop('disabled', true);
          }
          // Fill in author
          $('[name=author]').val(data.records[0].att);
          $('[name=author]').prop('disabled', true);

          // Fill in family PBDB id
          $('[name=pbdb_genus_no]').val(data.records[0].oid);

          // Record that this has been verified
          $("[name=genus]").data("oid", data.records[0].oid);
          $("[name=genus]").data('common', (data.records[0].nm2) ? data.records[0].nm2 : "");
          $("[name=genus]").data('author', data.records[0].att);

          // open species
          $("[name=species]").prop("disabled", false);

          // Get parent
          $.getJSON("http://paleobiodb.org/data1.1/taxa/list.json?id=" + data.records[0].par + "&rel=all_parents&show=attr", function(dataParent) {
            var parent;
            dataParent.records.forEach(function(d) {
              if (d.rnk === 9) {
                parent = d;
              }
            });

            // Fill in family and lock it
            $("[name=family]").val(parent.nam);
            $("[name=family]").prop("disabled", true);

            // Fill in family PBDB id
            $('[name=pbdb_family_no]').val(parent.oid);

            if ($("[name=common_name]").val() === "" && parent.nm2) {
              $('[name=common_name]').val(parent.nm2);
            } 

            // Save author and common name as data attributes!
            $("[name=family]").data('common', (parent.nm2) ? parent.nm2 : "");
            $("[name=family]").data('author', parent.att);
          });
        } else {
          alert("You entered a genus not found in the Paleobiology Database. Proceed with caution.");
        }
      });

      $("[name=genus]").on("keyup", function() {
        if ($(this).val().length < 1) {
          $("[name=species]").prop("disabled", true);
        } else {
          $("[name=species]").prop("disabled", false);
        }
      });
      
      /* Set up the species autocomplete */
      // Out with the old
      $("[name=species]").typeahead("destroy");

      // Then in with the new
      var species = new Bloodhound({
        datumTokenizer: function(d) {
          return Bloodhound.tokenizers.whitespace(d.value);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        prefetch: {
          url: 'http://paleobiodb.org/data1.1/taxa/list.json?name=' + suggestion.value + '&rel=all_children&extant=true&rank=species',
          filter: function(taxa) {
              return $.map(taxa.records, function(taxon) {
                  var item = taxon.nam;
                  item = item.split(" ");
                  return {
                      value: item[1]
                  };
              });
          }
        }
      });

      species.initialize();

      $('[name=species]').typeahead(null, {
        name: 'species',
        minLength: 2,
        source: species.ttAdapter()
      });
    }); // End genus.on('selected')

    // When the species autocomplete is completed
    $("[name=species]").on("typeahead:selected", function(event, suggestion, dataset) {
      var genus = $("[name=genus]").val();

      $.getJSON("http://paleobiodb.org/data1.1/taxa/single.json?name=" + genus + "%20" + suggestion.value + "&show=attr", function(data) {
        if (data.records.length > 0) {
          // Fill in common name
          if (data.records[0].nm2) {
            $('[name=common_name]').val(data.records[0].nm2);
            $('[name=common_name]').prop('disabled', true);
          }
          // Fill in author
          $('[name=author]').val(data.records[0].att);
          $('[name=author]').prop('disabled', true);

          // Fill in family PBDB id
          $('[name=pbdb_species_no]').val(data.records[0].oid);

          // Record that this has been verified
          $("[name=species]").data("oid", data.records[0].oid);

          // Lock down genus
          $("[name=genus]").prop("disabled", true);
        } else {
          alert("You entered a species not found in the Paleobiology Database. Proceed with caution.");
        }
      });
    }); // End species.on('selected')

    $("[name=family]").focusout(function() {
      if ($(this).val().length === 0) {
        $(this).data("oid", "");
        $("[name=common_name]").val("");
        $("[name=genus]").val("");
        $("[name=species]").val("");
        $("[name=author]").val("");
        $("[name=common_name]").prop("disabled", false);
        $("[name=genus]").prop("disabled", false);
        $("[name=species]").prop("disabled", true);
        $("[name=author]").prop("disabled", false);
      }
    });

    // Handle if genus is not in PBDB
    $("[name=genus]").focusout(function() {
      // if it has an oid AND length = 0 (autocompleted, changed mind)
      if ($(this).data("oid") && $(this).val().length === 0) {
        // - free up family
        $("[name=family]").prop("disabled", false);
        // - populate common name and author with family's attributes
        $("[name=common_name]").val($("[name=family]").data("common"));
        $("[name=author]").val($("[name=family]").data("author"));

        // lock species
        $("[name=species]").prop("disabled", true);
      } 

      // if it doesn't have an oid and length > 0 (entered something not in paleodb)
      else if (! $(this).data("oid") && $(this).val().length > 0) {
        // - free up common name and author
        $("[name=common_name]").prop("disabled", false);
        $("[name=author]").prop("disabled", false);
        $("[name=species]").prop("disabled", false);
        // - lock family
        $("[name=family]").prop("disabled", true);
      }

    });

    // Handle if species is not in PBDB
    $("[name=species]").focusout(function() {
      // if it has an oid AND length = 0 (autocompleted, changed mind)
      if ($(this).val().length === 0) {
        // - free up genus
        $("[name=genus]").prop("disabled", false);
        // - populate common name and author with family's attributes
        $("[name=common_name]").val( ($("[name=genus]").data("common")) ? $("[name=genus]").data("common") : $("[name=family]").data("common"));
        $("[name=author]").val($("[name=genus]").data("author"));
        $("[name=author]").prop("disabled", true);
        $(this).data("oid", "")
      } 
      // if it doesn't have an oid and length > 0 (entered something not in paleodb)
      else if (! $(this).data("oid") && $(this).val().length > 0) {
        // - free up common name and author
        $("[name=common_name]").prop("disabled", false);
        $("[name=author]").prop("disabled", false);
        // - lock family
        $("[name=family]").prop("disabled", true);
      }

    });
  } // end setupAutocomplete

  // Called on page load if a form page is specified in URL
  function handleLoad(href) {
    var page = href.replace("/addBeetle", "");
    page = page.replace("/", "");
    var data = formPages[page];
    updateContent(data);
  }

  // Handler for all links related to form pages
  function handleClick(event) {
    if (event.target.getAttribute('href')) {
      var formPage = event.target.getAttribute('href').split('/').pop(),
          data = formPages[formPage] || null;
    } else {
      var formPage = event.target.parentNode.getAttribute('href').split('/').pop(),
          data = formPages[formPage] || null;
    }
      
    updateContent(data);

    // Add an item to the history log
    history.pushState(data, event.target.textContent, event.target.href);

    return event.preventDefault();
  }

  // Load the proper form page
  function updateContent(data) {
    if (data === null) {
      return;
    }

    // Update the dots
    var dots = $(".status");
    for (var i = 0; i < dots.length; i++) {
      var number = parseInt($(dots[i]).attr("id").replace("prog", ""));
      if (number <= data.num) {
        $("#prog" + number).removeClass("fa-circle-o").addClass("fa-circle");
      } else {
        $("#prog" + number).removeClass("fa-circle").addClass("fa-circle-o");
      }
    }

    // show the proper form page
    $(".form-page").hide();
    $("#" + data.div).parent().show();
  }

  return {
    "init": init,
    "updateContent": updateContent,
    "handleLoad": handleLoad,
    "resizeModal": resizeModal
  }
})();

  

/*var rank_hash = { 25: "unranked", 23: "kingdom", 22: "subkingdom",
      21: "superphylum", 20: "phylum", 19: "subphylum",
      18: "superclass", 17: "class", 16: "subclass", 15: "infraclass",
      14: "superorder", 13: "order", 12: "suborder", 11: "infraorder",
      10: "superfamily", 9: "family", 8: "subfamily",
      7: "tribe", 6: "subtribe", 5: "genus", 4: "subgenus",
      3: "species", 2: "subspecies" };
*/
function review() {
   // Enable the disabled
  var disabled = $("#uploadForm").find(':input:disabled').removeAttr('disabled');

  // Store the data
  var formData = $("#uploadForm").serializeObject();

   // Disable the enabled
  disabled.attr('disabled','disabled');
  
  var keys = Object.keys(formData);

  keys.forEach(function(d) {
    if (formData[d] !== "") {
      if (formData[d] === "na") {
        $("span#" + d).html(formData["new_" + d]).parent().show();
      } else {
        $("span#" + d).html(formData[d]).parent().show();
      }
    } else {
      if (d !== "collection_date_end") {
        $("span#" + d).parent().hide();
      }
    }
  });

  // Fill in image
  var source = $("#imageToUpload").attr("src")
  if (source.length > 0) {
    $("#photo").attr("src", source);

    var height = $("#imageToUpload").css("height");
    var width = $("#imageToUpload").css("width");
    if (height !== "0px") {
      $("#photo").css("height", height);
    } else {
      $("#photo").css("width", width);
    }
  }

  // Make sure required fields are shown with errors
  var required = ["family", "lat", "geom_basis_full", "collection_date_start"];
  required.forEach(function(d) {
    var val = $("[name=" + d + "]").val();
    if (val.length < 2) {
      $("span#" + d).html("Required. Please add a value").parent().show().css("color", "#a94442");
    } else {
      $("span#" + d).css("color", "#333");
    }
  });
}

function validate() {
  /*
  Family
  collection date
  Location
  location resolution

  */
  var family = $('[name=family]').val(),
      collection_date = $('[name=collection_date_start]').val(),
      lat = $('[name=lat]').val(),
      geom_basis = $('[name=geom_basis]').val();

  if (family.length < 1) {
    $("#familyGroup").addClass("has-error");
    alert("Please enter a valid taxon family on page 1");
    return false;
  } else {
    // Double check family
    $.ajax({
        type:'GET',
        url:'http://paleobiodb.org/data1.1/taxa/list.json?name=' + family + '&rel=synonyms&extant=true&show=attr', 
        dataType: 'json', 
        async: false,
        success: function(data) {
          if (data.records.length > 0) {
            $('#familyGroup').addClass("has-success");
            return true;
          } else {
            $("#familyGroup").addClass("has-error");
            alert("Family not found in PaleoDB. Please make sure the spelling is correct before continuing");
            return false;
          }
        } 
      }); // End family verify ajax
  }

  if (lat.length < 2) {
    alert("Please select a collection location on page 2");
    return false;
  }

  else if (geom_basis.length < 1) {
    $('[name=geom_basis]').parent().addClass("has-error");
    alert("Please select a location resolution on page 2");
    return false;
  }

  else if (collection_date.length < 10) {
    $('[name=collection_date_start]').parent().parent().addClass("has-error");
    alert("Please enter a valid collection date on page 3");
    return false;
  }
  else {
    //localStorage.setItem("formData", "");
    // Enable the disabled
    var disabled = $("#uploadForm").find(':input:disabled').removeAttr('disabled');

    return true;
  }

} // end function validate

/* For storing form values in localStorage 
   via http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery
*/
$.fn.serializeObject = function() {
  var object = { },
      array = this.serializeArray();
  $.each(array, function() {
      if (object[this.name] !== undefined) {
          if (!object[this.name].push) {
              object[this.name] = [object[this.name]];
          }
          object[this.name].push(this.value || '');
      } else {
          object[this.name] = this.value || '';
      }
  });
  return object;
};

function fillForm() {
  var $fields = $("#uploadForm :input"),
      keys = Object.keys($fields),
      savedData = localStorage.getItem("formData");

  if (savedData) {
    savedData = JSON.parse(savedData);

    keys.forEach(function(d) {
      var name = $fields[d].name;

      if (typeof(name) !== "undefined") {
        if (name.length > 1 && savedData[name] !== "" && typeof(savedData[name]) !== "undefined") {
          console.log(name + " = " + savedData[name]);
          // Handle the datepickers
          if (name.indexOf("date") > -1) {
            var id = $("[name=" + name + "]").parent().attr("id"),
                date = new Date(savedData[name]);

            $("#" + id).find("[name=" + name + "]").datepicker('update', date); 

          } else if (name.indexOf("lat") > -1 || name.indexOf("lng") > -1) {

            if (name.indexOf("photo") > -1) {
              if (name.indexOf("lat") > -1) {
                $("#selectedLatPhoto").html(savedData[name]);
              } else {
                $("#selectedLngPhoto").html(savedData[name]);
              }
              
              $("#selectedLocationPhoto").css("display", "inline");
              $("#photoLocationBtn").hide();
            } else {
              $("#selected" + name.charAt(0).toUpperCase() + name.slice(1)).html(savedData[name]);
              
              $("#selectedLocation").css("display", "inline");
              $("[data-toggle=#locationModal]").hide();
            }
            $("[name=" + name + "]").val(savedData[name]);

          } else {
            $("[name=" + name + "]").val(savedData[name]);
          }

          // If they entered a new something, show that input
          if (savedData[name] === "na") {
              $("#new" + name).show();
          }
          
        }
      }
    });
  }
    
}

$(document).ready(function() {
  uploadForm.init();
  fillForm();
  // On browser navigation, load the proper form
  window.addEventListener('popstate', function(event) {
    uploadForm.updateContent(event.state);
  });

  // If no form page specified, go to the first page
  if (window.location.pathname === "/addBeetle") {
    history.pushState({
      div: "taxon_info"
    }, document.title, "/addBeetle/taxon_info");

    uploadForm.updateContent(history.state);
  // Otherwise go to the requested form page
  } else {
    uploadForm.handleLoad(window.location.pathname);
  }


  uploadForm.resizeModal();
});

