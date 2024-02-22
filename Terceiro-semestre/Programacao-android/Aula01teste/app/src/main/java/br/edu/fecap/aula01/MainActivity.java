package br.edu.fecap.aula01;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;

import java.util.Scanner;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        //ANALOGIA - DECLARAÇÃO DE UM OBJETO
        Casa minhaCasa = new Casa();
        minhaCasa.cor = "Vermelha";

        //Exibir o conteúdo (propriedades) do objeto
        System.out.println(minhaCasa.cor);

        //Chamar método externo
        minhaCasa.abrirPorta();

    }
}