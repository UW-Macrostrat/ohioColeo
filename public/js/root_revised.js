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
    return value > 20 ? "#045a8d" :
           value > 15 ? "#2b8cbe" :
           value > 10 ? "#74a9cf" :
           value > 5  ? "#bdc9e1" :
           value > 0  ? "#f1eef6" :
                        "#333";
  }

  function init() {


    $("#collectorFilter").change(function() {
      indexPage.getData();
    });


    var map = L.map('map', {
      center: new L.LatLng(40.2, -82.9),
      zoom: 7,
      minZoom: 7,
      maxZoom: 13,
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
      this.div.innerHTML += "<strong>" + attrs.count + ((attrs.count == 1) ? " family" : " families") +  "</strong>";
    }

    info.addTo(map);

    var clusterLayer = new L.MarkerClusterGroup({ showCoverageOnHover: false });

    map.on("zoomend", function() {
      if (map.getZoom() > 9) {
        map.addLayer(clusterLayer);
        map.removeLayer(counties);
      } else {
        if (map.hasLayer(clusterLayer)) {
          map.removeLayer(clusterLayer);
          map.addLayer(counties);
        }
      }
    });


    $.getJSON("/api/map", function(data) {
      counties = L.geoJson(data, {
        style: function(feature) {
          return {
            "color": "#333",
            "weight": "1",
            "opacity": "0.5",
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
              $.getJSON("/api/families?county=" + layer.feature.properties.name, function(data) {
                var content = "<h4>" + layer.feature.properties.name + " County</h4>";

                if (data.length > 0 && data[0].taxon_family.length > 0) {
                  content += "<br><strong>Families:</strong><br>";

                  data.forEach(function(d) {
                    content += d.taxon_family + " (" + d.count + ")<br>";
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
    
    $.getJSON("/api/occurrences", function(data) {

      data.forEach(function(d) {
        var geometry = d.geometry.split(" ");
        var marker = new L.Marker([parseFloat(geometry[0]), parseFloat(geometry[1])])
                          .bindPopup("<strong>Taxon:</strong> <a href='/occurrences?oid=" + d.id + "'>" + d.taxon_name + "</a><br><strong>Specimens: </strong>" + d.n_total_specimens + "<br><strong>Collector: </strong>" + d.collector);
        clusterLayer.addLayer(marker);
      });

      //clusterLayer.addTo(map);
    });

    $.getJSON("/api/stats", function(data) {
      $("#families").html(data[0].families + " families");
      $("#occurrences").html(data[0].occurrences + " occurrences");
      $("#photos").html(data[0].photos + " photos");
      $("#contributors").html(data[0].contributors + " contributors");

      data.forEach(function(d, i) {
        $("#family-image-" + (i + 1)).css("background-image", "url(/images/main/" + d.image_id + ".jpg)");
        $("#family-desc-" + (i + 1)).html("<a href='/occurrences?family=" + d.taxon_family + "'>" + d.taxon_family + "</a>");
      });
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

