import {sum} from "./functions";

$(document).ready(function() {
    $('#calculateBtn').click(function() {
        const num1 = $('#number1').val();
        const num2 = $('#number2').val();
        const result = sum(num1, num2);
        $('#result').html(`Result: ${result}`);
    });
});