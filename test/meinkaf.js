let num1 = 10;
let num2 = 5;

function multiplication(a, b) {
    return a * b;
}

function resta(a, b) {
    return a - b;
}

function division(a, b) {
    return a / b;
}

let result = resta(num1, num2);
let result1 = division(num1, num2);
let result2 = multiplication(num1, num2);
document.getElementById("result").textContent = result;
document.getElementById("result1").textContent = result1;
document.getElementById("result2").textContent = result2;