document.addEventListener('DOMContentLoaded', function(){
    const button = document.querySelector('button');
    const themeStatus = document.getElementById('themeStatus');

    button.onclick = function(){

        if(document.body.classList.contains("darkTheme")){
            document.body.classList.remove("darkTheme");
            themeStatus.textContent = "Modo: Claro";
        }
        else{
            document.body.classList.add("darkTheme");
            themeStatus.textContent = "Modo: Escuro";
        }
    };
});