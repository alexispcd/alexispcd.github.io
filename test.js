let myHeading = document.querySelector('h1');
let myImage = document.querySelector('img');
let myButton = document.querySelector('button');

myHeading.textContent = "hello world";

myImage.addEventListener('click', function () {
	let mySrc = myImage.getAttribute('src');
	if (mySrc === 'index.jpeg') {
		myImage.setAttribute('src', 'index2.jpeg');
	} else {
		myImage.setAttribute('src', 'index.jpeg');
	}
});

function setUserName() {
	let myName = prompt('Veuillez saisir vorte nom : ');
	localStorage.setItem('nom', myName);
	myHeading.textContent = 'Salut '+ myName;
}

if (!localStorage.getItem('nom')) {
	setUserName();
} else {
	let storedName = localStorage.getItem('nom');
	myHeading.textContent = 'Salut '+ storedName;
}

myButton.addEventListener('click', function () {
	setUserName();
});