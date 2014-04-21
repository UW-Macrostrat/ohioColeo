function validate() {
  
  var email = $('input[name=email]').val(),
      password = $('input[name=password]').val();

  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>( [\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var validEmailFormat = re.test(email);

  if (validEmailFormat == false) {
    $('#email.control-group').addClass('error');
    $('#email.help-inline').html("Invalid email address format");
    return false;
  } else {
    $.ajax({
      type:'POST',
      //url:'/verify?email=' + encodeURIComponent(email),  Uncomment for production
      url:'/verify?email=' + encodeURIComponent(email), 
      dataType: 'jsonp', 
      async: false,
      success: function(data) {
        emailExists = data;
        if (emailExists == false) {
          $('#email.control-group').addClass('error');
          $('#email.help-inline').html("Invalid email address");
          return false;
        } else {
          $('#email.control-group').addClass('success');
          $('#email.help-inline').html('');

          if ($('input[name=password]').val().length < 1) {
            $('#password.control-group').addClass('error');
            $('#password.help-inline').html("Please enter a password");
            return false;
          } else {
            $.ajax({
              type:'POST',
             // url:'/verify?email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password), Uncomment for production
              url:'/verify?email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password),
              dataType: 'jsonp', 
              async: false,
              success: function(data) {
                passwordExists = data;
                if (passwordExists == false) {
                  $('#password.control-group').addClass('error');
                  $('#password.help-inline').html('Invalid password. Please try again.');
                } else {
                  $('#password.control-group').addClass('success');
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