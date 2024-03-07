package br.edu.fecap.aula04views;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.CheckBox;
import android.widget.TextView;

public class MainActivity extends AppCompatActivity {

    private TextView campoResultado;
    private CheckBox checkVermelho, checkVerde, checkAzul;

    @Override
    protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        campoResultado = findViewById(R.id.textResultado);
        checkVermelho = findViewById(R.id.checkVermelho);
        checkVerde = findViewById(R.id.checkVerde);
        checkAzul = findViewById(R.id.checkAzul);

    }

    public void limpar(View view){
        campoResultado.setText("Resultado");

    }

    public void checkBox(){
        String texto = "";
        if(checkVermelho.isChecked()){
            texto = " Vermelho OK";
        }
        if(checkVerde.isChecked()){
            texto = texto + " Verde OK";
        }
        if(checkAzul.isChecked()){
            texto = texto + " Azul OK";
        }

        campoResultado.setText(texto);
    }

    public void enviar(View view){
        checkBox();

    }

}