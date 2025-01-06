const bar =document.getElementById('bar');
const nav =document.getElementById('navbar');
const close=document.getElementById('close');

if(bar){
    bar.addEventListener('click',()=>{
        nav.classList.add( 'active');
    })
}

if(close){
    close.addEventListener('click',()=>{
        nav.classList.remove( 'active');
    })
}

function updateHeaderForUser() {
    const userEmail = localStorage.getItem('userEmail');
    const username = localStorage.getItem('username');
    
    if (userEmail) {
        // User is logged in
        const navbar = document.getElementById('navbar');
        const loginButton = navbar.querySelector('.login');
        if (loginButton) {
            loginButton.innerHTML = `<a href="#">${username}</a>`;
        }
        
        // Add logout option
        const logoutLi = document.createElement('li');
        logoutLi.innerHTML = '<a href="#" id="logout">Logout</a>';
        navbar.appendChild(logoutLi);
        
        document.getElementById('logout').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('userEmail');
            localStorage.removeItem('username');
            window.location.reload();
        });
    }
}

// Add this function to check authentication
function checkAuth() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        const currentPage = window.location.pathname;
        if (currentPage.includes('cart.html')) {
            sessionStorage.setItem('previousPage', currentPage);
            window.location.href = '/login.html';
        }
    }
}

// Call this on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateHeaderForUser();
});

// Update the logout function
function logout() {
    fetch('/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('username');
            window.location.href = '/index.html';
        })
        .catch(error => console.error('Error:', error));
}