package br.edu.fecap.aula06_switch;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.ToggleButton;

public class MainActivity extends AppCompatActivity {

    //Atributo dos componentes Switch
    private ToggleButton toggleButtonSenha;
    private Switch switchSenha;
    private TextView textoResultado;

    // Atributos dos componentes SeekBar
    private SeekBar barraProgresso;
    private Button btnRecuperar;
    private TextView textoFelicidade;

    private boolean isProgress = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Atribuição Switch
        toggleButtonSenha = findViewById(R.id.btnToggle);
        switchSenha = findViewById(R.id.Switch1);
        textoResultado = findViewById(R.id.textResult);

        // Atribuição SeekBar
        barraProgresso = findViewById(R.id.barraProgresso);
        btnRecuperar = findViewById(R.id.btnReset);
        textoFelicidade = findViewById(R.id.textResult2);

        ouvinteSwitch();
        ouvinteSeek();

    }


    public void ouvinteSwitch(){
        switchSenha.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton compoundButton, boolean b) {
                if(b){
                    textoResultado.setText("Ligado");
                }else{
                    textoResultado.setText("Desligado");
                }
            }
        });
    }

    public void ouvinteSeek(){
        barraProgresso.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                textoFelicidade.setText("Felicidade: " + progress);
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
            }
        });
    }

    public void recuperarDados(View view){
        textoFelicidade.setText("Valor escolhido: " + barraProgresso.getProgress());
    }

}

