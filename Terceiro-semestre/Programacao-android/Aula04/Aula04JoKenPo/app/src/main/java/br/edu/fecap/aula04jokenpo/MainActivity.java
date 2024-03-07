package br.edu.fecap.aula04jokenpo;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import java.util.Random;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
    }

    public void selectPapel(View view){
        this.opcaoSelect("Papel");

    }

    public void selectPedra(View view){
        this.opcaoSelect("Pedra");
    }

    public void selectTesoura(View view){
        this.opcaoSelect("Tesoura");
    }

    public void opcaoSelect(String opcaoSelect){

        ImageView imgResultado = findViewById(R.id.imgDefault);
        TextView textResultado = findViewById(R.id.textResult);

        int numero = new Random().nextInt(3);
        String[] opcoes = {"Pedra", "Papel", "Tesoura"};
        String opcaoApp = opcoes[numero];

        switch (opcaoApp){
            case "Pedra":
                imgResultado.setImageResource(R.drawable.pedra);
                break;
            case "Papel":
                imgResultado.setImageResource(R.drawable.papel);
                break;
            case "Tesoura":
                imgResultado.setImageResource(R.drawable.tesoura);
                break;
        }

        if(
                (opcaoApp == "Tesoura" && opcaoSelect == "Papel")||
                (opcaoApp == "Papel" && opcaoSelect == "Pedra")  ||
                (opcaoApp == "Pedra" && opcaoSelect == "Tesoura")
        ){
            textResultado.setText("DERROTA!");
        }
        else if (
                (opcaoSelect == "Tesoura" && opcaoApp == "Papel")||
                (opcaoSelect == "Papel" && opcaoApp == "Pedra")  ||
                (opcaoSelect == "Pedra" && opcaoApp == "Tesoura")
        ){
            textResultado.setText("VITÓRIA!");
        }
        else{
            textResultado.setText("EMPATE!");
        }

    }
}