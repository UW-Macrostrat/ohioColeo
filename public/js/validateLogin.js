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