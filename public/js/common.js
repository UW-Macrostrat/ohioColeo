// Common to all pages. Contains autocomplete search and login validation code

(function() {
  function prefetch(type, callback) {
    $.ajax({
      url: "/api/autocomplete/" + type,
      success: callback
    });
  }
  
// Bleeegh. Ugly, but the best way I could figure out how to do it given typeahead.js's broken prefetch ability
// Bug report filed here - https://github.com/twitter/typeahead.js/issues/835
  prefetch("taxa", function(data) {

    var taxaEngine = new Bloodhound({
      datumTokenizer: function(d) {
        return Bloodhound.tokenizers.whitespace(d.name);
      },
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      local: data
    });

    taxaEngine.initialize();

    prefetch("order", function(data) {
      var orderEngine = new Bloodhound({
        datumTokenizer: function(d) {
          return Bloodhound.tokenizers.whitespace(d.name);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: data
      });

      orderEngine.initialize();

      prefetch("family", function(data) {
        var familyEngine = new Bloodhound({
          datumTokenizer: function(d) {
            return Bloodhound.tokenizers.whitespace(d.name);
          },
          queryTokenizer: Bloodhound.tokenizers.whitespace,
          local: data
        });

        familyEngine.initialize();

        prefetch("genus", function(data) {
          var generaEngine = new Bloodhound({
            datumTokenizer: function(d) {
              return Bloodhound.tokenizers.whitespace(d.name);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: data
          });

          generaEngine.initialize();

          prefetch("species", function(data) {
            var speciesEngine = new Bloodhound({
              datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.name);
              },
              queryTokenizer: Bloodhound.tokenizers.whitespace,
              local: data
            });

            speciesEngine.initialize();

            prefetch("collectors", function(data) {

                var collectorsEngine = new Bloodhound({
                  datumTokenizer: function(d) {
                    return Bloodhound.tokenizers.whitespace(d.name);
                  },
                  queryTokenizer: Bloodhound.tokenizers.whitespace,
                  local: data
                });

                collectorsEngine.initialize();

                prefetch("counties", function(data) {
                  var countiesEngine = new Bloodhound({
                    datumTokenizer: function(d) {
                      return Bloodhound.tokenizers.whitespace(d.name);
                    },
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    local: data
                  });

                  countiesEngine.initialize();

                  $('[name=searchInput]').typeahead(null, 
                  {
                    name: "taxon_name",
                    displayKey: 'name',
                    source: taxaEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Taxa</h5>"
                    }
                  },
                  {
                    name: "order",
                    displayKey: 'name',
                    source: orderEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Orders</h5>"
                    }
                  },
                  {
                    name: "family",
                    displayKey: 'name',
                    source: familyEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Families</h5>"
                    }
                  },
                  {
                    name: "species",
                    displayKey: 'name',
                    source: speciesEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Species</h5>"
                    }
                  },
                  {
                    name: "genus",
                    displayKey: 'name',
                    source: generaEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Genera</h5>"
                    }
                  },
                  {
                    name: "collector",
                    displayKey: 'name',
                    source: collectorsEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Collectors</h5>"
                    }
                  },
                  {
                    name: "county",
                    displayKey: 'name',
                    source: countiesEngine.ttAdapter(),
                    templates: {
                      header: "<h5 class='autocompleteCategory'>Counties</h5>"
                    }
                  });

                  $('[name=searchInput]').on("typeahead:selected", function(event, suggestion, dataset) {
                    if (dataset !== "collector") {
                      window.location = "/occurrences?" + dataset + "=" + suggestion.name;
                    } else {
                      window.location = "/occurrences?collector=" + suggestion.last_name;
                    }
                  });
                });
              });
          });
        });
      });
    });     
  });
 })();

 function validateLogin() {
  
  var email = $('#emailInput').val(),
      password = $('#passwordInput').val();

  if (!validator.isEmail(email)) {
    $('#emailGroup').addClass('has-error');
    $('#email.help-inline').html("Invalid email address format");
    return false;
  } else {
    $.ajax({
      type:'POST',
      url:'/verify?email=' + encodeURIComponent(email), 
      dataType: 'json', 
      async: false,
      success: function(data) {
        if (!data) {
          $('#emailGroup').addClass('has-error');
          $('#email.help-inline').html("Invalid email address");
          return false;
        } else {
          $('#emailGroup').addClass('has-success');
          $('#email.help-inline').html('');

          if (password.length < 1) {
            $('#passwordGroup').addClass('has-error');
            $('#password.help-inline').html("Please enter a password");
            return false;
          } else {
            $.ajax({
              type:'POST',
              url:'/verify?email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password),
              dataType: 'json', 
              async: false,
              success: function(data) {
                if (!data) {
                  $('#passwordGroup').addClass('has-error');
                  $('#password.help-inline').html('Invalid password. Please try again.');
                } else {
                  $('#passwordGroup').addClass('success');
                  $('#password.help-inline').html('');
                  document.getElementById("loginForm").submit();
                  return true;
                }
              } 
            }); // End password verify ajax
          }
        }
      } 
    }); // End email verify ajax
    return false;
  } // End else
} // End function validate