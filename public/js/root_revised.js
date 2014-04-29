var indexPage = (function() {
  var data = [],
      tablePartial = "";

  function getData() {
    var county = ($("#countyFilter").val() === "0") ? "" : $("#countyFilter").val(),
        collector = ($("#collectorFilter").val() === "0") ? "" : $("#collectorFilter").val(),
        query = "";

    if (county.length > 0) {
      query += "county=" + county;
    }
    if (collector.length > 0) {
      if (query.length > 0) {
        query += "&collector=" + collector;
      } else {
        query += "collector=" + collector;
      }
    }

    $.ajax({
      type:'GET',
      url:'/api/occurrences?' + query, 
      dataType: 'json', 
      async: false,
      success: function(result) {
        var data = {};
        data.occurrences = result.slice(0);
        updateMap(data.occurrences);
        if (tablePartial.length < 1) {
          $.ajax({
            type: 'GET',
            url: '/partials/occurrence_table.html',
            async: false,
            success: function(partial) {
              tablePartial = partial;
              var output = Mustache.render(partial, data);

              $("#resultTbody").html(output);
            }
          });
        } else {
          var output = Mustache.render(tablePartial, data);
          $("#resultTbody").html(output);
        }
          
      }
    });
  }

  function updateMap(data) {


  }

  function choropleth(value) {
    return value > 20 ? "#294E2F" :
           value > 15 ? "#3B6C44" :
           value > 10 ? "#4E8D59" :
           value > 5  ? "#63AF70" :
           value > 0  ? "#78D287" :
                        "#bbb";
  }

  function init() {


    $("#collectorFilter").change(function() {
      indexPage.getData();
    });


    var map = L.map('map', {
      center: new L.LatLng(40.2, -82.9),
      zoom: 7,
      minZoom: 7,
      maxZoom: 9,
      maxBounds: [
        [37, -86],
        [43, -80]
      ]
    });

    // add an OpenStreetMap tile layer
    L.tileLayer(  
      'http://{s}.acetate.geoiq.com/tiles/acetate/{z}/{x}/{y}.png', {
      attribution: 'Acetate tileset from GeoIQ'  
    }).addTo(map);

    var info = L.control({position: 'bottomleft'});

    info.onAdd = function(map) {
        this.div = L.DomUtil.create('div', 'info');
        this.div.innerHTML = "<strong>Mouse over a county for more info</strong>";
        return this.div;
    };

    info.update = function(attrs) {
      this.div.innerHTML = "<h4>" + attrs.name + "</h4>";
      this.div.innerHTML += "<strong>" + attrs.count + " occurrence(s)</strong>";
    }

    info.addTo(map);


    $.getJSON("/api/map", function(data) {
      var counties = L.geoJson(data, {
        style: function(feature) {
          return {
            "color": "#777",
            "weight": "1",
            "opacity": "1",
            "fillOpacity": 0.5,
            "fillColor": choropleth(feature.properties.count)
          }
        },
        onEachFeature: function(feature, layer) {
          layer.on({
            mouseover: function(e) {
              e.target.setStyle({
                "color": "#333",
                "weight": "1.5"
              });

              e.target.bringToFront();

              info.update(layer.feature.properties);
            },
            mouseout: function(e) {
              counties.resetStyle(e.target);
            },
            click: function(e) {
              $.getJSON("/api/occurrences?county=" + layer.feature.properties.name, function(data) {
                var content = "<h4>" + layer.feature.properties.name + " County</h4>";

                if (data.length > 0 && data[0].taxon_name.length > 0) {
                  content += "<br><strong>Occurrences:</strong><br>";

                  var occurrences = {};
                  data.forEach(function(d) {
                    if (occurrences[d.taxon_name]) {
                      occurrences[d.taxon_name] += 1;
                    } else {
                      occurrences[d.taxon_name] = 1
                    }
                  });

                  Object.keys(occurrences).forEach(function(d) {
                    content += d + " (" + occurrences[d] + ")<br>";
                  });
                }

                content += "<br><a href='/occurrences?county=" + layer.feature.properties.name + "'>More info</a>"

                layer.bindPopup(content).openPopup();
              });
            }
          });

          
        }
      }).addTo(map);
    });
  }

  return {
    "init": init,
    "data": data,
    "tablePartial": tablePartial,
    "getData": getData
  }
})();

indexPage.init();

