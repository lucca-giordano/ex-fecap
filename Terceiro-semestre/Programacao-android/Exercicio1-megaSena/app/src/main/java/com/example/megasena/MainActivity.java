package com.example.megasena;

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Random;

public class MainActivity extends AppCompatActivity {

    private Button btnPlay;
    private TextView textResult;

    Random random = new Random();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        btnPlay = findViewById(R.id.btnPlay);
        textResult = findViewById(R.id.textResult);

        btnPlay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                ArrayList<Integer> numbers = new ArrayList<>();
                while (numbers.size() < 6) {
                    int number = random.nextInt(60) + 1;
                    if (!numbers.contains(number)) {
                        numbers.add(number);
                    }
                    Collections.sort(numbers);
                    String result = "";
                    for (int num : numbers) {
                        result += num + " ";
                    }
                    textResult.setText(result);
                }
            }
        });

    }

    // Método para sortear 6 números diferentes entre 1 e 60


}