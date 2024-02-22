package com.example.megasena;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;

import java.util.Random;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        int numero1, numero2, numero3, numero4, numero5, numero6;
        
        

    }

    // Método para sortear 6 números diferentes entre 1 e 60

    public void sortearNumeros() {
        Random random = new Random();
        int numero;

        for (int i = 0; i < 6; i++) {
            numero = random.nextInt(60) + 1;
            System.out.println("Número " + (i + 1) + ": " + numero);
        }
    }

    
    

}