var familyPage = (function() {

  var data = [],
      tablePartial = "",
      clusterLayer = new L.MarkerClusterGroup({ showCoverageOnHover: false });
  
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
      url:'/api/families?county=' + county + '&taxon_name=' + occurrence + '&collector=' + collector + '&order=' + order + '&family=' + family + '&genus=' + genus + '&species=' + species + '&oid=' + oid, 
      dataType: 'json', 
      async: false,
      success: function(result) {
        if (result.length > 0) {
          var data = {};
          data.families = result.slice(0);
          if (tablePartial.length < 1) {
            $.ajax({
              type: 'GET',
              url: '/partials/family_table.html',
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

  function init() {

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

    getData();
  }

  return {
    "init": init,
    "data": data,
    "tablePartial": tablePartial,
    "getData": getData
  }
})();

familyPage.init();


var margin = {top: 20, right: 30, bottom: 30, left: 30},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var x = d3.scale.ordinal()
    .rangeRoundBands([0, width], .1);

var y = d3.scale.linear()
    .range([height, 0]);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    .ticks(10, "");

var svg = d3.select("#graph").append("svg")
    .attr("id", "graphsvg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("id", "graphgroup")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("/api/calendar" + window.location.search, function(error, data) {
  data.map(function(d) {
    if (!d.count) {
      d.count = 0;
    }
    d.count = parseInt(d.count);
    return d;
  });

  x.domain(data.map(function(d) { return d.month_name; }));
  y.domain([0, d3.max(data, function(d) { return d.count; })]);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Occurrences");

  svg.selectAll(".bar")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.month_name); })
      .attr("width", x.rangeBand())
      .attr("y", function(d) { return y(d.count); })
      .attr("height", function(d) { return height - y(d.count); });

  resizeGraph();
});

function resizeGraph() {

  var scale = d3.select("#graph").style("width").replace("px", "");
  var multiplier = d3.select("#graph").style("height").replace("px", "");
  d3.select("#graphgroup").attr("transform", "scale(" + scale/900 + ")translate(" + margin.left + "," + margin.top + ")");
  //d3.select("#graphsvg").attr("height", multiplier*0.54);
}
d3.select(window).on("resize", resizeGraph);
