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
          if (dataset === "taxon_name" || dataset === "county") {
            window.location = "/occurrences?" + dataset + "=" + suggestion.name;
          } else {
            window.location = "/occurrences?collector=" + suggestion.last_name;
          }
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