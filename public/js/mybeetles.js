var occPage = (function() {

  var data = [],
      tablePartial = "",
      clusterLayer = new L.MarkerClusterGroup({ showCoverageOnHover: false });

  function getData() {
    var county = getSearchVar("county"),
        occurrence = getSearchVar("taxon_name"),
        collector = getSearchVar("collector"),
        order = getSearchVar("order"),
        family = getSearchVar("family"),
        genus = getSearchVar("genus"),
        species = getSearchVar("species"),
        oid = getSearchVar("oid");

    // Slop the URL together, as empty params are ignored in the api
    $.ajax({
      type:'GET',
      url:'/api/occurrences?county=' + county + '&taxon_name=' + occurrence + '&collector=' + collector + '&order=' + order + '&family=' + family + '&genus=' + genus + '&species=' + species + '&oid=' + oid, 
      dataType: 'json', 
      async: false,
      success: function(result) {
        if (result.length > 0 && result[0].id !== "") {
          var data = {};
          data.occurrences = result.slice(0);
          updateMap(data.occurrences);
          if (tablePartial.length < 1) {
            $.ajax({
              type: 'GET',
              url: '/partials/mybeetles_table.html',
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
        } else {
          $("#resultTable").html("<h3>No results found</h3>");
        }
  
          
      }
    });
  }

  function updateMap(data) {
    clusterLayer.clearLayers();

    var fips_hash = {};

    data.forEach(function(d) {
      if (fips_hash.hasOwnProperty(d.fips)) {
        fips_hash[d.fips] += 1;
      } else {
        fips_hash[d.fips] = 1;
      }

      var geometry = d.geometry.split(" ");
      var marker = new L.Marker([parseFloat(geometry[0]), parseFloat(geometry[1])])
                        .bindPopup("<strong>Taxon:</strong> " + d.taxon_name + "<br><strong>Specimens: </strong>" + d.n_total_specimens + "<br><strong>Collector: </strong>" + d.collector);
      clusterLayer.addLayer(marker);
    });

    countyData = [];
    $.getJSON("/api/map", function(data) {
      countyData = data;
      addCounties(countyData, fips_hash);
      console.log(fips_hash)
    });


  }

  function init() {
    $("#countyFilter").change(function() {
      occPage.getData();
    });

    $("#collectorFilter").change(function() {
      occPage.getData();
    });

    counties = "";

    map = L.map('map', {
      center: new L.LatLng(40.2, -82.9),
      zoom: 7,
      minZoom: 7,
      maxZoom: 11
    });

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

    // add an OpenStreetMap tile layer
    L.tileLayer(  
      'http://{s}.acetate.geoiq.com/tiles/acetate/{z}/{x}/{y}.png', {
      attribution: 'Acetate tileset from GeoIQ'  
    }).addTo(map);

    $('a[href="#mapPanel"]').on("shown.bs.tab", function() {
      map.invalidateSize();
    });

    if (getSearchVar("county").length > 2) {
      $.getJSON("/api/map/bounds?county=" + getSearchVar("county"), function(data) {
        var bounds = JSON.parse(data[0].bounds);

        map.fitBounds([
          [bounds.coordinates[0][0][1], bounds.coordinates[0][0][0]],
          [bounds.coordinates[0][2][1], bounds.coordinates[0][2][0]]
        ]);
      });
    }

    //clusterLayer.addTo(map);

    

    getData();
  }

  return {
    "init": init,
    "data": data,
    "tablePartial": tablePartial,
    "getData": getData
  }
})();

function addCounties(data, fips_hash) {
  if (map.hasLayer(counties)) {
    map.removeLayer(counties);
  }

  if (fips_hash) {
    Object.keys(fips_hash).forEach(function(d) {
      data.features.forEach(function(j) {
        if (j.properties.fips == d) {
          j.properties.count = fips_hash[d];
        } else {
          if (!fips_hash.hasOwnProperty(j.properties.fips)) {
            j.properties.count = 0;
          }
          
        }
      });
    });
  }

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

        },
        mouseout: function(e) {
          counties.resetStyle(e.target);
        },
        click: function(e) {
          $.getJSON("/api/occurrences?county=" + layer.feature.properties.name + "&family=" + getSearchVar("family"), function(data) {
            var content = "<h4>" + layer.feature.properties.name + " County</h4>";

            if (data.length > 0 && data[0].taxon_family.length > 0) {
              content += "<br><strong>Occurrences:</strong><br>";

              data.forEach(function(d) {

                var taxon = ""
                if (d.taxon_species) {
                  taxon += "<i>" + d.taxon_genus + " " + d.taxon_species + "</i>";
                } else {
                  taxon += d.taxon_name;
                }
                content += taxon + "<br>";
              });
            }

            content += "<br><a href='/occurrences?county=" + layer.feature.properties.name + "'>More info</a>"

            layer.bindPopup(content).openPopup();
          });
        }
      });

      
    }
  }).addTo(map);
}

/* Via https://developer.mozilla.org/en-US/docs/Web/API/Window.location , example #6 */
function getSearchVar(variable) {
  return decodeURI(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURI(variable).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

function choropleth(value) {
    return value > 20 ? "#045a8d" :
           value > 15 ? "#2b8cbe" :
           value > 10 ? "#74a9cf" :
           value > 5  ? "#bdc9e1" :
           value > 0  ? "#f1eef6" :
                        "#333";
  }

occPage.init();
