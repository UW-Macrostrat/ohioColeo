var occPage = (function() {

  var data = [],
      tablePartial = "",
      clusterLayer = new L.MarkerClusterGroup({ showCoverageOnHover: false });
  
  /* Via https://developer.mozilla.org/en-US/docs/Web/API/Window.location , example #6 */
  function getSearchVar(variable) {
    return decodeURI(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURI(variable).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
  }

  function getData() {
    var county = getSearchVar("county"),
        occurrence = getSearchVar("taxon_name"),
        collector = getSearchVar("collector");

    // Slop the URL together, as empty params are ignored in the api
    $.ajax({
      type:'GET',
      url:'/api/occurrences?county=' + county + '&taxon_name=' + occurrence + '&collector=' + collector, 
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
    clusterLayer.clearLayers();

    data.forEach(function(d) {
      var geometry = d.geometry.split(" ");
      var marker = new L.Marker([parseFloat(geometry[0]), parseFloat(geometry[1])])
                        .bindPopup("<strong>Taxon:</strong> " + d.taxon_name + "<br><strong>Specimens: </strong>" + d.n_total_specimens + "<br><strong>Collector: </strong>" + d.collector);
      clusterLayer.addLayer(marker);
    });

  }

  function init() {
    $("#countyFilter").change(function() {
      occPage.getData();
    });

    $("#collectorFilter").change(function() {
      occPage.getData();
    });


    var map = L.map('map', {
      center: new L.LatLng(40.2, -82.9),
      zoom: 7,
      minZoom: 7,
      maxZoom: 11
    });

    // add an OpenStreetMap tile layer
    L.tileLayer(  
      'http://{s}.acetate.geoiq.com/tiles/acetate/{z}/{x}/{y}.png', {
      attribution: 'Acetate tileset from GeoIQ'  
    }).addTo(map);

    $('a[href="#mapPanel"]').on("shown.bs.tab", function() {
      map.invalidateSize();
    });

    clusterLayer.addTo(map);

    getData();
  }

  return {
    "init": init,
    "data": data,
    "tablePartial": tablePartial,
    "getData": getData
  }
})();

occPage.init();
